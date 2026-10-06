# GLOW WORKS 生野 — Google ビジネスプロフィール 毎日自動投稿

大阪市生野区の就労継続支援B型事業所「GLOW WORKS 生野」の Google ビジネスプロフィール (GBP) に、
**毎日1回、テーマ選定 → キャプション生成 → 画像生成 → 画像公開URL化 → 品質チェック → 投稿 → 記録** を自動で行うシステムです。

- 目的は「毎日投稿すること」ではなく、検索した人に役立つ情報を蓄積して **検索 → プロフィール → Webサイト → 電話/LINE → 見学 → 体験 → 利用相談** につなげること
- 公式 API (Business Profile API) のみを使用。スクレイピングやブラウザ自動操作は行いません
- 誤った店舗への投稿・二重投稿・誇大/未確認表現を、何層にもわたって防ぎます

---

## 目次

1. [仕組み](#1-仕組み)
2. [必要なサービス](#2-必要なサービス)
3. [セットアップ](#3-セットアップ)
   - 手順1 Google Cloud プロジェクト作成
   - 手順2 Business Profile API 利用申請・API 有効化
   - 手順3 OAuth 同意画面・OAuth クライアント作成
   - 手順4 Google アカウント認証 (Refresh Token 取得)
   - 手順5 Account ID / Location ID の自動検出
   - 手順6 OpenAI API キー
   - 手順7 Cloudflare R2 (画像の公開URL)
   - 手順8 .env 設定
4. [DRY RUN](#4-dry-run)
5. [本番投稿テスト](#5-本番投稿テスト)
6. [GitHub Actions で毎日自動実行](#6-github-actions-で毎日自動実行)
7. [運用モード (DRY_RUN / AUTO_PUBLISH)](#7-運用モード)
8. [コマンド一覧](#8-コマンド一覧)
9. [コンテンツ設計](#9-コンテンツ設計)
10. [安全装置](#10-安全装置)
11. [トラブルシューティング](#11-トラブルシューティング)
12. [ディレクトリ構成](#12-ディレクトリ構成)

---

## 1. 仕組み

```
GitHub Actions (毎日 10:30 JST / 12:30 JST バックアップ)
  │
  ├─ STEP 1  日付取得 (Asia/Tokyo)
  ├─ STEP 2  投稿履歴確認 (SQLite)  … 当日 success があれば SKIP
  ├─ STEP 3  テーマ選択 (A〜Z をカテゴリ比率・クールダウン付きでローテーション)
  ├─ STEP 4  投稿構成 (切り口・キーワード・CTA有無・画像シーン/構図/人物)
  ├─ STEP 5  キャプション生成 (OpenAI Responses API) + VALUE_SCORE 評価 (80未満は作り直し)
  ├─ STEP 6  画像プロンプト生成 (subject / camera angle / lighting / negative constraints …)
  ├─ STEP 7  画像生成 (gpt-image-2.5-flare) + 破綻チェック → 日本語は Sharp で正確に合成
  ├─ STEP 8  Cloudflare R2 にアップロード → 公開 HTTPS URL を実際に取得できるか確認
  ├─ STEP 9  ルールベース validation (0〜100点。85未満は1回自動修正、それでも未満なら投稿しない)
  ├─ STEP 10 投稿先店舗を API で再照合 → Local Posts API で投稿 (画像 + 文章)
  ├─ STEP 11 結果を SQLite に保存 (+ generated/YYYY-MM-DD/ にプレビュー)
  └─ STEP 12 logs/YYYY-MM-DD.log に記録
```

使用 API:

| 用途 | API | エンドポイント |
| --- | --- | --- |
| アカウント一覧 | My Business Account Management API v1 | `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts` |
| 店舗一覧・照合 | My Business Business Information API v1 | `GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{id}/locations?readMask=...` |
| 投稿 | Google My Business API v4 (Local Posts) | `POST https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/localPosts` |
| 文章 | OpenAI Responses API (Structured Outputs) | 既定 `gpt-6.1-sol`、使えなければ `gpt-5.5` に自動切替 |
| 画像 | OpenAI Image API | 既定 `gpt-image-2.5-flare` / 高品質 `gpt-image-2.5-sunburst` |

> Local Posts は v1 に移行されておらず、現在も v4 (`mybusiness.googleapis.com`) が正式な投稿 API です。
> Google が API を変更した場合は [公式リファレンス](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts/create) と [廃止スケジュール](https://developers.google.com/my-business/content/sunset-dates) を確認し、`src/gbp/posts.ts` を更新してください。

---

## 2. 必要なサービス

| サービス | 用途 | 費用の目安 |
| --- | --- | --- |
| Google Cloud | Business Profile API・OAuth | API 自体は無料 (要利用申請) |
| Google ビジネスプロフィール | 投稿先。**GLOW WORKS 生野のオーナーまたは管理者の Google アカウント**が必要 | 無料 |
| OpenAI API | 文章・画像生成 | 従量課金 (画像1枚/日 + 文章数回/日) |
| Cloudflare R2 (または GCS) | 画像の公開URL・履歴DBの保存 | 無料枠内に収まる想定 |
| GitHub | 毎日の自動実行 (Actions) | 無料枠内 (1回 約2〜4分) |

Node.js 20.11 以上 (推奨 22) が必要です。

---

## 3. セットアップ

```bash
cd glowworks-gbp-auto
npm install
cp .env.example .env
npm run status        # 何が未設定かを一覧表示 (USER ACTION REQUIRED)
```

### 手順1 Google Cloud プロジェクト作成

> **USER ACTION REQUIRED**

1. <https://console.cloud.google.com/> に、GLOW WORKS 生野を管理している Google アカウントでログイン
2. 画面上部のプロジェクト選択 → 「新しいプロジェクト」→ 名前例 `glowworks-gbp` → 作成
3. 「ダッシュボード」に表示される **プロジェクト番号** (数字) を控える (利用申請で使用)

### 手順2 Business Profile API 利用申請・API 有効化

> **USER ACTION REQUIRED** — 承認まで数日〜数週間かかることがあります。最初に申請してください。

Business Profile API は申請制で、未承認のプロジェクトはクォータが **0** (呼ぶと 429/403) です。

1. 申請前の条件を確認
   - Google ビジネスプロフィールが **確認済み (verified)** で、60日以上運用されている
   - プロフィールに Web サイト (<https://glowworksikuno.com/>) が登録されている
   - 申請する Google アカウントがプロフィールのオーナー/管理者
2. 申請フォーム: <https://support.google.com/business/contact/api_default>
   - 「Application for Basic API Access」を選択
   - 会社名・Web サイト・手順1のプロジェクト番号・連絡先メールを入力
   - 利用目的の例: *"Publishing daily informational posts (text + image) to our own single location (GLOW WORKS 生野, a welfare employment support office) via the Local Posts API. No third-party data."*
3. 承認メールが届いたら、Cloud Console → 「API とサービス」→「ライブラリ」で以下 **3つ** を有効化
   - **My Business Account Management API**
   - **My Business Business Information API**
   - **Google My Business API** (v4。Local Posts 用。承認後にライブラリに表示されます)
4. 「API とサービス」→「割り当て」で上記 API のクォータが 0 でないこと (例: 300 QPM) を確認

### 手順3 OAuth 同意画面・OAuth クライアント作成

> **USER ACTION REQUIRED**

1. Cloud Console →「API とサービス」→「OAuth 同意画面」(Google Auth Platform)
   - User Type: **外部** (Google Workspace 組織内のみなら「内部」でも可)
   - アプリ名: `GLOW WORKS GBP Auto`、サポートメール: 自分のメール
   - スコープ: `https://www.googleapis.com/auth/business.manage` を追加
   - テストユーザー: 店舗管理用の Google アカウントを追加
   - **公開ステータスを「本番環境」にする** — 「テスト」のままだと Refresh Token が **7日で失効** し、自動投稿が止まります。
     自社アカウントだけで使う場合、Google の審査なしで「未確認のアプリ」警告が出るだけで利用できます (認証時に「詳細」→「(安全ではないページ)に移動」)。
2. 「認証情報」→「認証情報を作成」→「OAuth クライアント ID」
   - アプリケーションの種類: **デスクトップ アプリ**
   - 作成後に表示される **クライアント ID** と **クライアント シークレット** を `.env` の
     `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` に設定
   - ダウンロードした JSON は **Git にコミットしない** (.gitignore 済み)

### 手順4 Google アカウント認証 (Refresh Token 取得)

> **USER ACTION REQUIRED** — ブラウザでのログインと許可はご自身で行ってください。

```bash
npm run auth
```

1. 表示された URL をブラウザで開く
2. **GLOW WORKS 生野のオーナー/管理者の Google アカウント** でログイン → 「ビジネス プロフィールの管理」を許可
3. 同じ PC なら自動で完了し、`.env` に `GOOGLE_REFRESH_TOKEN` が保存されます
   - 別の PC / スマホで開いた場合: 許可後の「このサイトにアクセスできません (127.0.0.1)」ページの **アドレスバーの URL 全体** をターミナルに貼り付けて Enter
4. GitHub Secrets 登録用にトークン全文を一度だけ表示したい場合: `npm run auth -- --print` (登録後ターミナル履歴を消去)

### 手順5 Account ID / Location ID の自動検出

```bash
npm run find-location            # 確認のみ
npm run find-location -- --write # 一意に特定できたら .env に保存
```

- アカウント一覧 → 店舗一覧 → 「GLOW WORKS 生野」を **店舗名と住所の両方** で照合します
- 住所は表記ゆれ (全角/半角、「5丁目12-19」「5-12-19」「五丁目12番19号」) を正規化して比較します
- 一致が 0件 / 複数 / 片方だけ一致 の場合は **設定しません** (誤投稿防止)
- Google 上の表記が異なる場合は `.env` の `GBP_EXPECTED_NAME` / `GBP_EXPECTED_ADDRESS` を合わせてください
- 投稿のたびにも、投稿直前に同じ照合を行い、一致しなければ投稿を中止します

### 手順6 OpenAI API キー

> **USER ACTION REQUIRED** — 課金設定はご自身で行ってください。

1. <https://platform.openai.com/> → Settings → **Billing** で支払い方法を登録
2. **API keys** → 「Create new secret key」→ `.env` の `OPENAI_API_KEY` に設定
3. 画像モデル (`gpt-image-2.5-*`) の利用に **Organization Verification** が求められる場合は、Settings → Organization → General → Verify で認証
4. 品質優先にする場合は `IMAGE_QUALITY_PRIORITY=true` (→ `gpt-image-2.5-sunburst`)

### 手順7 Cloudflare R2 (画像の公開URL)

Google は投稿画像を **公開 HTTPS URL から取得** します。生成画像を R2 に置き、URL を発行します。

> **USER ACTION REQUIRED**

1. <https://dash.cloudflare.com/> → **R2 Object Storage** → (初回のみ R2 を有効化。支払い方法の登録が必要)
2. 「バケットを作成」→ 名前例 `glowworks-gbp` → `R2_BUCKET`
3. バケット → **設定 → 公開アクセス**
   - 推奨: **カスタムドメイン** を接続 (例 `img.glowworksikuno.com`、ドメインが Cloudflare 管理の場合)
   - 簡易: **R2.dev サブドメイン** を「許可」(開発向け・レート制限あり)
   - 表示された URL (例 `https://pub-xxxx.r2.dev`) を `R2_PUBLIC_URL` に (末尾スラッシュなし)
4. R2 トップ → **API トークンの管理** →「API トークンを作成」
   - 権限: **オブジェクト読み取りと書き込み**、対象: 作成したバケットのみ
   - 表示される **アクセスキー ID** → `R2_ACCESS_KEY_ID`、**シークレットアクセスキー** → `R2_SECRET_ACCESS_KEY`
5. R2 トップに表示される **アカウント ID** → `R2_ACCOUNT_ID`
6. ライフサイクルルールを設定する場合は **`generated/` を 90日以上** にしてください (最低30日は URL を維持)。`state/` には設定しないでください

保存されるもの:

| キー | 内容 |
| --- | --- |
| `generated/YYYY-MM-DD/post-<hash>.jpg` | 投稿画像 (Google が取得) |
| `state/posts.db` | 投稿履歴 SQLite (`STATE_SYNC=true` 時。投稿本文などのみで秘密情報は含みません) |
| `state/backup/posts-YYYY-MM-DD.db` | 履歴 DB の日次バックアップ |

> Google Cloud Storage を使う場合: `STORAGE_PROVIDER=gcs`、`GCS_BUCKET`、サービスアカウント JSON を base64 化して `GCS_KEY_JSON_BASE64`。
> バケットは「均一なバケットレベルのアクセス」で `allUsers` に「Storage オブジェクト閲覧者」を付与して公開してください。

### 手順8 .env 設定

`.env.example` の全項目に説明があります。最低限:

```env
OPENAI_API_KEY=sk-...
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=1//...        # npm run auth で自動設定
GBP_ACCOUNT_ID=...                 # npm run find-location -- --write で自動設定
GBP_LOCATION_ID=...
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=glowworks-gbp
R2_PUBLIC_URL=https://pub-xxxx.r2.dev
DRY_RUN=true
AUTO_PUBLISH=false
```

確認:

```bash
npm run status
```

すべて ✅ になり「USER ACTION REQUIRED」が DRY_RUN の切替だけになれば準備完了です。

---

## 4. DRY RUN

**初回は必ず DRY RUN で確認してください。** Google へは投稿しません。

```bash
npm run dry-run                 # 実際の OpenAI + R2 で生成・アップロード
npm run dry-run -- --theme R    # テーマを固定して試す (A〜Z)
```

`generated/YYYY-MM-DD/` に以下が出力されます:

| ファイル | 内容 |
| --- | --- |
| `caption.txt` | 投稿本文 |
| `image-prompt.txt` | 画像生成プロンプト |
| `post.jpg` | 投稿画像 (合成文字・注記込み) |
| `post.json` | テーマ・キーワード・画像URL・**Google へ送る投稿 JSON (payload)**・結果 |
| `validation.json` | 品質チェックの全項目・点数・VALUE_SCORE・画像チェック結果 |

API キーなしで仕組みだけ確認したい場合: `.env` に `AI_MOCK=true` と `STORAGE_PROVIDER=local` を設定 (モック文章・画像で全工程を実行。本番投稿は不可)。

---

## 5. 本番投稿テスト

```bash
npm run test-post                 # 読み取りのみ: 認証・店舗照合・既存投稿の取得・最新DRY RUNの投稿JSON・画像URL疎通
# 問題なければ .env を DRY_RUN=false にして
npm run test-post -- --publish    # 最新の DRY RUN 内容を1件だけ本番投稿 (yes の確認入力あり)
```

または、その日の内容を生成してすぐ投稿:

```bash
npm run post
```

Google マップ / 検索で「GLOW WORKS 生野」のプロフィール → 「最新情報」に投稿が表示されることを確認してください (反映まで数分〜。審査で `REJECTED` になった場合は `npm run history` の error に記録されます)。

---

## 6. GitHub Actions で毎日自動実行

PC が起動していなくても GitHub 上で毎日実行されます。ワークフロー: リポジトリ直下の `.github/workflows/gbp-daily-post.yml`

### スケジュール (UTC ↔ JST)

GitHub Actions の cron は **UTC**。日本は UTC+9 (サマータイムなし) なので:

| JST | UTC cron | 役割 |
| --- | --- | --- |
| 10:30 | `30 1 * * *` | 本実行 |
| 12:30 | `30 3 * * *` | バックアップ (GitHub 側の遅延/スキップ対策。投稿済みなら何もしない) |

投稿時刻を変える場合は `POST_HOUR` / `POST_MINUTE` (Variables) を変え、`npm run cron` が表示する UTC cron 式に workflow の schedule を合わせてください。
プログラムは「予定時刻前の実行は SKIP」「当日投稿済みなら SKIP」するため、時刻はコードにハードコードされていません。

### GitHub Secrets (USER ACTION REQUIRED)

リポジトリ → **Settings → Secrets and variables → Actions → Secrets → New repository secret** で登録:

| Secret 名 | 値 |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API キー |
| `GOOGLE_CLIENT_ID` | OAuth クライアント ID |
| `GOOGLE_CLIENT_SECRET` | OAuth クライアント シークレット |
| `GOOGLE_REFRESH_TOKEN` | `npm run auth` で取得した値 (`.env` 参照) |
| `GBP_ACCOUNT_ID` | `npm run find-location` の結果 |
| `GBP_LOCATION_ID` | 同上 |
| `R2_ACCOUNT_ID` | Cloudflare アカウント ID |
| `R2_ACCESS_KEY_ID` | R2 API トークンのアクセスキー ID |
| `R2_SECRET_ACCESS_KEY` | R2 API トークンのシークレット |
| `R2_BUCKET` | バケット名 |
| `R2_PUBLIC_URL` | 公開 URL (例 `https://pub-xxxx.r2.dev`) |

(GCS を使う場合は `GCS_BUCKET` / `GCS_PUBLIC_URL` / `GCS_KEY_JSON_BASE64`)

### GitHub Variables (運用の切替)

同じ画面の **Variables** タブで登録 (未登録時は安全側の既定値):

| Variable 名 | 既定 | 説明 |
| --- | --- | --- |
| `DRY_RUN` | `true` | `false` で本番投稿が可能に |
| `AUTO_PUBLISH` | `false` | `true` で完全自動投稿 |
| `IMAGE_QUALITY_PRIORITY` | `false` | `true` で `gpt-image-2.5-sunburst` |
| `OPENAI_TEXT_MODEL` | (空=gpt-6.1-sol) | テキストモデル変更時 |
| `POST_HOUR` / `POST_MINUTE` | `10` / `30` | 投稿時刻 (cron も合わせて変更) |
| `STORAGE_PROVIDER` | `r2` | `gcs` に切替可 |

Actions では `STATE_SYNC=true` で履歴 DB を R2 の `state/posts.db` に保存・復元するため、毎回まっさらな実行環境でも重複防止・ローテーションが継続します。

### 手動実行

Actions タブ → 「GBP daily post」→ **Run workflow** → mode を選択 (`dry-run` / `daily` / `post` / `generate`)、必要ならテーマ (A〜Z)。
実行後、ジョブの **Artifacts** から `generated/` (プレビュー一式) と `logs/` をダウンロードできます (30日保存)。

### 推奨の切替手順

1. Secrets 登録 → Variables 未設定のまま (DRY_RUN=true) で数日運用し、Artifacts の投稿内容を確認
2. `DRY_RUN=false`、`AUTO_PUBLISH=false` → 毎日 pending として生成。内容を確認し、問題なければ手動で `mode=post` を実行 (承認)
3. 品質に納得したら `AUTO_PUBLISH=true` → **完全自動化**

> 公開リポジトリで 60日間コミット等の活動がないと、GitHub は scheduled workflow を自動停止します。停止通知メールが来たら Actions タブで再有効化してください。

### 代替: Cloud Run + Cloud Scheduler / 常駐サーバー

- 常駐 PC/VPS: `npm run scheduler` (`.env` の時刻で毎日実行。pm2 や systemd で常駐)
- Cloud Run Jobs: このディレクトリをコンテナ化し `npx tsx src/index.ts --mode daily` を実行、Cloud Scheduler で `30 10 * * *` (タイムゾーン Asia/Tokyo) を設定。`STATE_SYNC=true` にしてください

---

## 7. 運用モード

| DRY_RUN | AUTO_PUBLISH | 毎日の実行 (`npm run daily` / Actions) |
| --- | --- | --- |
| `true` | (任意) | 生成 + 画像URL化 + 投稿JSON + validation まで。**投稿しない** (`dry_run`) |
| `false` | `false` | 生成して **承認待ち (`pending`)** で保存。`npm run approve` (Actions なら mode=post) で投稿 |
| `false` | `true` | **完全自動投稿** |

- `npm run post` は DRY_RUN=false のときだけ動作します (DRY_RUN=true では拒否)
- `AI_MOCK=true` では本番投稿できません

---

## 8. コマンド一覧

| コマンド | 内容 |
| --- | --- |
| `npm run auth` | Google 認証 (Refresh Token 取得・.env 保存) |
| `npm run find-location [-- --write]` | GLOW WORKS 生野 の ACCOUNT_ID / LOCATION_ID 検出 |
| `npm run generate` | 投稿生成だけ (アップロード・投稿なし) |
| `npm run dry-run` | 画像 + 文章 + 画像URL + validation + 投稿JSON (投稿なし) |
| `npm run post` | 今すぐ本番投稿 (当日 pending があればそれを投稿) |
| `npm run daily` | 毎日の実行 (DRY_RUN / AUTO_PUBLISH に従う) |
| `npm run approve [-- --date YYYY-MM-DD]` | 承認待ち (pending) を投稿 |
| `npm run history [-- --limit 50] [-- --id N] [-- --runs]` | 投稿履歴 / 実行履歴の表示 |
| `npm run status [-- --offline]` | 設定・認証・投稿先・ストレージ・履歴の状態確認 |
| `npm run test-post [-- --publish]` | Google 接続テスト / 初回本番投稿テスト |
| `npm run cron` | 投稿時刻から GitHub Actions 用 UTC cron 式を表示 |
| `npm run scheduler` | 常駐スケジューラ (PC/VPS 用) |
| `npm run typecheck` / `npm run lint` / `npm test` | 開発用チェック |

オプション: `--theme A〜Z` (テーマ固定)、`--date YYYY-MM-DD` (generate/dry-run のみ)

---

## 9. コンテンツ設計

### テーマ (A〜Z) とカテゴリ比率

| カテゴリ | 目標比率 | テーマ |
| --- | --- | --- |
| 利用者の悩み解決 | 30% | B 働く不安 / C 週5日は難しい / D 人間関係に疲れた / E 精神障害 / F 発達障害 / U 自信がない / V 毎日通えない / W 話すのが苦手 / X ブランク / Y できる仕事が分からない |
| 仕事内容 | 20% | H PC作業 / I 古着 / J 在宅利用 / P 仕事内容 |
| 制度・B型解説 | 15% | A 初めてB型を探す / O B型の仕組み / T よくある質問 |
| 事業所紹介 | 10% | G 生活リズム / K 送迎 / Q 1日の流れ |
| 見学・利用方法 | 10% | R 見学・体験 / S 利用開始までの流れ |
| 家族向け | 5% | L ご家族 |
| 支援者向け | 5% | M 相談支援専門員 / N 病院・支援機関 |
| 季節・地域 | 5% | Z 季節・時期 |

- 直近40投稿のカテゴリ比率と目標の差が最も大きいカテゴリを選び、その中で最も長く使っていないテーマを選択 (ランダムではありません)
- 同じテーマは **連続せず、14日以内に再使用しない**。各テーマに複数の「切り口」があり、毎回変わります
- primaryKeyword 1個 + secondaryKeywords 2〜4個を、テーマの検索意図に合わせて直近と被らないよう選択
- 見学・相談の導線 (LEARN_MORE ボタン) は約30% (情報提供 70% / 相談導線 30%)
- 季節・曜日は文脈として渡しますが、イベントやキャンペーンは作らせません

テーマ・事実・キーワードの編集: `src/content/themes.ts` / `businessFacts.ts` / `keywords.ts` / `imageScenes.ts`

### 事実の管理

`src/content/businessFacts.ts` にある情報だけを事実として書かせます。工賃・利用料の金額、送迎エリア、最寄り駅、空き状況、就職実績などは「未確認情報」として AI に禁止し、validator でも検出します。
**事業所の情報が変わったら必ずこのファイルを更新してください。**

### 画像

- シーン (PC作業・検品・撮影・梱包・相談…19種)、構図 (広角・寄り・斜め・手元・俯瞰…10種)、人物 (20〜50代の日本人、性別を偏らせない9パターン)、光をローテーション
- 画像AIにはキャプション全文ではなく、専用の構造化プロンプト (subject / location / action / camera angle / lighting / composition / clothing / expression / background / brand mood / negative constraints) を渡します
- 画像AIに文字は描かせず、必要な短いフレーズ (例「週1日から相談できます」) は Sharp + Noto Sans CJK で正確に合成
- 右下に「※画像はイメージです」を合成 (AI画像を実際の施設写真と誤認させないため)。`assets/reference/` に実写を置くと編集モードで実際の空間をベースに生成
- 生成後に AI で指・キーボード・文字・テーマ一致をチェックし、NG なら1回だけ再生成

---

## 10. 安全装置

| リスク | 対策 |
| --- | --- |
| 誤った店舗に投稿 | 店舗名 **と** 住所の両方が一致する1件のみ設定。投稿直前にも API で再照合し、不一致なら停止 |
| 二重投稿 | ① 当日 `success` があれば SKIP ② DB の UNIQUE 制約で同日の承認待ち/投稿中/成功は1件のみ ③ 投稿前・再試行前に Google 上の同一本文の投稿を確認 (タイムアウト後も再送しない) ④ Actions の concurrency で同時実行なし ⑤ 1日の投稿試行は最大3回 |
| 誇大・虚偽・医療効果 | 生成プロンプトで禁止 + ルールベース validator で検出 → ブロック |
| 似た投稿の量産 | 直近30投稿を AI に渡す + 3-gram 類似度・見出し・書き出し・構成・定型句の検査 |
| 薄い投稿 | 別ロールの AI が VALUE_SCORE を採点。80未満は作り直し、最終的に未満なら投稿しない |
| API エラー | 最大3回・指数バックオフ。401 はトークン更新、403 は即停止、429 は Retry-After を尊重、5xx は再試行。画像生成・文章生成は最大2回 |
| 認証情報の漏洩 | コードにキーなし。`.env`/認証 JSON は .gitignore。ログはキー・トークンを自動伏字化 |

validation の採点項目 (0〜100点、85点以上 かつ ブロック項目なしで合格):
店舗名 / 住所 / 営業時間・定員 / 虚偽・未確認情報・医療効果 / 誇大表現 / キーワード詰め込み / 直近投稿との類似 / 文章の自然さ (AI定型句・定型挨拶・絵文字・長文・電話番号/URL) / 文字数 / CTA の量 / 画像とテーマの一致 / VALUE_SCORE

---

## 11. トラブルシューティング

| 症状 | 原因と対処 |
| --- | --- |
| `429 RESOURCE_EXHAUSTED` / クォータ 0 | Business Profile API の利用申請が未承認。手順2の承認を待つ。承認後も割り当てが 0 なら申請フォームで問い合わせ |
| `403 PERMISSION_DENIED` | API が有効化されていない (手順2-3の3つ)、または認証したアカウントが店舗のオーナー/管理者でない。`npm run auth` を正しいアカウントでやり直す |
| `invalid_grant` | Refresh Token が失効。OAuth 同意画面が「テスト」だと7日で失効します → 「本番環境」に公開して `npm run auth` → GitHub Secret も更新 |
| `refresh_token が返されませんでした` | <https://myaccount.google.com/permissions> でアプリのアクセスを削除して再実行 |
| `店舗を一意に特定できませんでした` | Google 上の店舗名・住所の表記を確認し、`GBP_EXPECTED_NAME` / `GBP_EXPECTED_ADDRESS` を合わせる |
| `投稿先の店舗が想定と一致しません` | `GBP_LOCATION_ID` が別店舗、または店舗名/住所が Google 上で変更された。`npm run find-location` で再確認 |
| `画像の公開URLにアクセスできません` | R2 の公開アクセスが無効、または `R2_PUBLIC_URL` の誤り。ブラウザで URL を開いて確認 |
| 投稿が `REJECTED` | Google のコンテンツポリシーで却下。本文の電話番号・URL・誇大表現を避ける設定になっていますが、`npm run history -- --id N` で内容を確認 |
| テキストモデルが見つからない | `OPENAI_TEXT_MODEL_FALLBACK` (既定 gpt-5.5) に自動切替。恒久的には `OPENAI_TEXT_MODEL` を変更 |
| 画像生成で 403 | OpenAI の Organization Verification が必要。手順6-3 |
| `validation ... 基準未満` で投稿されない | 安全側の正常動作。`generated/日付/validation.json` を確認。翌日は別テーマで再生成されます |
| 画像の日本語が □ になる | 日本語フォントなし。`sudo apt install fonts-noto-cjk` (Actions では自動インストール)。フォントがない場合は合成をスキップします |
| Actions が動かない | Secrets/Variables の名前を確認。60日無活動で停止していないか Actions タブを確認 |
| 同じ日に投稿されていない | `npm run history -- --runs` で SKIP 理由 (予定時刻前・投稿済み・試行上限) を確認 |

ログ: `logs/YYYY-MM-DD.log` (Actions では Artifacts)。API キー・トークンは自動的に `[REDACTED]` になります。

---

## 12. ディレクトリ構成

```
glowworks-gbp-auto/
├─ src/
│  ├─ index.ts            CLI エントリ (--mode daily|generate|dry-run|post)
│  ├─ pipeline.ts         STEP 1〜12 の本体・冪等性制御
│  ├─ scheduler.ts        時刻判定・常駐スケジューラ・UTC cron 変換
│  ├─ config.ts           .env 読込・検証
│  ├─ ai/
│  │  ├─ caption.ts       キャプション生成 (Responses API + Structured Outputs)
│  │  ├─ imagePrompt.ts   画像プロンプト生成
│  │  ├─ imageGenerator.ts 画像生成 / 参照写真の編集モード
│  │  ├─ reviewer.ts      VALUE_SCORE 評価・画像破綻チェック
│  │  ├─ validator.ts     ルールベース品質チェック (0〜100点)
│  │  ├─ openaiClient.ts  OpenAI 呼び出し・リトライ・モデルフォールバック
│  │  └─ mock.ts          AI_MOCK 用オフライン実装
│  ├─ gbp/
│  │  ├─ auth.ts          OAuth トークン管理
│  │  ├─ account.ts       アカウント一覧
│  │  ├─ location.ts      店舗一覧・取得
│  │  ├─ match.ts         店舗名・住所の照合
│  │  └─ posts.ts         Local Posts 投稿・重複検出・店舗再照合
│  ├─ storage/            r2 / gcs / local と履歴DBの同期
│  ├─ content/            テーマ・事実・キーワード・画像シーン・季節・計画
│  ├─ db/                 SQLite (posts / runs)
│  ├─ image/overlay.ts    文字合成・注記・JPEG 仕上げ
│  └─ utils/              日付・ログ (伏字化)・リトライ・テキスト類似度
├─ scripts/               auth / find-location / status / history / approve / test-post / cron-expr
├─ tests/                 node:test (validator・照合・ローテーション・二重投稿防止・リトライ)
├─ assets/reference/      実際の店舗写真 (任意)
├─ data/posts.db          投稿履歴 (Git 管理外)
├─ generated/YYYY-MM-DD/  プレビュー (Git 管理外)
├─ logs/YYYY-MM-DD.log    ログ (Git 管理外)
└─ .env.example
.github/workflows/gbp-daily-post.yml   毎日の自動実行 (リポジトリ直下)
.github/workflows/gbp-ci.yml           型チェック・lint・テスト・モック DRY RUN
```

DB の主な列: `id, date, publishedAt, theme, targetAudience, primaryKeyword, secondaryKeywords, title, caption, imagePrompt, imagePath, imagePublicUrl, googlePostId, status, error, createdAt` ほか (`src/db/migrations.ts`)。
