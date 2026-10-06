import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {renderMarkup} from '../lib/markup';
import {COLORS, FONTS, TYPE} from '../styles/theme';

/**
 * 冒頭 Hook。0フレーム目から読める状態で出す（スクロールを止めるため、フェードインで待たせない）。
 * lead = 小さい前置き / main = 大きな本体（{縁} が朱）
 */
export const HookText: React.FC<{lead: string; main: string; frames: number; top?: number; still?: boolean}> = ({lead, main, frames, top = 400, still = false}) => {
	const current = useCurrentFrame();
	const frame = still ? 30 : current;
	const settle = interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'});
	const out = still ? 1 : interpolate(frame, [frames - 3, frames + 4], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				top,
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				textAlign: 'center',
				color: COLORS.text,
				opacity: out,
				transform: `scale(${1.025 - 0.025 * settle})`,
				filter: settle < 1 ? `blur(${(1 - settle) * 2}px)` : undefined,
				textShadow: '0 4px 22px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.9)',
				fontFeatureSettings: '"palt" 1',
			}}
		>
			<div style={{fontFamily: FONTS.heavy, fontWeight: 600, fontSize: TYPE.hookSmall, letterSpacing: '0.12em', marginBottom: 18, opacity: 0.92}}>{lead}</div>
			{main.split('\n').map((row, i) => (
				<div key={i} style={{fontFamily: FONTS.heavy, fontWeight: 900, fontSize: TYPE.hookLarge, lineHeight: 1.22, letterSpacing: '0.02em', whiteSpace: 'nowrap'}}>
					{renderMarkup(row, {
						color: COLORS.accent,
						textShadow: '0 0 2px rgba(255,190,170,0.4), 0 0 30px rgba(165,31,36,0.45), 0 4px 22px rgba(0,0,0,0.85)',
					})}
				</div>
			))}
		</div>
	);
};
