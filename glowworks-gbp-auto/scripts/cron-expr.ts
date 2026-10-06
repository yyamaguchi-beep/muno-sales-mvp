/** npm run cron — .env の POST_HOUR / POST_MINUTE / TIMEZONE を GitHub Actions 用 UTC cron に変換して表示 */
import { loadConfig } from "../src/config.js";
import { utcCronFor } from "../src/scheduler.js";

const cfg = loadConfig();
const cron = utcCronFor(cfg);
console.log(`投稿時刻: ${cfg.POST_HOUR}:${String(cfg.POST_MINUTE).padStart(2, "0")} (${cfg.TIMEZONE})`);
console.log(`GitHub Actions cron (UTC): "${cron}"`);
console.log("→ .github/workflows/gbp-daily-post.yml の schedule をこの値に合わせてください (バックアップ実行も同様に調整)。");
