import type Database from "better-sqlite3";

/** user_version ベースの前進のみマイグレーション */
const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE IF NOT EXISTS posts (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    date              TEXT NOT NULL,              -- 投稿対象日 (TIMEZONE基準 YYYY-MM-DD)
    mode              TEXT NOT NULL,              -- daily | post | dry-run | generate
    status            TEXT NOT NULL,              -- draft | dry_run | pending | publishing | success | failed | rejected
    publishedAt       TEXT,
    theme             TEXT,
    themeName         TEXT,
    category          TEXT,
    angle             TEXT,
    targetAudience    TEXT,
    primaryKeyword    TEXT,
    secondaryKeywords TEXT,                       -- JSON array
    title             TEXT,
    hook              TEXT,
    structure         TEXT,
    caption           TEXT,
    ctaType           TEXT,                       -- NONE | LEARN_MORE
    ctaUrl            TEXT,
    imagePrompt       TEXT,
    imageScene        TEXT,
    imageComposition  TEXT,
    imagePerson       TEXT,
    overlayText       TEXT,
    imagePath         TEXT,
    imageObjectKey    TEXT,
    imagePublicUrl    TEXT,
    googlePostId      TEXT,
    googlePostState   TEXT,
    googleSearchUrl   TEXT,
    validationScore   INTEGER,
    valueScore        INTEGER,
    validationJson    TEXT,
    error             TEXT,
    attempts          INTEGER NOT NULL DEFAULT 0,
    runId             TEXT,
    createdAt         TEXT NOT NULL,
    updatedAt         TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date);
  CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
  -- 二重投稿防止: 1日につき「承認待ち/投稿中/成功」は1件まで (DBレベルで保証)
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_posts_live_per_date
    ON posts(date) WHERE status IN ('pending', 'publishing', 'success');

  CREATE TABLE IF NOT EXISTS runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    runId       TEXT NOT NULL UNIQUE,
    date        TEXT NOT NULL,
    mode        TEXT NOT NULL,
    result      TEXT,                             -- success | skipped | failed | dry_run | pending | rejected | draft
    message     TEXT,
    postId      INTEGER,
    startedAt   TEXT NOT NULL,
    finishedAt  TEXT
  );
  `,
];

export function migrate(db: Database.Database): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]!);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}
