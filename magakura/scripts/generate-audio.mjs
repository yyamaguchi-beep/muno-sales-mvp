// 禍蔵 演出用サウンド生成スクリプト（依存なし / 48kHz WAV）
// BGM・環境音・SEを手続き合成して public/assets/audio に書き出す。
// 実録音の素材に差し替える場合は同名ファイルで上書きするか、episode.ts のパスを変更する。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const SR = 48000;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets', 'audio');
fs.mkdirSync(OUT, {recursive: true});

// ---------- 乱数（再現性のためシード固定） ----------
let seed = 20261006;
const rand = () => {
	seed ^= seed << 13;
	seed ^= seed >>> 17;
	seed ^= seed << 5;
	return ((seed >>> 0) / 4294967296);
};
const noise = () => rand() * 2 - 1;

// ---------- DSP ----------
const buf = (sec) => new Float32Array(Math.round(sec * SR));

function biquad(x, type, freq, q = 0.707) {
	const y = new Float32Array(x.length);
	let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
	const f = typeof freq === 'function' ? freq : () => freq;
	let b0, b1, b2, a1, a2;
	const coef = (fc) => {
		const w = (2 * Math.PI * Math.min(fc, SR * 0.45)) / SR;
		const al = Math.sin(w) / (2 * q);
		const c = Math.cos(w);
		let B0, B1, B2;
		if (type === 'lp') { B0 = (1 - c) / 2; B1 = 1 - c; B2 = (1 - c) / 2; }
		else if (type === 'hp') { B0 = (1 + c) / 2; B1 = -(1 + c); B2 = (1 + c) / 2; }
		else { B0 = al; B1 = 0; B2 = -al; } // bandpass
		const A0 = 1 + al;
		b0 = B0 / A0; b1 = B1 / A0; b2 = B2 / A0; a1 = (-2 * c) / A0; a2 = (1 - al) / A0;
	};
	coef(f(0));
	for (let i = 0; i < x.length; i++) {
		if (typeof freq === 'function' && i % 64 === 0) coef(f(i / SR));
		const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
		x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
	}
	return y;
}

const brown = (n) => {
	const y = new Float32Array(n);
	let v = 0;
	for (let i = 0; i < n; i++) { v = (v + 0.02 * noise()) * 0.998; y[i] = v * 3.5; }
	return y;
};
const white = (n) => Float32Array.from({length: n}, noise);

function reverb(x, {mix = 0.3, size = 1, damp = 0.4, tail = 3} = {}) {
	const n = x.length + Math.round(tail * SR);
	const inp = new Float32Array(n); inp.set(x);
	const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((d) => Math.round(d * size * (SR / 44100)));
	const out = new Float32Array(n);
	for (const d of combs) {
		const line = new Float32Array(d); let idx = 0, store = 0;
		for (let i = 0; i < n; i++) {
			const o = line[idx];
			store = o * (1 - damp) + store * damp;
			line[idx] = inp[i] + store * 0.84;
			idx = (idx + 1) % d;
			out[i] += o / combs.length;
		}
	}
	for (const d of [556, 441, 341, 225].map((v) => Math.round(v * (SR / 44100)))) {
		const line = new Float32Array(d); let idx = 0;
		for (let i = 0; i < n; i++) {
			const b = line[idx]; const v = -out[i] + b; line[idx] = out[i] + b * 0.5; out[i] = v; idx = (idx + 1) % d;
		}
	}
	for (let i = 0; i < n; i++) out[i] = inp[i] * (1 - mix) + out[i] * mix * 3;
	return out;
}

const env = (n, a, d, curve = 3) => {
	const e = new Float32Array(n); const A = Math.round(a * SR);
	for (let i = 0; i < n; i++) e[i] = i < A ? i / Math.max(1, A) : Math.exp(-((i - A) / SR) * (curve / Math.max(0.001, d)));
	return e;
};
const mul = (a, b) => a.map((v, i) => v * (typeof b === 'number' ? b : b[i] ?? 0));
const addAt = (dst, src, sec, gain = 1) => { const o = Math.round(sec * SR); for (let i = 0; i < src.length && o + i < dst.length; i++) dst[o + i] += src[i] * gain; };
const fade = (x, fi, fo) => { const a = fi * SR, b = fo * SR; for (let i = 0; i < x.length; i++) { let g = 1; if (i < a) g = i / a; if (i > x.length - b) g = Math.min(g, (x.length - i) / b); x[i] *= g; } return x; };
const normalize = (x, peakDb) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); const g = Math.pow(10, peakDb / 20) / (m || 1); return x.map((v) => v * g); };

