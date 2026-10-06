/**
 * GLOW WORKS 生野 の「確認済みの事実」だけを定義する。
 * AI にはここにある情報以外を事実として書かせない。変更時はこのファイルを更新すること。
 */
export const BUSINESS = {
  name: "GLOW WORKS 生野",
  /** 本文中で許容する表記ゆれ (validator で使用) */
  nameVariantsAllowed: ["GLOW WORKS 生野", "GLOW WORKS生野", "GLOW WORKS"],
  address: "大阪府大阪市生野区小路東5丁目12-19",
  addressShort: "生野区小路東5丁目12-19",
  postalNote: "大阪市生野区",
  type: "就労継続支援B型事業所",
  capacity: 20,
  businessHours: { open: "9:30", close: "18:30" },
  serviceHours: { start: "10:00", end: "16:00" },
  websiteUrl: "https://glowworksikuno.com/",
  mapsUrl: "https://maps.app.goo.gl/4hV5YKBahziFH1Ur6",

  disabilityTypes: ["精神障害", "知的障害", "発達障害", "身体障害", "難病"],

  /** 相談可能なこと (=「必ず利用できる」ではない) */
  consultable: [
    "生活保護を利用している方も利用相談ができる",
    "障害者手帳がない場合も相談できる (医師の意見書等で利用できる場合があるが、個別の状況による)",
    "週1日からの利用を相談できる",
    "在宅での利用を相談できる (利用には条件・自治体の判断が関わる)",
  ],

  services: ["送迎あり (対応範囲は個別に確認が必要)", "昼食あり"],

  work: [
    "古着の検品",
    "古着の採寸",
    "古着の撮影",
    "商品情報のPC入力",
    "フリマ・ECサイトへの出品作業",
    "梱包",
    "発送",
    "その他のPC作業",
  ],

  policy: ["利用者ごとのペースを尊重する", "作業内容は相談しながら決める"],

  /** 生成文で使ってよい地域ワード (送迎可否・対応エリアとして断定しないこと) */
  areaWords: ["大阪市", "生野区", "小路", "小路東", "北巽", "布施"],
} as const;

/**
 * 未確認のため本文で断定してはいけない情報。
 * AI プロンプトに渡し、validator でも検出する。
 */
export const UNVERIFIED_TOPICS = [
  "工賃の金額・平均工賃・時給換算",
  "利用料の金額・「無料」と断定すること (所得により自己負担が発生する場合がある)",
  "昼食の料金・メニュー",
  "送迎の対応エリア・送迎時間・送迎ルート",
  "最寄り駅・駅からの徒歩分数",
  "土日祝の営業・イベント・キャンペーン",
  "就職実績・就職率・一般就労への移行人数",
  "スタッフの人数・資格・経歴",
  "空き状況 (「空きあり」「すぐ利用可」など)",
  "取引先企業名・販売サイト名",
  "医療的・治療的な効果",
] as const;

/** AI に渡す事実ブロック (プロンプト用テキスト) */
export function factsForPrompt(): string {
  const b = BUSINESS;
  return [
    `事業所名: ${b.name}`,
    `種別: ${b.type} (定員${b.capacity}名)`,
    `所在地: ${b.address}`,
    `営業時間: ${b.businessHours.open}〜${b.businessHours.close}`,
    `サービス提供時間: ${b.serviceHours.start}〜${b.serviceHours.end}`,
    `対象: ${b.disabilityTypes.join("・")}のある方`,
    `相談できること: ${b.consultable.join(" / ")}`,
    `サービス: ${b.services.join(" / ")}`,
    `主な作業: ${b.work.join("、")}`,
    `方針: ${b.policy.join(" / ")}`,
    `Webサイト: ${b.websiteUrl}`,
    "",
    "【未確認情報 — 本文で具体的に書かない・断定しない】",
    ...UNVERIFIED_TOPICS.map((t) => `- ${t}`),
  ].join("\n");
}
