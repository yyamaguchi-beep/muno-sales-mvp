/**
 * エントリポイント。
 *   tsx src/index.ts --mode daily [--respect-schedule]   毎日の自動実行 (DRY_RUN / AUTO_PUBLISH に従う)
 *   tsx src/index.ts --mode generate                     生成のみ (アップロード・投稿なし)
 *   tsx src/index.ts --mode dry-run                      生成 + 画像公開URL化 + 投稿JSON (投稿なし)
 *   tsx src/index.ts --mode post                         今すぐ本番投稿 (DRY_RUN=false 必須)
 * オプション: --theme A〜Z (テーマ固定), --date YYYY-MM-DD (generate/dry-run のみ)
 */
import { loadConfig } from "./config.js";
import type { RunMode } from "./db/database.js";
import { runPipeline } from "./pipeline.js";
import { scheduleGate } from "./scheduler.js";
import { parseArgs } from "./utils/args.js";
import { isValidDateString } from "./utils/date.js";
import { errorMessage } from "./utils/errors.js";
import { logger, redact } from "./utils/logger.js";

async function main(): Promise<number> {
  const args = parseArgs();
  const mode = String(args.mode ?? "daily") as RunMode;
  if (!["daily", "generate", "dry-run", "post"].includes(mode)) {
    console.error(`不明な --mode: ${mode}`);
    return 2;
  }
  const date = typeof args.date === "string" ? args.date : undefined;
  if (date && !isValidDateString(date)) {
    console.error(`--date は YYYY-MM-DD 形式で指定してください: ${date}`);
    return 2;
  }
  const cfg = loadConfig();

  if (mode === "daily" && args["respect-schedule"]) {
    const gate = scheduleGate(cfg, new Date());
    if (!gate.ok) {
      logger.info(`スケジュール判定: ${gate.reason} → SKIP`);
      return 0;
    }
  }

  const outcome = await runPipeline({ mode, dateOverride: date, forceTheme: typeof args.theme === "string" ? args.theme : undefined });
  console.log(`\n結果: ${outcome.result}\n${outcome.message}${outcome.outputDir ? `\n出力: ${outcome.outputDir}` : ""}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const fs = await import("node:fs");
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### GBP 自動投稿: ${outcome.result}\n\n${outcome.message}\n`);
  }
  return outcome.result === "failed" || outcome.result === "rejected" ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    logger.error(`致命的エラー: ${redact(errorMessage(err))}`);
    process.exit(1);
  });
