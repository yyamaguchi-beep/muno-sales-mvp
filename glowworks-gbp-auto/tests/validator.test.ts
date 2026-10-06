import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePost } from "../src/ai/validator.js";
import { planPost } from "../src/content/planner.js";
import type { PostRecord } from "../src/db/database.js";
import { makeConfig } from "./helpers.js";

makeConfig();
const plan = planPost([], "2026-10-07", { ctaRatio: 0.3, forceTheme: "H" });

const GOOD = `PCを使う仕事に興味はあるけれど、タイピングに自信がない。見学の場でよく聞く声です。

GLOW WORKS 生野のPC作業は、古着の採寸メモを見ながら決まった項目を入力するところから始められます。商品名やサイズ、状態といった項目は毎回同じ順番なので、慣れるまではスタッフと一緒に確認しながら進めます。

入力に慣れてきたら、撮影した写真の整理や出品作業など、少しずつ範囲を広げていく方もいます。どこまで担当するかは、体調や得意不得意に合わせて相談しながら決めています。

就労継続支援B型は雇用契約を結ばない福祉サービスなので、作業時間や日数も個別に調整できます。PC作業がしたいけれど続けられるか不安という方は、実際の作業の流れを見てから判断することもできます。`;

function check(caption: string, recent: PostRecord[] = [], overrides: Partial<Parameters<typeof validatePost>[0]> = {}) {
  return validatePost({
    draft: { title: "PC入力の始め方", hook: "", structure: "悩み→作業説明→制度", caption, overlayText: "", keywordsUsed: [] },
    plan,
    recent,
    valueScore: 85,
    minScore: 85,
    minValueScore: 80,
    ...overrides,
  });
}

test("自然な投稿は合格する", () => {
  const r = check(GOOD);
  assert.equal(r.blocking, false, JSON.stringify(r.feedback));
  assert.ok(r.score >= 85, `score=${r.score} ${r.feedback.join(" / ")}`);
  assert.equal(r.passed, true);
});

test("断定表現・医療効果・工賃金額はブロック", () => {
  for (const bad of ["誰でも利用できます。", "必ず就職できます。", "通うと症状が改善します。", "工賃は月3万円です。", "今なら空きあります。", "北巽まで送迎できます。"]) {
    const r = check(GOOD + "\n" + bad);
    assert.equal(r.blocking, true, `should block: ${bad}`);
    assert.equal(r.passed, false);
  }
});

test("住所・営業時間・定員の誤りはブロック", () => {
  assert.equal(check(GOOD + "\n所在地は生野区小路東3丁目1-2です。").blocking, true);
  assert.equal(check(GOOD + "\n営業時間は9:00〜18:00です。").blocking, true);
  assert.equal(check(GOOD + "\n定員は30名です。").blocking, true);
  assert.equal(check(GOOD + "\nサービス提供時間は10:00〜16:00です。").blocking, false);
});

test("別店舗名はブロック", () => {
  assert.equal(check(GOOD.replace("GLOW WORKS 生野", "GLOW WORKS 東大阪")).blocking, true);
});

test("直近投稿と酷似していればブロック", () => {
  const rec = { date: "2026-10-01", caption: GOOD, title: "別の見出し" } as PostRecord;
  const r = check(GOOD, [rec]);
  assert.equal(r.blocking, true);
  assert.ok(r.metrics.maxSimilarity > 0.9);
});

test("定型句の多用・挨拶始まり・絵文字過多・キーワード詰め込みは減点", () => {
  const stuffed = "こんにちは！" + GOOD + "\n生野区 B型 生野区 B型事業所 生野区 就労支援 生野区 大阪 生野区 ✨✨✨✨✨ あなたのペースで、あなたのペースで";
  const r = check(stuffed);
  assert.equal(r.passed, false);
  assert.ok(r.score < 85);
});

test("自然な列挙 (検品・採寸・撮影・入力) はキーワード羅列と判定しない", () => {
  const r = check(GOOD + "\n作業は検品・採寸・撮影・入力・梱包に分かれています。");
  assert.equal(r.checks.find((c) => c.id === "keywords")?.deduction, 0);
});
