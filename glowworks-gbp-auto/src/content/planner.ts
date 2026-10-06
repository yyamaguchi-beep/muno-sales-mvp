import type { PostRecord } from "../db/database.js";
import { diffDays } from "../utils/date.js";
import { hash32 } from "../utils/text.js";
import { COMPOSITIONS, EXPRESSIONS, LIGHTINGS, PEOPLE, SCENES, type Scene } from "./imageScenes.js";
import { PRIMARY_KEYWORDS, SECONDARY_KEYWORDS } from "./keywords.js";
import { CATEGORY_TARGETS, THEMES, type Category, type Theme } from "./themes.js";

export interface PostPlan {
  date: string;
  theme: Theme;
  angle: string;
  category: Category;
  primaryKeyword: string;
  secondaryKeywords: string[];
  useCta: boolean;
  scene: Scene;
  composition: (typeof COMPOSITIONS)[number];
  lighting: string;
  person: (typeof PEOPLE)[number] | null;
  expression: string;
}

export interface PlannerOptions {
  ctaRatio: number;
  /** 同一テーマを再使用しない最小日数 */
  themeCooldownDays?: number;
  /** テーマを強制 (手動テスト用) */
  forceTheme?: string;
}

/** 決定的な疑似乱数で同順位を崩す (同じ日に再実行しても同じ計画になる) */
function tiebreak(date: string, key: string): number {
  return hash32(`${date}:${key}`) / 0xffffffff;
}

function lastUsedIndex<T>(history: PostRecord[], pick: (r: PostRecord) => T | null, value: T): number {
  const idx = history.findIndex((r) => pick(r) === value);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx; // 0 = 直近
}

/** 最も長く使われていない候補を選ぶ (LRU)。excludeRecent 件以内に使われたものは可能な限り避ける */
function pickLru<T>(
  candidates: T[],
  history: PostRecord[],
  pick: (r: PostRecord) => string | null,
  keyOf: (c: T) => string,
  date: string,
  excludeRecent = 0,
): T {
  const scored = candidates.map((c) => ({
    c,
    last: lastUsedIndex(history, pick, keyOf(c)),
    tb: tiebreak(date, keyOf(c)),
  }));
  const fresh = scored.filter((s) => s.last >= excludeRecent);
  const pool = fresh.length > 0 ? fresh : scored;
  pool.sort((a, b) => b.last - a.last || a.tb - b.tb);
  return pool[0]!.c;
}

export function rankCategories(history: PostRecord[], date: string): Category[] {
  const window = history.slice(0, 40);
  const total = Math.max(window.length, 1);
  const counts = new Map<string, number>();
  for (const r of window) if (r.category) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  const last = history[0]?.category;

  const scored = (Object.keys(CATEGORY_TARGETS) as Category[]).map((cat) => {
    const share = (counts.get(cat) ?? 0) / total;
    let score = CATEGORY_TARGETS[cat] - share;
    // 同じカテゴリの連続を避ける (悩み系は比率が高いので軽めのペナルティ)
    if (cat === last) score -= cat === "pain" ? 0.08 : 0.2;
    return { cat, score, tb: tiebreak(date, cat) };
  });
  scored.sort((a, b) => b.score - a.score || a.tb - b.tb);
  return scored.map((x) => x.cat);
}

/** テーマのクールダウン中でないか */
function themeAvailable(history: PostRecord[], date: string, code: string, cooldownDays: number): boolean {
  if (history[0]?.theme === code) return false;
  const d = history.find((r) => r.theme === code)?.date;
  return !d || diffDays(date, d) >= cooldownDays;
}

/** 比率の不足が大きい順に、クールダウン外のテーマが残っているカテゴリを選ぶ */
export function chooseCategory(history: PostRecord[], date: string, cooldownDays = 14): Category {
  const ranked = rankCategories(history, date);
  return (
    ranked.find((cat) => THEMES.some((t) => t.category === cat && themeAvailable(history, date, t.code, cooldownDays))) ?? ranked[0]!
  );
}

export function chooseTheme(history: PostRecord[], date: string, category: Category, cooldownDays: number): Theme {
  const themes = THEMES.filter((t) => t.category === category);
  const lastDate = (code: string) => history.find((r) => r.theme === code)?.date;
  const scored = themes.map((t) => {
    const d = lastDate(t.code);
    const age = d ? diffDays(date, d) : Number.POSITIVE_INFINITY;
    return { t, age, tb: tiebreak(date, t.code) };
  });
  const prev = history[0]?.theme;
  const eligible = scored.filter((s) => s.age >= cooldownDays && s.t.code !== prev);
  const pool = eligible.length > 0 ? eligible : scored.filter((s) => s.t.code !== prev);
  const finalPool = pool.length > 0 ? pool : scored;
  finalPool.sort((a, b) => b.age - a.age || a.tb - b.tb);
  return finalPool[0]!.t;
}

