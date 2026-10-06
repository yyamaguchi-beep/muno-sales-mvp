import React from 'react';
import {COLORS} from '../styles/theme';

/** "{縁}を切りたい" → 強調語だけ朱色の span にする */
export const renderMarkup = (text: string, accentStyle?: React.CSSProperties): React.ReactNode[] => {
	const out: React.ReactNode[] = [];
	const re = /\{([^}]+)\}/g;
	let last = 0;
	let m: RegExpExecArray | null;
	let k = 0;
	while ((m = re.exec(text))) {
		if (m.index > last) out.push(<React.Fragment key={k++}>{text.slice(last, m.index)}</React.Fragment>);
		out.push(
			<span key={k++} style={{color: COLORS.accent, ...accentStyle}}>
				{m[1]}
			</span>,
		);
		last = m.index + m[0].length;
	}
	if (last < text.length) out.push(<React.Fragment key={k++}>{text.slice(last)}</React.Fragment>);
	return out;
};

export const stripMarkup = (text: string) => text.replace(/[{}]/g, '');

/** 文字数チェック用（字幕ルール：1行 最大14〜16文字） */
export const longestLine = (text: string) => Math.max(...stripMarkup(text).split('\n').map((l) => [...l].length));
