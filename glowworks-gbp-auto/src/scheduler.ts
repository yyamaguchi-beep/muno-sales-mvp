/**
 * スケジューリング。
 *  - scheduleGate(): GitHub Actions 等から呼ばれた時に「今日の投稿時刻を過ぎているか」を判定 (時刻は .env で設定)
 *  - 直接実行 (npm run scheduler): 常駐プロセスとして毎日 POST_HOUR:POST_MINUTE に daily を実行
 *    (PC/VPS で動かす場合用。推奨は GitHub Actions)
 */
import { fileURLToPath } from "node:url";
import { loadConfig, type Config } from "./config.js";
import { runPipeline } from "./pipeline.js";
import { addDays, localDateString, zonedTimeToUtc } from "./utils/date.js";
import { errorMessage } from "./utils/errors.js";
import { logger, redact } from "./utils/logger.js";

export function scheduledTimeFor(cfg: Config, date: string): Date {
  return zonedTimeToUtc(date, cfg.POST_HOUR, cfg.POST_MINUTE, cfg.TIMEZONE);
}

export function scheduleGate(cfg: Config, now: Date): { ok: boolean; reason: string } {
  const today = localDateString(now, cfg.TIMEZONE);
  const at = scheduledTimeFor(cfg, today);
  const hhmm = `${String(cfg.POST_HOUR).padStart(2, "0")}:${String(cfg.POST_MINUTE).padStart(2, "0")}`;
  if (now.getTime() < at.getTime()) return { ok: false, reason: `投稿予定時刻 (${hhmm} ${cfg.TIMEZONE}) 前` };
  if (cfg.POST_WINDOW_MINUTES > 0 && now.getTime() > at.getTime() + cfg.POST_WINDOW_MINUTES * 60_000) {
    return { ok: false, reason: `投稿予定時刻から ${cfg.POST_WINDOW_MINUTES} 分以上経過` };
  }
  return { ok: true, reason: `投稿予定時刻 (${hhmm}) 以降` };
}

export function nextRunAt(cfg: Config, now: Date): Date {
  const today = localDateString(now, cfg.TIMEZONE);
  const t = scheduledTimeFor(cfg, today);
  return t.getTime() > now.getTime() ? t : scheduledTimeFor(cfg, addDays(today, 1));
}

/** POST_HOUR/POST_MINUTE を UTC の cron 式に変換 (GitHub Actions 用) */
export function utcCronFor(cfg: Config): string {
  const t = scheduledTimeFor(cfg, "2026-01-15");
  return `${t.getUTCMinutes()} ${t.getUTCHours()} * * *`;
}

async function loop() {
  const cfg = loadConfig();
  logger.info(`常駐スケジューラ開始: 毎日 ${cfg.POST_HOUR}:${String(cfg.POST_MINUTE).padStart(2, "0")} (${cfg.TIMEZONE})`);
  for (;;) {
    const next = nextRunAt(cfg, new Date());
    logger.info(`次回実行: ${next.toISOString()}`);
    // setTimeout の上限 (約24.8日) を超えないよう分割して待つ
    while (Date.now() < next.getTime()) {
      await new Promise((r) => setTimeout(r, Math.min(next.getTime() - Date.now(), 60 * 60_000)));
    }
    try {
      await runPipeline({ mode: "daily" });
    } catch (err) {
      logger.error(`スケジュール実行エラー: ${redact(errorMessage(err))}`);
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void loop();
}
