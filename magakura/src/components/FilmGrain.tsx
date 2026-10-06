import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {fbm1, seeded} from '../lib/noise';

const TILES = [0, 1, 2, 3].map((i) => staticFile(`assets/images/textures/grain_${i}.jpg`));

/** フィルムグレイン＋周辺減光＋ごく弱い露光ゆらぎ（記録映像の質感） */
export const FilmGrain: React.FC<{amount?: number}> = ({amount = 0.11}) => {
	const frame = useCurrentFrame();
	const r = seeded(frame * 7919 + 13);
	const ox = Math.round(r() * 1080);
	const oy = Math.round(r() * 1920);
	const exposure = fbm1(frame * 0.35, 77) * 0.025;
	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<AbsoluteFill style={{overflow: 'hidden', mixBlendMode: 'overlay', opacity: amount}}>
				<Img
					src={TILES[frame % TILES.length]}
					style={{position: 'absolute', width: 2160, height: 3840, left: -ox, top: -oy, imageRendering: 'auto'}}
				/>
			</AbsoluteFill>
			<AbsoluteFill
				style={{
					background: 'radial-gradient(ellipse 75% 60% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
				}}
			/>
			<AbsoluteFill style={{backgroundColor: exposure > 0 ? `rgba(255,220,180,${exposure * 0.6})` : `rgba(0,0,0,${-exposure})`}} />
		</AbsoluteFill>
	);
};
