import React from 'react';
import {AbsoluteFill, Img} from 'remotion';
import {ArchiveHeader} from '../components/ArchiveHeader';
import {FilmGrain} from '../components/FilmGrain';
import {HookText} from '../components/HookText';
import {Scene} from '../components/Scene';
import type {Episode} from '../data/types';
import {useFontsReady} from '../lib/fonts';
import {TEX} from '../visuals/props';
import {COLORS, FONTS} from '../styles/theme';
import {collectTexts} from './MagakuraShort';
import {Seal} from '../visuals/props';

/** サムネイル（1080×1920 PNG）。プロフィール一覧で並んだ時に“収蔵記録”として揃って見えるよう構成を固定 */
export const Thumbnail: React.FC<{episode: Episode}> = ({episode: ep}) => {
	useFontsReady(collectTexts(ep));
	return (
		<AbsoluteFill style={{backgroundColor: '#000'}}>
			<AbsoluteFill style={{opacity: 0}}>
				{Object.values(TEX).map((src) => (
					<Img key={src} src={src} style={{width: 1, height: 1}} />
				))}
			</AbsoluteFill>
			<Scene visual={{type: 'procedural', preset: 'candle-room'}} frames={1} push={1} />
			<ArchiveHeader id={ep.id} title={ep.title} titleLatin={ep.titleLatin} />
			<HookText lead={ep.thumbnail.lead} main={ep.thumbnail.main} frames={999} top={430} still />
			<div style={{position: 'absolute', left: 0, right: 0, top: 940, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18}}>
				<svg width={64} height={64} viewBox="-40 -40 80 80">
					<Seal x={0} y={0} size={68} opacity={0.95} />
				</svg>
				<span style={{fontFamily: FONTS.latin, fontWeight: 600, fontSize: 30, letterSpacing: '0.5em', color: COLORS.kinari, opacity: 0.8}}>MAGAKURA</span>
			</div>
			<FilmGrain amount={0.08} />
		</AbsoluteFill>
	);
};
