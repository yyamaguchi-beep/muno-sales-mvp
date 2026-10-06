import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PROJECT_ROOT, type Config } from "../config.js";
import type { StorageProvider } from "./index.js";

/**
 * ローカル保存 (開発・オフライン DRY RUN 用)。
 * Google からはアクセスできないため、本番投稿では使用不可 (pipeline 側で拒否)。
 */
export class LocalStorage implements StorageProvider {
  readonly name = "local";
  readonly publicHttps = false;
  private dir: string;

  constructor(cfg: Config) {
    this.dir = path.resolve(PROJECT_ROOT, cfg.LOCAL_PUBLIC_DIR);
  }

  async upload(key: string, body: Buffer): Promise<string> {
    const file = path.join(this.dir, key);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
    return this.publicUrl(key);
  }

  async download(key: string): Promise<Buffer | null> {
    const file = path.join(this.dir, key);
    return fs.existsSync(file) ? fs.readFileSync(file) : null;
  }

  publicUrl(key: string): string {
    return pathToFileURL(path.join(this.dir, key)).href;
  }
}
