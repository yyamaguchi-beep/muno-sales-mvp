import assert from "node:assert/strict";
import { test } from "node:test";
import { FatalError, HttpError } from "../src/utils/errors.js";
import { redact } from "../src/utils/logger.js";
import { withRetry } from "../src/utils/retry.js";

const noSleep = async () => {};

test("5xx は最大回数まで指数バックオフで再試行", async () => {
  let n = 0;
  await assert.rejects(withRetry(async () => { n++; throw new HttpError("x", 503, ""); }, { label: "t", maxAttempts: 3, sleep: noSleep }));
  assert.equal(n, 3);
});

test("429 は Retry-After を尊重", async () => {
  const waits: number[] = [];
  let n = 0;
  const r = await withRetry(async () => { if (n++ === 0) throw new HttpError("x", 429, "", 7000); return "ok"; }, { label: "t", maxAttempts: 3, sleep: async (ms) => { waits.push(ms); } });
  assert.equal(r, "ok");
  assert.equal(waits[0], 7000);
});

test("401 はトークン更新を1回だけ試す", async () => {
  let refreshed = 0;
  let n = 0;
  const r = await withRetry(async () => { if (n++ === 0) throw new HttpError("x", 401, ""); return "ok"; }, { label: "t", maxAttempts: 3, sleep: noSleep, onUnauthorized: async () => { refreshed++; return true; } });
  assert.equal(r, "ok");
  assert.equal(refreshed, 1);
});

test("403 は即 FatalError", async () => {
  let n = 0;
  await assert.rejects(withRetry(async () => { n++; throw new HttpError("x", 403, ""); }, { label: "t", maxAttempts: 3, sleep: noSleep }), FatalError);
  assert.equal(n, 1);
});

test("ログからシークレットを除去", () => {
  process.env.OPENAI_API_KEY = "sk-FAKE-test-key-000000";
  const out = redact("key=sk-FAKE-test-key-000000 Bearer ya29.a0AfB_xyz refresh_token=1//0gABCDEFGHIJKLMNOPQRSTUV");
  assert.ok(!out.includes("FAKE-test-key-000000"));
  assert.ok(!out.includes("ya29.a0AfB_xyz"));
  assert.ok(!out.includes("0gABCDEFGHIJKLMNOPQRSTUV"));
  process.env.OPENAI_API_KEY = "";
});
