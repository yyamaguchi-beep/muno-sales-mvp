/**
 * 投稿直前の自動品質チェック (AI を使わないルールベース)。
 * 0〜100 点で採点し、blocking な違反が1つでもあれば点数に関わらず不合格。
 */
import { BUSINESS } from "../content/businessFacts.js";
import { AI_ISH_PHRASES, OVERUSED_PHRASES, PROHIBITED_PATTERNS } from "../content/phrases.js";
import type { PostPlan } from "../content/planner.js";
import type { PostRecord } from "../db/database.js";
import { charLength, countEmoji, countOccurrences, firstSentence, normalize, splitSentences, textSimilarity } from "../utils/text.js";
import type { CaptionDraft } from "./caption.js";
import type { ImageReview } from "./reviewer.js";

export interface CheckResult {
  id: string;
  label: string;
  passed: boolean;
  deduction: number;
  blocking: boolean;
  details: string[];
}

export interface ValidationResult {
  score: number;
  passed: boolean;
  minScore: number;
  blocking: boolean;
  checks: CheckResult[];
  /** AI 修正用のフィードバック */
  feedback: string[];
  metrics: { length: number; maxSimilarity: number; mostSimilarDate: string | null; emoji: number; ctaPhrases: number };
}

export interface ValidationInput {
  draft: CaptionDraft;
  plan: PostPlan;
  recent: PostRecord[];
  imagePrompt?: string;
  imageReview?: ImageReview | null;
  valueScore?: number | null;
  minScore: number;
  minValueScore: number;
}

const CTA_RE = /(お問い合わせ|お問合せ|ご連絡ください|お電話|LINE|お気軽に|ご相談ください|相談してください|見学[^。\n]{0,10}(?:ください|どうぞ|受付|お待ち))/g;
const HYPE_RE = /(日本一|No\.?\s?1|ナンバーワン|最高の|唯一の|業界初|圧倒的|最強|完璧な|大人気)/g;
const PHONE_RE = /0\d{1,4}[-‐ー−]?\d{1,4}[-‐ー−]?\d{3,4}/;
const URL_RE = /https?:\/\/|www\./i;

const ALLOWED_TIMES = new Set(["9:30", "18:30", "10:00", "16:00", "10:", "16:"]);

function addCheck(list: CheckResult[], c: Omit<CheckResult, "passed">) {
  list.push({ ...c, passed: c.deduction === 0 && !c.blocking });
}

