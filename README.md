# müno 売上管理 MVP

LINEにAirレジ / Uber Eats / ロケットナウの売上スクショを送ると、AIが読み取り、管理画面で確認・修正・承認してからGoogleスプレッドシートへ反映するMVPです。

## 機能

- LINE Webhookで画像受信
- 画像保存
- OpenAI Visionで売上スクショ読取
- チャネル判定
- 日付、売上、客数、注文件数、客単価、手数料、入金予定額、商品別売上を抽出
- 項目別confidenceと候補数字を保持
- 低信頼度項目を赤表示
- 画像不鮮明時に再送依頼
- 同じ日付・同じチャネルの重複検知
- 前日比50%以上増減、客単価異常値をアラート
- 管理画面で修正・承認
- 承認後にGoogle Sheetsへ反映
- スマホ向けダッシュボード

## 起動

```bash
npm start
```

ローカルURL:

```txt
http://localhost:3000/admin
```

初期ログイン:

```txt
ID: owner
Password: password
```

## Render環境変数

```env
APP_BASE_URL=https://muno-sales-mvp-1.onrender.com
APP_SESSION_SECRET=長いランダム文字列
ADMIN_USER=owner
ADMIN_PASSWORD=強いパスワード
APP_USERS_JSON=

LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...

OPENAI_API_KEY=...
OPENAI_VISION_MODEL=gpt-4.1-mini
OPENAI_MOCK=false

GOOGLE_SHEETS_SPREADSHEET_ID=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY_BASE64=...
```

`GOOGLE_PRIVATE_KEY_BASE64` はサービスアカウントJSONの `private_key` をBase64化して設定してください。

## LINE Webhook URL

```txt
https://muno-sales-mvp-1.onrender.com/api/line/webhook
```

## Google Sheets

承認時に以下のシートを自動作成・更新します。

- `daily_sales`
- `product_sales`
- `monthly_targets`
- `settings`

サービスアカウントのメールアドレスを対象スプレッドシートに編集者として共有してください。

## Render Disk

`render.yaml` で永続ディスクを使います。

```env
DATA_DIR=/var/data
UPLOAD_DIR=/var/data/uploads
```

売上DBと画像はRender Diskに保存されます。

## 動作確認

1. `/health` が `ok: true` を返す
2. `/admin` にログイン
3. `手入力` で売上登録
4. 詳細画面で修正
5. 承認
6. Google Sheetsへ反映
7. LINEにスクショ送信
8. 確認待ちとして管理画面に表示
