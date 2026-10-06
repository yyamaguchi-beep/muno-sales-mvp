# 禍蔵｜MAGAKURA 縦型ショート テンプレート

> 誰にも言えない願いを、ここに納める。

TikTok / Instagram Reels / YouTube Shorts 向けの縦型ショートを **Remotion + React + TypeScript** で量産するためのプロジェクトです。
`src/data/` にある 1 投稿 = 1 ファイルのデータを書き換えるだけで、テーマを差し替えた新しい動画を書き出せます。

| 項目 | 値 |
| --- | --- |
| 解像度 | 1080 × 1920（9:16） |
| fps | 30 |
| 尺 | 24 秒（データで 22〜30 秒に調整可） |
| 音量 | -17 LUFS / True Peak -1.5 dBFS（書き出し時に自動マスタリング） |

## 成果物（第壱號「縁切り」）

`out/` に書き出されます。

| ファイル | 内容 |
| --- | --- |
| `out/magakura_001_bgm.mp4` | BGM 入り版（BGM＋環境音＋SE） |
| `out/magakura_001_nobgm.mp4` | BGM なし版（環境音＋SE のみ。プラットフォームの楽曲やナレーションを後から重ねる用） |
| `out/magakura_001_thumbnail.png` | サムネイル（1080×1920） |

字幕は映像に焼き込み済みなので、無音で再生しても内容が伝わります。

---

## 起動方法

```bash
cd magakura
npm install
```

Node.js 20 以上が必要です。書体（Noto Serif JP / Shippori Mincho / Cormorant Garamond）は `@fontsource` で同梱しているため、書き出し時にネット接続は不要です。

## プレビュー方法

```bash
npm run dev
```

ブラウザで Remotion Studio が開きます。左の一覧に次の 3 つが投稿ごとに並びます。

- `MAGAKURA-001` … BGM 入り
- `MAGAKURA-001-noBGM` … BGM なし
- `Thumb-001` … サムネイル

## レンダリング方法

```bash
npm run render              # 全投稿の BGM 入り・BGM なし MP4 とサムネイル PNG
npm run render:bgm          # BGM 入りだけ
npm run render:nobgm        # BGM なしだけ
npm run render:thumb        # サムネイルだけ
node scripts/render.mjs --ep=001             # 投稿を指定
node scripts/render.mjs --stills=0,60,300    # 確認用の静止画（out/qa/）
node scripts/render.mjs --lufs=-16           # 仕上がりの音量を変える
npm run check               # 解像度・fps・尺・フレーム欠落・音量・黒潰れを自動チェック
```

Remotion Studio の Render ボタンや `npx remotion render MAGAKURA-001 out/x.mp4` でも書き出せます（その場合は音量の自動マスタリングは行われません）。

---

## テキスト変更方法

`src/data/episode.ts` を編集します。

- `{波括弧}` で囲んだ語だけが深い朱色（#A51F24）になります。例：`'“{悪縁}を{断つ}”という'`。全文を朱にはしないでください
- `\n` で改行。**1 行 14〜16 文字・1 画面 3 行まで**
- `captions[].at` はシーン開始からの表示秒数。`inline: true` を付けると前の語と同じ行に続けて出ます（「書く。結ぶ。切る。」の演出）
- `size: 'large'` で一段大きく表示（「自分を取り戻すために。」など）
- `note` は画面上部の注記です。`tag` に **史実 / 言葉 / 伝承 / 民間信仰 / 再構成 / 演出** のいずれかを必ず付け、事実と伝承と禍蔵による再構成を区別します
- Hook は `hook.lead`（小さい前置き）と `hook.main`（大きい本体）

### 表現ルール（信頼性）

「必ず縁が切れる」「確実に呪える」のような断定は使いません。「〜と信じられていた」「伝承では」「民間信仰では」「〜という文化があった」と書きます。怖さは、実在した文化だという事実性でつくります。

## 画像変更方法

素材が無い場合でも、木・和紙・縄・形代・木箱・蝋燭を手続き生成で描く **procedural プリセット** で映像が成立します。実写素材がある場合は差し替えてください。

1. 画像を `public/assets/images/`、動画を `public/assets/video/` に置く
2. シーンの `visual` を書き換える

```ts
visual: {type: 'image', src: 'assets/images/rope_01.jpg', focusX: 0.5, focusY: 0.4},
// または
visual: {type: 'video', src: 'assets/video/candle_01.mp4', startFromSec: 2},
// 画像に蝋燭の炎を重ねたいとき（炎の根元の座標）
candle: {x: 900, y: 620, scale: 1.3, body: false, blur: 6, smoke: true},
```

画像・動画には自動で禍蔵のトーン（暗め・低彩度・焦茶寄り）の色補正、push-in、フィルムグレイン、周辺減光がかかります。