function writeWav(name, L, R = L) {
	const n = Math.min(L.length, R.length);
	const b = Buffer.alloc(44 + n * 4);
	b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVE', 8); b.write('fmt ', 12);
	b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(SR, 24);
	b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
	for (let i = 0; i < n; i++) {
		b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4);
		b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4);
	}
	fs.writeFileSync(path.join(OUT, name), b);
	console.log('wrote', name, (n / SR).toFixed(2) + 's');
}
// 少しだけ左右差をつけたステレオ化
const stereo = (x, width = 0.0006) => { const d = Math.round(width * SR); const R = new Float32Array(x.length); for (let i = 0; i < x.length; i++) R[i] = x[Math.max(0, i - d)]; return [x, R]; };

// ---------- BGM: 低く神妙なアンビエント（和楽器は使わない） ----------
function bgm(sec = 32) {
	const n = Math.round(sec * SR);
	const L = new Float32Array(n), R = new Float32Array(n);
	const voices = [
		{f: 55.0, g: 0.34, lfo: 0.05}, {f: 55.35, g: 0.24, lfo: 0.07},
		{f: 82.41, g: 0.16, lfo: 0.031}, {f: 110.2, g: 0.09, lfo: 0.043},
		{f: 130.8, g: 0.05, lfo: 0.023}, // 短三度（暗さ）
		{f: 164.8, g: 0.03, lfo: 0.06},
	];
	for (const [k, v] of voices.entries()) {
		let ph = rand() * 6.28; const pan = (k % 2 ? 0.4 : -0.4);
		for (let i = 0; i < n; i++) {
			const t = i / SR;
			const amp = v.g * (0.6 + 0.4 * Math.sin(2 * Math.PI * v.lfo * t + k));
			ph += (2 * Math.PI * v.f * (1 + 0.0015 * Math.sin(t * 0.3 + k))) / SR;
			const s = (Math.sin(ph) + 0.18 * Math.sin(ph * 2) + 0.06 * Math.sin(ph * 3)) * amp;
			L[i] += s * (1 - pan) * 0.5; R[i] += s * (1 + pan) * 0.5;
		}
	}
	// 息のようなノイズパッド（ゆっくりフィルタが開閉）
	const air = biquad(white(n), 'bp', (t) => 380 + 260 * Math.sin(t * 0.21), 2.5);
	for (let i = 0; i < n; i++) { const t = i / SR; const g = 0.05 * (0.5 + 0.5 * Math.sin(t * 0.17)); L[i] += air[i] * g; R[i] += air[(i + 900) % n] * g; }
	// 鈴のような倍音の滲み（ごく小さく）
	for (const at of [5.2, 13.8, 21.1]) {
		const s = buf(5); const e = env(s.length, 0.8, 4.2, 4);
		for (let i = 0; i < s.length; i++) { const t = i / SR; s[i] = (Math.sin(2 * Math.PI * 659.3 * t) * 0.6 + Math.sin(2 * Math.PI * 987.8 * t) * 0.25) * e[i] * 0.025; }
		addAt(L, s, at); addAt(R, s, at + 0.01);
	}
	const lp = (x) => biquad(x, 'lp', 1800);
	const rl = reverb(lp(L), {mix: 0.45, size: 1.3, damp: 0.5, tail: 0}).slice(0, n);
	const rr = reverb(lp(R), {mix: 0.45, size: 1.33, damp: 0.5, tail: 0}).slice(0, n);
	fade(rl, 1.2, 3); fade(rr, 1.2, 3);
	writeWav('bgm_ambient.wav', normalize(rl, -6), normalize(rr, -6));
}

// ---------- 環境音: 部屋の空気＋弱い風 ----------
function roomTone(sec = 32) {
	const n = Math.round(sec * SR);
	const b = biquad(brown(n), 'lp', 300);
	const wind = biquad(white(n), 'bp', (t) => 500 + 300 * Math.sin(t * 0.37) + 120 * Math.sin(t * 1.3), 1.2);
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) { const t = i / SR; out[i] = b[i] * 0.6 + wind[i] * 0.12 * (0.3 + 0.7 * Math.max(0, Math.sin(t * 0.45))); }
	fade(out, 0.05, 1);
	const [L, R] = stereo(normalize(out, -14), 0.012);
	writeWav('amb_room.wav', L, R);
}

