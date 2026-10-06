/**
 * npm run status
 * 設定・認証・投稿先・ストレージ・履歴の状態を確認する (何も投稿しない)。
 * 未設定項目があっても終了コード 0 で、必要な「USER ACTION REQUIRED」を表示する。
 */
import fs from "node:fs";
import { ENV_FILE, imageModel, loadConfig, paths } from "../src/config.js";
import { listReferenceImages } from "../src/ai/imageGenerator.js";
import { PostRepository } from "../src/db/database.js";
import { getAccessToken } from "../src/gbp/auth.js";
import { verifyTargetLocation } from "../src/gbp/posts.js";
import { hasJapaneseFont } from "../src/image/overlay.js";
import { nextRunAt, utcCronFor } from "../src/scheduler.js";
import { createStorage } from "../src/storage/index.js";
import { mask } from "../src/utils/envFile.js";
import { errorMessage } from "../src/utils/errors.js";
import { logger } from "../src/utils/logger.js";
import { parseArgs } from "../src/utils/args.js";

logger.setFileLogging(false);
const args = parseArgs();
const cfg = loadConfig();
const actions: string[] = [];
const ok = (s: string) => console.log(`  ✅ ${s}`);
const warn = (s: string) => console.log(`  ⚠️  ${s}`);
const ng = (s: string) => console.log(`  ❌ ${s}`);