使えるプリセット：`candle-room` / `rope-box` / `document` / `cord-paper-flame` / `sealed-box` / `flame-macro` / `end-dark`

> 生成画像やプリセットの古文書・札・形代は **演出用の再現** です。実在の史料として見せないでください（墨跡はわざと判読できない筆の流れだけにしてあります）。

テクスチャを作り直す場合は `npm run assets` を実行します（`scripts/generate-textures.py` に numpy と Pillow が必要です）。

## BGM 変更方法

`public/assets/audio/` に音源を置き、`episode.ts` の `audio` を書き換えます。

```ts
audio: {
  bgm: {src: 'assets/audio/my_bgm.mp3', volume: 0.32},
  ambience: [
    {src: 'assets/audio/amb_room.mp3', volume: 0.55},        // 部屋の空気・弱い風
    {src: 'assets/audio/sfx_candle_loop.mp3', volume: 0.32}, // 蝋燭
  ],
  narration: {src: 'assets/audio/narration_001.mp3', volume: 1}, // 収録したら追加
},
```

- 同梱の音（BGM・環境音・SE）はすべて `scripts/generate-audio.mjs` で合成したオリジナルなので、権利の心配はありません
- SE はシーンごとの `sfx: [{src, at, volume}]` で配置します（`at` はシーン開始からの秒）
- 同梱の SE：点火 / 蝋燭 / 紙 / 筆 / 縄 / 鋏 / 木箱 / 遠い鐘 / 床の軋み / 衣擦れ / 部屋の空気
- ナレーション原稿は `narrationScript` にあります。低く落ち着いた、民俗学ドキュメンタリー調の男性の声で収録し、`audio.narration` に指定してください

## 動画尺変更方法

尺は各シーンの `durationSec` の合計（＋ `hook.durationSec` ＋ `cta.durationSec`）で自動的に決まります。シーンとシーンの間は 8 フレームのクロスディゾルブで、締めの直前は暗転します。

- Hook は 1.0〜1.5 秒を推奨（Hook の文字は 0 フレーム目から読める状態で表示されます）
- 字幕 1 画面あたり、読み終えるまで最低 2.5 秒を目安に
- 合計 22〜30 秒（`npm run check` で確認）

## 新しい投稿の追加方法

1. `src/data/template.ts` を `src/data/ushinokoku.ts` などにコピーして中身を書く（`id` は `'002'` のように連番。ヘッダーに「収蔵記録 第弐號」と出ます）
2. `src/data/index.ts` の `EPISODES` に追加する

```ts
import {enkiri} from './episode';
import {ushinokoku} from './ushinokoku';
export const EPISODES = [enkiri, ushinokoku];
```

3. `npm run dev` で確認し、`node scripts/render.mjs --ep=002` で書き出す

テーマ例：呪いたい / 別れてほしい / 忘れたい / 呪われているか知りたい / 呪詛返し / 丑の刻参り / 形代 / 名前の呪術 / 髪を使う呪術

---

## 構成

```
magakura/
  src/
    Root.tsx                    投稿ごとに 3 つの Composition を自動登録
    compositions/
      MagakuraShort.tsx         本編（タイムライン・音・トランジション）
      Thumbnail.tsx             サムネイル
    components/
      HookText.tsx              冒頭 Hook
      Caption.tsx               字幕（朱の強調・出現アニメーション）
      CandleOverlay.tsx         和蝋燭・炎・煙（手続き生成）
      FilmGrain.tsx             グレイン・周辺減光・露光ゆらぎ
      Logo.tsx                  ロゴ／締めのカード
      Scene.tsx                 カメラ（push-in）と素材の切り替え
      ArchiveHeader.tsx         「収蔵記録 第壱號」ヘッダーと出典注記
    visuals/                    手続き生成の背景プリセットと小道具
    data/
      types.ts                  データ型
      episode.ts                第壱號「縁切り」
      template.ts               新規投稿のひな形
      index.ts                  投稿一覧
    styles/theme.ts             色・書体・セーフエリア
    lib/                        ノイズ・タイムライン・強調記法・フォント読込
  public/assets/
    images/ video/ audio/ fonts/
  scripts/
    render.mjs                  一括書き出し＋音量マスタリング
    check-output.mjs            書き出し後の自動チェック
    generate-audio.mjs          BGM・環境音・SE の合成
    generate-textures.py        木・和紙・古紙・グレインのテクスチャ生成
```

### セーフエリア

TikTok・Reels・Shorts の UI に被らないよう、情報は `x: 90〜930 / y: 220〜1500` に収めています（右側 150px はアイコン列のため空けてあります）。字幕は y 1050〜1490 の帯、出典注記は上部、ロゴは中央です。

## 投稿メモ（第壱號）

`episode.ts` の `post` に投稿キャプションとハッシュタグの案があります。プロフィールのリンク先（《裏帳》note）を必ず設定してから投稿してください。