export function validatePost(input: ValidationInput): ValidationResult {
  const { draft, plan, recent } = input;
  const text = draft.caption;
  const norm = normalize(text);
  const checks: CheckResult[] = [];
  const feedback: string[] = [];

  // 1. 店舗名
  {
    const details: string[] = [];
    let deduction = 0;
    let blocking = false;
    for (const m of text.normalize("NFKC").matchAll(/(GLOW\s*WORKS)\s*([^\s、。,.!?！？「」『』()\n]{0,3})/gi)) {
      const [whole, brand = "", suffix = ""] = m;
      if (brand !== "GLOW WORKS") {
        details.push(`表記ゆれ: 「${whole}」(正: ${BUSINESS.name})`);
        deduction += 5;
      }
      // 「GLOW WORKS 〇〇」の〇〇が生野以外の地名なら別店舗の可能性 → 投稿しない
      if (suffix && !suffix.startsWith("生野") && /^[\p{Script=Han}]{2}/u.test(suffix)) {
        details.push(`別店舗名の可能性: 「${whole}」`);
        blocking = true;
      }
    }
    if (/グロー\s*ワークス/.test(text)) {
      details.push("カタカナ表記「グローワークス」ではなく正式表記を使う");
      deduction += 5;
    }
    if (countOccurrences(text, "GLOW WORKS") === 0 && countOccurrences(text, "GLOWWORKS") === 0) {
      details.push(`事業所名「${BUSINESS.name}」が本文にない`);
      deduction += 5;
    }
    addCheck(checks, { id: "name", label: "店舗名は正しいか", deduction, blocking, details });
  }

  // 2. 住所
  {
    const details: string[] = [];
    let blocking = false;
    const t = text.normalize("NFKC");
    for (const m of t.matchAll(/小路東\s*(\d+)\s*丁目\s*([\d\-－−番の号]*)/g)) {
      const ok = m[1] === "5" && (m[2] === "" || /^12[-－−番の]?19号?$/.test(m[2]!));
      if (!ok) {
        details.push(`住所の誤り: 「${m[0]}」(正: ${BUSINESS.addressShort})`);
        blocking = true;
      }
    }
    if (/(?:大阪市|大阪府)(?!生野区|大阪市)[^\s、。]{1,3}区/.test(t.replace(/大阪市生野区/g, ""))) {
      const other = t.match(/大阪市(?!生野)([^\s、。]{1,3}区)/);
      if (other && /所在地|住所|にあります|に位置/.test(t)) {
        details.push(`所在地として別の区が書かれている可能性: 「${other[0]}」`);
        blocking = true;
      }
    }
    addCheck(checks, { id: "address", label: "住所は正しいか", deduction: 0, blocking, details });
  }

  // 3. 営業時間・定員
  {
    const details: string[] = [];
    let deduction = 0;
    let blocking = false;
    const t = text.normalize("NFKC").replace(/：/g, ":");
    const times = [...t.matchAll(/(\d{1,2}):(\d{2})/g)].map((m) => `${Number(m[1])}:${m[2]}`);
    const bad = times.filter((x) => !ALLOWED_TIMES.has(x));
    if (bad.length) {
      details.push(`事実と異なる可能性のある時刻: ${bad.join(", ")} (営業 9:30〜18:30 / 提供 10:00〜16:00)`);
      deduction += 20;
    }
    const biz = t.match(/営業時間[^0-9]{0,6}(\d{1,2}:\d{2})\D{1,3}(\d{1,2}:\d{2})/);
    if (biz && (biz[1] !== "9:30" || biz[2] !== "18:30")) {
      details.push(`営業時間が誤り: ${biz[1]}〜${biz[2]}`);
      blocking = true;
    }
    const svc = t.match(/(?:サービス)?提供時間[^0-9]{0,6}(\d{1,2}:\d{2})\D{1,3}(\d{1,2}:\d{2})/);
    if (svc && (svc[1] !== "10:00" || svc[2] !== "16:00")) {
      details.push(`サービス提供時間が誤り: ${svc[1]}〜${svc[2]}`);
      blocking = true;
    }
    const cap = t.match(/定員(?:は|が|:)?\s*(\d+)/);
    if (cap && Number(cap[1]) !== BUSINESS.capacity) {
      details.push(`定員が誤り: ${cap[1]}名 (正: ${BUSINESS.capacity}名)`);
      blocking = true;
    }
    addCheck(checks, { id: "facts", label: "営業時間・定員に矛盾がないか", deduction, blocking, details });
  }

  // 4. サービス内容の虚偽・未確認情報・医療効果
  {
    const details: string[] = [];
    for (const p of PROHIBITED_PATTERNS) {
      const m = text.normalize("NFKC").match(p.re);
      if (m) details.push(`${p.reason}: 「${m[0]}」`);
    }
    addCheck(checks, { id: "claims", label: "虚偽・未確認情報・医療効果の断定がないか", deduction: 0, blocking: details.length > 0, details });
  }

  // 5. 誇大表現
  {
    const hits = [...new Set(text.match(HYPE_RE) ?? [])];
    addCheck(checks, {
      id: "hype", label: "誇大表現がないか", deduction: hits.length ? 15 : 0, blocking: false,
      details: hits.map((h) => `誇大表現: 「${h}」`),
    });
  }

  // 6. キーワード詰め込み
  {
    const details: string[] = [];
    let deduction = 0;
    const pk = countOccurrences(text, plan.primaryKeyword.replace(/\s+/g, ""));
    if (pk > 2) { details.push(`primaryKeyword の完全一致が${pk}回`); deduction += 10; }
    const limits: [string, number][] = [["生野区", 4], ["就労継続支援B型", 3], ["B型", 7], ["大阪", 4], ["就労支援", 4]];
    for (const [w, max] of limits) {
      const c = countOccurrences(text, w);
      if (c > max) { details.push(`「${w}」が${c}回 (目安${max}回以内)`); deduction += 6; }
    }
    const hashtags = (text.match(/[#＃][^\s#＃]+/g) ?? []).length;
    if (hashtags > 3) { details.push(`ハッシュタグが${hashtags}個`); deduction += 10; }
    // 自然な列挙 (検品・採寸・撮影…) は許容し、検索語っぽい語の羅列だけを検出する
    const listy = /(?:[^\s、。]{2,14}[／/|｜]){3,}/.test(text) ||
      (text.match(/(?:[^\s、。・「」]{2,14}・){3,}[^\s、。・「」]{2,14}/g) ?? []).some(
        (seg) => seg.split("・").filter((w) => /生野|大阪|B型|就労|支援|事業所|障害/.test(w)).length >= 3,
      );
    if (listy) { details.push("キーワードの羅列に見える箇所がある"); deduction += 8; }
    addCheck(checks, { id: "keywords", label: "キーワード詰め込みになっていないか", deduction: Math.min(deduction, 25), blocking: false, details });
  }

  // 7. 直近投稿との類似
  let maxSim = 0;
  let mostSimilarDate: string | null = null;
  {
    const details: string[] = [];
    let deduction = 0;
    let blocking = false;
    const window = recent.slice(0, 30);
    for (const r of window) {
      if (!r.caption) continue;
      const s = textSimilarity(text, r.caption);
      if (s > maxSim) { maxSim = s; mostSimilarDate = r.date; }
    }
    if (maxSim >= 0.5) { details.push(`${mostSimilarDate} の投稿と本文が酷似 (類似度 ${maxSim.toFixed(2)})`); blocking = true; }
    else if (maxSim >= 0.33) { details.push(`${mostSimilarDate} の投稿と本文が似ている (類似度 ${maxSim.toFixed(2)})`); deduction += 15; }

    const title = normalize(draft.title);
    const hook = firstSentence(text);
    for (const r of window) {
      if (r.title && normalize(r.title) === title) { details.push(`見出しが ${r.date} と同一`); blocking = true; }
      else if (r.title && textSimilarity(draft.title, r.title, 2) >= 0.7) { details.push(`見出しが ${r.date} と類似`); deduction += 8; }
      if (r.caption && textSimilarity(hook, firstSentence(r.caption), 2) >= 0.6) { details.push(`書き出しが ${r.date} と類似`); deduction += 10; break; }
    }
    if (draft.structure && recent.slice(0, 3).some((r) => r.structure && normalize(r.structure) === normalize(draft.structure))) {
      details.push("文章構成が直近3投稿のいずれかと同じ"); deduction += 5;
    }
    if (draft.overlayText && recent.slice(0, 5).some((r) => r.overlayText === draft.overlayText)) {
      details.push(`画像のキャッチコピー「${draft.overlayText}」が直近5投稿と重複`); deduction += 5;
    }
    addCheck(checks, { id: "similarity", label: "直近投稿と酷似していないか", deduction: Math.min(deduction, 30), blocking, details });
  }

  // 8. 文章の自然さ
  {
    const details: string[] = [];
    let deduction = 0;
    const ai = AI_ISH_PHRASES.filter((p) => text.includes(p));
    if (ai.length) { details.push(`AI的な定型句: ${ai.join("、")}`); deduction += Math.min(12, ai.length * 4); }
    for (const p of OVERUSED_PHRASES) {
      const c = countOccurrences(text, p);
      if (c > 1) { details.push(`「${p}」を${c}回使用`); deduction += 6; }
      else if (c === 1 && recent.slice(0, 7).some((r) => countOccurrences(r.caption ?? "", p) > 0)) {
        details.push(`「${p}」は直近7投稿で使用済み`); deduction += 5;
      }
    }
    if (/^(こんにちは|こんばんは|おはようございます)/.test(text.trim())) { details.push("定型の挨拶で始まっている"); deduction += 10; }
    const sentences = splitSentences(text);
    const long = sentences.filter((s) => charLength(s) > 120);
    if (long.length) { details.push(`120字超の長い文が${long.length}つ`); deduction += 5; }
    let run = 1;
    for (let i = 1; i < sentences.length; i++) {
      const end = (s: string) => s.replace(/[。！？!?]+$/, "").slice(-3);
      run = end(sentences[i]!) === end(sentences[i - 1]!) ? run + 1 : 1;
      if (run >= 4) { details.push("同じ文末表現が4回以上連続"); deduction += 5; break; }
    }
    const emoji = countEmoji(text);
    if (emoji > 4) { details.push(`絵文字が${emoji}個 (4個以内)`); deduction += 10; }
    const excl = (text.match(/[！!]/g) ?? []).length;
    if (excl > 4) { details.push(`感嘆符が${excl}個`); deduction += 5; }
    if (PHONE_RE.test(text.normalize("NFKC"))) { details.push("本文に電話番号がある (投稿が却下される場合がある)"); deduction += 10; }
    if (URL_RE.test(text)) { details.push("本文にURLがある (リンクはボタンで設定する)"); deduction += 8; }
    addCheck(checks, { id: "natural", label: "文章が不自然ではないか", deduction: Math.min(deduction, 30), blocking: false, details });
  }

  // 9. 文字数
  const len = charLength(text);
  {
    const details: string[] = [];
    let deduction = 0;
    let blocking = false;
    if (len > 1500) { details.push(`${len}字: Google の上限1500字を超過`); blocking = true; }
    else if (len > 900) { details.push(`${len}字: 長すぎる (300〜700字目安)`); deduction += 15; }
    else if (len > 700) { details.push(`${len}字: やや長い`); deduction += 5; }
    else if (len < 250) { details.push(`${len}字: 短すぎる`); deduction += 20; }
    else if (len < 300) { details.push(`${len}字: やや短い`); deduction += 5; }
    addCheck(checks, { id: "length", label: "文字数 (300〜700字目安)", deduction, blocking, details });
  }

  // 10. CTA の量
  const ctaCount = (text.match(CTA_RE) ?? []).length;
  {
    const details: string[] = [];
    let deduction = 0;
    if (ctaCount >= 4) { details.push(`相談・問い合わせの呼びかけが${ctaCount}箇所`); deduction += 15; }
    else if (!plan.useCta && ctaCount >= 2) { details.push(`情報提供回なのに呼びかけが${ctaCount}箇所`); deduction += 10; }
    addCheck(checks, { id: "cta", label: "CTAが過剰でないか", deduction, blocking: false, details });
  }

  // 11. 画像とテーマの一致
  {
    const details: string[] = [];
    let deduction = 0;
    if (!plan.theme.scenes.includes(plan.scene.id)) { details.push("画像シーンがテーマ外"); deduction += 10; }
    if (input.imagePrompt) {
      if (!/no distorted fingers/i.test(input.imagePrompt)) { details.push("画像プロンプトに negative constraints がない"); deduction += 5; }
      if (!/Do NOT render any text/i.test(input.imagePrompt)) { details.push("画像プロンプトに文字禁止指示がない"); deduction += 5; }
    }
    if (input.imageReview) {
      const r = input.imageReview;
      if (!r.matchesTheme) { details.push("画像がテーマと一致しない (画像チェック)"); deduction += 15; }
      if (!r.handsOk) { details.push("手・指の破綻 (画像チェック)"); deduction += 15; }
      if (!r.noGarbledText) { details.push("画像内に崩れた文字 (画像チェック)"); deduction += 10; }
      if (!r.devicesOk) { details.push("PC・キーボードの破綻 (画像チェック)"); deduction += 10; }
      if (r.score < 70) { details.push(`画像チェック総合点 ${r.score}`); deduction += 10; }
    }
    addCheck(checks, { id: "image", label: "画像がテーマと一致し破綻がないか", deduction: Math.min(deduction, 30), blocking: false, details });
  }

  // 12. VALUE_SCORE (別AIによる有益性評価の結果を反映)
  if (input.valueScore !== undefined && input.valueScore !== null) {
    const ok = input.valueScore >= input.minValueScore;
    addCheck(checks, {
      id: "value", label: "読み手にとって有益か (VALUE_SCORE)", deduction: ok ? 0 : 15, blocking: false,
      details: ok ? [] : [`VALUE_SCORE ${input.valueScore} < ${input.minValueScore}`],
    });
  }

  const totalDeduction = checks.reduce((s, c) => s + c.deduction, 0);
  const score = Math.max(0, 100 - totalDeduction);
  const blocking = checks.some((c) => c.blocking);
  for (const c of checks) if (!c.passed) feedback.push(...c.details.map((d) => `[${c.label}] ${d}`));

  // 参考: norm を使った最終確認 (正規化後に空でないこと)
  if (!norm) feedback.push("本文が空です");

  return {
    score,
    passed: !blocking && score >= input.minScore && norm.length > 0,
    minScore: input.minScore,
    blocking,
    checks,
    feedback,
    metrics: { length: len, maxSimilarity: Number(maxSim.toFixed(3)), mostSimilarDate, emoji: countEmoji(text), ctaPhrases: ctaCount },
  };
}