function intersects<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.some((x) => b.includes(x));
}

export function planPost(history: PostRecord[], date: string, opts: PlannerOptions): PostPlan {
  const cooldown = opts.themeCooldownDays ?? 14;

  let theme: Theme;
  if (opts.forceTheme) {
    const t = THEMES.find((x) => x.code === opts.forceTheme!.toUpperCase());
    if (!t) throw new Error(`不明なテーマコード: ${opts.forceTheme}`);
    theme = t;
  } else {
    theme = chooseTheme(history, date, chooseCategory(history, date, cooldown), cooldown);
  }

  const sameTheme = history.filter((r) => r.theme === theme.code);
  const angle = pickLru(theme.angles, sameTheme, (r) => r.angle, (a) => a, date);

  // キーワード: テーマの検索意図に合うものから、最近使っていないもの
  const primCandidates = PRIMARY_KEYWORDS.filter((k) => intersects(k.intents, theme.keywordIntents));
  const primary = pickLru(
    primCandidates.length ? primCandidates : PRIMARY_KEYWORDS,
    history,
    (r) => r.primaryKeyword,
    (k) => k.keyword,
    date,
    3,
  ).keyword;

  const secCount = 2 + (hash32(`${date}:sec`) % 3); // 2〜4個
  const recentSecondary = new Set(
    history.slice(0, 3).flatMap((r) => {
      try {
        return JSON.parse(r.secondaryKeywords ?? "[]") as string[];
      } catch {
        return [];
      }
    }),
  );
  const secCandidates = SECONDARY_KEYWORDS.filter((k) => k.keyword !== primary && intersects(k.intents, theme.keywordIntents))
    .map((k) => ({ k: k.keyword, recent: recentSecondary.has(k.keyword) ? 1 : 0, tb: tiebreak(date, k.keyword) }))
    .sort((a, b) => a.recent - b.recent || a.tb - b.tb);
  const secondary = secCandidates.slice(0, secCount).map((s) => s.k);
  // 候補が足りないときは汎用語で補う
  for (const fallback of ["大阪 就労支援", "障害福祉サービス", "生野区 B型事業所"]) {
    if (secondary.length >= 2) break;
    if (fallback !== primary && !secondary.includes(fallback)) secondary.push(fallback);
  }

  // CTA: 情報提供70% / 相談導線30% を目安に
  const last10 = history.slice(0, 10);
  const ctaShare = last10.length ? last10.filter((r) => r.ctaType && r.ctaType !== "NONE").length / last10.length : 0;
  const useCta =
    theme.category === "howto" ||
    (theme.ctaFriendly && ctaShare < opts.ctaRatio) ||
    ctaShare < opts.ctaRatio - 0.15;

  // 画像: シーン・構図・人物を直近と被らないようにローテーション
  const sceneCandidates = SCENES.filter((s) => theme.scenes.includes(s.id));
  const scene = pickLru(sceneCandidates, history, (r) => r.imageScene, (s) => s.id, date, 2);
  const compCandidates = COMPOSITIONS.filter((c) => !scene.noPeople || !["person", "over_shoulder", "hands"].includes(c.id));
  const composition = pickLru([...compCandidates], history, (r) => r.imageComposition, (c) => c.id, date, 5);

  let person: (typeof PEOPLE)[number] | null = null;
  if (!scene.noPeople) {
    const lastPerson = PEOPLE.find((p) => p.id === history.find((r) => r.imagePerson)?.imagePerson);
    const peopleCandidates = PEOPLE.filter((p) => !lastPerson || p.gender !== lastPerson.gender || p.gender === "x");
    person = pickLru([...peopleCandidates], history, (r) => r.imagePerson, (p) => p.id, date, 4);
  }

  const lighting = LIGHTINGS[hash32(`${date}:light`) % LIGHTINGS.length]!;
  const expression = EXPRESSIONS[hash32(`${date}:expr`) % EXPRESSIONS.length]!;

  return {
    date,
    theme,
    angle,
    category: theme.category,
    primaryKeyword: primary,
    secondaryKeywords: secondary.slice(0, 4),
    useCta,
    scene,
    composition,
    lighting,
    person,
    expression,
  };
}
