// 依存なしの決定論的ノイズ。Remotion はフレーム単位で再計算されるため Math.random() は使わない。

const hash = (n: number) => {
	const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
	return s - Math.floor(s);
};

/** 1D の滑らかなノイズ（0..1） */
export const noise1 = (x: number, seed = 0) => {
	const i = Math.floor(x);
	const f = x - i;
	const u = f * f * (3 - 2 * f);
	return hash(i + seed * 101.3) * (1 - u) + hash(i + 1 + seed * 101.3) * u;
};

/** 複数オクターブ（-1..1） */
export const fbm1 = (x: number, seed = 0, octaves = 4) => {
	let v = 0;
	let amp = 0.5;
	let freq = 1;
	let norm = 0;
	for (let o = 0; o < octaves; o++) {
		v += amp * noise1(x * freq, seed + o * 17);
		norm += amp;
		amp *= 0.5;
		freq *= 2.03;
	}
	return (v / norm) * 2 - 1;
};

/** シード付き擬似乱数（静的なレイアウト生成用） */
export const seeded = (seed: number) => {
	let s = seed >>> 0 || 1;
	return () => {
		s ^= s << 13;
		s ^= s >>> 17;
		s ^= s << 5;
		return (s >>> 0) / 4294967296;
	};
};

/** 蝋燭の炎のゆらぎ（0 付近を中心に揺れる値の束） */
export const flameState = (frame: number, fps: number, seed = 0) => {
	const t = frame / fps;
	const sway = fbm1(t * 1.3, seed + 1) * 0.9 + fbm1(t * 4.1, seed + 2) * 0.25;
	const stretch = fbm1(t * 2.2, seed + 3) * 0.6 + fbm1(t * 7.5, seed + 4) * 0.15;
	const flicker = fbm1(t * 9.0, seed + 5) * 0.5 + fbm1(t * 2.7, seed + 6) * 0.5;
	return {sway, stretch, flicker};
};
