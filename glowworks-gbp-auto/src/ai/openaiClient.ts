import OpenAI from "openai";
import type { Config } from "../config.js";
import { FatalError, HttpError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { withRetry } from "../utils/retry.js";

let client: OpenAI | null = null;

export function openai(cfg: Config): OpenAI {
  if (!cfg.OPENAI_API_KEY) throw new FatalError("OPENAI_API_KEY が未設定です (.env または GitHub Secrets)。");
  // SDK 内部リトライは 0 にして、こちらの withRetry に一本化する (多重リトライ防止)
  client ??= new OpenAI({ apiKey: cfg.OPENAI_API_KEY, maxRetries: 0, timeout: 180_000 });
  return client;
}

export const OPENAI_HINTS = {
  unauthorized: "OPENAI_API_KEY が無効です。OpenAI ダッシュボードでキーを確認してください。",
  forbidden: "OpenAI の組織認証・モデル利用権限・課金設定を確認してください (画像モデルは Organization Verification が必要な場合があります)。",
};

/** OpenAI SDK のエラーを共通 HttpError に変換 */
export function toHttpError(err: unknown): unknown {
  if (err instanceof OpenAI.APIError && typeof err.status === "number") {
    const retryAfter = err.headers?.get?.("retry-after");
    const ms = retryAfter ? Number(retryAfter) * 1000 : undefined;
    return new HttpError(`OpenAI API error: ${err.message}`, err.status, JSON.stringify(err.error ?? {}), ms);
  }
  return err;
}

function isModelNotFound(err: unknown): boolean {
  return err instanceof HttpError && (err.status === 404 || (err.status === 400 && /model/i.test(err.body + err.message)));
}

/**
 * Responses API + Structured Outputs で JSON を生成する。
 * 指定モデルが使えない場合は OPENAI_TEXT_MODEL_FALLBACK で再試行。
 */
export async function generateJson<T>(
  cfg: Config,
  args: { label: string; schemaName: string; schema: Record<string, unknown>; system: string; user: string; maxAttempts?: number },
): Promise<T> {
  const models = [cfg.OPENAI_TEXT_MODEL, cfg.OPENAI_TEXT_MODEL_FALLBACK].filter((m, i, a) => m && a.indexOf(m) === i);
  let lastErr: unknown;
  for (const model of models) {
    try {
      return await withRetry(
        async () => {
          try {
            const res = await openai(cfg).responses.create({
              model,
              instructions: args.system,
              input: args.user,
              text: { format: { type: "json_schema", name: args.schemaName, schema: args.schema, strict: true } },
            });
            const text = res.output_text;
            if (!text) throw new Error(`${args.label}: 空のレスポンス`);
            return JSON.parse(text) as T;
          } catch (err) {
            throw toHttpError(err);
          }
        },
        { label: `${args.label} (${model})`, maxAttempts: args.maxAttempts ?? 2, hints: OPENAI_HINTS, shouldRetry: (e) => !isModelNotFound(e) },
      );
    } catch (err) {
      lastErr = err;
      if (isModelNotFound(err) && model !== models[models.length - 1]) {
        logger.warn(`テキストモデル ${model} が利用できません。フォールバックモデルで再試行します。`);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/** 画像入力 (vision) 付きで JSON を生成 */
export async function generateJsonWithImage<T>(
  cfg: Config,
  args: { label: string; schemaName: string; schema: Record<string, unknown>; system: string; user: string; imageBase64Jpeg: string },
): Promise<T> {
  const model = cfg.OPENAI_TEXT_MODEL || cfg.OPENAI_TEXT_MODEL_FALLBACK;
  return withRetry(
    async () => {
      try {
        const res = await openai(cfg).responses.create({
          model,
          instructions: args.system,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: args.user },
                { type: "input_image", image_url: `data:image/jpeg;base64,${args.imageBase64Jpeg}`, detail: "high" },
              ],
            },
          ],
          text: { format: { type: "json_schema", name: args.schemaName, schema: args.schema, strict: true } },
        });
        return JSON.parse(res.output_text) as T;
      } catch (err) {
        throw toHttpError(err);
      }
    },
    { label: args.label, maxAttempts: 2, hints: OPENAI_HINTS },
  );
}
