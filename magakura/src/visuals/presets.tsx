// 手続き生成の背景プリセット。画像・動画素材が無くても「記録映像」として成立させるための演出素材。
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CandleOverlay} from '../components/CandleOverlay';
import type {ProceduralPreset} from '../data/types';
import {useSvgId} from '../components/svgId';
import {InkStrokes, Katashiro, Lighting, Ofuda, Rope, Seal, TEX, Washi, WoodBoxTop} from './props';

type P = {progress: number; seed: number};

const Svg: React.FC<{children: React.ReactNode; blur?: number}> = ({children, blur}) => (
	<svg width="100%" height="100%" viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0, filter: blur ? `blur(${blur}px)` : undefined}}>
		{children}
	</svg>
);

/** 卓上（真上から） */
const Table: React.FC<{shade?: number; rotate?: number}> = ({shade = 0.35, rotate = 90}) => (
	<g>
		<g transform={`rotate(${rotate} 540 960)`}>
			<image href={TEX.table} x={-440} y={-60} width={1960} height={2040} preserveAspectRatio="xMidYMid slice" />
		</g>
		<rect x={0} y={0} width={1080} height={1920} fill={`rgba(0,0,0,${shade})`} />
	</g>
);

/** Hook / 締め：古い部屋に和蝋燭が一本 */
const CandleRoom: React.FC<P & {end?: boolean}> = ({progress, end}) => {
	const id = useSvgId('room');
	const flameY = end ? 1530 : 1180;
	const scale = end ? 0.72 : 1.18;
	return (
		<AbsoluteFill style={{backgroundColor: '#040302'}}>
			<Svg>
				<defs>
					<linearGradient id={`${id}-shoji`} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stopColor="rgba(170,180,190,0.14)" />
						<stop offset="1" stopColor="rgba(170,180,190,0.02)" />
					</linearGradient>
					<filter id={`${id}-far`}>
						<feGaussianBlur stdDeviation={9} />
					</filter>
					<linearGradient id={`${id}-tableEdge`} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stopColor="rgba(255,190,120,0.16)" />
						<stop offset="0.04" stopColor="rgba(0,0,0,0.1)" />
						<stop offset="1" stopColor="rgba(0,0,0,0.75)" />
					</linearGradient>
				</defs>
				{/* 奥の壁（土壁と柱）— 被写界深度でぼかす */}
				<g filter={`url(#${id}-far)`} transform={`translate(0 ${-10 * progress})`}>
					<image href={TEX.plaster} x={-60} y={-60} width={1200} height={2040} preserveAspectRatio="xMidYMid slice" opacity={0.75} />
					<image href={TEX.wall} x={-40} y={-60} width={170} height={2040} preserveAspectRatio="xMidYMid slice" />
					<image href={TEX.wall} x={950} y={-60} width={170} height={2040} preserveAspectRatio="xMidYMid slice" />
					{/* 障子越しの弱い光 */}
					{!end && (
						<g opacity={0.9}>
							<rect x={140} y={120} width={330} height={760} fill={`url(#${id}-shoji)`} />
							{[0, 1, 2].map((i) => (
								<rect key={'v' + i} x={140 + 110 * (i + 1) - 3} y={120} width={6} height={760} fill="rgba(0,0,0,0.5)" />
							))}
							{[0, 1, 2, 3, 4, 5].map((i) => (
								<rect key={'h' + i} x={140} y={120 + 110 * (i + 1) - 3} width={330} height={6} fill="rgba(0,0,0,0.5)" />
							))}
						</g>
					)}
				</g>
				{/* 卓 */}
				<g transform={`translate(0 ${6 * progress})`}>
					<image href={TEX.table} x={-100} y={flameY + 380 * scale + 40} width={1280} height={700} preserveAspectRatio="xMidYMid slice" />
					<rect x={-100} y={flameY + 380 * scale + 40} width={1280} height={700} fill={`url(#${id}-tableEdge)`} />
				</g>
				<Lighting cx={540} cy={flameY - 60} r={end ? 900 : 1150} strength={end ? 0.97 : 0.9} warm={0.25} />
			</Svg>
			<CandleOverlay x={540} y={flameY} scale={scale} glow={end ? 0.7 : 1.15} intro={!end} smoke={end} seed={1} />
		</AbsoluteFill>
	);
};

