// 書き出し後の機械チェック：解像度・fps・尺・フレーム数・ラウドネス・ピーク・黒潰れ／白飛び
//   node scripts/check-output.mjs [out/xxx.mp4 ...]
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const files = process.argv.slice(2).length
	? process.argv.slice(2)
	: fs.readdirSync('out').filter((f) => f.endsWith('.mp4') && !f.includes('.raw.')).map((f) => path.join('out', f));

const run = (args) => spawnSync(args[0], args.slice(1), {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
let ok = true;
const expect = (cond, msg) => {
	console.log(`  ${cond ? 'OK ' : 'NG '} ${msg}`);
	if (!cond) ok = false;
};

for (const f of files) {
	console.log(f);
	const probe = JSON.parse(run(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', f]).stdout);
	const v = probe.streams.find((s) => s.codec_type === 'video');
	const a = probe.streams.find((s) => s.codec_type === 'audio');
	expect(v.width === 1080 && v.height === 1920, `解像度 ${v.width}x${v.height}`);
	expect(v.r_frame_rate === '30/1', `fps ${v.r_frame_rate}`);
	const dur = Number(v.duration);
	expect(dur >= 22 && dur <= 30, `尺 ${dur.toFixed(2)}s`);
	expect(Number(v.nb_frames) === Math.round(dur * 30), `フレーム数 ${v.nb_frames}（欠落なし）`);
	expect(!!a, '音声トラックあり');

	const loud = run(['ffmpeg', '-hide_banner', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr;
	const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(loud.slice(loud.lastIndexOf('Summary')))?.[1]);
	const peak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(loud.slice(loud.lastIndexOf('Summary')))?.[1]);
	expect(I <= -15 && I >= -20, `ラウドネス ${I} LUFS（目標 -17 前後）`);
	expect(peak <= -1, `トゥルーピーク ${peak} dBFS`);

	const stats = run(['ffmpeg', '-hide_banner', '-i', f, '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-f', 'null', '-']).stderr;
	const ys = [...stats.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
	const darkFrames = ys.filter((y) => y < 3).length;
	expect(darkFrames <= 20, `完全な黒フレーム ${darkFrames} 枚（暗転の演出分のみ）`);
	expect(Math.max(...ys) < 180, `最大平均輝度 ${Math.max(...ys).toFixed(1)}（白飛びなし）`);
	expect(ys[0] > 15, `1フレーム目の平均輝度 ${ys[0].toFixed(1)}（真っ黒で始まらない）`);
}
console.log(ok ? '\nすべてのチェックに合格' : '\n要確認の項目があります');
process.exit(ok ? 0 : 1);
