import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ENV_FILE = path.join(PROJECT_ROOT, ".env");

// quiet: dotenv v17+ prints a banner otherwise
dotenv.config({ path: ENV_FILE, quiet: true });

const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v.trim() === "") return def;
      return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
    });

const int = (def: number, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v.trim() === "") return def;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `must be an integer between ${min} and ${max}` });
        return z.NEVER;
      }
      return n;
    });

const str = (def = "") =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? def : v.trim()));

const schema = z.object({
  OPENAI_API_KEY: str(),
  OPENAI_IMAGE_MODEL: str("gpt-image-2.5-flare"),
  OPENAI_IMAGE_MODEL_HQ: str("gpt-image-2.5-sunburst"),
  IMAGE_QUALITY_PRIORITY: bool(false),
  OPENAI_IMAGE_QUALITY: z.enum(["low", "medium", "high", "auto"]).optional().default("high"),
  OPENAI_IMAGE_SIZE: str("1024x1024"),
  OPENAI_TEXT_MODEL: str("gpt-6.1-sol"),
  OPENAI_TEXT_MODEL_FALLBACK: str("gpt-5.5"),
  AI_MOCK: bool(false),
  IMAGE_MODE: z.enum(["generate", "edit", "auto"]).optional().default("auto"),
  IMAGE_VISION_CHECK: bool(true),
  IMAGE_DISCLAIMER_LABEL: bool(true),
  IMAGE_OVERLAY_TEXT: bool(true),
  OVERLAY_FONT_FAMILY: str("Noto Sans CJK JP, Noto Sans JP, Hiragino Sans, WenQuanYi Zen Hei, sans-serif"),

  GOOGLE_CLIENT_ID: str(),
  GOOGLE_CLIENT_SECRET: str(),
  GOOGLE_REFRESH_TOKEN: str(),
  GOOGLE_OAUTH_PORT: int(53682, 1024, 65535),

  GBP_ACCOUNT_ID: str(),
  GBP_LOCATION_ID: str(),
  GBP_EXPECTED_NAME: str("GLOW WORKS 生野"),
  GBP_EXPECTED_ADDRESS: str("大阪府大阪市生野区小路東5丁目12-19"),
  GBP_LANGUAGE_CODE: str("ja"),

  WEBSITE_URL: str("https://glowworksikuno.com/"),

  STORAGE_PROVIDER: z.enum(["r2", "gcs", "local"]).optional().default("r2"),
  R2_ACCOUNT_ID: str(),
  R2_ACCESS_KEY_ID: str(),
  R2_SECRET_ACCESS_KEY: str(),
  R2_BUCKET: str(),
  R2_PUBLIC_URL: str(),
  GCS_BUCKET: str(),
  GCS_PUBLIC_URL: str(),
  GCS_KEY_JSON_BASE64: str(),
  LOCAL_PUBLIC_DIR: str("public-local"),
  STATE_SYNC: bool(false),

  TIMEZONE: str("Asia/Tokyo"),
  POST_HOUR: int(10, 0, 23),
  POST_MINUTE: int(30, 0, 59),
  // 予定時刻からこの分数を超えて遅れた実行はスキップ (GitHub Actions の遅延や再実行への保険)。0 = 無制限
  POST_WINDOW_MINUTES: int(0, 0, 1440),

  DRY_RUN: bool(true),
  AUTO_PUBLISH: bool(false),

  MIN_VALIDATION_SCORE: int(85, 0, 100),
  MIN_VALUE_SCORE: int(80, 0, 100),
  CTA_RATIO: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 0.3))
    .pipe(z.number().min(0).max(1)),
  HISTORY_CONTEXT_POSTS: int(30, 5, 100),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional().default("info"),
});

export type Config = z.infer<typeof schema>;

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`.env の設定値が不正です:\n${msg}`);
  }
  cached = parsed.data;
  return cached;
}

/** テスト用: 環境変数を再読込させる */
export function resetConfigCache(): void {
  cached = null;
}

export function imageModel(cfg: Config): string {
  return cfg.IMAGE_QUALITY_PRIORITY ? cfg.OPENAI_IMAGE_MODEL_HQ : cfg.OPENAI_IMAGE_MODEL;
}

/** ログに絶対出してはいけない値 */
export const SECRET_ENV_KEYS = [
  "OPENAI_API_KEY",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "GCS_KEY_JSON_BASE64",
] as const;

export const paths = {
  data: path.join(PROJECT_ROOT, "data"),
  db: path.join(PROJECT_ROOT, "data", "posts.db"),
  generated: path.join(PROJECT_ROOT, "generated"),
  logs: path.join(PROJECT_ROOT, "logs"),
  reference: path.join(PROJECT_ROOT, "assets", "reference"),
};
