import type { Config } from "../config.js";
import { BUSINESS, factsForPrompt } from "../content/businessFacts.js";
import { OVERUSED_PHRASES, AI_ISH_PHRASES } from "../content/phrases.js";
import type { PostPlan } from "../content/planner.js";
import type { SeasonContext } from "../content/season.js";
import { CATEGORY_LABELS } from "../content/themes.js";
import type { PostRecord } from "../db/database.js";
import { countOccurrences, firstSentence } from "../utils/text.js";
import { mockCaption } from "./mock.js";
import { generateJson } from "./openaiClient.js";

export interface CaptionDraft {
  title: string;
  hook: string;
  structure: string;
  caption: string;
  overlayText: string;
  keywordsUsed: string[];
}

/** 画像に合成してよい短いフレーズ (事実に基づくものだけ) */
export const OVERLAY_PHRASES = [
  "週1日から相談できます",
  "在宅利用も相談できます",
  "送迎・昼食あり",
  "古着とPCの仕事",
  "見学のご相談受付中",
  "大阪市生野区のB型事業所",
  "手帳がなくても相談できます",
] as const;

const CAPTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "hook", "structure", "caption", "overlayText", "keywordsUsed"],
  properties: {
    title: { type: "string", description: "投稿の内部管理用見出し (30字以内・本文には含めない)" },
    hook: { type: "string", description: "本文の書き出し1文" },
    structure: { type: "string", description: "今回採用した構成を矢印でつないだ短い説明 例: 疑問→制度説明→当事業所の場合→相談導線" },
    caption: { type: "string", description: "Googleビジネスプロフィールに投稿する本文" },
    overlayText: { type: "string", description: "画像に合成する短いフレーズ。指定リストから1つ、または空文字" },
    keywordsUsed: { type: "array", items: { type: "string" }, description: "本文に自然に含めたキーワード" },
  },
} as const;

/** 直近投稿の要約 (AI に渡して差別化させる) */
export function summarizeHistory(recent: PostRecord[]): string {
  if (recent.length === 0) return "(まだ投稿履歴はありません)";
  return recent
    .map((r, i) => {
      const head = firstSentence(r.caption ?? "").slice(0, 70);
      return `${i + 1}. [${r.date}] テーマ:${r.theme}${r.angle ? `/${r.angle}` : ""} 見出し:「${r.title ?? ""}」 構成:${r.structure ?? "-"} 書き出し:「${head}」 KW:${r.primaryKeyword ?? "-"} 画像:${r.imageScene ?? "-"}/${r.imageComposition ?? "-"}`;
    })
    .join("\n");
}

/** 直近で使われた定型表現 → 今回は使用禁止 */
export function recentlyUsedPhrases(recent: PostRecord[], window = 7): string[] {
  const texts = recent.slice(0, window).map((r) => r.caption ?? "");
  return OVERUSED_PHRASES.filter((p) => texts.some((t) => countOccurrences(t, p) > 0));
}

export function buildSystemPrompt(): string {
  return `あなたは障害福祉 (就労継続支援B型) と MEO/ローカルSEO に精通した日本語コピーライターです。
「${BUSINESS.name}」の Google ビジネスプロフィール投稿を1本書きます。

# 最優先
- 検索で見つけた人が「1つでも役に立つ情報」を得られること。宣伝より情報。
- 人が普通に読んで自然な文章。キーワード羅列は禁止。

# 事実 (これ以外を事実として書かない)
${factsForPrompt()}

# 表現ルール
- 「必ず利用できる」「誰でも利用できる」「すぐ利用できる」「絶対に就職できる」「症状が改善する」等の断定は禁止。
- 医療的効果を断定しない。利用条件は「個別の状況により異なります」等の留保を必要に応じて入れる。
- 工賃・利用料の金額、送迎エリア、最寄り駅、空き状況、イベント、キャンペーン、実績数値は書かない。
- 地域名(北巽・布施など)を使う場合も「送迎できます」「対応エリアです」と断定しない。
- 障害のある人を一括りにしない。子ども扱い・上から目線・過剰な感動・ポエム・過剰な営業口調は禁止。
- 「こんにちは！GLOW WORKS生野です！」のような定型挨拶で始めない。毎回書き出しを変える。
- 絵文字は0〜4個。必要なときだけ。
- 電話番号・URLは本文に書かない (リンクはボタンで付く)。
- AIっぽい定型句を避ける: ${AI_ISH_PHRASES.join("、")}
- 定型表現「${OVERUSED_PHRASES.join("」「")}」は多用しない (使うとしても1回まで)。
- 文字数は全角300〜700字程度。長さそのものを目的にしない。段落は2〜5個、適度に改行する。
- 事業所名「${BUSINESS.name}」は本文中に1〜2回、正確な表記で。`;
}

