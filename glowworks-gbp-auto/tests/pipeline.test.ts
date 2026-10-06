import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { clearTokenCache } from "../src/gbp/auth.js";
import { runPipeline } from "../src/pipeline.js";
import { makeConfig, memoryRepo } from "./helpers.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  clearTokenCache();
});

interface StubState {
  posts: { name: string; summary: string; createTime: string; state: string; searchUrl: string }[];
  createCalls: unknown[];
  failCreateWith?: "network" | 403 | 500;
  failCreateTimes?: number;
  locationTitle?: string;
}

/** Google API のスタブ */
function stubGoogle(s: StubState) {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      return json({ access_token: "ya29.test", expires_in: 3600, scope: "https://www.googleapis.com/auth/business.manage" });
    }
    if (url.includes("mybusinessbusinessinformation.googleapis.com/v1/locations/")) {
      return json({ name: "locations/222", title: s.locationTitle ?? "GLOW WORKS 生野", storefrontAddress: { administrativeArea: "大阪府", locality: "大阪市生野区", addressLines: ["小路東５丁目１２−１９"] } });
    }
    if (url.includes("/v4/accounts/111/locations/222/localPosts")) {
      if (method === "GET") return json({ localPosts: s.posts });
      const body = JSON.parse(String(init?.body));
      s.createCalls.push(body);
      if (s.failCreateWith && (s.failCreateTimes ?? 1) > 0) {
        s.failCreateTimes = (s.failCreateTimes ?? 1) - 1;
        if (s.failCreateWith === "network") {
          // Google 側では作成済み、だがクライアントはタイムアウトした状況を再現
          s.posts.unshift({ name: "accounts/111/locations/222/localPosts/abc", summary: body.summary, createTime: new Date().toISOString(), state: "LIVE", searchUrl: "https://local.google.com/x" });
          throw new TypeError("fetch failed (simulated timeout)");
        }
        return json({ error: { code: s.failCreateWith, message: "denied" } }, s.failCreateWith);
      }
      const post = { name: `accounts/111/locations/222/localPosts/p${s.createCalls.length}`, summary: body.summary, createTime: new Date().toISOString(), state: "LIVE", searchUrl: "https://local.google.com/p" };
      s.posts.unshift(post);
      return json(post);
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  }) as typeof fetch;
}

const LIVE_ENV = {
  DRY_RUN: "false",
  AI_MOCK: "false",
  STORAGE_PROVIDER: "r2",
  R2_ACCOUNT_ID: "acc",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "bucket",
  R2_PUBLIC_URL: "https://pub.example.r2.dev",
  GOOGLE_CLIENT_ID: "cid",
  GOOGLE_CLIENT_SECRET: "csecret",
  GOOGLE_REFRESH_TOKEN: "1//refresh",
  GBP_ACCOUNT_ID: "111",
  GBP_LOCATION_ID: "222",
};

const NOW = new Date("2026-10-07T01:30:00Z"); // 10:30 JST

/** AUTO_PUBLISH=false の daily で pending を作る (モックAI・ローカル保存) */
async function makePending(repo: ReturnType<typeof memoryRepo>, now = NOW) {
  const cfg = makeConfig({ DRY_RUN: "false", AUTO_PUBLISH: "false" });
  const r = await runPipeline({ mode: "daily", now, config: cfg, repo });
  assert.equal(r.result, "pending", r.message);
  // ローカル保存の file:// URL を公開URLに差し替え (本番では R2 の URL が入る)
  repo.update(r.postId!, { imagePublicUrl: "https://pub.example.r2.dev/generated/x/post.jpg" });
  return r.postId!;
}

test("DRY RUN: 生成・画像URL・投稿JSON・validation まで作り、Google へは送らない", async () => {
  const repo = memoryRepo();
  const cfg = makeConfig({ DRY_RUN: "true" });
  globalThis.fetch = (async () => { throw new Error("network must not be used"); }) as typeof fetch;
  const r = await runPipeline({ mode: "daily", now: NOW, config: cfg, repo });
  assert.equal(r.result, "dry_run");
  const rec = repo.get(r.postId!)!;
  assert.equal(rec.status, "dry_run");
  assert.ok(rec.caption && rec.imagePublicUrl && rec.imagePrompt && rec.validationScore);
});

