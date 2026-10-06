// ===============================================================
// 収蔵記録 第壱號「縁切り」
// 次回以降は episodes/ にファイルを追加し、index.ts に登録するだけで差し替え可能。
// {波括弧} = 朱色の強調 / \n = 改行
// ===============================================================
import type {Episode} from './types';

const A = 'assets/audio/';

export const enkiri: Episode = {
	id: '001',
	title: '縁切り',
	titleLatin: 'ENKIRI',
	hook: {
		lead: 'どうしても',
		main: '{縁}を切りたい\n人がいる。',
		durationSec: 1.2,
		sfx: [{src: A + 'sfx_ignite.mp3', at: 0, volume: 0.55}],
	},
	scenes: [
		{
			id: 'akuen',
			durationSec: 2.8,
			visual: {type: 'procedural', preset: 'rope-box', seed: 3},
			captions: [{at: 0.15, text: '昔の日本には、\n“{悪縁}を{断つ}”という\n考え方があった。'}],
			note: {tag: '史実', text: '江戸時代には、離縁を願う女性が駆け込む\n幕府公認の「縁切寺」があった（東慶寺・満徳寺）'},
			sfx: [
				{src: A + 'sfx_rope.mp3', at: 0.0, volume: 0.45},
				{src: A + 'sfx_paper.mp3', at: 0.9, volume: 0.3},
			],
			push: 1.035,
		},
		{
			id: 'en',
			durationSec: 4,
			visual: {type: 'procedural', preset: 'document', seed: 7},
			captions: [{at: 0.2, text: '人と人との関係を、\n昔の人は『{縁}』と呼んだ。'}],
			note: {tag: '言葉', text: '「縁」はもと仏教語。物事を結びつける\n「因縁」の考え方に由来する'},
			sfx: [
				{src: A + 'sfx_paper.mp3', at: 0.05, volume: 0.4},
				{src: A + 'sfx_creak.mp3', at: 2.3, volume: 0.22},
			],
			push: 1.04,
		},
		{
			id: 'katachi',
			durationSec: 4,
			visual: {type: 'procedural', preset: 'cord-paper-flame', seed: 11},
			captions: [{at: 0.2, text: 'だから、\n終わらせたい縁には\n“{形}”を与えた。'}],
			note: {tag: '民間信仰', text: '人の形の紙「形代（かたしろ）」に穢れを移し、\n祓う風習は、今も各地の神社に残る'},
			sfx: [
				{src: A + 'sfx_cloth.mp3', at: 0.0, volume: 0.3},
				{src: A + 'sfx_rope.mp3', at: 1.6, volume: 0.35},
			],
			push: 1.035,
		},
		{
			id: 'osameru',
			durationSec: 4,
			visual: {type: 'procedural', preset: 'sealed-box', seed: 5},
			captions: [
				{at: 0.15, text: '書く。'},
				{at: 0.85, text: '結ぶ。', inline: true},
				{at: 1.55, text: '切る。', inline: true},
				{at: 2.45, text: 'そして、{納める}。', size: 'large'},
			],
			note: {tag: '再構成', text: '各地に伝わる作法を、禍蔵が四つの所作に\n要約したもの。特定の儀式の再現ではない'},
			sfx: [
				{src: A + 'sfx_brush.mp3', at: 0.1, volume: 0.6},
				{src: A + 'sfx_rope.mp3', at: 0.8, volume: 0.6},
				{src: A + 'sfx_snip.mp3', at: 1.55, volume: 0.6},
				{src: A + 'sfx_box.mp3', at: 2.45, volume: 0.7},
			],
			push: 1.03,
		},
		{
			id: 'torimodosu',
			durationSec: 4,
			visual: {type: 'procedural', preset: 'flame-macro', seed: 2},
			captions: [
				{at: 0.2, text: '相手を壊すためではない。'},
				{at: 0.8, text: '自分を取り戻すために。', size: 'large'},
			],
			note: {tag: '伝承', text: '縁切りの願掛けは「悪縁を離れ、良縁を結ぶ」\nためのものとも語られてきた'},
			sfx: [{src: A + 'sfx_cloth.mp3', at: 0.6, volume: 0.25}],
			push: 1.045,
		},
	],
	cta: {
		copy: '誰にも言えない願いを、\nここに{納める}。',
		link: '詳細記録は《裏帳》へ',
		sub: 'プロフィールのリンクより',
		next: '次の収蔵記録　丑の刻参り',
		durationSec: 4,
		sfx: [{src: A + 'sfx_bell_far.mp3', at: 0.1, volume: 0.5}],
	},
	audio: {
		bgm: {src: A + 'bgm_ambient.mp3', volume: 0.32},
		ambience: [
			{src: A + 'amb_room.mp3', volume: 0.55},
			{src: A + 'sfx_candle_loop.mp3', volume: 0.32},
		],
		// 収録後に追加: narration: {src: 'assets/audio/narration_001.mp3', volume: 1},
	},
	narrationScript: `どうしても、
縁を切りたい人がいる。

昔の日本には、
悪縁を断つという考え方がありました。

人と人との関係を、
目には見えない『縁』として捉える。

だから昔の人は、
その思いを形にした。

書き、
結び、
切り、
そして納める。

それは必ずしも、
相手を壊すためではありません。

自分自身を、
その縁から解放するため。

禍蔵。

誰にも言えない願いを、
ここに納める。`,
	thumbnail: {lead: 'どうしても', main: '{縁}を切りたい\n人がいる。', label: '収蔵記録 第壱號｜縁切り'},
	post: {
		caption:
			'どうしても、縁を切りたい人がいる。\n江戸には幕府公認の「縁切寺」があり、人の形の紙「形代」に思いを託す風習は今も残る。\n禍蔵は、その記録を残している。\n詳細記録は《裏帳》へ（プロフィールのリンク）',
		hashtags: ['#禍蔵', '#縁切り', '#民俗学', '#日本の風習', '#形代', '#縁切寺', '#怖い話', '#呪い'],
	},
};

export const episode = enkiri;
