import type { Config } from "../config.js";
import { withRetry } from "../utils/retry.js";
import { GOOGLE_HINTS, googleFetch, refresherFor } from "./auth.js";

/** Business Information API v1 */
const BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const READ_MASK = "name,title,storefrontAddress,websiteUri,metadata";

export interface PostalAddress {
  regionCode?: string;
  postalCode?: string;
  administrativeArea?: string;
  locality?: string;
  sublocality?: string;
  addressLines?: string[];
}

export interface GbpLocation {
  name: string; // "locations/456"
  title?: string;
  storefrontAddress?: PostalAddress;
  websiteUri?: string;
  metadata?: { mapsUri?: string; placeId?: string; canHaveBusinessCalls?: boolean };
}

export function locationIdOf(name: string): string {
  return name.replace(/^.*locations\//, "");
}

export async function listLocations(cfg: Config, accountId: string): Promise<GbpLocation[]> {
  const out: GbpLocation[] = [];
  let pageToken = "";
  do {
    const url = `${BASE}/accounts/${accountId}/locations?readMask=${READ_MASK}&pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await withRetry(() => googleFetch<{ locations?: GbpLocation[]; nextPageToken?: string }>(cfg, url), {
      label: "店舗一覧取得",
      maxAttempts: 3,
      onUnauthorized: refresherFor(cfg),
      hints: GOOGLE_HINTS,
    });
    out.push(...(res.locations ?? []));
    pageToken = res.nextPageToken ?? "";
  } while (pageToken);
  return out;
}

export async function getLocation(cfg: Config, locationId: string): Promise<GbpLocation> {
  return withRetry(() => googleFetch<GbpLocation>(cfg, `${BASE}/locations/${locationId}?readMask=${READ_MASK}`), {
    label: "店舗情報取得",
    maxAttempts: 3,
    onUnauthorized: refresherFor(cfg),
    hints: GOOGLE_HINTS,
  });
}

export function formatAddress(a?: PostalAddress): string {
  if (!a) return "";
  return [a.administrativeArea, a.locality, a.sublocality, ...(a.addressLines ?? [])].filter(Boolean).join("");
}
