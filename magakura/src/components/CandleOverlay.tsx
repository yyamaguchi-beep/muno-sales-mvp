import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CandleSpec} from '../data/types';
import {fbm1, flameState} from '../lib/noise';
import {COLORS} from '../styles/theme';
import {useSvgId} from './svgId';

/**
 * 一本の和蝋燭。炎・芯・ガラスのない裸火の光・煙をすべて SVG で描く。
 * x / y は「炎の根元（芯の先）」の座標。
 */
export const CandleOverlay: React.FC<CandleSpec & {seed?: number; intro?: boolean; bodyShade?: number}> = ({
	x,
	y,
	scale = 1,
	body = true,
	blur = 0,
	glow = 1,
	smoke = false,
	seed = 0,
	intro = false,
	bodyShade = 0,
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	const id = useSvgId('candle');
	const {sway, stretch, flicker} = flameState(frame, fps, seed);

	// 冒頭：芯に火が移った直後のように一瞬だけ大きく、すぐ落ち着く
	const flare = intro ? 1 + 0.35 * Math.exp(-frame / 7) : 1;

	const W = 44 * scale;
	const H = 128 * scale * flare * (1 + 0.1 * stretch);
	const tipX = sway * W * 0.55;
	const tipY = -H;
	const midShift = sway * W * 0.22;
	const outer = `M 0 ${0.24 * W} C ${-0.66 * W} ${0.2 * W} ${-0.56 * W + midShift} ${-0.48 * H} ${tipX} ${tipY} C ${0.56 * W + midShift} ${-0.48 * H} ${0.66 * W} ${0.2 * W} 0 ${0.24 * W} Z`;
	const core = `M 0 ${0.18 * W} C ${-0.36 * W} ${0.14 * W} ${-0.3 * W + midShift * 0.6} ${-0.32 * H} ${tipX * 0.5} ${-0.62 * H} C ${0.3 * W + midShift * 0.6} ${-0.32 * H} ${0.36 * W} ${0.14 * W} 0 ${0.18 * W} Z`;

	const intensity = (0.82 + 0.18 * flicker) * glow * (intro ? Math.min(1.25, flare) : 1);

	// 和蝋燭（上が太いイカリ型）
	const bTop = 66 * scale;
	const bBot = 44 * scale;
	const bH = 340 * scale;
	const top = 12 * scale; // 芯の長さ
	const bodyPath = `M ${-bTop / 2} ${top} Q 0 ${top - 6 * scale} ${bTop / 2} ${top} L ${bBot / 2} ${top + bH} L ${-bBot / 2} ${top + bH} Z`;

	const smokePaths = smoke
		? [0, 1, 2].map((k) => {
				const pts: string[] = [];
				const len = 620 * Math.min(1.6, Math.max(0.7, scale * 0.5));
				const t = frame / fps;
				for (let i = 0; i <= 40; i++) {
					const h = (i / 40) * len;
					const amp = 3 + h * 0.11;
					const dx =
						Math.sin(h * 0.012 - t * (1.1 + k * 0.3) + k * 2) * amp +
						fbm1(h * 0.004 + t * 0.25 + k * 9, seed + 40) * amp * 1.4;
					pts.push(`${(tipX + dx + k * 4).toFixed(1)},${(tipY - 6 * scale - h).toFixed(1)}`);
				}
				return 'M ' + pts.join(' L ');
		  })
		: [];

	return (
		<AbsoluteFill style={{pointerEvents: 'none'}}>
			<svg width="100%" height="100%" viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
				<defs>
					<radialGradient id={`${id}-halo`}>
						<stop offset="0" stopColor={`rgba(${COLORS.glow},0.55)`} />
						<stop offset="0.25" stopColor={`rgba(${COLORS.glow},0.16)`} />
						<stop offset="0.6" stopColor={`rgba(${COLORS.glow},0.04)`} />
						<stop offset="1" stopColor={`rgba(${COLORS.glow},0)`} />
					</radialGradient>
					<radialGradient id={`${id}-outer`} cx="0.5" cy="0.72" r="0.7">
						<stop offset="0" stopColor={COLORS.flameMid} />
						<stop offset="0.55" stopColor={COLORS.flameOuter} stopOpacity="0.95" />
						<stop offset="1" stopColor="#8a2a10" stopOpacity="0.2" />
					</radialGradient>
					<radialGradient id={`${id}-core`} cx="0.5" cy="0.75" r="0.6">
						<stop offset="0" stopColor="#ffffff" />
						<stop offset="0.6" stopColor={COLORS.flameCore} />
						<stop offset="1" stopColor={COLORS.flameMid} stopOpacity="0.6" />
					</radialGradient>
					<linearGradient id={`${id}-body`} x1="0" x2="1">
						<stop offset="0" stopColor="#1f160e" />
						<stop offset="0.28" stopColor="#a88e68" />
						<stop offset="0.45" stopColor="#dcc8a2" />
						<stop offset="0.55" stopColor="#d2bc94" />
						<stop offset="0.8" stopColor="#8a7254" />
						<stop offset="1" stopColor="#170f09" />
					</linearGradient>
					<linearGradient id={`${id}-bodyShade`} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="rgba(255,150,60,0.55)" />
						<stop offset="0.08" stopColor="rgba(230,120,40,0.22)" />
						<stop offset="0.22" stopColor="rgba(90,40,10,0.12)" />
						<stop offset="0.5" stopColor="rgba(20,10,4,0.55)" />
						<stop offset="1" stopColor="rgba(0,0,0,0.93)" />
					</linearGradient>
					<linearGradient id={`${id}-translucent`} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="rgba(255,170,90,0.55)" />
						<stop offset="0.12" stopColor="rgba(255,140,60,0.18)" />
						<stop offset="0.3" stopColor="rgba(255,140,60,0)" />
					</linearGradient>
					<linearGradient id={`${id}-smoke`} x1="0" y1="1" x2="0" y2="0">
						<stop offset="0" stopColor="rgba(210,200,190,0.0)" />
						<stop offset="0.08" stopColor="rgba(210,200,190,0.30)" />
						<stop offset="0.5" stopColor="rgba(190,180,170,0.12)" />
						<stop offset="1" stopColor="rgba(190,180,170,0)" />
					</linearGradient>
					<filter id={`${id}-soft`} x="-100%" y="-100%" width="300%" height="300%">
						<feGaussianBlur stdDeviation={2.2 * Math.sqrt(scale) + blur} />
					</filter>
					<filter id={`${id}-core-blur`} x="-100%" y="-100%" width="300%" height="300%">
						<feGaussianBlur stdDeviation={1.4 * Math.sqrt(scale) + blur} />
					</filter>
					<filter id={`${id}-smoke-blur`} x="-50%" y="-10%" width="200%" height="120%">
						<feGaussianBlur stdDeviation={3 + scale} />
					</filter>
					<filter id={`${id}-body-blur`}>
						<feGaussianBlur stdDeviation={blur * 0.8} />
					</filter>
				</defs>

				<g transform={`translate(${x} ${y})`}>
					{/* 周囲を照らす光（画面に足し込む） */}
					<ellipse
						cx={tipX * 0.3}
						cy={-H * 0.45}
						rx={520 * scale * glow}
						ry={560 * scale * glow}
						fill={`url(#${id}-halo)`}
						opacity={intensity}
						style={{mixBlendMode: 'screen'}}
					/>

					{body && (
						<g filter={blur ? `url(#${id}-body-blur)` : undefined}>
							{/* 燭台 */}
							<rect x={-6 * scale} y={top + bH - 4 * scale} width={12 * scale} height={60 * scale} fill="#0d0a08" />
							<ellipse cx={0} cy={top + bH + 2 * scale} rx={bBot * 0.95} ry={9 * scale} fill="#17120e" />
							<ellipse cx={0} cy={top + bH + 60 * scale} rx={96 * scale} ry={16 * scale} fill="#0f0c0a" />
							<ellipse cx={0} cy={top + bH + 56 * scale} rx={96 * scale} ry={14 * scale} fill="#1d1712" />
							<ellipse cx={-30 * scale} cy={top + bH + 52 * scale} rx={40 * scale} ry={4 * scale} fill={`rgba(${COLORS.glow},0.18)`} />
							{/* 本体 */}
							<path d={bodyPath} fill={`url(#${id}-body)`} />
							<path d={bodyPath} fill={`url(#${id}-bodyShade)`} />
							{bodyShade > 0 && <path d={bodyPath} fill={`rgba(34,16,6,${bodyShade})`} />}
							{/* 蝋の透け（炎の光が上部に回り込む） */}
							<path d={bodyPath} fill={`url(#${id}-translucent)`} style={{mixBlendMode: 'screen'}} opacity={0.5 + 0.3 * flicker} />
							{/* 蝋だれ */}
							<path
								d={`M ${-bTop * 0.42} ${top} q ${-3 * scale} ${40 * scale} ${2 * scale} ${70 * scale} q ${4 * scale} ${6 * scale} ${5 * scale} -${6 * scale} l ${2 * scale} -${64 * scale} Z`}
								fill="rgba(240,230,210,0.55)"
							/>
							<path
								d={`M ${bTop * 0.2} ${top - 2 * scale} q ${2 * scale} ${22 * scale} ${-1 * scale} ${38 * scale} q ${3 * scale} ${5 * scale} ${5 * scale} 0 l ${1 * scale} -${38 * scale} Z`}
								fill="rgba(240,230,210,0.45)"
							/>
							{/* 上面のくぼみ（溶けた蝋が光る） */}
							<ellipse cx={0} cy={top} rx={bTop / 2 - 2 * scale} ry={6 * scale} fill="rgba(255,190,110,0.55)" />
							<ellipse cx={0} cy={top + 1 * scale} rx={bTop / 2 - 10 * scale} ry={3.5 * scale} fill="rgba(255,220,160,0.7)" />
						</g>
					)}

					{/* 煙 */}
					{smokePaths.map((d, i) => (
						<path
							key={i}
							d={d}
							stroke={`url(#${id}-smoke)`}
							strokeWidth={(2.5 + i * 1.6) * Math.max(1, scale * 0.6)}
							fill="none"
							filter={`url(#${id}-smoke-blur)`}
							opacity={0.8 - i * 0.2}
						/>
					))}

					{/* 芯 */}
					<path d={`M 0 ${top} Q ${tipX * 0.05} ${-2 * scale} ${tipX * 0.1} ${-10 * scale}`} stroke="#1a120c" strokeWidth={3.2 * scale} fill="none" strokeLinecap="round" />
					<circle cx={tipX * 0.1} cy={-10 * scale} r={2.2 * scale} fill="#ff7a2a" opacity={0.9} />

					{/* 炎 */}
					<g style={{mixBlendMode: 'screen'}}>
						<path d={outer} fill={`url(#${id}-outer)`} filter={`url(#${id}-soft)`} opacity={0.9 * Math.min(1, intensity + 0.15)} transform={`scale(1.18)`} />
						<path d={outer} fill={`url(#${id}-outer)`} filter={`url(#${id}-core-blur)`} />
						<path d={core} fill={`url(#${id}-core)`} filter={`url(#${id}-core-blur)`} />
						<ellipse cx={0} cy={0.02 * H} rx={0.22 * W} ry={0.1 * H} fill="rgba(90,120,255,0.45)" filter={`url(#${id}-core-blur)`} />
					</g>
				</g>
			</svg>
		</AbsoluteFill>
	);
};
