/**
 * AI_MOCK=true 用のオフライン実装。
 * OpenAI API を呼ばずにパイプライン全体 (DB・重複防止・validation・ストレージ・投稿JSON) を検証するためのもの。
 * 本番投稿には使わない (pipeline 側で AI_MOCK 時の本番投稿を拒否)。
 */
import sharp from "sharp";
import { BUSINESS } from "../content/businessFacts.js";
import type { PostPlan } from "../content/planner.js";
import type { SeasonContext } from "../content/season.js";
import type { Category } from "../content/themes.js";
import type { PostRecord } from "../db/database.js";
import { hash32 } from "../utils/text.js";
import type { CaptionDraft } from "./caption.js";
import type { ImageReview, ValueReview } from "./reviewer.js";

const OPENINGS: Record<Category, string[]> = {
  pain: [
    "「{target}」と感じたまま、相談先を探すのを先延ばしにしていませんか。",
    "{angle}。これは見学や相談の場でよく話題になるテーマです。",
    "不安があること自体は、利用をあきらめる理由にはなりません。今日は「{angle}」について整理してみます。",
  ],
  work: [
    "{name}の作業は、古着が届いてから発送するまでの工程を細かく分けて進めています。",
    "「どんな仕事をするの?」という質問に、今日は「{angle}」の視点からお答えします。",
    "作業の中身が分かると、通所のイメージはぐっと具体的になります。",
  ],
  system: [
    "就労継続支援B型は、雇用契約を結ばずに自分の体調に合わせて働ける障害福祉サービスです。",
    "B型事業所を探し始めると、制度の言葉が分かりにくいと感じる方が少なくありません。",
    "今日は「{angle}」について、できるだけ平易な言葉でまとめます。",
  ],
  intro: [
    "{name}(大阪市生野区)の通所の様子を、「{angle}」という切り口で紹介します。",
    "通う場所を決めるとき、作業内容と同じくらい大切なのが1日の過ごし方です。",
  ],
  howto: [
    "見学や体験は、利用を決めるためではなく「合うかどうかを確かめる」ための機会です。",
    "利用を考え始めたとき、最初に何をすればいいのかは意外と分かりにくいものです。",
  ],
  family: [
    "ご本人より先に、ご家族から相談をいただくことも珍しくありません。",
    "家族として何ができるのか迷ったときに知っておきたいことをまとめました。",
  ],
  supporter: [
    "相談支援専門員・医療機関・支援機関の皆さまへ、{name}の受け入れについてお知らせします。",
    "日中活動の場を検討されている支援者の方向けに、事業所の特徴を整理しました。",
  ],
  season: [
    "{seasonNote}。生活リズムが崩れやすいときこそ、通う場所があることが支えになる場合があります。",
    "{season}は{seasonNote}です。作業場でも季節に合わせた工夫をしています。",
  ],
};

const BODIES: Record<Category, string[]> = {
  pain: [
    "B型事業所は雇用契約を結ばない働き方のため、通所日数や作業時間を相談しながら決められるのが特徴です。{name}では週1日からの利用相談を受けており、体調に合わせて少しずつ日数を調整していく方もいます。",
    "作業は検品・採寸・撮影・入力・梱包と工程ごとに分かれているので、一度にすべてを覚える必要はありません。会話が少なくても進めやすい作業もあり、得意な工程から始められます。",
  ],
  work: [
    "古着の検品では、ほつれやシミがないかを一着ずつ確認します。採寸や撮影、商品情報のPC入力、出品、梱包、発送まで、工程ごとに担当を分けて進めています。",
    "PCが初めての方は、決まった項目を入力する作業から始めることもできます。どの工程が合うかは、実際にやってみてからスタッフと一緒に考えます。",
  ],
  system: [
    "利用には市区町村が発行する受給者証が必要で、申請の流れは自治体によって異なります。障害者手帳がない場合でも、医師の意見書などで利用できることがあるため、まずは相談してみるのがおすすめです。",
    "利用料は前年の所得などによって決まり、自己負担が発生しない方もいれば、上限額の範囲で負担がある方もいます。詳しくはお住まいの区役所や相談支援事業所で確認できます。",
  ],
  intro: [
    "サービス提供時間は10:00〜16:00です。作業の合間に休憩をはさみ、昼食も用意しています。送迎もありますので、通所の方法に不安がある場合はご相談ください(対応範囲は個別に確認します)。",
  ],
  howto: [
    "{name}では、見学で作業の様子や雰囲気を見ていただいたうえで、必要に応じて体験利用をご案内しています。一人での見学が不安な場合は、ご家族や支援者の方と一緒に来ていただくこともできます。",
    "利用開始までは、見学・体験、受給者証の申請、サービス等利用計画の作成といったステップがあります。期間は個別の状況により異なります。",
  ],
  family: [
    "ご本人の気持ちが固まっていなくても、ご家族が先に情報を集めておくことで選択肢が広がります。{name}では、作業内容や通所日数の考え方などを事前にお伝えしています。",
  ],
  supporter: [
    "精神障害・知的障害・発達障害・身体障害・難病のある方を対象に、定員20名で運営しています。週1日からの通所、在宅利用、生活保護を利用されている方の相談にも対応しています。",
  ],
  season: [
    "朝晩の寒暖差がある時期は、通所日数を一時的に調整したり、休憩を多めにとったりする方もいます。古着の作業でも季節の入れ替えがあり、扱う衣類が変わっていきます。",
  ],
};

