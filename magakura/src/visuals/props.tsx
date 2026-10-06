// 演出用の小道具（縄・和紙・形代・札・木箱・朱印）を SVG で描く。
// いずれも実在資料の複製ではなく、質感を再現した「演出素材」。
import React, {useMemo} from 'react';
import {staticFile} from 'remotion';
import {seeded} from '../lib/noise';
import {COLORS} from '../styles/theme';
import {useSvgId} from '../components/svgId';

export const TEX = {
	wall: staticFile('assets/images/textures/wood_wall.jpg'),
	table: staticFile('assets/images/textures/wood_table.jpg'),
	box: staticFile('assets/images/textures/wood_box.jpg'),
	washi: staticFile('assets/images/textures/washi.jpg'),
	washiStained: staticFile('assets/images/textures/washi_stained.jpg'),
	oldPaper: staticFile('assets/images/textures/old_paper.jpg'),
	plaster: staticFile('assets/images/textures/plaster_wall.jpg'),
};

type Pt = [number, number];

const catmull = (pts: Pt[], step: number) => {
	const out: {p: Pt; a: number}[] = [];
	const P = [pts[0], ...pts, pts[pts.length - 1]];
	for (let i = 1; i < P.length - 2; i++) {
		const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
		const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
		const n = Math.max(2, Math.ceil(segLen / step));
		for (let j = 0; j < n; j++) {
			const t = j / n;
			const t2 = t * t;
			const t3 = t2 * t;
			const f = (k: 0 | 1) =>
				0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
			const x = f(0);
			const y = f(1);
			const prev = out[out.length - 1];
			const a = prev ? Math.atan2(y - prev.p[1], x - prev.p[0]) : Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
			out.push({p: [x, y], a});
		}
	}
	return out;
};

/** 撚り縄。points を通る滑らかな曲線上に撚りの山を並べて描く */
export const Rope: React.FC<{points: Pt[]; width: number; color: 'black' | 'red'; shadow?: number}> = ({points, width, color, shadow = 1}) => {
	const id = useSvgId('rope');
	const samples = useMemo(() => catmull(points, width * 0.42), [points, width]);
	const base = color === 'black' ? '#0b0907' : '#4a0d0e';
	const mid = color === 'black' ? '#2b241f' : '#8e1d1f';
	const hi = color === 'black' ? '#5a5048' : '#c2483f';
	const d = 'M ' + samples.map((s) => `${s.p[0].toFixed(1)} ${s.p[1].toFixed(1)}`).join(' L ');
	return (
		<g>
			<defs>
				<radialGradient id={`${id}-strand`} cx="0.45" cy="0.35" r="0.65">
					<stop offset="0" stopColor={hi} />
					<stop offset="0.5" stopColor={mid} />
					<stop offset="1" stopColor={base} />
				</radialGradient>
				<filter id={`${id}-sh`} x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation={width * 0.35} />
				</filter>
			</defs>
			<path d={d} transform={`translate(${width * 0.35} ${width * 0.45})`} stroke="rgba(0,0,0,0.75)" strokeWidth={width * 1.1} fill="none" strokeLinecap="round" filter={`url(#${id}-sh)`} opacity={shadow} />
			<path d={d} stroke={base} strokeWidth={width} fill="none" strokeLinecap="round" />
			{samples.map((s, i) => (
				<ellipse
					key={i}
					cx={s.p[0]}
					cy={s.p[1]}
					rx={width * 0.56}
					ry={width * 0.24}
					transform={`rotate(${((s.a * 180) / Math.PI + 58).toFixed(1)} ${s.p[0].toFixed(1)} ${s.p[1].toFixed(1)})`}
					fill={`url(#${id}-strand)`}
				/>
			))}
		</g>
	);
};

/** テクスチャを任意の形に貼る */
export const Textured: React.FC<{
	href: string;
	d: string;
	x: number;
	y: number;
	w: number;
	h: number;
	shade?: number;
	children?: React.ReactNode;
	edge?: string;
}> = ({href, d, x, y, w, h, shade = 0, children, edge}) => {
	const id = useSvgId('tex');
	return (
		<g>
			<defs>
				<clipPath id={`${id}-clip`}>
					<path d={d} />
				</clipPath>
			</defs>
			<g clipPath={`url(#${id}-clip)`}>
				<image href={href} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
				{children}
				{shade > 0 && <rect x={x} y={y} width={w} height={h} fill={`rgba(0,0,0,${shade})`} />}
			</g>
			{edge && <path d={d} fill="none" stroke={edge} strokeWidth={1.5} />}
		</g>
	);
};

