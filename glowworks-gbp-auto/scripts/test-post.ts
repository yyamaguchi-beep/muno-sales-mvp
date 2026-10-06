/**
 * npm run test-post
 *   Google 側の接続テスト (読み取りのみ): トークン更新 → 投稿先店舗の照合 → 既存投稿一覧の取得
 *   → 最新の DRY RUN 記録から投稿 JSON を組み立てて表示。投稿はしない。
 *
 * npm run test-post -- --publish
 *   最新の DRY RUN 記録をそのまま本番投稿する (DRY_RUN=false 必須・確認入力あり)。
 *   初回の本番投稿テスト用。当日分の success 記録が既にある場合は実行しない。
 */
import readline from "node:readline/promises";
import { loadConfig } from "../src/config.js";
import { PostRepository } from "../src/db/database.js";
import { buildPayload, createLocalPost, listRecentPosts, verifyTargetLocation } from "../src/gbp/posts.js";
import { verifyPublicUrl } from "../src/storage/index.js";
import { parseArgs } from "../src/utils/args.js";
import { localDateString } from "../src/utils/date.js";
import { errorMessage } from "../src/utils/errors.js";

async function main() {
  const args = parseArgs();
  const cfg = loadConfig();
  const target = await verifyTargetLocation(cfg);
  console.log(`✅ 投稿先: ${target.title} / ${target.address}`);
  const posts = await listRecentPosts(cfg, 5);
  console.log(`✅ 既存投稿 ${posts.length}件取得`);
  for (const p of posts) console.log(`   - ${p.createTime} ${p.state} ${(p.summary ?? "").slice(0, 40).replace(/\n/g, " ")}`);

  const repo = new PostRepository();
  const rec = repo.recent(1, ["dry_run"])[0];
  if (!rec?.caption || !rec.imagePublicUrl) {
    console.log("\nDRY RUN の記録がありません。先に npm run dry-run を実行してください。");
    repo.close();
    return;
  }
  const payload = buildPayload(cfg, rec.caption, rec.imagePublicUrl, rec.ctaType === "LEARN_MORE");
  console.log(`\n投稿JSON (DRY RUN id=${rec.id}, ${rec.date}):\n${JSON.stringify(payload, null, 2)}`);
  await verifyPublicUrl(rec.imagePublicUrl);
  console.log("✅ 画像URLに外部からアクセスできます");

  if (!args.publish) {
    console.log("\n(読み取りテストのみ。実際に投稿するには --publish)");
    repo.close();
    return;
  }
  if (cfg.DRY_RUN) throw new Error("DRY_RUN=true のため投稿できません。");
  const today = localDateString(new Date(), cfg.TIMEZONE);
  if (repo.findByDate(today, ["success", "publishing"]).length) throw new Error(`${today} は既に投稿済みです。`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`本当に「${target.title}」へ投稿しますか? 投稿する場合は yes と入力: `);
  rl.close();
  if (answer.trim() !== "yes") {
    console.log("中止しました。");
    repo.close();
    return;
  }
  const id = repo.insert({ ...rec, id: undefined, createdAt: undefined, updatedAt: undefined, date: today, mode: "post", status: "publishing", attempts: 1 } as never);
  try {
    const { post } = await createLocalPost(cfg, today, payload);
    repo.update(id, { status: "success", googlePostId: post.name, googlePostState: post.state ?? null, googleSearchUrl: post.searchUrl ?? null, publishedAt: post.createTime ?? new Date().toISOString() });
    console.log(`✅ 投稿しました: ${post.name} state=${post.state} ${post.searchUrl ?? ""}`);
  } catch (err) {
    repo.update(id, { status: "failed", error: errorMessage(err) });
    throw err;
  } finally {
    repo.close();
  }
}

main().catch((err) => {
  console.error(`❌ ${errorMessage(err)}`);
  process.exit(1);
});
