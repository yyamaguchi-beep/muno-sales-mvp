import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Config } from "../config.js";
import type { StorageProvider } from "./index.js";

/** Cloudflare R2 (S3 互換 API)。公開は r2.dev サブドメインまたはカスタムドメイン経由 */
export class R2Storage implements StorageProvider {
  readonly name = "r2";
  readonly publicHttps = true;
  private client: S3Client;
  private bucket: string;
  private publicBase: string;

  constructor(cfg: Config) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${cfg.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: cfg.R2_ACCESS_KEY_ID, secretAccessKey: cfg.R2_SECRET_ACCESS_KEY },
    });
    this.bucket = cfg.R2_BUCKET;
    this.publicBase = cfg.R2_PUBLIC_URL.replace(/\/+$/, "");
  }

  async upload(key: string, body: Buffer, contentType: string, cacheControl = "public, max-age=31536000, immutable"): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl }),
    );
    return this.publicUrl(key);
  }

  async download(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (err) {
      if (err instanceof NoSuchKey || (err as { name?: string }).name === "NoSuchKey") return null;
      throw err;
    }
  }

  publicUrl(key: string): string {
    return `${this.publicBase}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
}