const rectPath = (x: number, y: number, w: number, h: number) => `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;

/** 紙の縁をわずかに不揃いにした四角形（和紙のちぎれ感） */
const roughRect = (x: number, y: number, w: number, h: number, seed: number, amp = 2.5) => {
	const r = seeded(seed);
	const pts: string[] = [];
	const n = 14;
	const jitter = () => (r() - 0.5) * amp * 2;
	for (let i = 0; i <= n; i++) pts.push(`${x + (w * i) / n + jitter()} ${y + jitter()}`);
	for (let i = 1; i <= n; i++) pts.push(`${x + w + jitter()} ${y + (h * i) / n + jitter()}`);
	for (let i = n - 1; i >= 0; i--) pts.push(`${x + (w * i) / n + jitter()} ${y + h + jitter()}`);
	for (let i = n - 1; i > 0; i--) pts.push(`${x + jitter()} ${y + (h * i) / n + jitter()}`);
	return 'M ' + pts.join(' L ') + ' Z';
};

/**
 * 判読できない墨の筆致（くずし字の“気配”）。
 * 実在の文書・文字を装わないよう、文字ではなく連綿とした筆の流れだけを描く。
 */
export const InkStrokes: React.FC<{x: number; y: number; w: number; h: number; cols: number; seed: number; cell?: number; opacity?: number; color?: string}> = ({
	x,
	y,
	w,
	h,
	cols,
	seed,
	cell = 46,
	opacity = 0.82,
	color = '#1c1410',
}) => {
	const id = useSvgId('ink');
	const strokes = useMemo(() => {
		const r = seeded(seed);
		const out: {d: string; sw: number; o: number}[] = [];
		const colW = w / cols;
		for (let c = 0; c < cols; c++) {
			const cx = x + w - colW * (c + 0.5) + (r() - 0.5) * colW * 0.15;
			const colLen = h * (0.45 + r() * 0.55);
			let cy = y + r() * cell * 0.4;
			while (cy < y + colLen) {
				// ひと続きの筆（2〜5字分）
				const n = 2 + Math.floor(r() * 4);
				let px = cx + (r() - 0.5) * cell * 0.3;
				let py = cy;
				let d = `M ${px.toFixed(1)} ${py.toFixed(1)}`;
				for (let k = 0; k < n * 2; k++) {
					const nx = cx + (r() - 0.5) * cell * 0.5;
					const ny = py + cell * (0.3 + r() * 0.35);
					const c1x = px + (r() - 0.5) * cell * 1.1;
					const c1y = py + (ny - py) * 0.3;
					const c2x = nx + (r() - 0.5) * cell * 1.1;
					const c2y = py + (ny - py) * 0.8;
					d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
					px = nx;
					py = ny;
				}
				const sw = cell * (0.06 + r() * 0.06);
				const o = 0.55 + r() * 0.4;
				out.push({d, sw, o});
				// 打ち込みの点・はね
				if (r() < 0.7) {
					const dx = cx + (r() - 0.5) * cell * 0.6;
					const dy = cy + r() * (py - cy);
					out.push({d: `M ${dx.toFixed(1)} ${dy.toFixed(1)} q ${(cell * 0.12).toFixed(1)} ${(cell * 0.05).toFixed(1)} ${(cell * 0.18).toFixed(1)} ${(cell * 0.16).toFixed(1)}`, sw: sw * 1.6, o});
				}
				cy = py + cell * (0.4 + r() * 0.6);
			}
		}
		return out;
	}, [x, y, w, h, cols, seed, cell]);
	return (
		<g opacity={opacity}>
			<defs>
				<filter id={`${id}-bleed`} x="-5%" y="-5%" width="110%" height="110%">
					<feGaussianBlur stdDeviation={0.9} />
				</filter>
			</defs>
			<g filter={`url(#${id}-bleed)`}>
				{strokes.map((s, i) => (
					<path key={i} d={s.d} stroke={color} strokeWidth={s.sw} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={s.o} />
				))}
			</g>
		</g>
	);
};