export function buildUserPrompt(args: {
  plan: PostPlan;
  season: SeasonContext;
  recent: PostRecord[];
  bannedPhrases: string[];
  feedback?: string[];
  previous?: CaptionDraft;
}): string {
  const { plan, season } = args;
  const lines = [
    `# 今日の投稿条件`,
    `日付: ${season.date} (${season.weekday}曜日) / 季節: ${season.season}`,
    `季節の話題として使ってよいこと (使うかは任意。イベントや催しは作らない): ${season.notes.join(" / ")}`,
    `カテゴリ: ${CATEGORY_LABELS[plan.category]}`,
    `テーマ: ${plan.theme.code} ${plan.theme.name}`,
    `読み手: ${plan.theme.targetAudience}`,
    `今回の切り口: ${plan.angle}`,
    `primaryKeyword (本文に自然に1回程度): ${plan.primaryKeyword}`,
    `secondaryKeywords (無理に全部入れなくてよい・自然に): ${plan.secondaryKeywords.join(" / ")}`,
    plan.useCta
      ? `相談導線: 今回は最後に見学・相談への自然な一言を入れる (押し付けない)。`
      : `相談導線: 今回は情報提供が中心。見学・相談の呼びかけは入れないか、ごく控えめにする。`,
    `画像に合成するフレーズ候補 (今回の内容に合う場合のみ1つ。なければ空文字): ${OVERLAY_PHRASES.join(" / ")}`,
    "",
    `# 構成の考え方`,
    `例: 読み手の具体的な悩み・疑問 → 結論や気づき → 制度・サービスの説明 → ${BUSINESS.name}ではどうか → 得られる具体的メリット → 自然な相談導線`,
    `ただし直近投稿と同じ構成・同じ書き出し・同じ見出しにしないこと。Q&A形式、箇条書き少なめの解説、作業工程の紹介、ケースの例示 (架空の人物の成功談は書かない) など形式も変える。`,
    "",
    `# 直近の投稿 (これらと見出し・書き出し・構成・言い回しを被らせない)`,
    summarizeHistory(args.recent),
  ];
  if (args.bannedPhrases.length) {
    lines.push("", `# 今回使用禁止の表現 (直近で使用済み)`, args.bannedPhrases.map((p) => `- ${p}`).join("\n"));
  }
  if (args.feedback?.length) {
    lines.push("", `# 前回案への指摘 (必ず全て解消して書き直す)`, args.feedback.map((f) => `- ${f}`).join("\n"));
    if (args.previous) lines.push("", `# 前回案`, args.previous.caption);
  }
  return lines.join("\n");
}

export async function generateCaption(
  cfg: Config,
  args: { plan: PostPlan; season: SeasonContext; recent: PostRecord[]; feedback?: string[]; previous?: CaptionDraft },
): Promise<CaptionDraft> {
  const bannedPhrases = recentlyUsedPhrases(args.recent);
  if (cfg.AI_MOCK) return mockCaption(args.plan, args.season, args.recent, args.feedback);
  const draft = await generateJson<CaptionDraft>(cfg, {
    label: "キャプション生成",
    schemaName: "gbp_caption",
    schema: CAPTION_SCHEMA,
    system: buildSystemPrompt(),
    user: buildUserPrompt({ ...args, bannedPhrases }),
    maxAttempts: 2,
  });
  draft.caption = draft.caption.trim();
  if (!OVERLAY_PHRASES.includes(draft.overlayText as (typeof OVERLAY_PHRASES)[number])) draft.overlayText = "";
  return draft;
}
