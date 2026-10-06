import type { Config } from "../config.js";
import { withRetry } from "../utils/retry.js";
import { GOOGLE_HINTS, googleFetch, refresherFor } from "./auth.js";

/** Account Management API v1 */
const BASE = "https://mybusinessaccountmanagement.googleapis.com/v1";

export interface GbpAccount {
  name: string; // "accounts/123"
  accountName?: string;
  type?: string;
  role?: string;
  verificationState?: string;
}

export function accountIdOf(name: string): string {
  return name.replace(/^accounts\//, "");
}

export async function listAccounts(cfg: Config): Promise<GbpAccount[]> {
  const out: GbpAccount[] = [];
  let pageToken = "";
  do {
    const url = `${BASE}/accounts?pageSize=20${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await withRetry(() => googleFetch<{ accounts?: GbpAccount[]; nextPageToken?: string }>(cfg, url), {
      label: "アカウント一覧取得",
      maxAttempts: 3,
      onUnauthorized: refresherFor(cfg),
      hints: GOOGLE_HINTS,
    });
    out.push(...(res.accounts ?? []));
    pageToken = res.nextPageToken ?? "";
  } while (pageToken);
  return out;
}
