import React from 'react';
import {AbsoluteFill, Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';
import type {CandleSpec, Visual} from '../data/types';
import {ProceduralVisual} from '../visuals/presets';
import {CandleOverlay} from './CandleOverlay';

/** 実写・画像素材を禍蔵のトーン（暗く・低彩度・焦茶寄り）に揃える */
const GRADE = 'brightness(0.78) contrast(1.08) saturate(0.72) sepia(0.18)';

/**
 * 1シーン分の映像レイヤー。
 * - push: ゆっくりした push-in（1.03 = 3%）。1 未満で pull-out
 * - 画像 / 動画 / 手続き生成のどれでも同じカメラワークがかかる
 */
export const Scene: React.FC<{
	visual: Visual;
	frames: number;
	push?: number;
	candle?: CandleSpec | null;
	darken?: number;
	seed?: number;
}> = ({visual, frames, push = 1.03, candle, darken = 0, seed = 1}) => {
	const frame = useCurrentFrame();
	const progress = Math.min(1, Math.max(0, frame / Math.max(1, frames)));
	// ease-out 気味の非常に遅い push-in
	const eased = 1 - Math.pow(1 - progress, 1.6);
	const scale = interpolate(eased, [0, 1], [1, push]);

	let content: React.ReactNode;
	if (visual.type === 'procedural') {
		content = <ProceduralVisual preset={visual.preset} progress={progress} seed={visual.seed ?? seed} />;
	} else if (visual.type === 'image') {
		content = (
			<Img
				src={staticFile(visual.src)}
				style={{
					width: '100%',
					height: '100%',
					objectFit: 'cover',
					objectPosition: `${(visual.focusX ?? 0.5) * 100}% ${(visual.focusY ?? 0.5) * 100}%`,
					filter: GRADE,
				}}
			/>
		);
	} else {
		content = (
			<OffthreadVideo
				src={staticFile(visual.src)}
				startFrom={Math.round((visual.startFromSec ?? 0) * 30)}
				muted={visual.muted ?? true}
				style={{width: '100%', height: '100%', objectFit: 'cover', filter: GRADE}}
			/>
		);
	}

	return (
		<AbsoluteFill style={{backgroundColor: '#050403', overflow: 'hidden'}}>
			<AbsoluteFill style={{transform: `scale(${scale})`, transformOrigin: '50% 42%'}}>
				{content}
				{candle && <CandleOverlay {...candle} seed={seed} />}
			</AbsoluteFill>
			{darken > 0 && <AbsoluteFill style={{backgroundColor: `rgba(0,0,0,${darken})`}} />}
		</AbsoluteFill>
	);
};
