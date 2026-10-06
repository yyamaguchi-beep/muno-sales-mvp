import { Storage } from "@google-cloud/storage";
import type { Config } from "../config.js";
import type { StorageProvider } from "./index.js";

/**
 * Google Cloud Storage。バケットは「均一なバケットレベルのアクセス」+ allUsers に
 * Storage Object Viewer を付与して公開しておく (README 参照)。
 * 認証: GCS_KEY_JSON_BASE64 (サービスアカウントJSONをbase64) または ADC。
 */
export class GcsStorage implements StorageProvider {
  readonly name = "gcs";
  readonly publicHttps = true;
  private storage: Storage;
  private bucket: string;
  private publicBase: string;

  constructor(cfg: Config) {
    const credentials = cfg.GCS_KEY_JSON_BASE64
      ? (JSON.parse(Buffer.from(cfg.GCS_KEY_JSON_BASE64, "base64").toString("utf8")) as Record<string, string>)
      : undefined;
    this.storage = new Storage(credentials ? { credentials, projectId: credentials.project_id } : {});
    this.bucket = cfg.GCS_BUCKET;
    this.publicBase = (cfg.GCS_PUBLIC_URL || `https://storage.googleapis.com/${cfg.GCS_BUCKET}`).replace(/\/+$/, "");
  }

  async upload(key: string, body: Buffer, contentType: string, cacheControl = "public, max-age=31536000, immutable"): Promise<string> {
    await this.storage.bucket(this.bucket).file(key).save(body, { contentType, metadata: { cacheControl }, resumable: false });
    return this.publicUrl(key);
  }

  async download(key: string): Promise<Buffer | null> {
    const file = this.storage.bucket(this.bucket).file(key);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [buf] = await file.download();
    return buf;
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
}
