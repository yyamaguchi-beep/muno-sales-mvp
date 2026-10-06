import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import type {CaptionLine} from '../data/types';
import {renderMarkup} from '../lib/markup';
import {COLORS, FONTS, SAFE, TYPE} from '../styles/theme';

/** 文字の出現：0.23秒で、わずかに浮き上がりながらピントが合う */
export const useReveal = (atFrame: number, dur = 7) => {
	const frame = useCurrentFrame();
	const t = interpolate(frame, [atFrame, atFrame + dur], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing: Easing.out(Easing.cubic),
	});
	return {
		opacity: t,
		transform: `translateY(${(1 - t) * 10}px)`,
		filter: t < 1 ? `blur(${(1 - t) * 5}px)` : undefined,
	} as React.CSSProperties;
};

export const accentStyle: React.CSSProperties = {
	color: COLORS.accent,
	fontWeight: 800,
	// 暗所で朱が沈まないよう、ごく薄い明るい縁取りだけを足す
	textShadow: '0 0 1px rgba(255,200,190,0.35), 0 0 14px rgba(165,31,36,0.35), 0 2px 6px rgba(0,0,0,0.8)',
};

const Piece: React.FC<{line: CaptionLine; fps: number}> = ({line, fps}) => {
	const style = useReveal(Math.round(line.at * fps));
	const large = line.size === 'large';
	return (
		<span
			style={{
				display: 'inline-block',
				fontSize: large ? TYPE.captionLarge : TYPE.caption,
				fontWeight: large ? 800 : 600,
				marginLeft: line.inline ? '0.45em' : 0,
				...style,
			}}
		>
			{line.text.split('\n').map((row, i) => (
				<span key={i} style={{display: 'block'}}>
					{renderMarkup(row, accentStyle)}
				</span>
			))}
		</span>
	);
};

/** 画面中央下寄り（UIに被らない帯）に表示する字幕ブロック */
export const Caption: React.FC<{lines: CaptionLine[]; frames: number}> = ({lines, frames}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	// 行のまとまり（inline は直前の行に連結）
	const rows: CaptionLine[][] = [];
	for (const l of lines) {
		if (l.inline && rows.length) rows[rows.length - 1].push(l);
		else rows.push([l]);
	}
	const out = interpolate(frame, [frames - 6, frames + 2], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const bandIn = interpolate(frame, [0, 6], [0, 1], {extrapolateRight: 'clamp'});
	return (
		<>
			{/* 字幕の下敷き（黒の半透明グラデーション） */}
			<div
				style={{
					position: 'absolute',
					left: 0,
					right: 0,
					top: 960,
					height: 640,
					background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0) 100%)',
					opacity: out * bandIn,
				}}
			/>
			<div
				style={{
					position: 'absolute',
					left: SAFE.left,
					width: SAFE.right - SAFE.left + (1080 - SAFE.right - SAFE.left), // 左右対称に中央寄せ
					top: 1050,
					height: 440,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					textAlign: 'center',
					fontFamily: FONTS.serif,
					color: COLORS.text,
					lineHeight: 1.48,
					letterSpacing: '0.04em',
					fontFeatureSettings: '"palt" 1',
					textShadow: '0 2px 8px rgba(0,0,0,0.75)',
					opacity: out,
				}}
			>
				{rows.map((row, i) => (
					<div key={i} style={{whiteSpace: 'nowrap'}}>
						{row.map((l, j) => (
							<Piece key={j} line={l} fps={fps} />
						))}
					</div>
				))}
			</div>
		</>
	);
};
