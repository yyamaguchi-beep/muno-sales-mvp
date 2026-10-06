import { formatAddress, type GbpLocation } from "./location.js";

const KANJI_NUM: Record<string, string> = { 〇: "0", 一: "1", 二: "2", 三: "3", 四: "4", 五: "5", 六: "6", 七: "7", 八: "8", 九: "9" };

/** 店舗名の正規化: 全角半角・大小・空白・記号を無視 */
export function normalizeName(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/[\s・･\-‐ー_.]/g, "");
}

/**
 * 住所の正規化: 「5丁目12-19」「５丁目１２番１９号」「5-12-19」を同一視する。
 * 都道府県・市の有無にも左右されないよう、比較は「区以降」で行う。
 */
export function normalizeAddress(s: string): string {
  let t = s.normalize("NFKC").replace(/[一二三四五六七八九〇]/g, (c) => KANJI_NUM[c] ?? c);
  t = t.replace(/\s+/g, "").replace(/〒?\d{3}-?\d{4}/, "").replace(/^日本、?/, "");
  t = t.replace(/(\d+)丁目/g, "$1-").replace(/(\d+)番地?/g, "$1-").replace(/(\d+)号/g, "$1");
  t = t.replace(/[‐－−ー―]/g, "-").replace(/-+/g, "-").replace(/-$/, "");
  const ku = t.indexOf("区");
  return ku >= 0 ? t.slice(Math.max(0, t.lastIndexOf("市", ku) + 1)) : t;
}

export interface MatchResult {
  location: GbpLocation;
  nameMatch: boolean;
  addressMatch: boolean;
  address: string;
}

export function evaluateLocation(loc: GbpLocation, expectedName: string, expectedAddress: string): MatchResult {
  const address = formatAddress(loc.storefrontAddress);
  const nameMatch = normalizeName(loc.title ?? "") === normalizeName(expectedName);
  const addressMatch = address !== "" && normalizeAddress(address) === normalizeAddress(expectedAddress);
  return { location: loc, nameMatch, addressMatch, address };
}

/** 店舗名と住所の「両方」が一致する店舗が、ちょうど1件のときだけ返す */
export function findUniqueMatch(locations: GbpLocation[], expectedName: string, expectedAddress: string): {
  match: MatchResult | null;
  candidates: MatchResult[];
  reason: string;
} {
  const evaluated = locations.map((l) => evaluateLocation(l, expectedName, expectedAddress));
  const both = evaluated.filter((e) => e.nameMatch && e.addressMatch);
  const partial = evaluated.filter((e) => e.nameMatch || e.addressMatch);
  if (both.length === 1) return { match: both[0]!, candidates: partial, reason: "店舗名・住所が一致" };
  if (both.length > 1) return { match: null, candidates: both, reason: "店舗名・住所が一致する店舗が複数あります" };
  return {
    match: null,
    candidates: partial,
    reason: partial.length ? "店舗名か住所の一方のみ一致する店舗があります (安全のため自動選択しません)" : "一致する店舗がありません",
  };
}
