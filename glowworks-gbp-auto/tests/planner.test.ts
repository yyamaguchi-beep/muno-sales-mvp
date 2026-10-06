import assert from "node:assert/strict";
import { test } from "node:test";
import { planPost } from "../src/content/planner.js";
import { CATEGORY_TARGETS, type Category } from "../src/content/themes.js";
import type { PostRecord } from "../src/db/database.js";
import { addDays } from "../src/utils/date.js";

function simulate(days: number) {
  const history: PostRecord[] = [];
  let date = "2026-10-01";
  for (let i = 0; i < days; i++) {
    const p = planPost(history, date, { ctaRatio: 0.3 });
    history.unshift({
      date, theme: p.theme.code, category: p.category, angle: p.angle, primaryKeyword: p.primaryKeyword,
      secondaryKeywords: JSON.stringify(p.secondaryKeywords), ctaType: p.useCta ? "LEARN_MORE" : "NONE",
      imageScene: p.scene.id, imageComposition: p.composition.id, imagePerson: p.person?.id ?? null, caption: "x",
    } as PostRecord);
    date = addDays(date, 1);
  }
  return history.reverse();
}

test("同じテーマが連続せず、14日以内に再使用されない", () => {
  const h = simulate(120);
  for (let i = 1; i < h.length; i++) assert.notEqual(h[i]!.theme, h[i - 1]!.theme, `day ${i}`);
  for (let i = 0; i < h.length; i++) {
    for (let j = Math.max(0, i - 13); j < i; j++) {
      assert.notEqual(h[i]!.theme, h[j]!.theme, `theme ${h[i]!.theme} reused within 14 days (day ${j} → ${i})`);
    }
  }
});

test("カテゴリ比率が目標に近い (±6%)", () => {
  const h = simulate(200);
  const counts = new Map<string, number>();
  for (const r of h) counts.set(r.category!, (counts.get(r.category!) ?? 0) + 1);
  for (const [cat, target] of Object.entries(CATEGORY_TARGETS) as [Category, number][]) {
    const share = (counts.get(cat) ?? 0) / h.length;
    assert.ok(Math.abs(share - target) <= 0.06, `${cat}: ${share.toFixed(2)} vs ${target}`);
  }
});

test("CTA比率はおおむね30%、構図は直近5回と被らない", () => {
  const h = simulate(100);
  const cta = h.filter((r) => r.ctaType === "LEARN_MORE").length / h.length;
  assert.ok(cta >= 0.2 && cta <= 0.45, `cta=${cta}`);
  for (let i = 5; i < h.length; i++) {
    const prev = h.slice(i - 5, i).map((r) => r.imageComposition);
    assert.ok(!prev.includes(h[i]!.imageComposition), `composition repeat at ${i}`);
  }
  for (let i = 1; i < h.length; i++) assert.notEqual(h[i]!.primaryKeyword, h[i - 1]!.primaryKeyword);
});

test("同じ日に再実行しても同じ計画 (決定的)", () => {
  const a = planPost([], "2026-10-07", { ctaRatio: 0.3 });
  const b = planPost([], "2026-10-07", { ctaRatio: 0.3 });
  assert.deepEqual([a.theme.code, a.angle, a.scene.id], [b.theme.code, b.angle, b.scene.id]);
});
