// 禍蔵 ブランドトークン。色・書体・安全領域はすべてここで管理する。

export const VIDEO = {
	width: 1080,
	height: 1920,
	fps: 30,
} as const;

export const COLORS = {
	ink: '#050403', // 黒
	soot: '#120D09', // 煤
	umber: '#2A1C12', // 焦茶
	wood: '#3B2717', // 煤けた木
	kinari: '#E6DCC8', // 生成り
	paper: '#C9B48E', // 古紙色
	text: '#F1ECE2', // 本文
	accent: '#A51F24', // 強調（深い朱）
	accentDeep: '#9E1B1B', // 朱印・ロゴ
	flameCore: '#FFF4D6',
	flameMid: '#FFC66B',
	flameOuter: '#E8742A',
	glow: '255, 170, 90', // rgba 用
} as const;

export const FONTS = {
	// 本文・字幕（明朝）
	serif: '"Shippori Mincho", "Noto Serif JP", serif',
	// Hook など太い見出し
	heavy: '"Noto Serif JP", "Shippori Mincho", serif',
	// 英字
	latin: '"Cormorant Garamond", "EB Garamond", serif',
} as const;

/**
 * TikTok / Reels / Shorts の UI が被らない領域（1080×1920 基準）。
 * 上: ステータスバー＋タブ / 下: キャプション・音源表示 / 右: いいね等のアイコン列。
 */
export const SAFE = {
	top: 220,
	bottom: 1500,
	left: 90,
	right: 930, // 右側 150px はアイコン列のため情報を置かない
} as const;

export const TYPE = {
	hookSmall: 74,
	hookLarge: 132,
	caption: 66,
	captionLarge: 84,
	note: 30,
	header: 28,
	maxCharsPerLine: 14,
} as const;
