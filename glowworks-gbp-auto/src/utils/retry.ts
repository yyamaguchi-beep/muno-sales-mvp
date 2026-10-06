import { FatalError, HttpError } from "./errors.js";
import { logger } from "./logger.js";

export interface RetryOptions {
  label: string;
  maxAttempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** 401 時に一度だけ呼ばれる (OAuth トークン更新など)。true を返せば即再試行 */
  onUnauthorized?: () => Promise<boolean>;
  /** false を返すと再試行せずに throw */
  shouldRetry?: (err: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
  /** 401/403 時のエラーメッセージに付ける対処法 */
  hints?: { unauthorized?: string; forbidden?: string };
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 指数バックオフ付きリトライ。
 *  - 401: onUnauthorized を一度だけ試行
 *  - 403: 権限/API未承認として即停止 (FatalError)
 *  - 429: Retry-After を尊重
 *  - 5xx / ネットワーク: 指数バックオフ
 *  - その他 4xx: 即停止
 */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<T> {
  const base = opts.baseDelayMs ?? 2000;
  const max = opts.maxDelayMs ?? 60_000;
  const doSleep = opts.sleep ?? sleep;
  let refreshed = false;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (err instanceof FatalError) throw err;
      if (opts.shouldRetry && !opts.shouldRetry(err)) throw err;

      let delay = Math.min(max, base * 2 ** (attempt - 1)) + Math.floor(Math.random() * 500);

      if (err instanceof HttpError) {
        if (err.status === 401) {
          if (opts.onUnauthorized && !refreshed) {
            refreshed = true;
            logger.warn(`${opts.label}: 401 Unauthorized → OAuth トークンを更新して再試行します`);
            if (await opts.onUnauthorized()) {
              attempt--; // トークン更新はリトライ回数に数えない
              continue;
            }
          }
          throw new FatalError(`${opts.label}: 認証エラー (401)。${opts.hints?.unauthorized ?? "認証情報を確認してください。"} ${err.body.slice(0, 200)}`);
        }
        if (err.status === 403) {
          throw new FatalError(
            `${opts.label}: 権限エラー (403)。${opts.hints?.forbidden ?? "権限設定を確認してください。"} 詳細: ${err.body.slice(0, 300)}`,
          );
        }
        if (err.status === 429) {
          delay = Math.min(Math.max(err.retryAfterMs ?? delay, 1000), 5 * 60_000);
        } else if (err.status < 500) {
          throw err; // 400/404 などは再試行しても直らない
        }
      }

      if (attempt >= opts.maxAttempts) break;
      logger.warn(`${opts.label}: 失敗 (試行 ${attempt}/${opts.maxAttempts})。${Math.round(delay / 1000)}秒後に再試行: ${String((err as Error)?.message ?? err).slice(0, 200)}`);
      await doSleep(delay);
    }
  }
  throw lastErr;
}
