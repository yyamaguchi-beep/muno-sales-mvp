// 書体はローカル同梱（@fontsource）で読み込むため、レンダリング時にネット接続は不要。
// 日本語フォントは unicode-range で分割されているので、使う文字を明示的にロードしてから描画する。
import '@fontsource/noto-serif-jp/600.css';
import '@fontsource/noto-serif-jp/900.css';
import '@fontsource/shippori-mincho/500.css';
import '@fontsource/shippori-mincho/600.css';
import '@fontsource/shippori-mincho/800.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';

const FACES = [
	'600 40px "Noto Serif JP"',
	'900 40px "Noto Serif JP"',
	'500 40px "Shippori Mincho"',
	'600 40px "Shippori Mincho"',
	'800 40px "Shippori Mincho"',
	'500 40px "Cormorant Garamond"',
	'600 40px "Cormorant Garamond"',
];

/** 渡した全テキストのグリフを読み込み終えるまでレンダリングを待つ */
export const useFontsReady = (texts: string[]) => {
	const [handle] = useState(() => delayRender('Loading fonts'));
	const joined = Array.from(new Set(texts.join('').replace(/\s/g, ''))).join('');
	useEffect(() => {
		Promise.all(FACES.map((f) => document.fonts.load(f, joined + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')))
			.then(() => document.fonts.ready)
			.then(() => continueRender(handle))
			.catch((e) => {
				console.error(e);
				continueRender(handle);
			});
	}, [handle, joined]);
};
