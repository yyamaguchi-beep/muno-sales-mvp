/**
 * npm run auth
 * Google OAuth 2.0 (business.manage) の refresh token を取得し .env に保存する。
 *
 *  1. ローカルで http://127.0.0.1:<GOOGLE_OAUTH_PORT> を待ち受け
 *  2. 表示された URL をブラウザで開き、GLOW WORKS 生野 を管理している Google アカウントで許可
 *  3. 自動でコードを受け取り refresh token を取得
 *  ブラウザが別マシンの場合: 許可後に表示される「接続できません」ページの URL 全体をコピーしてターミナルに貼り付け
 *
 * オプション: --no-write (.env に書かない) / --print (トークン全文を画面に1度だけ表示)
 */
import crypto from "node:crypto";
import http from "node:http";
import readline from "node:readline";
import { ENV_FILE, loadConfig } from "../src/config.js";
import { AUTH_URL, GBP_SCOPE, TOKEN_URL } from "../src/gbp/auth.js";
import { parseArgs } from "../src/utils/args.js";
import { mask, upsertEnvValues } from "../src/utils/envFile.js";

const args = parseArgs();
const cfg = loadConfig();

if (!cfg.GOOGLE_CLIENT_ID || !cfg.GOOGLE_CLIENT_SECRET) {
  console.error(`
[USER ACTION REQUIRED] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が未設定です。
  Google Cloud Console → APIとサービス → 認証情報 → 「認証情報を作成」→ OAuth クライアント ID
  → アプリケーションの種類「デスクトップ アプリ」で作成し、.env に設定してから再実行してください。`);
  process.exit(1);
}

const port = cfg.GOOGLE_OAUTH_PORT;
const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
const verifier = crypto.randomBytes(48).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
const state = crypto.randomBytes(16).toString("hex");

const authUrl = `${AUTH_URL}?${new URLSearchParams({
  client_id: cfg.GOOGLE_CLIENT_ID,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: GBP_SCOPE,
  access_type: "offline",
  prompt: "consent", // 毎回 refresh_token を確実に発行させる
  include_granted_scopes: "true",
  code_challenge: challenge,
  code_challenge_method: "S256",
  state,
})}`;

function extractCode(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (u.searchParams.get("state") !== state) {
      console.error("state が一致しません。最新の URL で認証してください。");
      return null;
    }
    return u.searchParams.get("code");
  } catch {
    return input.trim() || null; // コードだけ貼られた場合
  }
}

async function exchange(code: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.GOOGLE_CLIENT_ID,
      client_secret: cfg.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const json = (await res.json()) as { refresh_token?: string; scope?: string; error?: string; error_description?: string };
  if (!res.ok || json.error) throw new Error(`トークン取得に失敗: ${json.error} ${json.error_description ?? ""}`);
  if (!json.refresh_token) throw new Error("refresh_token が返されませんでした。https://myaccount.google.com/permissions でアプリのアクセスを削除してから再実行してください。");
  if (!json.scope?.includes(GBP_SCOPE)) throw new Error(`${GBP_SCOPE} スコープが許可されていません。同意画面でチェックを入れてください。`);
  return json.refresh_token;
}

let done = false;
async function finish(code: string | null) {
  if (done || !code) return;
  done = true;
  try {
    const token = await exchange(code);
    if (args["no-write"]) {
      console.log("\n取得成功。--no-write のため .env には保存していません。");
    } else {
      upsertEnvValues({ GOOGLE_REFRESH_TOKEN: token });
      console.log(`\n✅ GOOGLE_REFRESH_TOKEN を ${ENV_FILE} に保存しました: ${mask(token)}`);
    }
    if (args.print) console.log(`\nGOOGLE_REFRESH_TOKEN=${token}\n(GitHub Secrets 登録後、ターミナル履歴を消去してください)`);
    console.log("次: npm run find-location -- --write");
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ ${(err as Error).message}`);
    process.exit(1);
  }
}

const server = http.createServer((req, res) => {
  if (!req.url?.startsWith("/oauth2callback")) {
    res.writeHead(404).end();
    return;
  }
  const code = extractCode(`http://127.0.0.1:${port}${req.url}`);
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(code ? "<h2>認証が完了しました。ターミナルに戻ってください。</h2>" : "<h2>認証に失敗しました。</h2>");
  void finish(code);
});
server.on("error", (e) => console.warn(`ローカルサーバーを起動できません (${e.message})。URL貼り付け方式で続行します。`));
server.listen(port, "127.0.0.1");

console.log(`
1) 次の URL をブラウザで開き、「GLOW WORKS 生野」のオーナー/管理者の Google アカウントでログインして許可してください:

${authUrl}

2) 同じPCのブラウザなら自動で完了します。
   別のPC/スマホで開いた場合は、許可後に表示されるページ (127.0.0.1 に接続できません) の
   アドレスバーの URL 全体をここに貼り付けて Enter を押してください。
`);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on("line", (line) => void finish(extractCode(line)));
