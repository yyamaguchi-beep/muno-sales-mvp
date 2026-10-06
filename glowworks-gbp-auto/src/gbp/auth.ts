import type { Config } from "../config.js";
import { FatalError, HttpError, parseRetryAfter } from "../utils/errors.js";

export const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cache: CachedToken | null = null;

export function clearTokenCache(): void {
  cache = null;
}

/** refresh_token → access_token (メモリ上のみ保持・ログ出力しない) */
export async function getAccessToken(cfg: Config, force = false): Promise<string> {
  if (!cfg.GOOGLE_CLIENT_ID || !cfg.GOOGLE_CLIENT_SECRET) {
    throw new FatalError("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が未設定です。README「OAuth Client 作成」を参照してください。");
  }
  if (!cfg.GOOGLE_REFRESH_TOKEN) {
    throw new FatalError("GOOGLE_REFRESH_TOKEN が未設定です。`npm run auth` で取得してください。");
  }
  if (!force && cache && cache.expiresAt - 60_000 > Date.now()) return cache.accessToken;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.GOOGLE_CLIENT_ID,
      client_secret: cfg.GOOGLE_CLIENT_SECRET,
      refresh_token: cfg.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await res.text();
  if (!res.ok) {
    if (res.status === 400 && /invalid_grant/.test(body)) {
      throw new FatalError(
        "Google の refresh token が無効です (invalid_grant)。期限切れ・取り消し、または OAuth 同意画面が「テスト」状態のため7日で失効した可能性があります。`npm run auth` で再取得し、同意画面を「本番」に公開してください。",
      );
    }
    throw new HttpError("OAuth token refresh failed", res.status, body, parseRetryAfter(res.headers.get("retry-after")));
  }
  const json = JSON.parse(body) as { access_token: string; expires_in: number; scope?: string };
  if (json.scope && !json.scope.split(" ").includes(GBP_SCOPE)) {
    throw new FatalError(`refresh token に ${GBP_SCOPE} スコープがありません。\`npm run auth\` で再認証してください。`);
  }
  cache = { accessToken: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cache.accessToken;
}

/** 認証付き fetch。エラーは HttpError に変換 (リトライ判定は呼び出し側) */
export async function googleFetch<T>(
  cfg: Config,
  url: string,
  init: { method?: string; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const token = await getAccessToken(cfg);
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { "Content-Type": "application/json; charset=utf-8" } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(init.timeoutMs ?? 60_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new HttpError(`Google API ${init.method ?? "GET"} ${new URL(url).pathname}`, res.status, text, parseRetryAfter(res.headers.get("retry-after")));
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export const GOOGLE_HINTS = {
  unauthorized: "GOOGLE_REFRESH_TOKEN を再取得してください (npm run auth)。",
  forbidden:
    "Business Profile API の利用申請が承認済みか、Cloud Console で各APIが有効か、認証したGoogleアカウントが店舗のオーナー/管理者か確認してください。",
};

/** withRetry の onUnauthorized 用: トークンを強制更新 */
export function refresherFor(cfg: Config) {
  return async () => {
    clearTokenCache();
    await getAccessToken(cfg, true);
    return true;
  };
}
