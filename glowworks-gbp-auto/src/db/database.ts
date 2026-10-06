import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { paths } from "../config.js";
import { migrate } from "./migrations.js";

export type PostStatus = "draft" | "dry_run" | "pending" | "publishing" | "success" | "failed" | "rejected";
export type RunMode = "daily" | "post" | "dry-run" | "generate";

export interface PostRecord {
  id: number;
  date: string;
  mode: RunMode;
  status: PostStatus;
  publishedAt: string | null;
  theme: string | null;
  themeName: string | null;
  category: string | null;
  angle: string | null;
  targetAudience: string | null;
  primaryKeyword: string | null;
  secondaryKeywords: string | null;
  title: string | null;
  hook: string | null;
  structure: string | null;
  caption: string | null;
  ctaType: string | null;
  ctaUrl: string | null;
  imagePrompt: string | null;
  imageScene: string | null;
  imageComposition: string | null;
  imagePerson: string | null;
  overlayText: string | null;
  imagePath: string | null;
  imageObjectKey: string | null;
  imagePublicUrl: string | null;
  googlePostId: string | null;
  googlePostState: string | null;
  googleSearchUrl: string | null;
  validationScore: number | null;
  valueScore: number | null;
  validationJson: string | null;
  error: string | null;
  attempts: number;
  runId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PostInsert = Partial<Omit<PostRecord, "id" | "createdAt" | "updatedAt">> &
  Pick<PostRecord, "date" | "mode" | "status">;

const COLUMNS = [
  "date", "mode", "status", "publishedAt", "theme", "themeName", "category", "angle", "targetAudience",
  "primaryKeyword", "secondaryKeywords", "title", "hook", "structure", "caption", "ctaType", "ctaUrl",
  "imagePrompt", "imageScene", "imageComposition", "imagePerson", "overlayText", "imagePath", "imageObjectKey",
  "imagePublicUrl", "googlePostId", "googlePostState", "googleSearchUrl", "validationScore", "valueScore",
  "validationJson", "error", "attempts", "runId",
] as const;

export class PostRepository {
  readonly db: Database.Database;

  constructor(file: string = paths.db) {
    if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    migrate(this.db);
  }

  close(): void {
    // WAL をメインファイルへ反映 (ストレージ同期・Actions artifact 用)
    try {
      this.db.pragma("wal_checkpoint(TRUNCATE)");
    } catch {
      /* ignore */
    }
    this.db.close();
  }

  insert(rec: PostInsert): number {
    const now = new Date().toISOString();
    const cols = COLUMNS.filter((c) => (rec as Record<string, unknown>)[c] !== undefined);
    const sql = `INSERT INTO posts (${[...cols, "createdAt", "updatedAt"].join(",")})
                 VALUES (${[...cols, "createdAt", "updatedAt"].map((c) => "@" + c).join(",")})`;
    const info = this.db.prepare(sql).run({ ...rec, createdAt: now, updatedAt: now });
    return Number(info.lastInsertRowid);
  }

  update(id: number, patch: Partial<Omit<PostRecord, "id" | "createdAt">>): void {
    const cols = COLUMNS.filter((c) => (patch as Record<string, unknown>)[c] !== undefined);
    if (cols.length === 0) return;
    const sql = `UPDATE posts SET ${cols.map((c) => `${c}=@${c}`).join(",")}, updatedAt=@updatedAt WHERE id=@id`;
    this.db.prepare(sql).run({ ...patch, id, updatedAt: new Date().toISOString() });
  }

  get(id: number): PostRecord | undefined {
    return this.db.prepare("SELECT * FROM posts WHERE id=?").get(id) as PostRecord | undefined;
  }

  findByDate(date: string, statuses: PostStatus[]): PostRecord[] {
    const ph = statuses.map(() => "?").join(",");
    return this.db
      .prepare(`SELECT * FROM posts WHERE date=? AND status IN (${ph}) ORDER BY id DESC`)
      .all(date, ...statuses) as PostRecord[];
  }

  /** 新しい順に、指定ステータスの投稿を返す */
  recent(limit: number, statuses: PostStatus[]): PostRecord[] {
    const ph = statuses.map(() => "?").join(",");
    return this.db
      .prepare(`SELECT * FROM posts WHERE status IN (${ph}) ORDER BY date DESC, id DESC LIMIT ?`)
      .all(...statuses, limit) as PostRecord[];
  }

  all(limit: number): PostRecord[] {
    return this.db.prepare("SELECT * FROM posts ORDER BY id DESC LIMIT ?").all(limit) as PostRecord[];
  }

  /**
   * status を条件付きで遷移させる (楽観ロック)。遷移できたら true。
   * 同時実行された別プロセスが先に遷移させていれば false。
   */
  transition(id: number, from: PostStatus[], to: PostStatus, patch: Partial<PostRecord> = {}): boolean {
    const tx = this.db.transaction(() => {
      const row = this.get(id);
      if (!row || !from.includes(row.status)) return false;
      this.update(id, { ...patch, status: to });
      return true;
    });
    try {
      return tx.immediate();
    } catch (err) {
      if (String(err).includes("UNIQUE constraint failed")) return false;
      throw err;
    }
  }

  startRun(runId: string, date: string, mode: RunMode): void {
    this.db
      .prepare("INSERT INTO runs (runId, date, mode, startedAt) VALUES (?,?,?,?)")
      .run(runId, date, mode, new Date().toISOString());
  }

  finishRun(runId: string, result: string, message: string, postId?: number): void {
    this.db
      .prepare("UPDATE runs SET result=?, message=?, postId=?, finishedAt=? WHERE runId=?")
      .run(result, message.slice(0, 2000), postId ?? null, new Date().toISOString(), runId);
  }

  recentRuns(limit: number): { runId: string; date: string; mode: string; result: string | null; message: string | null; startedAt: string; finishedAt: string | null }[] {
    return this.db.prepare("SELECT * FROM runs ORDER BY id DESC LIMIT ?").all(limit) as never;
  }
}
