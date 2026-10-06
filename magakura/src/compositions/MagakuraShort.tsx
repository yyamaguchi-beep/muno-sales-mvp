import React from 'react';
import {AbsoluteFill, Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ArchiveHeader, Note} from '../components/ArchiveHeader';
import {Caption} from '../components/Caption';
import {FilmGrain} from '../components/FilmGrain';
import {HookText} from '../components/HookText';
import {EndCard} from '../components/Logo';
import {Scene} from '../components/Scene';
import type {Episode, Sfx} from '../data/types';
import {useFontsReady} from '../lib/fonts';
import {buildTimeline, DISSOLVE_FRAMES} from '../lib/timeline';
import {TEX} from '../visuals/props';

export type MagakuraShortProps = {
	episode: Episode;
	/** false で BGM なし版（環境音・SE は残る） */
	withBgm: boolean;
};

/** 全テキスト（フォントの事前読み込み用） */
export const collectTexts = (ep: Episode) => [
	ep.hook.lead,
	ep.hook.main,
	ep.title,
	ep.cta.copy,
	ep.cta.link,
	ep.cta.sub ?? '',
	ep.cta.next ?? '',
	ep.thumbnail.lead,
	ep.thumbnail.main,
	ep.thumbnail.label ?? '',
	'禍蔵収蔵記録第壱弐参肆伍陸漆捌玖拾號史実伝承民間信仰言葉再構成演出',
	...ep.scenes.flatMap((s) => [...s.captions.map((c) => c.text), s.note?.text ?? '', s.note?.tag ?? '']),
];

/** セグメントの入り（ディゾルブ）とレイヤー */
const Fade: React.FC<{children: React.ReactNode; fadeIn: boolean; toBlackAt?: number}> = ({children, fadeIn, toBlackAt}) => {
	const frame = useCurrentFrame();
	let o = fadeIn ? interpolate(frame, [0, DISSOLVE_FRAMES], [0, 1], {extrapolateRight: 'clamp'}) : 1;
	// fade through black：次が暗転で入る場合、自分の尺の終わりまでに黒へ落とす
	if (toBlackAt !== undefined) o *= interpolate(frame, [toBlackAt - DISSOLVE_FRAMES, toBlackAt], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	return <AbsoluteFill style={{opacity: o}}>{children}</AbsoluteFill>;
};

const SfxTrack: React.FC<{list?: Sfx[]; from: number}> = ({list, from}) => {
	const {fps} = useVideoConfig();
	return (
		<>
			{(list ?? []).map((s, i) => (
				<Sequence key={i} from={from + Math.round(s.at * fps)} layout="none" name={`SE ${s.src.split('/').pop()}`}>
					<Audio src={staticFile(s.src)} volume={s.volume ?? 0.5} />
				</Sequence>
			))}
		</>
	);
};

export const MagakuraShort: React.FC<MagakuraShortProps> = ({episode: ep, withBgm}) => {
	const {fps, durationInFrames} = useVideoConfig();
	useFontsReady(collectTexts(ep));
	const {segments} = buildTimeline(ep, fps);
	const fadeOutAudio = (v: number) => (f: number) =>
		v * interpolate(f, [0, 12, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			{/* テクスチャを先読み（SVG 内の <image> が未読込のまま描画されるのを防ぐ） */}
			<AbsoluteFill style={{opacity: 0}}>
				{Object.values(TEX).map((src) => (
					<Img key={src} src={src} style={{width: 1, height: 1}} />
				))}
			</AbsoluteFill>

			{segments.map((seg, i) => {
				const dur = seg.frames + seg.overlap;
				if (seg.kind === 'hook') {
					return (
						<Sequence key={i} from={seg.from} durationInFrames={dur} name="Hook">
							<Scene visual={{type: 'procedural', preset: 'candle-room'}} frames={dur} push={1.02} />
							<HookText lead={ep.hook.lead} main={ep.hook.main} frames={seg.frames} />
						</Sequence>
					);
				}
				if (seg.kind === 'cta') {
					return (
						<Sequence key={i} from={seg.from} durationInFrames={dur} name="CTA">
							<Fade fadeIn>
								<Scene visual={{type: 'procedural', preset: 'end-dark'}} frames={dur} push={1.025} darken={0.15} />
								<EndCard copy={ep.cta.copy} link={ep.cta.link} sub={ep.cta.sub} next={ep.cta.next} />
							</Fade>
						</Sequence>
					);
				}
				const s = seg.scene;
				const next = segments[i + 1];
				const nextIsBlack = next?.kind === 'cta' || (next?.kind === 'scene' && next.scene.transition === 'black');
				return (
					<Sequence key={i} from={seg.from} durationInFrames={dur} name={`Scene ${s.id}`}>
						<Fade fadeIn={(s.transition ?? 'dissolve') !== 'cut'} toBlackAt={nextIsBlack ? seg.frames : undefined}>
							<Scene visual={s.visual} frames={dur} push={s.push} candle={s.candle} darken={s.darken} seed={seg.index + 1} />
							<ArchiveHeader id={ep.id} title={ep.title} titleLatin={ep.titleLatin} />
							{s.note && <Note note={s.note} frames={seg.frames} />}
							<Caption lines={s.captions} frames={seg.frames} />
						</Fade>
					</Sequence>
				);
			})}

			<FilmGrain />

			{/* ---- 音 ---- */}
			{ep.audio.ambience.map((a, i) => (
				<Audio key={'amb' + i} src={staticFile(a.src)} volume={fadeOutAudio(a.volume)} loop />
			))}
			{withBgm && ep.audio.bgm && <Audio src={staticFile(ep.audio.bgm.src)} volume={fadeOutAudio(ep.audio.bgm.volume)} />}
			{ep.audio.narration && (
				<Sequence from={Math.round((ep.audio.narration.startSec ?? 0) * fps)} layout="none">
					<Audio src={staticFile(ep.audio.narration.src)} volume={ep.audio.narration.volume} />
				</Sequence>
			)}
			{segments.map((seg, i) => (
				<SfxTrack key={'sfx' + i} from={seg.from} list={seg.kind === 'hook' ? ep.hook.sfx : seg.kind === 'cta' ? ep.cta.sfx : seg.scene.sfx} />
			))}
		</AbsoluteFill>
	);
};
