import React from 'react';
import {Composition, Still} from 'remotion';
import {MagakuraShort, type MagakuraShortProps} from './compositions/MagakuraShort';
import {Thumbnail} from './compositions/Thumbnail';
import {EPISODES} from './data';
import {episodeDurationInFrames} from './lib/timeline';
import {VIDEO} from './styles/theme';

export const RemotionRoot: React.FC = () => (
	<>
		{EPISODES.map((ep) => {
			const durationInFrames = episodeDurationInFrames(ep, VIDEO.fps);
			const common = {durationInFrames, fps: VIDEO.fps, width: VIDEO.width, height: VIDEO.height} as const;
			return (
				<React.Fragment key={ep.id}>
					<Composition<any, MagakuraShortProps>
						id={`MAGAKURA-${ep.id}`}
						component={MagakuraShort}
						{...common}
						defaultProps={{episode: ep, withBgm: true}}
					/>
					<Composition<any, MagakuraShortProps>
						id={`MAGAKURA-${ep.id}-noBGM`}
						component={MagakuraShort}
						{...common}
						defaultProps={{episode: ep, withBgm: false}}
					/>
					<Still id={`Thumb-${ep.id}`} component={Thumbnail} width={VIDEO.width} height={VIDEO.height} defaultProps={{episode: ep}} />
				</React.Fragment>
			);
		})}
	</>
);
