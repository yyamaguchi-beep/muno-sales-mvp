/** 日本語テキストの正規化・比較ユーティリティ */

export function normalize(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

/** 文字 n-gram の集合 */
export function ngrams(s: string, n = 3): Set<string> {
  const t = normalize(s).replace(/[、。!?！？「」『』（）()・\-ー〜~…:：;；,.]/g, "");
  const set = new Set<string>();
  for (let i = 0; i + n <= t.length; i++) set.add(t.slice(i, i + n));
  return set;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export function textSimilarity(a: string, b: string, n = 3): number {
  return jaccard(ngrams(a, n), ngrams(b, n));
}

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const h = normalize(haystack);
  const nd = normalize(needle);
  let count = 0;
  let idx = h.indexOf(nd);
  while (idx !== -1) {
    count++;
    idx = h.indexOf(nd, idx + nd.length);
  }
  return count;
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?])|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function firstSentence(text: string): string {
  return splitSentences(text)[0] ?? "";
}

/** 絵文字の数 (Extended_Pictographic) */
export function countEmoji(text: string): number {
  return (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
}

/** 文字数 (サロゲートペアを1文字として数える) */
export function charLength(text: string): number {
  return [...text].length;
}

/** シンプルな決定的ハッシュ (FNV-1a 32bit) */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function shortHash(s: string): string {
  return hash32(s).toString(16).padStart(8, "0");
}
