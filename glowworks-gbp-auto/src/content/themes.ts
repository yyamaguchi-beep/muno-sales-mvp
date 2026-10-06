export type Category = "pain" | "work" | "system" | "intro" | "howto" | "family" | "supporter" | "season";

/** 投稿カテゴリの目標比率 (合計 1.0) */
export const CATEGORY_TARGETS: Record<Category, number> = {
  pain: 0.3,
  work: 0.2,
  system: 0.15,
  intro: 0.1,
  howto: 0.1,
  family: 0.05,
  supporter: 0.05,
  season: 0.05,
};

export const CATEGORY_LABELS: Record<Category, string> = {
  pain: "利用者の悩み解決",
  work: "仕事内容",
  system: "制度・B型解説",
  intro: "事業所紹介",
  howto: "見学・利用方法",
  family: "家族向け",
  supporter: "支援者向け",
  season: "季節・地域",
};

export type KeywordIntent =
  | "area"
  | "beginner"
  | "visit"
  | "mental"
  | "developmental"
  | "welfare"
  | "weekly"
  | "remote"
  | "transport"
  | "pc"
  | "clothes"
  | "family"
  | "supporter";

export interface Theme {
  code: string;
  name: string;
  category: Category;
  targetAudience: string;
  /** 同じテーマでも毎回切り口を変えるための視点 */
  angles: string[];
  keywordIntents: KeywordIntent[];
  scenes: string[];
  /** 見学・相談導線を基本的に入れるテーマか */
  ctaFriendly: boolean;
}

