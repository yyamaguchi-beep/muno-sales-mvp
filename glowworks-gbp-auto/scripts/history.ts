/** npm run history [-- --limit 30] [-- --runs] */
import { PostRepository } from "../src/db/database.js";
import { parseArgs } from "../src/utils/args.js";
import { logger } from "../src/utils/logger.js";

logger.setFileLogging(false);
const args = parseArgs();
const limit = Number(args.limit ?? 30);
const repo = new PostRepository();

if (args.runs) {
  console.table(repo.recentRuns(limit).map((r) => ({ runId: r.runId, mode: r.mode, result: r.result, message: (r.message ?? "").slice(0, 60), started: r.startedAt })));
} else {
  const rows = repo.all(limit).map((r) => ({
    id: r.id,
    date: r.date,
    mode: r.mode,
    status: r.status,
    theme: r.theme ? `${r.theme} ${r.themeName ?? ""}`.slice(0, 18) : "",
    keyword: r.primaryKeyword ?? "",
    title: (r.title ?? "").slice(0, 24),
    score: r.validationScore ?? "",
    value: r.valueScore ?? "",
    cta: r.ctaType ?? "",
    google: r.googlePostId ? r.googlePostId.split("/").pop() : "",
    error: (r.error ?? "").slice(0, 40),
  }));
  if (rows.length === 0) console.log("履歴はまだありません。");
  else console.table(rows);
  if (args.id) {
    const r = repo.get(Number(args.id));
    console.log(r ? { ...r, validationJson: undefined } : "見つかりません");
    if (r?.caption) console.log(`\n--- caption ---\n${r.caption}`);
  }
}
repo.close();
