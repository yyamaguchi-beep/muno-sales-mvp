import type { Config } from "../config.js";
import { factsForPrompt } from "../content/businessFacts.js";
import type { PostPlan } from "../content/planner.js";
import type { CaptionDraft } from "./caption.js";
import { mockImageReview, mockValueReview } from "./mock.js";
import { generateJson, generateJsonWithImage } from "./openaiClient.js";

export interface ValueReview {
  valueScore: number;
  usefulInfo: string;
  issues: string[];
}

export interface ImageReview {
  score: number;
  matchesTheme: boolean;
  handsOk: boolean;
  noGarbledText: boolean;
  devicesOk: boolean;
  looksRealistic: boolean;
  issues: string[];
}

const VALUE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["valueScore", "usefulInfo", "issues"],
  properties: {
    valueScore: { type: "integer", description: "0〜100" },
    usefulInfo: { type: "string", description: "読み手が得られる具体的な情報を1文で" },
    issues: { type: "array", items: { type: "string" }, description: "改善すべき点 (なければ空配列)" },
  },
} as const;

/**
 * VALUE_SCORE: 「今日この投稿を検索で見つけた人に、何か1つでも有益な情報があるか」を
 * 生成とは別の呼び出し (評価者ロール) で採点する。
 */
export async function reviewValue(cfg: Config, plan: PostPlan, draft: CaptionDraft): Promise<ValueReview> {
  if (cfg.AI_MOCK) return mockValueReview(draft);
  return generateJson<ValueReview>(cfg, {
    label: "VALUE_SCORE評価",
    schemaName: "value_review",
    schema: VALUE_SCHEMA,
    system: `あなたは障害福祉サービスの利用を検討している当事者・家族・支援者の立場で、Googleマップの投稿を厳しく評価する編集者です。
採点基準 (100点満点):
- 読み手 (${plan.theme.targetAudience}) が具体的に役立つ情報・判断材料を1つ以上得られるか (40点)
- 制度や事業所の説明が正確で、未確認情報を断定していないか (20点)
- 自然で読みやすく、宣伝臭・ポエム・定型句が少ないか (20点)
- 次の行動 (情報収集・相談) がイメージできるか。ただし押し付けていないか (20点)
内容が薄い・抽象的なだけ・どの事業所でも言える内容は60点以下にすること。

参考: 事業所の確認済み事実
${factsForPrompt()}`,
    user: `テーマ: ${plan.theme.name} / 切り口: ${plan.angle}\n\n# 投稿本文\n${draft.caption}`,
  });
}

const IMAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "matchesTheme", "handsOk", "noGarbledText", "devicesOk", "looksRealistic", "issues"],
  properties: {
    score: { type: "integer", description: "0〜100 総合点" },
    matchesTheme: { type: "boolean" },
    handsOk: { type: "boolean", description: "指・関節の破綻がない (手が写っていなければ true)" },
    noGarbledText: { type: "boolean", description: "崩れた文字・意味不明な文字がない (後から合成したラベルは除く)" },
    devicesOk: { type: "boolean", description: "PC画面・キーボードの破綻がない (写っていなければ true)" },
    looksRealistic: { type: "boolean", description: "現実的な日本の事業所・室内に見える" },
    issues: { type: "array", items: { type: "string" } },
  },
} as const;

/** 生成画像の破綻・テーマ一致をチェック (合成ラベル付与前の画像を渡す) */
export async function reviewImage(cfg: Config, plan: PostPlan, jpeg: Buffer): Promise<ImageReview> {
  if (cfg.AI_MOCK) return mockImageReview();
  return generateJsonWithImage<ImageReview>(cfg, {
    label: "画像チェック",
    schemaName: "image_review",
    schema: IMAGE_SCHEMA,
    system:
      "あなたは写真のレタッチャー兼品質管理担当です。AI生成画像の破綻 (指・手・関節・顔・PC・キーボード・文字・重複人物・不自然な空間) を厳しく検査します。",
    user: `この画像は「${plan.scene.label}」(${plan.theme.name}) のイメージ写真として Google マップ投稿に使う予定です。日本の就労継続支援B型事業所の自然な雰囲気か、破綻がないかを評価してください。過剰な笑顔・病院っぽさ・欧米オフィス・高級オフィスも減点。`,
    imageBase64Jpeg: jpeg.toString("base64"),
  });
}

export function imageReviewPassed(r: ImageReview): boolean {
  return r.score >= 70 && r.handsOk && r.noGarbledText && r.devicesOk && r.matchesTheme;
}
