// 投稿（エピソード）の一覧。新しい投稿はファイルを追加してここに登録する。
// Root.tsx が自動で「MAGAKURA-<id>」「MAGAKURA-<id>-noBGM」「Thumb-<id>」を作る。
import {enkiri} from './episode';
import type {Episode} from './types';

export const EPISODES: Episode[] = [enkiri];
