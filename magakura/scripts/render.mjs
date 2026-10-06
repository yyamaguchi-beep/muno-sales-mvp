// まとめて書き出すスクリプト。
//   node scripts/render.mjs                 … 全エピソードの BGM あり / なし MP4 とサムネイル PNG
//   node scripts/render.mjs --ep=001        … 指定エピソードのみ
//   node scripts/render.mjs --only=bgm|nobgm|thumb
//   node scripts/render.mjs --stills=0,60,200  … 確認用の静止画だけ書き出す（out/qa/）
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync, spawnSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(
	process.argv.slice(2).map((a) => {
		const [k, v] = a.replace(/^--/, '').split('=');
		return [k, v ?? 'true'];
	}),
);
const outDir = path.join(root, 'out');
// SNS 向けの最終ラウドネス（音圧は控えめ）。-14 だとプラットフォーム側で下げられるため -16〜-18 を推奨
const TARGET_LUFS = Number(args.lufs ?? -17);

/** ffmpeg の 2 パス loudnorm で音量をそろえる（映像は再エンコードしない） */
const masterAudio = (input, output) => {
	const filter = `loudnorm=I=${TARGET_LUFS}:TP=-1.5:LRA=11`;
	// 1パス目：測定（結果は stderr に JSON で出る）
	const r = spawnSync('ffmpeg', ['-hide_banner', '-i', input, '-af', `${filter}:print_format=json`, '-f', 'null', '-'], {encoding: 'utf8'});
	if (r.error) {
		console.warn('ffmpeg が無いためマスタリングを省略します');
		fs.renameSync(input, output);
		return;
	}
	const log = r.stderr;
	const m = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
	const second = `${filter}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
	execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', input, '-c:v', 'copy', '-af', second, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', output]);
	fs.unlinkSync(input);
	console.log(`  mastered: ${m.input_i} LUFS → ${TARGET_LUFS} LUFS`);
};
fs.mkdirSync(outDir, {recursive: true});

// 同梱 Chromium があれば使う（クラウド環境向け）。無ければ Remotion が自動取得する。
const candidates = [process.env.REMOTION_BROWSER, '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'].filter(Boolean);
const browserExecutable = candidates.find((p) => fs.existsSync(p)) ?? null;

console.log('Bundling…');
const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.ts'), webpackOverride: (c) => c});

const {EPISODE_IDS} = await (async () => {
	// Root に登録された Composition 一覧から ID を拾う
	const {getCompositions} = await import('@remotion/renderer');
	const comps = await getCompositions(serveUrl, {browserExecutable});
	return {EPISODE_IDS: [...new Set(comps.filter((c) => c.id.startsWith('MAGAKURA-') && !c.id.endsWith('noBGM')).map((c) => c.id.replace('MAGAKURA-', '')))]};
})();

const ids = args.ep ? [args.ep] : EPISODE_IDS;
const want = (k) => !args.only || args.only.split(',').includes(k);

for (const id of ids) {
	if (args.stills) {
		const comp = await selectComposition({serveUrl, id: `MAGAKURA-${id}`, browserExecutable});
		const qa = path.join(outDir, 'qa');
		fs.mkdirSync(qa, {recursive: true});
		for (const f of args.stills.split(',').map(Number)) {
			const output = path.join(qa, `${id}_f${String(f).padStart(4, '0')}.png`);
			await renderStill({serveUrl, composition: comp, frame: f, output, browserExecutable});
			console.log('still', output);
		}
		continue;
	}
	const jobs = [
		['bgm', `MAGAKURA-${id}`, `magakura_${id}_bgm.mp4`],
		['nobgm', `MAGAKURA-${id}-noBGM`, `magakura_${id}_nobgm.mp4`],
	];
	for (const [key, compId, file] of jobs) {
		if (!want(key)) continue;
		const composition = await selectComposition({serveUrl, id: compId, browserExecutable});
		const finalLocation = path.join(outDir, file);
		const outputLocation = finalLocation.replace(/\.mp4$/, '.raw.mp4');
		console.log(`Rendering ${compId} → ${outputLocation}`);
		let last = -1;
		await renderMedia({
			serveUrl,
			composition,
			codec: 'h264',
			crf: 17,
			pixelFormat: 'yuv420p',
			audioCodec: 'aac',
			audioBitrate: '192k',
			imageFormat: 'jpeg',
			jpegQuality: 92,
			outputLocation,
			browserExecutable,
			concurrency: Number(args.concurrency ?? 4),
			onProgress: ({progress}) => {
				const p = Math.floor(progress * 20);
				if (p !== last) {
					last = p;
					process.stdout.write(`  ${Math.round(progress * 100)}%\n`);
				}
			},
		});
		masterAudio(outputLocation, finalLocation);
	}
	if (want('thumb')) {
		const composition = await selectComposition({serveUrl, id: `Thumb-${id}`, browserExecutable});
		const output = path.join(outDir, `magakura_${id}_thumbnail.png`);
		await renderStill({serveUrl, composition, output, browserExecutable});
		console.log('thumbnail', output);
	}
}
console.log('done');
