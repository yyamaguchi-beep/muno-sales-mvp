import React from 'react';
import {useVideoConfig} from 'remotion';
import {renderMarkup} from '../lib/markup';
import {Seal} from '../visuals/props';
import {COLORS, FONTS} from '../styles/theme';
import {accentStyle, useReveal} from './Caption';

/** 朱印＋禍蔵＋MAGAKURA のロゴ */
export const Logo: React.FC<{size?: number; style?: React.CSSProperties}> = ({size = 1, style}) => (
	<div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', ...style}}>
		<svg width={150 * size} height={150 * size} viewBox="-80 -80 160 160">
			<Seal x={0} y={0} size={136} opacity={0.95} />
		</svg>
		<div
			style={{
				fontFamily: FONTS.heavy,
				fontWeight: 900,
				fontSize: 92 * size,
				color: COLORS.text,
				letterSpacing: '0.42em',
				marginRight: '-0.42em',
				marginTop: 22 * size,
				lineHeight: 1.1,
				textShadow: '0 3px 16px rgba(0,0,0,0.8)',
			}}
		>
			禍蔵
		</div>
		<div
			style={{
				fontFamily: FONTS.latin,
				fontWeight: 600,
				fontSize: 36 * size,
				color: COLORS.kinari,
				letterSpacing: '0.62em',
				marginRight: '-0.62em',
				marginTop: 10 * size,
				opacity: 0.85,
			}}
		>
			MAGAKURA
		</div>
	</div>
);

/** 締めのカード：ブランドコピー → ロゴ → 《裏帳》導線 */
export const EndCard: React.FC<{copy: string; link: string; sub?: string; next?: string}> = ({copy, link, sub, next}) => {
	const {fps} = useVideoConfig();
	const copyIn = useReveal(Math.round(0.2 * fps), 10);
	const logoIn = useReveal(Math.round(0.95 * fps), 14);
	const linkIn = useReveal(Math.round(1.7 * fps), 10);
	const nextIn = useReveal(Math.round(2.3 * fps), 10);
	return (
		<div style={{position: 'absolute', left: 0, right: 0, top: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', color: COLORS.text, fontFeatureSettings: '"palt" 1'}}>
			<div style={{fontFamily: FONTS.serif, fontWeight: 600, fontSize: 64, lineHeight: 1.55, letterSpacing: '0.06em', textShadow: '0 2px 10px rgba(0,0,0,0.8)', ...copyIn}}>
				{copy.split('\n').map((r, i) => (
					<div key={i}>{renderMarkup(r, accentStyle)}</div>
				))}
			</div>
			<div style={{marginTop: 70, ...logoIn}}>
				<Logo />
			</div>
			<div style={{marginTop: 64, ...linkIn}}>
				<div style={{width: 360, height: 1, margin: '0 auto 30px', background: 'linear-gradient(to right, transparent, rgba(241,236,226,0.5), transparent)'}} />
				<div style={{fontFamily: FONTS.serif, fontWeight: 600, fontSize: 46, letterSpacing: '0.08em'}}>
					{renderMarkup(link.replace('《裏帳》', '{《裏帳》}'), accentStyle)}
				</div>
				{sub && <div style={{fontFamily: FONTS.serif, fontWeight: 500, fontSize: 30, marginTop: 14, opacity: 0.75, letterSpacing: '0.1em'}}>{sub}</div>}
			</div>
			{next && (
				<div style={{marginTop: 40, fontFamily: FONTS.serif, fontWeight: 500, fontSize: 27, letterSpacing: '0.16em', ...nextIn, opacity: (nextIn.opacity as number) * 0.6}}>
					{next}
				</div>
			)}
		</div>
	);
};