// ---------- 蝋燭の炎（ループ） ----------
function candleFire(sec = 32) {
	const n = Math.round(sec * SR);
	const rumble = biquad(brown(n), 'lp', 180);
	const out = new Float32Array(n);
	for (let i = 0; i < n; i++) out[i] = rumble[i] * 0.5 * (0.7 + 0.3 * Math.sin(i / SR * 2.3));
	// パチ、という小さな爆ぜ
	let t = 0.05;
	while (t < sec) {
		const c = buf(0.03); const e = env(c.length, 0.0005, 0.012, 5);
		for (let i = 0; i < c.length; i++) c[i] = noise() * e[i];
		addAt(out, biquad(c, 'bp', 1500 + rand() * 2500, 1.5), t, 0.25 + rand() * 0.5);
		t += 0.12 + rand() * rand() * 1.4;
	}
	const [L, R] = stereo(normalize(out, -9));
	writeWav('sfx_candle_loop.wav', L, R);
}

// ---------- 点火（冒頭の小さな火の音） ----------
function ignite() {
	const s = buf(1.6);
	const scratch = biquad(white(s.length), 'bp', 2800, 0.9);
	const e1 = env(s.length, 0.004, 0.14, 4);
	const whoosh = biquad(white(s.length), 'bp', (t) => 300 + 900 * Math.exp(-t * 4), 0.8);
	const e2 = env(s.length, 0.06, 0.9, 3);
	for (let i = 0; i < s.length; i++) {
		const t = i / SR;
		const rough = 0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 47) * Math.sin(t * 2 * Math.PI * 13);
		s[i] = scratch[i] * e1[i] * rough * 0.7 + whoosh[i] * e2[i] * 0.9;
	}
	const r = reverb(s, {mix: 0.2, size: 0.6, tail: 0.6});
	const [L, R] = stereo(normalize(r, -3));
	writeWav('sfx_ignite.wav', L, R);
}

// ---------- 紙 ----------
function paper() {
	const s = buf(1.0);
	const w = biquad(biquad(white(s.length), 'hp', 1200), 'lp', 7000);
	for (let i = 0; i < s.length; i++) {
		const t = i / SR;
		const g = Math.exp(-Math.pow((t - 0.32) / 0.2, 2)) * (0.4 + 0.6 * Math.abs(Math.sin(t * 60 + Math.sin(t * 23) * 3)));
		s[i] = w[i] * g;
	}
	const [L, R] = stereo(normalize(reverb(s, {mix: 0.15, size: 0.5, tail: 0.4}), -4));
	writeWav('sfx_paper.wav', L, R);
}

// ---------- 筆 ----------
function brush() {
	const s = buf(0.9);
	const w = biquad(white(s.length), 'bp', (t) => 1800 + 2200 * t, 0.7);
	for (let i = 0; i < s.length; i++) { const t = i / SR; s[i] = w[i] * Math.sin(Math.PI * Math.min(1, t / 0.55)) ** 2 * (t < 0.55 ? 1 : 0); }
	const [L, R] = stereo(normalize(reverb(s, {mix: 0.12, size: 0.5, tail: 0.3}), -6));
	writeWav('sfx_brush.wav', L, R);
}

// ---------- 縄（擦れ・締まる音） ----------
function rope() {
	const s = buf(1.1);
	let ph = 0;
	for (let i = 0; i < s.length; i++) {
		const t = i / SR;
		const rate = 30 + 90 * Math.sin(Math.PI * Math.min(1, t / 0.7));
		ph += rate / SR;
		const pulse = (ph % 1) < 0.08 ? noise() : noise() * 0.15;
		s[i] = pulse * Math.sin(Math.PI * Math.min(1, t / 0.75)) * (t < 0.75 ? 1 : 0);
	}
	const f = biquad(biquad(s, 'bp', 900, 1.2), 'lp', 4000);
	const [L, R] = stereo(normalize(reverb(f, {mix: 0.18, size: 0.5, tail: 0.4}), -5));
	writeWav('sfx_rope.wav', L, R);
}

// ---------- 切る（鋏） ----------
function snip() {
	const s = buf(0.7);
	for (const [at, g] of [[0.0, 1], [0.045, 0.7]]) {
		const c = buf(0.25); const e = env(c.length, 0.0003, 0.06, 5);
		for (let i = 0; i < c.length; i++) { const t = i / SR; c[i] = (noise() * 0.6 + Math.sin(2 * Math.PI * 4200 * t) * 0.5 + Math.sin(2 * Math.PI * 6900 * t) * 0.3) * e[i]; }
		addAt(s, biquad(c, 'hp', 1500), at, g);
	}
	const [L, R] = stereo(normalize(reverb(s, {mix: 0.25, size: 0.7, tail: 0.6}), -4));
	writeWav('sfx_snip.wav', L, R);
}

