// ===============================================================
// 新しい投稿のひな形。コピーして src/data/<テーマ>.ts を作り、src/data/index.ts の EPISODES に追加する。
// {波括弧} = 朱色の強調 / \n = 改行 / 1行は14〜16文字以内 / 1画面は最大3行
// note.tag は必ず「史実・伝承・民間信仰・言葉・再構成・演出」のどれかを付け、断定表現は避ける
// ===============================================================
import type {Episode} from './types';

const A = 'assets/audio/';

export const template: Episode = {
	id: '002',
	title: '丑の刻参り',
	titleLatin: 'USHI NO TOKI MAIRI',
	hook: {
		lead: '',
		main: '',
		durationSec: 1.2,
		sfx: [{src: A + 'sfx_ignite.mp3', at: 0, volume: 0.55}],
	},
	scenes: [
		{
			id: 'scene1',
			durationSec: 2.8,
			// 素材がある場合: {type: 'image', src: 'assets/images/xxx.jpg'} / {type: 'video', src: 'assets/video/xxx.mp4'}
			visual: {type: 'procedural', preset: 'rope-box', seed: 1},
			// 画像・動画に炎を重ねる場合（炎の根元の座標）
			// candle: {x: 900, y: 600, scale: 1.2, body: false, blur: 6},
			captions: [{at: 0.15, text: ''}],
			note: {tag: '史実', text: ''},
			sfx: [],
			push: 1.035,
		},
	],
	cta: {
		copy: '誰にも言えない願いを、\nここに{納める}。',
		link: '詳細記録は《裏帳》へ',
		sub: 'プロフィールのリンクより',
		next: '',
		durationSec: 4,
		sfx: [{src: A + 'sfx_bell_far.mp3', at: 0.1, volume: 0.5}],
	},
	audio: {
		bgm: {src: A + 'bgm_ambient.mp3', volume: 0.32},
		ambience: [
			{src: A + 'amb_room.mp3', volume: 0.55},
			{src: A + 'sfx_candle_loop.mp3', volume: 0.32},
		],
	},
	narrationScript: '',
	thumbnail: {lead: '', main: '', label: ''},
};
