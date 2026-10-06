import type {Episode, Scene} from '../data/types';

/** ディゾルブで重ねるフレーム数 */
export const DISSOLVE_FRAMES = 8;

export type Segment =
	| {kind: 'hook'; from: number; frames: number; overlap: number}
	| {kind: 'scene'; scene: Scene; index: number; from: number; frames: number; overlap: number}
	| {kind: 'cta'; from: number; frames: number; overlap: number};

export const buildTimeline = (ep: Episode, fps: number) => {
	const segs: Segment[] = [];
	let t = 0;
	const push = (s: Omit<Segment, 'from' | 'overlap'> & {frames: number}) => {
		segs.push({...(s as Segment), from: t, overlap: 0});
		t += s.frames;
	};
	push({kind: 'hook', frames: Math.round(ep.hook.durationSec * fps)} as Segment);
	ep.scenes.forEach((scene, index) => push({kind: 'scene', scene, index, frames: Math.round(scene.durationSec * fps)} as Segment));
	push({kind: 'cta', frames: Math.round(ep.cta.durationSec * fps)} as Segment);
	// 次のセグメントがディゾルブで入る場合、手前のセグメントを延長して下に敷いておく
	for (let i = 0; i < segs.length - 1; i++) {
		const next = segs[i + 1];
		const tr = next.kind === 'scene' ? next.scene.transition ?? 'dissolve' : 'black';
		segs[i].overlap = tr === 'cut' ? 0 : DISSOLVE_FRAMES;
	}
	return {segments: segs, totalFrames: t};
};

export const episodeDurationInFrames = (ep: Episode, fps: number) => buildTimeline(ep, fps).totalFrames;