/** 朱印（禍蔵の印） */
export const Seal: React.FC<{x: number; y: number; size: number; text?: string; opacity?: number; rotate?: number}> = ({x, y, size, text = '禍蔵', opacity = 0.88, rotate = 0}) => {
	const id = useSvgId('seal');
	const chars = [...text];
	return (
		<g transform={`translate(${x} ${y}) rotate(${rotate})`} opacity={opacity}>
			<defs>
				<filter id={`${id}-rough`} x="-10%" y="-10%" width="120%" height="120%">
					<feTurbulence type="fractalNoise" baseFrequency={1.6 / Math.max(20, size) * 20} numOctaves={2} seed={4} result="n" />
					<feDisplacementMap in="SourceGraphic" in2="n" scale={size * 0.035} />
					<feComponentTransfer>
						<feFuncA type="discrete" tableValues="0 1 1 1" />
					</feComponentTransfer>
				</filter>
				<mask id={`${id}-mask`}>
					<rect x={-size / 2} y={-size / 2} width={size} height={size} fill="white" />
					<rect x={-size / 2 + size * 0.07} y={-size / 2 + size * 0.07} width={size * 0.86} height={size * 0.86} fill="none" stroke="black" strokeWidth={size * 0.035} />
					{chars.map((c, i) => (
						<text
							key={i}
							x={0}
							y={-size * 0.2 + i * size * 0.44 - (chars.length - 2) * size * 0.2}
							fontSize={size * 0.4}
							fontFamily='"Noto Serif JP", serif'
							fontWeight={900}
							textAnchor="middle"
							dominantBaseline="central"
							fill="black"
						>
							{c}
						</text>
					))}
				</mask>
			</defs>
			<g filter={`url(#${id}-rough)`}>
				<rect x={-size / 2} y={-size / 2} width={size} height={size} fill={COLORS.accentDeep} mask={`url(#${id}-mask)`} />
			</g>
		</g>
	);
};

/** 和紙の一枚 */
export const Washi: React.FC<{x: number; y: number; w: number; h: number; seed: number; stained?: boolean; shade?: number; rotate?: number; children?: React.ReactNode; fold?: number}> = ({
	x,
	y,
	w,
	h,
	seed,
	stained,
	shade = 0.1,
	rotate = 0,
	children,
	fold = 0,
}) => {
	const d = roughRect(x, y, w, h, seed);
	const id = useSvgId('washi');
	return (
		<g transform={`rotate(${rotate} ${x + w / 2} ${y + h / 2})`}>
			<defs>
				<filter id={`${id}-sh`} x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation={10} />
				</filter>
				<linearGradient id={`${id}-fold`} x1="0" x2="0" y1="0" y2="1">
					<stop offset="0" stopColor="rgba(0,0,0,0)" />
					<stop offset="0.48" stopColor="rgba(0,0,0,0.18)" />
					<stop offset="0.5" stopColor="rgba(255,255,255,0.12)" />
					<stop offset="0.53" stopColor="rgba(0,0,0,0.1)" />
					<stop offset="1" stopColor="rgba(0,0,0,0)" />
				</linearGradient>
			</defs>
			<path d={d} transform="translate(10 14)" fill="rgba(0,0,0,0.7)" filter={`url(#${id}-sh)`} />
			<Textured href={stained ? TEX.washiStained : TEX.washi} d={d} x={x} y={y} w={w} h={h} shade={shade}>
				{children}
				{fold > 0 &&
					Array.from({length: fold}).map((_, i) => (
						<rect key={i} x={x} y={y + (h / (fold + 1)) * (i + 1) - h * 0.06} width={w} height={h * 0.12} fill={`url(#${id}-fold)`} />
					))}
			</Textured>
		</g>
	);
};

/** 形代（人形の紙）。各地の神社で用いられる、平たい頭・水平の肩・袖・浅い裾割れの素朴な形 */
export const katashiroPath = (x: number, y: number, s: number) => {
	const P = (px: number, py: number) => `${(x + px * s).toFixed(1)} ${(y + py * s).toFixed(1)}`;
	return `M ${P(130, 6)} C ${P(160, 6)} ${P(172, 26)} ${P(172, 50)} C ${P(172, 74)} ${P(158, 90)} ${P(146, 94)} L ${P(146, 106)} L ${P(252, 110)} L ${P(252, 150)} L ${P(206, 150)} L ${P(206, 236)} L ${P(196, 236)} L ${P(198, 400)} L ${P(138, 400)} L ${P(130, 352)} L ${P(122, 400)} L ${P(62, 400)} L ${P(64, 236)} L ${P(54, 236)} L ${P(54, 150)} L ${P(8, 150)} L ${P(8, 110)} L ${P(114, 106)} L ${P(114, 94)} C ${P(102, 90)} ${P(88, 74)} ${P(88, 50)} C ${P(88, 26)} ${P(100, 6)} ${P(130, 6)} Z`;
};