const CLOSINGS_CTA = [
  "見学のご相談は、Webサイトからお問い合わせいただけます。",
  "気になる点があれば、見学の際に遠慮なく聞いてください。",
];
const CLOSINGS_INFO = [
  "利用については個別の状況により異なりますので、判断材料のひとつとして参考にしてください。",
  "自分に合う形を考えるときのヒントになればうれしいです。",
];

function pick<T>(arr: T[], seed: string): T {
  return arr[hash32(seed) % arr.length]!;
}

function fill(t: string, plan: PostPlan, season: SeasonContext): string {
  return t
    .replaceAll("{target}", plan.theme.targetAudience.replace(/の方$/, "") + "かもしれない")
    .replaceAll("{angle}", plan.angle)
    .replaceAll("{name}", BUSINESS.name)
    .replaceAll("{season}", season.season)
    .replaceAll("{seasonNote}", season.notes[0] ?? "季節の変わり目");
}

export function mockCaption(plan: PostPlan, season: SeasonContext, recent: PostRecord[], feedback?: string[]): CaptionDraft {
  const seed = `${plan.date}:${plan.theme.code}:${plan.angle}:${recent.length}:${feedback?.length ?? 0}`;
  const opening = fill(pick(OPENINGS[plan.category], seed + "o"), plan, season);
  const bodies = BODIES[plan.category].map((b) => fill(b, plan, season));
  const middle = `${plan.theme.targetAudience}にとって、${plan.angle}を知っておくことは、自分に合う事業所を選ぶうえでの判断材料になります。大阪市生野区周辺で就労支援を探している方にも参考になる内容です。`;
  const closing = plan.useCta ? pick(CLOSINGS_CTA, seed + "c") : pick(CLOSINGS_INFO, seed + "c");
  const caption = [opening, middle, ...bodies, closing].join("\n\n");
  return {
    title: `${plan.theme.name}: ${plan.angle}`.slice(0, 30),
    hook: opening,
    structure: plan.useCta ? "問いかけ→判断材料→制度/作業の説明→相談導線" : "問いかけ→判断材料→制度/作業の説明→留保",
    caption,
    overlayText: plan.useCta ? "見学のご相談受付中" : "",
    keywordsUsed: [plan.primaryKeyword],
  };
}

export function mockValueReview(draft: CaptionDraft): ValueReview {
  return { valueScore: 82, usefulInfo: `(mock) ${draft.title}`, issues: [] };
}

export function mockImageReview(): ImageReview {
  return { score: 90, matchesTheme: true, handsOk: true, noGarbledText: true, devicesOk: true, looksRealistic: true, issues: [] };
}

/** プレースホルダー画像 (グラデーション + 簡単な図形 + 英字ラベル) */
export async function mockImage(label: string, date: string): Promise<Buffer> {
  const hue = hash32(label + date) % 60;
  const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${40 + hue},45%,92%)"/><stop offset="1" stop-color="hsl(${110 + hue},25%,78%)"/>
    </linearGradient></defs>
    <rect width="1024" height="1024" fill="url(#g)"/>
    <rect x="620" y="90" width="300" height="380" rx="8" fill="#ffffff" fill-opacity="0.7"/>
    <rect x="80" y="640" width="864" height="40" rx="6" fill="#b89b72"/>
    <circle cx="200" cy="560" r="70" fill="#6f9a6a" fill-opacity="0.8"/>
    <text x="512" y="420" text-anchor="middle" font-family="sans-serif" font-size="44" fill="#3b4a3f">MOCK IMAGE (AI_MOCK=true)</text>
    <text x="512" y="480" text-anchor="middle" font-family="sans-serif" font-size="28" fill="#3b4a3f">${date}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}