/** 黒縄・赤縄・木箱・和紙 */
const RopeBox: React.FC<P> = ({progress, seed}) => (
	<AbsoluteFill style={{backgroundColor: '#050403'}}>
		<Svg>
			<Table shade={0.45} />
			<g transform={`translate(${-8 * progress} ${-14 * progress})`}>
				<WoodBoxTop x={70} y={210} w={640} h={520} rotate={-7} shade={0.35} />
				<Washi x={470} y={560} w={520} h={600} seed={seed} rotate={9} shade={0.18} fold={1}>
					<InkStrokes x={560} y={640} w={340} h={420} cols={4} seed={seed + 9} opacity={0.35} />
				</Washi>
			</g>
			<g transform={`translate(${-16 * progress} ${-20 * progress})`}>
				<Rope
					color="black"
					width={30}
					points={[
						[1150, 380],
						[900, 470],
						[760, 640],
						[600, 820],
						[380, 880],
						[230, 1010],
						[260, 1150],
						[420, 1130],
						[480, 1010],
						[360, 960],
						[-60, 1080],
					]}
				/>
				<Rope
					color="red"
					width={20}
					points={[
						[-60, 560],
						[180, 640],
						[420, 700],
						[640, 760],
						[860, 900],
						[1000, 1060],
						[1160, 1120],
					]}
				/>
			</g>
			<Lighting cx={780} cy={600} r={1150} strength={0.92} warm={0.3} />
		</Svg>
		<CandleOverlay x={950} y={600} scale={1.25} body={false} blur={7} glow={1.1} seed={3} />
	</AbsoluteFill>
);

/** 古紙・形代・札 */
const Document: React.FC<P> = ({progress, seed}) => (
	<AbsoluteFill style={{backgroundColor: '#050403'}}>
		<Svg>
			<Table shade={0.5} />
			<g transform={`translate(${6 * progress} ${-10 * progress})`}>
				<Washi x={110} y={230} w={860} h={900} seed={seed} rotate={-3} shade={0.05} stained>
					<image href={TEX.oldPaper} x={110} y={230} width={860} height={900} preserveAspectRatio="none" opacity={0.75} style={{mixBlendMode: 'multiply'}} />
					<InkStrokes x={200} y={300} w={680} h={760} cols={9} seed={seed + 1} cell={52} opacity={0.55} />
				</Washi>
				<Ofuda x={790} y={180} w={150} h={560} rotate={6} seed={seed + 4} />
			</g>
			<g transform={`translate(${-14 * progress} ${-18 * progress})`}>
				<Katashiro x={160} y={560} scale={1.1} rotate={-11} seed={seed + 2} shade={0.2} />
			</g>
			<Lighting cx={640} cy={760} r={1100} strength={0.92} warm={0.3} />
		</Svg>
		<CandleOverlay x={935} y={1010} scale={1.2} body={false} blur={7} glow={1.1} seed={5} />
	</AbsoluteFill>
);