export const Katashiro: React.FC<{x: number; y: number; scale: number; rotate?: number; shade?: number; ink?: boolean; seed?: number}> = ({x, y, scale, rotate = 0, shade = 0.12, ink = true, seed = 1}) => {
	const d = katashiroPath(x, y, scale);
	const id = useSvgId('kata');
	return (
		<g transform={`rotate(${rotate} ${x + 130 * scale} ${y + 200 * scale})`}>
			<defs>
				<filter id={`${id}-sh`} x="-30%" y="-30%" width="160%" height="160%">
					<feGaussianBlur stdDeviation={7} />
				</filter>
			</defs>
			<path d={d} transform="translate(8 12)" fill="rgba(0,0,0,0.75)" filter={`url(#${id}-sh)`} />
			<Textured href={TEX.washi} d={d} x={x} y={y} w={260 * scale} h={400 * scale} shade={shade} edge="rgba(80,60,40,0.4)">
				{ink && <InkStrokes x={x + 100 * scale} y={y + 170 * scale} w={60 * scale} h={200 * scale} cols={1} cell={30 * scale} seed={seed} opacity={0.6} />}
			</Textured>
		</g>
	);
};

/** 木箱（真上から見た蓋） */
export const WoodBoxTop: React.FC<{x: number; y: number; w: number; h: number; rotate?: number; shade?: number; children?: React.ReactNode}> = ({x, y, w, h, rotate = 0, shade = 0.25, children}) => {
	const id = useSvgId('box');
	const d = rectPath(x, y, w, h);
	const inset = Math.min(w, h) * 0.05;
	return (
		<g transform={`rotate(${rotate} ${x + w / 2} ${y + h / 2})`}>
			<defs>
				<filter id={`${id}-sh`} x="-20%" y="-20%" width="140%" height="140%">
					<feGaussianBlur stdDeviation={22} />
				</filter>
				<linearGradient id={`${id}-bevel`} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor="rgba(255,220,170,0.18)" />
					<stop offset="0.5" stopColor="rgba(0,0,0,0)" />
					<stop offset="1" stopColor="rgba(0,0,0,0.45)" />
				</linearGradient>
			</defs>
			<rect x={x + 16} y={y + 26} width={w} height={h} fill="rgba(0,0,0,0.85)" filter={`url(#${id}-sh)`} />
			<Textured href={TEX.box} d={d} x={x} y={y} w={w} h={h} shade={shade}>
				<rect x={x} y={y} width={w} height={h} fill={`url(#${id}-bevel)`} />
				<rect x={x + inset} y={y + inset} width={w - inset * 2} height={h - inset * 2} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={3} />
				<rect x={x + inset + 3} y={y + inset + 3} width={w - inset * 2} height={h - inset * 2} fill="none" stroke="rgba(255,210,160,0.08)" strokeWidth={2} />
				{children}
			</Textured>
			<rect x={x} y={y} width={w} height={h} fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth={4} />
		</g>
	);
};

/** 札（細長い和紙に墨と朱印） */
export const Ofuda: React.FC<{x: number; y: number; w: number; h: number; rotate?: number; seed: number; shade?: number}> = ({x, y, w, h, rotate = 0, seed, shade = 0.15}) => (
	<Washi x={x} y={y} w={w} h={h} seed={seed} rotate={rotate} shade={shade} stained>
		<InkStrokes x={x + w * 0.25} y={y + h * 0.08} w={w * 0.5} h={h * 0.62} cols={1} cell={w * 0.42} seed={seed + 3} opacity={0.85} />
		<Seal x={x + w / 2} y={y + h * 0.82} size={w * 0.48} opacity={0.75} />
	</Washi>
);

/** 光の当たり方（蝋燭の位置を中心に周囲を落とす） */
export const Lighting: React.FC<{cx: number; cy: number; r: number; strength?: number; warm?: number}> = ({cx, cy, r, strength = 0.9, warm = 0.12}) => {
	const id = useSvgId('light');
	return (
		<g>
			<defs>
				<radialGradient id={`${id}-dark`} cx={cx} cy={cy} r={r} gradientUnits="userSpaceOnUse">
					<stop offset="0" stopColor="rgba(0,0,0,0)" />
					<stop offset="0.35" stopColor={`rgba(0,0,0,${strength * 0.25})`} />
					<stop offset="0.75" stopColor={`rgba(0,0,0,${strength * 0.75})`} />
					<stop offset="1" stopColor={`rgba(0,0,0,${strength})`} />
				</radialGradient>
				<radialGradient id={`${id}-warm`} cx={cx} cy={cy} r={r * 0.7} gradientUnits="userSpaceOnUse">
					<stop offset="0" stopColor={`rgba(${COLORS.glow},${warm})`} />
					<stop offset="1" stopColor={`rgba(${COLORS.glow},0)`} />
				</radialGradient>
			</defs>
			<rect x={-200} y={-200} width={1480} height={2320} fill={`url(#${id}-warm)`} style={{mixBlendMode: 'overlay'}} />
			<rect x={-200} y={-200} width={1480} height={2320} fill={`url(#${id}-dark)`} />
		</g>
	);
};
