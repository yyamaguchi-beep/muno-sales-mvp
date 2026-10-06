import type { Config } from "../config.js";
import { addDays, localDateString } from "../utils/date.js";
import { AmbiguousResultError, FatalError, HttpError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";
import { normalize } from "../utils/text.js";
import { GOOGLE_HINTS, googleFetch, refresherFor } from "./auth.js";
import { getLocation } from "./location.js";
import { evaluateLocation } from "./match.js";

/**
 * Local Posts は v4 (mybusiness.googleapis.com) にのみ存在する (v1 へ移行されていない)。
 * POST https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/localPosts
 */
const V4 = "https://mybusiness.googleapis.com/v4";

export interface LocalPostPayload {
  languageCode: string;
  summary: string;
  topicType: "STANDARD";
  callToAction?: { actionType: "LEARN_MORE"; url: string };
  media?: { mediaFormat: "PHOTO"; sourceUrl: string }[];
}

export interface LocalPost {
  name: string; // accounts/{a}/locations/{l}/localPosts/{id}
  languageCode?: string;
  summary?: string;
  state?: "LOCAL_POST_STATE_UNSPECIFIED" | "REJECTED" | "LIVE" | "PROCESSING";
  createTime?: string;
  updateTime?: string;
  searchUrl?: string;
  topicType?: string;
}

export function buildPayload(cfg: Config, caption: string, imageUrl: string | null, useCta: boolean): LocalPostPayload {
  const payload: LocalPostPayload = {
    languageCode: cfg.GBP_LANGUAGE_CODE,
    summary: caption,
    topicType: "STANDARD",
  };
  if (useCta) payload.callToAction = { actionType: "LEARN_MORE", url: cfg.WEBSITE_URL };
  if (imageUrl) payload.media = [{ mediaFormat: "PHOTO", sourceUrl: imageUrl }];
  return payload;
}

function parentPath(cfg: Config): string {
  if (!/^\d+$/.test(cfg.GBP_ACCOUNT_ID) || !/^\d+$/.test(cfg.GBP_LOCATION_ID)) {
    throw new FatalError("GBP_ACCOUNT_ID / GBP_LOCATION_ID が未設定または不正です。`npm run find-location -- --write` で設定してください。");
  }
  return `accounts/${cfg.GBP_ACCOUNT_ID}/locations/${cfg.GBP_LOCATION_ID}`;
}

/** 誤投稿防止: 投稿直前に、設定された LOCATION が本当に GLOW WORKS 生野 かを API で再確認 */
export async function verifyTargetLocation(cfg: Config): Promise<{ title: string; address: string }> {
  parentPath(cfg);
  const loc = await getLocation(cfg, cfg.GBP_LOCATION_ID);
  const m = evaluateLocation(loc, cfg.GBP_EXPECTED_NAME, cfg.GBP_EXPECTED_ADDRESS);
  if (!m.nameMatch || !m.addressMatch) {
    throw new FatalError(
      `投稿先の店舗が想定と一致しません。誤投稿防止のため停止します。取得: 「${loc.title ?? "?"}」${m.address} / 期待: 「${cfg.GBP_EXPECTED_NAME}」${cfg.GBP_EXPECTED_ADDRESS}`,
    );
  }
  return { title: loc.title ?? "", address: m.address };
}

export async function listRecentPosts(cfg: Config, pageSize = 20): Promise<LocalPost[]> {
  const res = await withRetry(
    () => googleFetch<{ localPosts?: LocalPost[] }>(cfg, `${V4}/${parentPath(cfg)}/localPosts?pageSize=${pageSize}`),
    { label: "投稿一覧取得", maxAttempts: 3, onUnauthorized: refresherFor(cfg), hints: GOOGLE_HINTS },
  );
  return res.localPosts ?? [];
}

/**
 * 同じ本文の投稿がすでに存在するか (タイムアウト後・再実行時の二重投稿防止)。
 * 日付をまたいだ再試行でも検出できるよう、対象日の前日以降に作成された同一本文を一致とみなす。
 */
export async function findExistingPost(cfg: Config, date: string, caption: string): Promise<LocalPost | null> {
  const target = normalize(caption);
  const posts = await listRecentPosts(cfg);
  const since = addDays(date, -1);
  return (
    posts.find(
      (p) =>
        p.summary !== undefined &&
        normalize(p.summary) === target &&
        (!p.createTime || localDateString(new Date(p.createTime), cfg.TIMEZONE) >= since),
    ) ?? null
  );
}

/**
 * 投稿を作成する。冪等性のため:
 *  - 作成前にリモートに同一本文の当日投稿がないか確認
 *  - タイムアウト/5xx 後の再試行前にも再確認 (Google 側で作成済みなら再送しない)
 *  - 最大3回・指数バックオフ・429 は Retry-After を尊重・401 はトークン更新・403 は即停止
 */
export async function createLocalPost(cfg: Config, date: string, payload: LocalPostPayload): Promise<{ post: LocalPost; recovered: boolean }> {
  const parent = parentPath(cfg);

  const existing = await findExistingPost(cfg, date, payload.summary);
  if (existing) {
    logger.warn(`同一本文の投稿が既に存在します (${existing.name})。再投稿せず成功として扱います。`);
    return { post: existing, recovered: true };
  }

  let recovered = false;
  const post = await withRetry<LocalPost>(
    async (attempt) => {
      if (attempt > 1) {
        const again = await findExistingPost(cfg, date, payload.summary);
        if (again) {
          recovered = true;
          return again;
        }
      }
      try {
        return await googleFetch<LocalPost>(cfg, `${V4}/${parent}/localPosts`, { method: "POST", body: payload, timeoutMs: 90_000 });
      } catch (err) {
        if (err instanceof HttpError) throw err;
        // ネットワーク断・タイムアウト: Google 側で作成済みの可能性 → 次の試行前に必ずリモート確認する
        throw new AmbiguousResultError(`投稿リクエストの結果が不明です: ${(err as Error).message}`, err);
      }
    },
    { label: "GBP投稿作成", maxAttempts: 3, baseDelayMs: 4000, onUnauthorized: refresherFor(cfg), hints: GOOGLE_HINTS },
  ).catch(async (err) => {
    // 最終失敗でも、結果不明 (タイムアウト/5xx) なら最後にもう一度リモートを確認する
    if (err instanceof AmbiguousResultError || (err instanceof HttpError && err.status >= 500)) {
      const late = await findExistingPost(cfg, date, payload.summary).catch(() => null);
      if (late) {
        recovered = true;
        return late;
      }
    }
    throw err;
  });
  return { post, recovered };
}
