import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {SourceNote} from '../data/types';
import {COLORS, FONTS, SAFE, TYPE} from '../styles/theme';
import {useReveal} from './Caption';

const KANJI = ['', '壱', '弐', '参', '肆', '伍', '陸', '漆', '捌', '玖'];
/** '001' → '第壱號' / '012' → '第拾弐號' */
export const archiveNumber = (id: string) => {
	const n = parseInt(id, 10);
	if (!Number.isFinite(n) || n <= 0) return `第${id}號`;
	if (n < 10) return `第${KANJI[n]}號`;
	if (n < 100) return `第${n >= 20 ? KANJI[Math.floor(n / 10)] : ''}拾${KANJI[n % 10]}號`;
	return `第${n}號`;
};

/** 画面上部の「収蔵記録」ラベル。普通のオカルト垢ではなく“資料館”であることを示す */
export const ArchiveHeader: React.FC<{id: string; title: string; titleLatin: string}> = ({id, title, titleLatin}) => (
	<div
		style={{
			position: 'absolute',
			left: SAFE.left,
			right: 1080 - SAFE.right,
			top: SAFE.top + 12,
			display: 'flex',
			alignItems: 'baseline',
			justifyContent: 'space-between',
			color: COLORS.kinari,
			borderBottom: '1px solid rgba(230,220,200,0.28)',
			paddingBottom: 12,
			textShadow: '0 1px 6px rgba(0,0,0,0.9)',
		}}
	>
		<span style={{fontFamily: FONTS.serif, fontWeight: 600, fontSize: TYPE.header, letterSpacing: '0.18em', opacity: 0.88}}>
			禍蔵 収蔵記録 {archiveNumber(id)}　<span style={{color: COLORS.text}}>{title}</span>
		</span>
		<span style={{fontFamily: FONTS.latin, fontWeight: 600, fontSize: 24, letterSpacing: '0.3em', opacity: 0.6}}>
			No.{id} {titleLatin}
		</span>
	</div>
);

/** 史実／伝承／再構成を区別する注記 */
export const Note: React.FC<{note: SourceNote; frames: number}> = ({note, frames}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const reveal = useReveal(Math.round(0.35 * fps), 9);
	const out = interpolate(frame, [frames - 6, frames + 2], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const isFact = note.tag === '史実' || note.tag === '言葉';
	return (
		<div
			style={{
				position: 'absolute',
				left: SAFE.left,
				right: 1080 - SAFE.right,
				top: SAFE.top + 74,
				display: 'flex',
				gap: 18,
				alignItems: 'flex-start',
				color: COLORS.text,
				textShadow: '0 1px 8px rgba(0,0,0,0.95)',
				...reveal,
				opacity: (reveal.opacity as number) * out,
			}}
		>
			<span
				style={{
					flex: 'none',
					fontFamily: FONTS.serif,
					fontWeight: 800,
					fontSize: 24,
					letterSpacing: '0.12em',
					padding: '5px 10px 5px 13px',
					border: `1.5px solid ${isFact ? 'rgba(241,236,226,0.7)' : COLORS.accent}`,
					color: isFact ? COLORS.text : '#d9a7a3',
					background: 'rgba(0,0,0,0.45)',
					marginTop: 3,
				}}
			>
				{note.tag}
			</span>
			<span style={{fontFamily: FONTS.serif, fontWeight: 500, fontSize: TYPE.note, lineHeight: 1.55, letterSpacing: '0.03em', opacity: 0.9, fontFeatureSettings: '"palt" 1'}}>
				{note.text.split('\n').map((r, i) => (
					<div key={i}>{r}</div>
				))}
			</span>
		</div>
	);
};
