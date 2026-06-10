# RIGELUS Solar Management

株式会社RIGELUS専用の太陽光営業管理システム Phase 1 MVP です。

外部依存を増やさず、現在の Node.js HTTP サーバー構成のまま、営業マン管理、報酬条件、催事スケジュール、LINE/フォーム報告、管理者承認、案件進捗、売上・入金・報酬・交通費ダッシュボードを動かせます。

## Phase 1 Scope

- 営業マン登録
- 報酬・給与条件登録
- 催事店舗マスタと開催スケジュール管理
- LINEまたはフォームからの勤怠報告
- LINEまたはフォームからの営業結果報告
- AIまたはローカルルールによる報告構造化
- 管理者の確認・承認・無効化
- 既存案件進捗シートを読み取り専用の同期元として扱う設計
- RIGELUS売上、粗利、入金予定、報酬支払予定、交通費、営業成績の可視化

Blueprint Consulting は Phase 1 では実装せず、あとから追加できるようデータ構造を分けています。

## Run Locally

```powershell
npm start
```

この環境で `npm` が使えない場合:

```powershell
& 'C:\Users\user\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' server.js
```

管理画面:

```txt
http://localhost:3000/admin
```

既定ログインは `.env` 未設定時のみ `owner / password` です。本番運用前に必ず変更してください。

## Environment

`.env.example` を `.env` にコピーして設定します。

```env
PORT=3000
APP_BASE_URL=http://localhost:3000
APP_SESSION_SECRET=change-this-long-random-secret
ADMIN_USER=owner
ADMIN_PASSWORD=change-me

LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=

OPENAI_API_KEY=
OPENAI_TEXT_MODEL=gpt-4.1-mini
OPENAI_MOCK=false

GOOGLE_SHEETS_SPREADSHEET_ID=
SOURCE_PROJECTS_SPREADSHEET_ID=17Nays5-dUCKS6sNvF_B_LVtVHRfEDZR0WaTg7YXRQbM
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_PRIVATE_KEY_BASE64=
```

`OPENAI_API_KEY` がない場合、LINEテキスト報告はローカルルールで構造化されます。

## Data Model

ローカルMVPでは `data/db.json` をDBとして使います。将来Supabaseへ移行しやすいよう、テーブル相当の配列で保存しています。

- `salesPeople`
- `compensationRules`
- `eventStoreMaster`
- `eventSchedules`
- `attendanceLogs`
- `salesReports`
- `solarProjects`
- `payments`
- `rewardPayments`
- `commuteRoutes`
- `commuteExpenses`
- `eventResults`
- `dashboardMetrics`
- `auditLogs`
- `settings`

## LINE Webhook

```txt
POST /api/line/webhook
```

テキストメッセージ例:

```txt
本日の結果
田中
ホームズ寝屋川店
接客22
アポ2
契約1
山田様 契約
佐藤様 再訪
```

```txt
今日の稼働
田中
6/10
10:00-18:00
ホームズ寝屋川店
休憩60分
接客18
アポ1
契約0
```

すべて `pending_review` として保存され、管理者の承認後に正式反映されます。

## Google Sheets

`GOOGLE_SHEETS_SPREADSHEET_ID` は RIGELUS 管理用の出力先です。承認時に Phase 1 用タブを作成し、承認済みレコードを追記します。

既存案件進捗シート `17Nays5-dUCKS6sNvF_B_LVtVHRfEDZR0WaTg7YXRQbM` は `SOURCE_PROJECTS_SPREADSHEET_ID` として読み取り専用の同期元にします。壊さない前提です。

## Key URLs

- `/admin`: 経営ダッシュボード
- `/admin/sales-people`: 営業マン登録
- `/admin/compensation-rules`: 報酬条件登録
- `/admin/events`: 催事店舗・開催スケジュール
- `/admin/reports`: 勤怠・営業結果フォーム
- `/admin/projects`: 案件進捗・売上登録
- `/admin/review`: 承認キュー