export const THEMES: Theme[] = [
  {
    code: "A", name: "初めてB型を探している人", category: "system", targetAudience: "初めて就労継続支援B型を探している方",
    angles: ["B型とA型・就労移行支援の違い", "事業所選びで見ておきたいポイント", "最初に誰に相談すればよいか", "見学で質問しておくと良いこと", "受給者証とは何か"],
    keywordIntents: ["beginner", "area", "visit"], scenes: ["consultation", "workspace_interior", "first_day"], ctaFriendly: true,
  },
  {
    code: "B", name: "働くことに不安がある人", category: "pain", targetAudience: "働くことに不安を感じている方",
    angles: ["不安の正体を分けて考える", "短時間・少ない日数から始める選択肢", "作業を細かく分けるという工夫", "体調の波との付き合い方", "失敗を前提にした仕組み"],
    keywordIntents: ["beginner", "area", "mental"], scenes: ["small_group", "work_desk", "staff_conversation"], ctaFriendly: false,
  },
  {
    code: "C", name: "週5日は難しい人", category: "pain", targetAudience: "週5日の通所や勤務が難しい方",
    angles: ["週1日から相談できる意味", "通所日数を段階的に考える", "体力・体調に合わせた日数の決め方", "休んだ後の戻り方"],
    keywordIntents: ["weekly", "area"], scenes: ["daily_flow", "work_desk", "break_time"], ctaFriendly: false,
  },
  {
    code: "D", name: "人間関係に疲れた人", category: "pain", targetAudience: "職場や学校の人間関係に疲れた経験がある方",
    angles: ["一人で黙々とできる作業がある", "少人数の環境という選択肢", "スタッフへの相談の仕方", "距離感を自分で選べること"],
    keywordIntents: ["mental", "area", "pc"], scenes: ["work_desk", "clothes_inspection", "pc_work"], ctaFriendly: false,
  },
  {
    code: "E", name: "精神障害のある人", category: "pain", targetAudience: "うつ病・統合失調症・双極性障害などの精神障害のある方",
    angles: ["体調の波を前提にした通い方", "主治医との連携について", "休憩の取り方", "通所リズムを作る工夫"],
    keywordIntents: ["mental", "area"], scenes: ["break_time", "work_desk", "staff_conversation"], ctaFriendly: false,
  },
  {
    code: "F", name: "発達障害のある人", category: "pain", targetAudience: "ASD・ADHDなど発達障害のある方",
    angles: ["手順が見える作業の良さ", "得意・苦手に合わせた作業選び", "集中しやすい環境づくり", "指示の受け取り方の工夫"],
    keywordIntents: ["developmental", "pc", "area"], scenes: ["pc_work", "clothes_photo", "work_desk"], ctaFriendly: false,
  },
  {
    code: "G", name: "生活リズムを整えたい人", category: "intro", targetAudience: "生活リズムを整えたい方",
    angles: ["通う場所があることの意味", "サービス提供時間10:00〜16:00の使い方", "昼食があることの良さ", "朝の準備を少しずつ"],
    keywordIntents: ["area", "beginner"], scenes: ["daily_flow", "lunch", "workspace_interior"], ctaFriendly: false,
  },
  {
    code: "H", name: "PC作業に興味がある人", category: "work", targetAudience: "PC作業に興味がある方",
    angles: ["商品情報の入力作業とは", "PCが初めてでも始められる作業の分け方", "タイピング以外のPC作業", "出品作業の流れ"],
    keywordIntents: ["pc", "area"], scenes: ["pc_work", "data_entry", "home_pc"], ctaFriendly: false,
  },
  {
    code: "I", name: "古着が好きな人", category: "work", targetAudience: "古着やファッションが好きな方",
    angles: ["検品で見るポイント", "採寸という仕事", "商品撮影の工夫", "一着が届くまでの流れ"],
    keywordIntents: ["clothes", "area"], scenes: ["clothes_inspection", "clothes_photo", "clothes_rack"], ctaFriendly: false,
  },
  {
    code: "J", name: "在宅利用を検討している人", category: "work", targetAudience: "在宅での利用を検討している方",
    angles: ["在宅利用の相談で確認すること", "在宅でのPC作業のイメージ", "通所と在宅の組み合わせ", "在宅利用の注意点"],
    keywordIntents: ["remote", "pc", "area"], scenes: ["home_pc", "pc_work"], ctaFriendly: true,
  },
  {
    code: "K", name: "送迎が必要な人", category: "intro", targetAudience: "通所に送迎が必要な方",
    angles: ["送迎があることで広がる選択肢", "送迎について相談するときのポイント", "通所の負担を減らす工夫"],
    keywordIntents: ["transport", "area"], scenes: ["transport", "first_day"], ctaFriendly: true,
  },
  {
    code: "L", name: "ご家族", category: "family", targetAudience: "障害のある方のご家族",
    angles: ["家族が先に相談してもよい", "本人の気持ちを尊重した進め方", "家族が知っておきたいB型の基本", "通所が始まってからの関わり方"],
    keywordIntents: ["family", "area", "beginner"], scenes: ["consultation", "staff_conversation"], ctaFriendly: true,
  },
  {
    code: "M", name: "相談支援専門員", category: "supporter", targetAudience: "相談支援専門員の方",
    angles: ["事業所の特徴と受け入れの考え方", "見学・体験の調整について", "作業内容の情報提供", "週1日・在宅の相談について"],
    keywordIntents: ["supporter", "area"], scenes: ["consultation", "workspace_interior"], ctaFriendly: true,
  },
  {
    code: "N", name: "病院・クリニック・支援機関", category: "supporter", targetAudience: "病院・クリニック・支援機関の方",
    angles: ["日中活動の場としてのB型", "生活リズムづくりの選択肢として", "連携の進め方", "紹介前に知っておきたい事業所情報"],
    keywordIntents: ["supporter", "mental", "area"], scenes: ["workspace_interior", "staff"], ctaFriendly: true,
  },
  {
    code: "O", name: "B型事業所の仕組み", category: "system", targetAudience: "就労継続支援B型の制度を知りたい方",
    angles: ["雇用契約を結ばない働き方とは", "工賃とは何か (金額には触れない)", "利用に必要な手続き", "B型と一般就労の関係", "利用料の考え方 (金額は断定しない)"],
    keywordIntents: ["beginner", "area", "welfare"], scenes: ["workspace_interior", "consultation"], ctaFriendly: false,
  },
  {
    code: "P", name: "GLOW WORKSで行う仕事内容", category: "work", targetAudience: "作業内容を知りたい方",
    angles: ["作業工程の全体像", "梱包・発送の工夫", "一つの作業を分担する仕組み", "向き不向きで選べる作業"],
    keywordIntents: ["clothes", "pc", "area"], scenes: ["packing", "clothes_inspection", "small_group"], ctaFriendly: false,
  },
  {
    code: "Q", name: "1日の流れ", category: "intro", targetAudience: "通所のイメージを知りたい方",
    angles: ["朝の始まり方", "午前と午後の作業", "休憩と昼食", "帰る前の時間"],
    keywordIntents: ["area", "beginner"], scenes: ["daily_flow", "lunch", "break_time"], ctaFriendly: false,
  },
  {
    code: "R", name: "見学・体験について", category: "howto", targetAudience: "見学・体験を考えている方",
    angles: ["見学で見られること", "体験利用でわかること", "見学の申し込み方法", "一人での見学が不安な場合"],
    keywordIntents: ["visit", "area"], scenes: ["consultation", "first_day", "workspace_interior"], ctaFriendly: true,
  },
  {
    code: "S", name: "利用開始までの流れ", category: "howto", targetAudience: "利用開始までの手続きを知りたい方",
    angles: ["相談から利用開始までのステップ", "受給者証の申請について", "サービス等利用計画とは", "準備しておくとよいこと"],
    keywordIntents: ["beginner", "visit", "area"], scenes: ["consultation", "first_day"], ctaFriendly: true,
  },
  {
    code: "T", name: "よくある質問", category: "system", targetAudience: "利用を検討中で疑問がある方",
    angles: ["手帳がなくても相談できる?", "生活保護を利用していても大丈夫?", "途中で日数を変えられる?", "服装や持ち物は?", "PCが使えなくても大丈夫?"],
    keywordIntents: ["welfare", "beginner", "area", "weekly"], scenes: ["consultation", "staff_conversation"], ctaFriendly: false,
  },
  {
    code: "U", name: "「働ける自信がない」という悩み", category: "pain", targetAudience: "働ける自信がないと感じている方",
    angles: ["自信は始めた後についてくることもある", "小さな作業単位で考える", "できたことを記録する", "比べる相手を変える"],
    keywordIntents: ["beginner", "mental", "area"], scenes: ["work_desk", "staff_conversation"], ctaFriendly: false,
  },
  {
    code: "V", name: "「毎日通えない」という悩み", category: "pain", targetAudience: "毎日通うことが難しい方",
    angles: ["通所日数は相談して決められる", "休みの連絡の仕方", "在宅との組み合わせ", "まずは週1日から"],
    keywordIntents: ["weekly", "remote", "area"], scenes: ["daily_flow", "home_pc"], ctaFriendly: false,
  },
  {
    code: "W", name: "「人と話すのが苦手」という悩み", category: "pain", targetAudience: "人と話すのが苦手な方",
    angles: ["会話が少なくても進められる作業", "伝え方の工夫 (メモ・チャット)", "見学での話し方の不安", "スタッフとの関わり方"],
    keywordIntents: ["developmental", "mental", "pc"], scenes: ["pc_work", "clothes_photo", "work_desk"], ctaFriendly: false,
  },
  {
    code: "X", name: "「ブランクが長い」という悩み", category: "pain", targetAudience: "仕事や社会参加のブランクが長い方",
    angles: ["ブランクがあっても相談してよい理由", "生活リズムから整える", "久しぶりの作業での準備", "ブランク期間の伝え方"],
    keywordIntents: ["beginner", "area", "mental"], scenes: ["first_day", "work_desk"], ctaFriendly: false,
  },
  {
    code: "Y", name: "「自分にできる仕事が分からない」という悩み", category: "pain", targetAudience: "自分に合う仕事が分からない方",
    angles: ["いろいろな作業を試せる", "作業を通じて得意を見つける", "苦手の分かり方も大事", "スタッフと振り返る"],
    keywordIntents: ["beginner", "pc", "clothes"], scenes: ["small_group", "clothes_inspection", "pc_work"], ctaFriendly: false,
  },
  {
    code: "Z", name: "季節・時期に合わせたテーマ", category: "season", targetAudience: "季節の変わり目に体調や生活を気にかけている方",
    angles: ["季節の変わり目の体調管理", "季節と通所リズム", "季節の古着の扱い", "新しいことを始めたい時期"],
    keywordIntents: ["area", "beginner", "clothes"], scenes: ["seasonal", "clothes_rack", "workspace_interior"], ctaFriendly: false,
  },
];

export function themeByCode(code: string): Theme | undefined {
  return THEMES.find((t) => t.code === code);
}