async function main() {
  console.log("\n■ 実行モード");
  console.log(`  DRY_RUN=${cfg.DRY_RUN}  AUTO_PUBLISH=${cfg.AUTO_PUBLISH}  AI_MOCK=${cfg.AI_MOCK}`);
  console.log(
    `  → 毎日の実行 (npm run daily / GitHub Actions) は ${cfg.DRY_RUN ? "DRY RUN (投稿しない)" : cfg.AUTO_PUBLISH ? "自動で本番投稿" : "承認待ち (pending) として保存"}`,
  );
  console.log(`  .env: ${fs.existsSync(ENV_FILE) ? "あり" : "なし (環境変数のみで実行)"}`);

  console.log("\n■ スケジュール");
  console.log(`  毎日 ${cfg.POST_HOUR}:${String(cfg.POST_MINUTE).padStart(2, "0")} (${cfg.TIMEZONE}) / GitHub Actions cron (UTC): "${utcCronFor(cfg)}"`);
  console.log(`  次回予定: ${nextRunAt(cfg, new Date()).toISOString()}`);

  console.log("\n■ OpenAI");
  console.log(`  テキスト: ${cfg.OPENAI_TEXT_MODEL} (fallback ${cfg.OPENAI_TEXT_MODEL_FALLBACK}) / 画像: ${imageModel(cfg)} ${cfg.OPENAI_IMAGE_SIZE} quality=${cfg.OPENAI_IMAGE_QUALITY}`);
  if (!cfg.OPENAI_API_KEY) {
    (cfg.AI_MOCK ? warn : ng)(`OPENAI_API_KEY 未設定${cfg.AI_MOCK ? " (AI_MOCK=true のためモックで動作)" : ""}`);
    actions.push("OpenAI API キーを発行し OPENAI_API_KEY に設定 (README 手順5)");
  } else if (args.offline) {
    ok(`OPENAI_API_KEY 設定済み ${mask(cfg.OPENAI_API_KEY)} (--offline: 疎通確認省略)`);
  } else {
    try {
      const res = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(cfg.OPENAI_TEXT_MODEL)}`, {
        headers: { Authorization: `Bearer ${cfg.OPENAI_API_KEY}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) ok(`APIキー有効・テキストモデル ${cfg.OPENAI_TEXT_MODEL} 利用可`);
      else if (res.status === 404) warn(`テキストモデル ${cfg.OPENAI_TEXT_MODEL} が見つかりません (fallback を使用)`);
      else ng(`OpenAI API 応答 HTTP ${res.status}`);
      const img = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(imageModel(cfg))}`, {
        headers: { Authorization: `Bearer ${cfg.OPENAI_API_KEY}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (img.ok) ok(`画像モデル ${imageModel(cfg)} 利用可`);
      else {
        warn(`画像モデル ${imageModel(cfg)} の確認: HTTP ${img.status}`);
        actions.push("OpenAI の Organization Verification / 画像モデル利用権限を確認");
      }
    } catch (err) {
      ng(`OpenAI 疎通確認に失敗: ${errorMessage(err)}`);
    }
  }
  const refs = listReferenceImages();
  console.log(`  画像モード: ${cfg.IMAGE_MODE} / 参照写真 (assets/reference): ${refs.length}枚 / 日本語フォント: ${hasJapaneseFont() ? "あり" : "なし (文字合成スキップ)"}`);

  console.log("\n■ Google Business Profile");
  const g = { id: !!cfg.GOOGLE_CLIENT_ID, secret: !!cfg.GOOGLE_CLIENT_SECRET, rt: !!cfg.GOOGLE_REFRESH_TOKEN };
  (g.id && g.secret ? ok : ng)(`OAuth Client: ID ${g.id ? "設定済み" : "未設定"} / Secret ${g.secret ? "設定済み" : "未設定"}`);
  if (!g.id || !g.secret) actions.push("Google Cloud で OAuth クライアント (デスクトップアプリ) を作成し GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET を設定 (README 手順2-3)");
  (g.rt ? ok : ng)(`Refresh Token: ${g.rt ? mask(cfg.GOOGLE_REFRESH_TOKEN) : "未設定"}`);
  if (!g.rt) actions.push("npm run auth で GOOGLE_REFRESH_TOKEN を取得 (README 手順4)");
  (cfg.GBP_ACCOUNT_ID && cfg.GBP_LOCATION_ID ? ok : ng)(`投稿先: account=${cfg.GBP_ACCOUNT_ID || "未設定"} location=${cfg.GBP_LOCATION_ID || "未設定"}`);
  if (!cfg.GBP_ACCOUNT_ID || !cfg.GBP_LOCATION_ID) actions.push("npm run find-location -- --write で GBP_ACCOUNT_ID / GBP_LOCATION_ID を設定");

  if (g.id && g.secret && g.rt && !args.offline) {
    try {
      await getAccessToken(cfg);
      ok("OAuth トークン更新 OK (business.manage)");
      if (cfg.GBP_ACCOUNT_ID && cfg.GBP_LOCATION_ID) {
        const t = await verifyTargetLocation(cfg);
        ok(`投稿先店舗の照合 OK: ${t.title} / ${t.address}`);
      }
    } catch (err) {
      ng(errorMessage(err));
      actions.push("Google 認証/権限エラーを解消 (README トラブルシューティング)");
    }
  }

  console.log("\n■ 画像ストレージ");
  try {
    const s = createStorage(cfg);
    (s.publicHttps ? ok : warn)(`${s.name}: ${s.publicHttps ? "公開HTTPS URL 発行可" : "ローカル保存のみ (本番投稿不可)"} 例: ${s.publicUrl("generated/YYYY-MM-DD/post.jpg")}`);
    if (!s.publicHttps) actions.push("Cloudflare R2 バケットを作成し R2_* を設定、STORAGE_PROVIDER=r2 に変更 (README 手順6)");
  } catch (err) {
    ng(errorMessage(err));
    actions.push("Cloudflare R2 バケットを作成し R2_* を設定 (README 手順6)");
  }
  console.log(`  状態同期 (STATE_SYNC): ${cfg.STATE_SYNC}`);

  console.log("\n■ 投稿履歴 (SQLite)");
  const repo = new PostRepository();
  const counts = repo.db.prepare("SELECT status, COUNT(*) c FROM posts GROUP BY status").all() as { status: string; c: number }[];
  console.log(`  DB: ${paths.db}`);
  console.log(`  件数: ${counts.length ? counts.map((c) => `${c.status}=${c.c}`).join(" ") : "0"}`);
  const last = repo.recentRuns(1)[0];
  if (last) console.log(`  最終実行: ${last.startedAt} ${last.mode} → ${last.result ?? "実行中/中断"} ${(last.message ?? "").slice(0, 80)}`);
  repo.close();

  if (cfg.DRY_RUN) actions.push("DRY RUN の結果 (generated/) を確認後、DRY_RUN=false に変更");
  else if (!cfg.AUTO_PUBLISH) actions.push("手動承認運用中。完全自動化するには AUTO_PUBLISH=true");

  console.log("\n■ USER ACTION REQUIRED");
  if (actions.length === 0) console.log("  なし (完全自動運用の状態です)");
  else actions.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));
  console.log("");
}

main().catch((err) => {
  console.error(errorMessage(err));
  process.exit(1);
});
