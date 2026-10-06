// エピソード（1投稿）のデータ構造。
// 文章中の {波括弧} で囲んだ語は深い朱色で強調表示される。改行は \n。

export type ProceduralPreset =
	| 'candle-room' // 暗い室内に一本の和蝋燭（Hook / 締め）
	| 'rope-box' // 黒縄・赤縄・木箱・和紙
	| 'document' // 古文書風の紙・形代・札
	| 'cord-paper-flame' // 黒い紐で結んだ紙と炎
	| 'sealed-box' // 黒縄で封じられた木箱
	| 'flame-macro' // 炎のアップと煙
	| 'end-dark'; // 締めの暗転

export type Visual =
	| {type: 'procedural'; preset: ProceduralPreset; seed?: number}
	/** public/ からの相対パス。例: 'assets/images/rope.jpg' */
	| {type: 'image'; src: string; focusX?: number; focusY?: number}
	| {type: 'video'; src: string; startFromSec?: number; muted?: boolean};

export type CandleSpec = {
	/** 画面上の炎の位置（px, 1080×1920 基準） */
	x: number;
	y: number;
	/** 炎の大きさ（1 = 標準の和蝋燭） */
	scale?: number;
	/** 蝋燭本体を描くか（画像素材に炎だけ重ねる場合は false） */
	body?: boolean;
	/** ピンぼけ量（px） */
	blur?: number;
	/** 周囲を照らす光の強さ 0..1.5 */
	glow?: number;
	smoke?: boolean;
};

export type CaptionLine = {
	/** シーン開始からの表示タイミング（秒） */
	at: number;
	text: string;
	/** large: 一段大きく / word: 一語ずつのリズム表示用 */
	size?: 'body' | 'large';
	/** true の場合、直前の行に続けて同じ行に表示する（書く。結ぶ。切る。のような演出） */
	inline?: boolean;
};

/** 史実・伝承・再構成を必ず区別して表示するための注記 */
export type SourceNote = {
	tag: '史実' | '伝承' | '民間信仰' | '言葉' | '再構成' | '演出';
	text: string;
};

export type Sfx = {
	/** public/ からの相対パス */
	src: string;
	/** シーン開始からの秒 */
	at: number;
	volume?: number;
};

export type Scene = {
	id: string;
	durationSec: number;
	visual: Visual;
	/** 炎を重ねる。null で炎なし（procedural の各プリセットは自前で炎を描くので通常は不要） */
	candle?: CandleSpec | null;
	captions: CaptionLine[];
	note?: SourceNote;
	sfx?: Sfx[];
	/** カメラ: push-in の倍率（1.03 = 3%）。pull-out は 1 未満 */
	push?: number;
	/** 入りのトランジション */
	transition?: 'dissolve' | 'black' | 'cut';
	/** 画面の暗さ 0..1（締めで暗く落とす等） */
	darken?: number;
};

export type Episode = {
	/** 収蔵番号（例: '001'） */
	id: string;
	/** テーマ名（ヘッダーとファイル名に使用） */
	title: string;
	/** ローマ字テーマ（ヘッダー英字） */
	titleLatin: string;
	/** 冒頭 Hook */
	hook: {
		/** 小さい前置き（例: 'どうしても'） */
		lead: string;
		/** 大きい本体（{縁} のように強調） */
		main: string;
		durationSec: number;
		sfx?: Sfx[];
	};
	scenes: Scene[];
	/** 締め（ロゴ・ブランドコピー・導線） */
	cta: {
		copy: string;
		link: string;
		sub?: string;
		next?: string;
		durationSec: number;
		sfx?: Sfx[];
	};
	audio: {
		bgm?: {src: string; volume: number};
		/** 全編に敷く環境音（部屋の空気・蝋燭など） */
		ambience: {src: string; volume: number}[];
		/** 録音したナレーション（任意）。無ければ字幕のみで成立する設計 */
		narration?: {src: string; volume: number; startSec?: number};
	};
	/** ナレーション原稿（収録用。動画には字幕として出ない） */
	narrationScript: string;
	thumbnail: {lead: string; main: string; label?: string};
	/** 投稿用キャプション・ハッシュタグ（README / 書き出し用メモ） */
	post?: {caption: string; hashtags: string[]};
};