test("AUTO_PUBLISH=false: pending を作り、同日の再実行は SKIP", async () => {
  const repo = memoryRepo();
  await makePending(repo);
  const again = await runPipeline({ mode: "daily", now: NOW, config: makeConfig({ DRY_RUN: "false", AUTO_PUBLISH: "false" }), repo });
  assert.equal(again.result, "skipped");
  assert.equal(repo.findByDate("2026-10-07", ["pending"]).length, 1);
});

test("承認 (post) で pending を投稿し、再実行しても二重投稿しない", async () => {
  const repo = memoryRepo();
  const id = await makePending(repo);
  const s: StubState = { posts: [], createCalls: [] };
  stubGoogle(s);
  const cfg = makeConfig(LIVE_ENV);
  const r = await runPipeline({ mode: "post", now: NOW, config: cfg, repo });
  assert.equal(r.result, "success", r.message);
  assert.equal(s.createCalls.length, 1);
  const payload = s.createCalls[0] as { topicType: string; languageCode: string; media: { sourceUrl: string }[] };
  assert.equal(payload.topicType, "STANDARD");
  assert.equal(payload.languageCode, "ja");
  assert.equal(payload.media[0]!.sourceUrl, "https://pub.example.r2.dev/generated/x/post.jpg");
  const rec = repo.get(id)!;
  assert.equal(rec.status, "success");
  assert.match(rec.googlePostId!, /localPosts\/p1$/);

  // cron 再実行 / Actions 再実行
  const again = await runPipeline({ mode: "post", now: NOW, config: cfg, repo });
  assert.equal(again.result, "skipped");
  const daily = await runPipeline({ mode: "daily", now: NOW, config: makeConfig({ ...LIVE_ENV, AUTO_PUBLISH: "true" }), repo });
  assert.equal(daily.result, "skipped");
  assert.equal(s.createCalls.length, 1);
});

test("タイムアウトしたが Google 側で作成済み → 再送せず success に復旧", async () => {
  const repo = memoryRepo();
  await makePending(repo);
  const s: StubState = { posts: [], createCalls: [], failCreateWith: "network", failCreateTimes: 1 };
  stubGoogle(s);
  const r = await runPipeline({ mode: "post", now: NOW, config: makeConfig(LIVE_ENV), repo });
  assert.equal(r.result, "success", r.message);
  assert.equal(s.createCalls.length, 1, "must not resend after ambiguous timeout");
});

test("403 は再試行せず停止し failed を記録", async () => {
  const repo = memoryRepo();
  const id = await makePending(repo);
  const s: StubState = { posts: [], createCalls: [], failCreateWith: 403, failCreateTimes: 5 };
  stubGoogle(s);
  const r = await runPipeline({ mode: "post", now: NOW, config: makeConfig(LIVE_ENV), repo });
  assert.equal(r.result, "failed");
  assert.match(r.message, /403/);
  assert.equal(s.createCalls.length, 1);
  assert.equal(repo.get(id)!.status, "failed");
});

test("投稿先の店舗名が一致しなければ投稿しない", async () => {
  const repo = memoryRepo();
  await makePending(repo);
  const s: StubState = { posts: [], createCalls: [], locationTitle: "GLOW WORKS 東大阪" };
  stubGoogle(s);
  const r = await runPipeline({ mode: "post", now: NOW, config: makeConfig(LIVE_ENV), repo });
  assert.equal(r.result, "failed");
  assert.match(r.message, /一致しません/);
  assert.equal(s.createCalls.length, 0);
});

test("DRY_RUN=true では post モードを拒否、AI_MOCK では本番投稿を拒否", async () => {
  const repo = memoryRepo();
  await assert.rejects(runPipeline({ mode: "post", now: NOW, config: makeConfig({ DRY_RUN: "true" }), repo }), /DRY_RUN=true/);
  await assert.rejects(runPipeline({ mode: "post", now: NOW, config: makeConfig({ ...LIVE_ENV, AI_MOCK: "true" }), repo }), /AI_MOCK/);
});
