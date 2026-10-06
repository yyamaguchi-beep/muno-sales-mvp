import type { Config } from "../config.js";
import { FatalError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { sleep } from "../utils/retry.js";
import { GcsStorage } from "./gcs.js";
import { LocalStorage } from "./local.js";
import { R2Storage } from "./r2.js";

export interface StorageProvider {
  readonly name: string;
  /** Google のサーバーから取得できる公開 HTTPS URL を発行できるか */
  readonly publicHttps: boolean;
  upload(key: string, body: Buffer, contentType: string, cacheControl?: string): Promise<string>;
  /** 非公開でもよいオブジェクト取得 (状態同期用)。存在しなければ null */
  download(key: string): Promise<Buffer | null>;
  publicUrl(key: string): string;
}

export function createStorage(cfg: Config): StorageProvider {
  switch (cfg.STORAGE_PROVIDER) {
    case "r2": {
      const missing = (["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"] as const).filter((k) => !cfg[k]);
      if (missing.length) throw new FatalError(`STORAGE_PROVIDER=r2 ですが ${missing.join(", ")} が未設定です。`);
      return new R2Storage(cfg);
    }
    case "gcs":
      if (!cfg.GCS_BUCKET) throw new FatalError("STORAGE_PROVIDER=gcs ですが GCS_BUCKET が未設定です。");
      return new GcsStorage(cfg);
    case "local":
      return new LocalStorage(cfg);
  }
}

/** 公開URLが Google から取得できる状態か確認 (HTTP 200 かつ image/*) */
export async function verifyPublicUrl(url: string, attempts = 4): Promise<void> {
  if (!url.startsWith("https://")) throw new FatalError(`画像URLが HTTPS ではありません: ${url}`);
  let last = "";
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1023" }, signal: AbortSignal.timeout(20_000) });
      const type = res.headers.get("content-type") ?? "";
      if ((res.status === 200 || res.status === 206) && type.startsWith("image/")) return;
      last = `HTTP ${res.status} content-type=${type}`;
    } catch (err) {
      last = (err as Error).message;
    }
    logger.warn(`公開URLの確認に失敗 (${i + 1}/${attempts}): ${last}`);
    await sleep(2000 * (i + 1));
  }
  throw new FatalError(`画像の公開URLにアクセスできません (${last})。R2 の公開アクセス設定 / R2_PUBLIC_URL を確認してください: ${url}`);
}
