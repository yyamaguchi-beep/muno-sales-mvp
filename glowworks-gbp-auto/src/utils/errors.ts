export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** 再試行してはいけない致命的エラー (権限不足・設定ミス・店舗不一致など) */
export class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalError";
  }
}

/** 投稿の成否が不明なエラー (タイムアウト等)。再送前に必ずリモート確認が必要 */
export class AmbiguousResultError extends Error {
  constructor(message: string, public override readonly cause?: unknown) {
    super(message);
    this.name = "AmbiguousResultError";
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof HttpError) return `${err.message} (HTTP ${err.status}) ${err.body.slice(0, 500)}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(header);
  if (!Number.isNaN(at)) return Math.max(0, at - Date.now());
  return undefined;
}
