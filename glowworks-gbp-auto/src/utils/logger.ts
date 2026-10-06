import fs from "node:fs";
import path from "node:path";
import { SECRET_ENV_KEYS, paths } from "../config.js";
import { localDateString } from "./date.js";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** 既知のシークレット値と、トークンらしき文字列を伏字にする */
export function redact(text: string): string {
  let out = text;
  for (const key of SECRET_ENV_KEYS) {
    const v = process.env[key];
    if (v && v.length >= 6) out = out.split(v).join(`[REDACTED:${key}]`);
  }
  return out
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, "sk-[REDACTED]")
    .replace(/ya29\.[A-Za-z0-9._-]+/g, "ya29.[REDACTED]")
    .replace(/1\/\/[A-Za-z0-9_-]{20,}/g, "1//[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[REDACTED]")
    .replace(/("?(?:access_token|refresh_token|client_secret|id_token|code_verifier)"?\s*[:=]\s*"?)[^"&\s,}]+/gi, "$1[REDACTED]");
}

class Logger {
  private minLevel: Level = (process.env.LOG_LEVEL as Level) || "info";
  private timeZone = process.env.TIMEZONE || "Asia/Tokyo";
  private fileEnabled = true;

  setFileLogging(enabled: boolean) {
    this.fileEnabled = enabled;
  }

  private write(level: Level, msg: string, meta?: unknown) {
    if (ORDER[level] < ORDER[this.minLevel]) return;
    const now = new Date();
    let line = `${now.toISOString()} [${level.toUpperCase()}] ${msg}`;
    if (meta !== undefined) {
      try {
        line += ` ${typeof meta === "string" ? meta : JSON.stringify(meta)}`;
      } catch {
        line += " [unserializable meta]";
      }
    }
    line = redact(line);
    (level === "error" || level === "warn" ? console.error : console.log)(line);
    if (!this.fileEnabled) return;
    try {
      fs.mkdirSync(paths.logs, { recursive: true });
      fs.appendFileSync(path.join(paths.logs, `${localDateString(now, this.timeZone)}.log`), line + "\n");
    } catch {
      // ログ書き込み失敗で本処理を止めない
    }
  }

  debug(msg: string, meta?: unknown) { this.write("debug", msg, meta); }
  info(msg: string, meta?: unknown) { this.write("info", msg, meta); }
  warn(msg: string, meta?: unknown) { this.write("warn", msg, meta); }
  error(msg: string, meta?: unknown) { this.write("error", msg, meta); }
}

export const logger = new Logger();
