import fs from "node:fs";
import { ENV_FILE } from "../config.js";

/** .env の指定キーを書き換える (なければ追記)。値はログに出さないこと */
export function upsertEnvValues(values: Record<string, string>, file = ENV_FILE): void {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split(/\r?\n/) : [];
  for (const [key, value] of Object.entries(values)) {
    const idx = lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
    const line = `${key}=${value}`;
    if (idx >= 0) lines[idx] = line;
    else lines.push(line);
  }
  fs.writeFileSync(file, lines.join("\n").replace(/\n*$/, "\n"), { mode: 0o600 });
}

export function mask(value: string | undefined): string {
  if (!value) return "(未設定)";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-2)} (${value.length}文字)`;
}
