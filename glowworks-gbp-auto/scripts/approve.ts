/**
 * npm run approve [-- --date YYYY-MM-DD]
 * AUTO_PUBLISH=false で作成された承認待ち (pending) の投稿を Google に公開する。
 * 事前に generated/<date>/ の caption.txt と post.jpg を確認すること。
 */
import { loadConfig } from "../src/config.js";
import { PostRepository } from "../src/db/database.js";
import { approvePending } from "../src/pipeline.js";
import { pullState } from "../src/storage/stateSync.js";
import { parseArgs } from "../src/utils/args.js";
import { localDateString } from "../src/utils/date.js";
import { errorMessage } from "../src/utils/errors.js";

async function main() {
  const args = parseArgs();
  const cfg = loadConfig();
  const date = typeof args.date === "string" ? args.date : localDateString(new Date(), cfg.TIMEZONE);
  await pullState(cfg);
  const repo = new PostRepository();
  const pending = repo.findByDate(date, ["pending"])[0];
  repo.close();
  if (!pending) {
    console.error(`${date} の承認待ち (pending) 投稿はありません。npm run history で確認してください。`);
    process.exit(1);
  }
  console.log(`承認して投稿します: id=${pending.id} 「${pending.title}」\n${pending.caption}\n画像: ${pending.imagePublicUrl}\n`);
  const outcome = await approvePending(date);
  console.log(`結果: ${outcome.result} ${outcome.message}`);
  process.exit(outcome.result === "success" || outcome.result === "skipped" ? 0 : 1);
}
main().catch((e) => {
  console.error(errorMessage(e));
  process.exit(1);
});