// ---------- 木箱（蓋を閉じる） ----------
function box() {
	const s = buf(1.4);
	const modes = [[118, 1, 0.35], [247, 0.6, 0.22], [412, 0.4, 0.15], [688, 0.25, 0.08], [1130, 0.15, 0.05]];
	for (const [f, g, d] of modes) {
		const e = env(s.length, 0.001, d, 4);
		for (let i = 0; i < s.length; i++) s[i] += Math.sin(2 * Math.PI * f * (i / SR)) * g * e[i];
	}
	const click = biquad(mul(white(s.length), env(s.length, 0.0005, 0.015, 5)), 'bp', 2400, 1);
	for (let i = 0; i < s.length; i++) s[i] = s[i] * 0.8 + click[i] * 0.5;
	const [L, R] = stereo(normalize(reverb(s, {mix: 0.3, size: 0.9, tail: 1}), -3));
	writeWav('sfx_box.wav', L, R);
}

// ---------- 遠い鐘（梵鐘風、遠景） ----------
function bell() {
	const s = buf(7);
	const f0 = 92;
	const partials = [[0.5, 0.5, 6], [1, 1, 5], [1.19, 0.5, 3.5], [1.56, 0.35, 3], [2.0, 0.45, 2.6], [2.66, 0.25, 1.8], [3.01, 0.2, 1.5], [4.1, 0.1, 1.0]];
	for (const [r, g, d] of partials) {
		const e = env(s.length, 0.004, d, 3);
		const beat = 0.6 + rand();
		for (let i = 0; i < s.length; i++) { const t = i / SR; s[i] += Math.sin(2 * Math.PI * f0 * r * t) * g * e[i] * (0.8 + 0.2 * Math.sin(2 * Math.PI * beat * t)); }
	}
	const far = biquad(s, 'lp', 900);
	const r = reverb(far, {mix: 0.55, size: 1.5, damp: 0.6, tail: 2});
	const [L, R] = stereo(normalize(fade(r, 0.01, 1.5), -4), 0.004);
	writeWav('sfx_bell_far.wav', L, R);
}

// ---------- 床の軋み ----------
function creak() {
	const s = buf(1.3);
	let ph = 0;
	for (let i = 0; i < s.length; i++) {
		const t = i / SR;
		const rate = 25 + 60 * Math.sin(Math.PI * Math.min(1, t / 0.9)) + 10 * Math.sin(t * 40);
		ph += rate / SR;
		s[i] = ((ph % 1) < 0.03 ? 1 : 0) * Math.sin(Math.PI * Math.min(1, t / 0.9)) * (t < 0.9 ? 1 : 0);
	}
	const f = biquad(biquad(s, 'bp', 520, 6), 'bp', 1050, 3);
	const [L, R] = stereo(normalize(reverb(f, {mix: 0.35, size: 1.1, tail: 0.8}), -6), 0.003);
	writeWav('sfx_creak.wav', L, R);
}

// ---------- 衣擦れ ----------
function cloth() {
	const s = buf(1.2);
	const w = biquad(biquad(white(s.length), 'hp', 600), 'lp', 3500);
	for (let i = 0; i < s.length; i++) { const t = i / SR; s[i] = w[i] * Math.exp(-Math.pow((t - 0.45) / 0.28, 2)) * (0.5 + 0.5 * Math.abs(Math.sin(t * 17))); }
	const [L, R] = stereo(normalize(reverb(s, {mix: 0.2, size: 0.6, tail: 0.4}), -8));
	writeWav('sfx_cloth.wav', L, R);
}

bgm();
roomTone();
candleFire();
ignite();
paper();
brush();
rope();
snip();
box();
bell();
creak();
cloth();

// WAV → MP3（リポジトリを軽く保つ）。ffmpeg が無い環境では WAV のまま残す。
for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.wav'))) {
	const src = path.join(OUT, f);
	try {
		execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-codec:a', 'libmp3lame', '-b:a', '192k', src.replace(/\.wav$/, '.mp3')]);
		fs.unlinkSync(src);
	} catch {
		console.warn('ffmpeg が見つからないため WAV のまま保持します:', f);
	}
}
console.log('audio done');
