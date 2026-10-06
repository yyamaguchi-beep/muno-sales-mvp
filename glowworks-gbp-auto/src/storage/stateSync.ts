import fs from "node:fs";
import { paths, type Config } from "../config.js";
import { logger } from "../utils/logger.js";
import { createStorage } from "./index.js";

/**
 * GitHub Actions のように毎回まっさらな環境で動く場合、SQLite (data/posts.db) を
 * ストレージに保存・復元して履歴を引き継ぐ。STATE_SYNC=true で有効。
 * DB に秘密情報は含まれない (投稿本文・メタデータのみ)。
 */
export const STATE_KEY = "state/posts.db";

export async function pullState(cfg: Config): Promise<void> {
  if (!cfg.STATE_SYNC) return;
  const storage = createStorage(cfg);
  const buf = await storage.download(STATE_KEY);
  if (!buf) {
    logger.info("状態同期: リモートにDBがないため新規作成します");
    return;
  }
  fs.mkdirSync(paths.data, { recursive: true });
  if (fs.existsSync(paths.db)) fs.copyFileSync(paths.db, `${paths.db}.bak`);
  for (const ext of ["-wal", "-shm"]) fs.rmSync(paths.db + ext, { force: true });
  fs.writeFileSync(paths.db, buf);
  logger.info(`状態同期: DBを復元しました (${buf.length} bytes)`);
}

export async function pushState(cfg: Config): Promise<void> {
  if (!cfg.STATE_SYNC || !fs.existsSync(paths.db)) return;
  const storage = createStorage(cfg);
  const buf = fs.readFileSync(paths.db);
  await storage.upload(STATE_KEY, buf, "application/vnd.sqlite3", "no-store");
  // 世代バックアップ (日付ごと)
  await storage.upload(`state/backup/posts-${new Date().toISOString().slice(0, 10)}.db`, buf, "application/vnd.sqlite3", "no-store");
  logger.info(`状態同期: DBを保存しました (${buf.length} bytes)`);
}
