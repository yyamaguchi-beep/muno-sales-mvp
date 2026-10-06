import type { KeywordIntent } from "./themes.js";

export interface KeywordEntry {
  keyword: string;
  intents: KeywordIntent[];
}

/** primaryKeyword 候補 (検索意図ごと) */
export const PRIMARY_KEYWORDS: KeywordEntry[] = [
  { keyword: "大阪市生野区 就労継続支援B型", intents: ["area", "beginner"] },
  { keyword: "生野区 B型事業所", intents: ["area", "visit", "transport", "family", "supporter"] },
  { keyword: "就労継続支援B型 大阪", intents: ["area", "beginner", "welfare"] },
  { keyword: "障害者 就労支援 生野区", intents: ["area", "beginner", "family"] },
  { keyword: "B型事業所 見学 大阪", intents: ["visit"] },
  { keyword: "精神障害 就労支援 大阪", intents: ["mental"] },
  { keyword: "発達障害 就労支援 大阪", intents: ["developmental"] },
  { keyword: "生活保護 就労支援 大阪", intents: ["welfare"] },
  { keyword: "週1 B型事業所", intents: ["weekly"] },
  { keyword: "在宅 B型事業所 大阪", intents: ["remote"] },
  { keyword: "送迎 B型 生野区", intents: ["transport"] },
  { keyword: "PC作業 B型事業所", intents: ["pc"] },
  { keyword: "古着 B型事業所", intents: ["clothes"] },
  { keyword: "B型事業所 家族 相談", intents: ["family"] },
  { keyword: "就労継続支援B型 相談支援専門員", intents: ["supporter"] },
];

/** secondaryKeywords 候補 */
export const SECONDARY_KEYWORDS: KeywordEntry[] = [
  { keyword: "生野区 B型事業所", intents: ["area"] },
  { keyword: "大阪 就労支援", intents: ["area", "beginner"] },
  { keyword: "障害福祉サービス", intents: ["beginner", "family", "supporter", "welfare"] },
  { keyword: "B型 見学", intents: ["visit", "beginner"] },
  { keyword: "B型 体験利用", intents: ["visit"] },
  { keyword: "受給者証", intents: ["beginner", "family", "supporter"] },
  { keyword: "通所 日数 相談", intents: ["weekly"] },
  { keyword: "生活リズム", intents: ["mental", "beginner", "weekly"] },
  { keyword: "精神障害 通所", intents: ["mental"] },
  { keyword: "発達障害 仕事 向いている", intents: ["developmental"] },
  { keyword: "障害者手帳なし 相談", intents: ["welfare", "beginner"] },
  { keyword: "生活保護 B型", intents: ["welfare"] },
  { keyword: "在宅利用", intents: ["remote"] },
  { keyword: "在宅 PC作業", intents: ["remote", "pc"] },
  { keyword: "送迎あり", intents: ["transport"] },
  { keyword: "昼食あり", intents: ["transport", "beginner"] },
  { keyword: "データ入力", intents: ["pc"] },
  { keyword: "古着 検品", intents: ["clothes"] },
  { keyword: "商品撮影", intents: ["clothes", "pc"] },
  { keyword: "梱包 発送 作業", intents: ["clothes"] },
  { keyword: "小路 生野区", intents: ["area"] },
  { keyword: "北巽 布施 周辺", intents: ["area"] },
  { keyword: "家族 相談", intents: ["family"] },
  { keyword: "相談支援事業所 連携", intents: ["supporter"] },
  { keyword: "日中活動", intents: ["supporter", "mental"] },
];