/** 黒い紐で結んだ紙と炎 */
const CordPaperFlame: React.FC<P> = ({progress, seed}) => (
	<AbsoluteFill style={{backgroundColor: '#050403'}}>
		<Svg>
			<Table shade={0.55} rotate={0} />
			<g transform={`translate(${-10 * progress} ${-12 * progress}) rotate(-12 470 640)`}>
				<Washi x={250} y={300} w={420} h={680} seed={seed} shade={0.08} fold={2}>
					<InkStrokes x={330} y={360} w={260} h={560} cols={3} seed={seed + 2} cell={48} opacity={0.5} />
				</Washi>
				<Rope color="black" width={18} points={[[180, 560], [330, 556], [470, 548], [610, 556], [760, 566]]} />
				<Rope color="black" width={18} points={[[180, 640], [330, 636], [470, 628], [610, 636], [760, 646]]} />
				{/* 結び目と垂れ */}
				<Rope color="black" width={18} points={[[470, 590], [440, 610], [450, 650], [500, 640], [495, 600], [470, 590]]} />
				<Rope color="black" width={16} points={[[470, 640], [430, 720], [400, 840], [420, 960], [380, 1060]]} />
				<Rope color="black" width={16} points={[[480, 640], [530, 730], [570, 820], [560, 910]]} />
			</g>
			<Lighting cx={760} cy={620} r={1150} strength={0.9} warm={0.35} />
		</Svg>
		<CandleOverlay x={830} y={700} scale={1.7} body={false} blur={3} glow={1.2} smoke seed={7} />
	</AbsoluteFill>
);

/** 黒縄で封じた木箱 */
const SealedBox: React.FC<P> = ({progress, seed}) => (
	<AbsoluteFill style={{backgroundColor: '#050403'}}>
		<Svg>
			<Table shade={0.55} />
			<g transform={`translate(${4 * progress} ${-12 * progress})`}>
				<WoodBoxTop x={150} y={270} w={780} h={760} rotate={3} shade={0.3}>
					<Washi x={430} y={250} w={190} h={820} seed={seed} shade={0.1}>
						<InkStrokes x={470} y={330} w={110} h={420} cols={1} cell={70} seed={seed + 6} opacity={0.8} />
					</Washi>
				</WoodBoxTop>
				<g transform="rotate(3 540 650)">
					<Rope color="black" width={26} points={[[110, 640], [300, 652], [540, 660], [780, 652], [970, 640]]} />
					<Rope color="black" width={26} points={[[700, 200], [700, 420], [704, 660], [700, 900], [700, 1100]]} />
					<Rope color="black" width={26} points={[[704, 625], [668, 652], [690, 700], [742, 690], [740, 640], [704, 625]]} />
					<Rope color="black" width={22} points={[[700, 690], [660, 790], [630, 900], [650, 1010]]} />
					<Seal x={350} y={860} size={120} rotate={-4} />
				</g>
			</g>
			<Lighting cx={480} cy={700} r={1050} strength={0.9} warm={0.3} />
		</Svg>
		<CandleOverlay x={130} y={1020} scale={1.3} body={false} blur={8} glow={1.1} seed={9} />
	</AbsoluteFill>
);

/** 炎のアップと煙 */
const FlameMacro: React.FC<P> = ({progress}) => (
	<AbsoluteFill style={{backgroundColor: '#030202'}}>
		<Svg blur={10}>
			<image href={TEX.plaster} x={-60} y={-60} width={1200} height={2040} preserveAspectRatio="xMidYMid slice" opacity={0.35} />
			<Lighting cx={540} cy={720} r={950} strength={0.97} warm={0.4} />
		</Svg>
		<CandleOverlay x={540} y={980 + 10 * progress} scale={3.6} glow={1} smoke seed={11} bodyShade={0.45} />
	</AbsoluteFill>
);

export const ProceduralVisual: React.FC<{preset: ProceduralPreset; progress: number; seed?: number}> = ({preset, progress, seed = 1}) => {
	switch (preset) {
		case 'candle-room':
			return <CandleRoom progress={progress} seed={seed} />;
		case 'end-dark':
			return <CandleRoom progress={progress} seed={seed} end />;
		case 'rope-box':
			return <RopeBox progress={progress} seed={seed} />;
		case 'document':
			return <Document progress={progress} seed={seed} />;
		case 'cord-paper-flame':
			return <CordPaperFlame progress={progress} seed={seed} />;
		case 'sealed-box':
			return <SealedBox progress={progress} seed={seed} />;
		case 'flame-macro':
			return <FlameMacro progress={progress} seed={seed} />;
	}
};
