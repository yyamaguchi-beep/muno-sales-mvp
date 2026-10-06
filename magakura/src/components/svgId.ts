import {useId} from 'react';

/** url(#...) で安全に参照できる SVG 用 ID（同時に複数シーンが描画されても衝突しない） */
export const useSvgId = (prefix: string) => {
	const raw = useId();
	return `${prefix}-${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`;
};
