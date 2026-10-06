import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { generateCaption, type CaptionDraft } from "./ai/caption.js";
import { generateImage } from "./ai/imageGenerator.js";
import { buildImagePrompt } from "./ai/imagePrompt.js";
import { imageReviewPassed, reviewImage, reviewValue, type ImageReview } from "./ai/reviewer.js";
import { validatePost, type ValidationResult } from "./ai/validator.js";
import { imageModel, loadConfig, paths, type Config } from "./config.js";
import { planPost, type PostPlan } from "./content/planner.js";
import { seasonContext } from "./content/season.js";
import { CATEGORY_LABELS } from "./content/themes.js";
import { PostRepository, type PostRecord, type PostStatus, type RunMode } from "./db/database.js";
import { buildPayload, createLocalPost, findExistingPost, verifyTargetLocation, type LocalPostPayload } from "./gbp/posts.js";
import { finalizeImage } from "./image/overlay.js";
import { createStorage, verifyPublicUrl, type StorageProvider } from "./storage/index.js";
import { pullState, pushState } from "./storage/stateSync.js";
import { localDateString } from "./utils/date.js";
import { errorMessage, FatalError } from "./utils/errors.js";
import { logger, redact } from "./utils/logger.js";
import { shortHash } from "./utils/text.js";

export type RunResult = "success" | "skipped" | "failed" | "dry_run" | "pending" | "rejected" | "draft";

export interface RunOptions {
  mode: RunMode;
  now?: Date;
  /** generate / dry-run のみ: 日付の上書き (テスト用) */
  dateOverride?: string;
  forceTheme?: string;
  /** テスト用: 設定を差し替え */
  config?: Config;
  /** テスト用: DB を差し替え */
  repo?: PostRepository;
}

export interface RunOutcome {
  result: RunResult;
  message: string;
  postId?: number;
  outputDir?: string;
}

/** 1日あたりの本番投稿試行の上限 (無限再送防止) */
const MAX_PUBLISH_ATTEMPTS_PER_DAY = 3;
/** publishing のまま放置された記録をクラッシュとみなすまでの時間 */
const STALE_PUBLISHING_MS = 20 * 60_000;

type Action = "draft" | "dry_run" | "pending" | "publish";

function decideAction(cfg: Config, mode: RunMode): Action {
  switch (mode) {
    case "generate":
      return "draft";
    case "dry-run":
      return "dry_run";
    case "post":
      if (cfg.DRY_RUN) throw new FatalError("DRY_RUN=true のため本番投稿できません。初回 DRY RUN を確認後、.env (または GitHub Variables) で DRY_RUN=false にしてください。");
      return "publish";
    case "daily":
      if (cfg.DRY_RUN) return "dry_run";
      return cfg.AUTO_PUBLISH ? "publish" : "pending";
  }
}

function writeFile(dir: string, name: string, content: string | Buffer) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), content);
}

interface Generated {
  plan: PostPlan;
  draft: CaptionDraft;
  valueScore: number;
  validation: ValidationResult;
  imagePrompt: string;
  imageReview: ImageReview | null;
  image: Buffer;
  imageMeta: { model: string; mode: string; referenceFile?: string };
}

/** STEP 3〜9: テーマ選択 → キャプション → 画像プロンプト → 画像 → validation */
async function generateContent(cfg: Config, repo: PostRepository, date: string, now: Date, action: Action, forceTheme?: string): Promise<Generated | { rejected: true; reason: string; partial: Partial<Generated> }> {
  // 履歴: 本番系の記録でローテーション。DRY RUN / generate 時はそれらの記録も含めて毎回違う内容を試せるようにする
  const rotationStatuses: PostStatus[] = ["success", "pending", "publishing", "failed"];
  if (action === "dry_run" || action === "draft") rotationStatuses.push("dry_run", "draft");
  const history = repo.recent(60, rotationStatuses).filter((r) => r.caption || r.theme);
  const recentForAi = repo.recent(cfg.HISTORY_CONTEXT_POSTS, rotationStatuses).filter((r) => r.caption);

  // STEP 3-4: テーマ・構成計画
  const plan = planPost(history, date, { ctaRatio: cfg.CTA_RATIO, forceTheme });
  const season = seasonContext(now, cfg.TIMEZONE, date);
  logger.info(
    `テーマ決定: ${plan.theme.code} ${plan.theme.name} / 切り口「${plan.angle}」 / ${CATEGORY_LABELS[plan.category]} / KW「${plan.primaryKeyword}」+[${plan.secondaryKeywords.join(", ")}] / CTA=${plan.useCta ? "LEARN_MORE" : "なし"} / 画像=${plan.scene.id}・${plan.composition.id}・${plan.person?.id ?? "人物なし"}`,
  );

  // STEP 5: キャプション生成 + VALUE_SCORE (80未満は作り直し、最大2回)
  let draft: CaptionDraft | null = null;
  let valueScore = 0;
  let feedback: string[] | undefined;
  for (let i = 0; i < 3; i++) {
    const d = await generateCaption(cfg, { plan, season, recent: recentForAi, feedback, previous: draft ?? undefined });
    const v = await reviewValue(cfg, plan, d);
    logger.info(`文章生成 (${i + 1}回目): 「${d.title}」 ${[...d.caption].length}字 VALUE_SCORE=${v.valueScore}`);
    if (!draft || v.valueScore > valueScore) {
      draft = d;
      valueScore = v.valueScore;
    }
    if (v.valueScore >= cfg.MIN_VALUE_SCORE) break;
    feedback = [`読み手にとっての有益性が不足 (VALUE_SCORE ${v.valueScore})。${v.usefulInfo}`, ...v.issues];
  }
  if (!draft) throw new Error("キャプションを生成できませんでした");
  if (valueScore < cfg.MIN_VALUE_SCORE) {
    return { rejected: true, reason: `VALUE_SCORE ${valueScore} < ${cfg.MIN_VALUE_SCORE} (作り直し後も基準未満)`, partial: { plan, draft, valueScore } };
  }

  // STEP 9a: 本文 validation → 85未満なら一度だけ自動修正
  const validateText = (d: CaptionDraft, vs: number) =>
    validatePost({ draft: d, plan, recent: recentForAi, valueScore: vs, minScore: cfg.MIN_VALIDATION_SCORE, minValueScore: cfg.MIN_VALUE_SCORE });
  let validation = validateText(draft, valueScore);
  logger.info(`validation (本文): ${validation.score}点 ${validation.passed ? "合格" : "不合格"}`, validation.feedback.length ? validation.feedback : undefined);
  if (!validation.passed) {
    logger.info("validation 不合格のため自動修正を1回実行します");
    const fixed = await generateCaption(cfg, { plan, season, recent: recentForAi, feedback: validation.feedback, previous: draft });
    const v2 = await reviewValue(cfg, plan, fixed);
    const val2 = validateText(fixed, v2.valueScore);
    logger.info(`validation (修正後): ${val2.score}点 ${val2.passed ? "合格" : "不合格"}`, val2.feedback.length ? val2.feedback : undefined);
    draft = fixed;
    valueScore = v2.valueScore;
    validation = val2;
    if (!validation.passed) {
      return { rejected: true, reason: `validation ${validation.score}点 (修正後も基準未満)`, partial: { plan, draft, valueScore, validation } };
    }
  }

  // STEP 6: 画像プロンプト
  const { prompt: imagePrompt } = await buildImagePrompt(cfg, plan, season, draft);

  // STEP 7: 画像生成 (+ 破綻チェック。NGなら1回だけ作り直し = 生成は最大2回)
  let gen = await generateImage(cfg, imagePrompt, date, plan.scene.label);
  let imageReview: ImageReview | null = null;
  if (cfg.IMAGE_VISION_CHECK) {
    const checkJpeg = await finalizeImage(gen.raw, { size: 1024, fontFamily: cfg.OVERLAY_FONT_FAMILY });
    imageReview = await reviewImage(cfg, plan, checkJpeg);
    logger.info(`画像チェック: ${imageReview.score}点 ${imageReviewPassed(imageReview) ? "OK" : "NG"}`, imageReview.issues.length ? imageReview.issues : undefined);
    if (!imageReviewPassed(imageReview)) {
      logger.info("画像に問題があるため1回だけ再生成します");
      const fixPrompt = `${imagePrompt}\nAvoid these problems found in a previous attempt: ${imageReview.issues.join("; ")}`;
      gen = await generateImage(cfg, fixPrompt, `${date}-retry`, plan.scene.label);
      imageReview = await reviewImage(cfg, plan, await finalizeImage(gen.raw, { size: 1024, fontFamily: cfg.OVERLAY_FONT_FAMILY }));
      logger.info(`画像チェック (再生成): ${imageReview.score}点 ${imageReviewPassed(imageReview) ? "OK" : "NG"}`);
    }
  }
  logger.info(`画像生成: model=${gen.model} mode=${gen.mode}${gen.referenceFile ? ` ref=${gen.referenceFile}` : ""}`);

  const image = await finalizeImage(gen.raw, {
    size: Number(cfg.OPENAI_IMAGE_SIZE.split("x")[0]) || 1024,
    overlayText: cfg.IMAGE_OVERLAY_TEXT ? draft.overlayText || undefined : undefined,
    disclaimer: cfg.IMAGE_DISCLAIMER_LABEL ? "※画像はイメージです" : undefined,
    fontFamily: cfg.OVERLAY_FONT_FAMILY,
  });

  // STEP 9b: 最終 validation (本文 + 画像)
  validation = validatePost({ draft, plan, recent: recentForAi, imagePrompt, imageReview, valueScore, minScore: cfg.MIN_VALIDATION_SCORE, minValueScore: cfg.MIN_VALUE_SCORE });
  logger.info(`validation (最終): ${validation.score}点 ${validation.passed ? "合格" : "不合格"}`);
  const result: Generated = { plan, draft, valueScore, validation, imagePrompt, imageReview, image, imageMeta: { model: gen.model, mode: gen.mode, referenceFile: gen.referenceFile } };
  if (!validation.passed) return { rejected: true, reason: `validation ${validation.score}点 (画像を含む最終チェックで基準未満)`, partial: result };
  return result;
}

function recordFromGenerated(g: Partial<Generated>): Partial<PostRecord> {
  return {
    theme: g.plan?.theme.code,
    themeName: g.plan?.theme.name,
    category: g.plan?.category,
    angle: g.plan?.angle,
    targetAudience: g.plan?.theme.targetAudience,
    primaryKeyword: g.plan?.primaryKeyword,
    secondaryKeywords: g.plan ? JSON.stringify(g.plan.secondaryKeywords) : undefined,
    title: g.draft?.title,
    hook: g.draft?.hook,
    structure: g.draft?.structure,
    caption: g.draft?.caption,
    overlayText: g.draft?.overlayText || undefined,
    ctaType: g.plan ? (g.plan.useCta ? "LEARN_MORE" : "NONE") : undefined,
    imagePrompt: g.imagePrompt,
    imageScene: g.plan?.scene.id,
    imageComposition: g.plan?.composition.id,
    imagePerson: g.plan?.person?.id,
    validationScore: g.validation?.score,
    valueScore: g.valueScore,
    validationJson: g.validation ? JSON.stringify(g.validation) : undefined,
  };
}

/** 投稿前プレビューを generated/YYYY-MM-DD/ に保存 */
function savePreview(dir: string, g: Generated, extra: Record<string, unknown>) {
  writeFile(dir, "post.jpg", g.image);
  writeFile(dir, "caption.txt", g.draft.caption + "\n");
  writeFile(dir, "image-prompt.txt", g.imagePrompt + "\n");
  writeFile(
    dir,
    "validation.json",
    JSON.stringify({ validation: g.validation, valueScore: g.valueScore, imageReview: g.imageReview }, null, 2),
  );
  writePostJson(dir, {
    plan: {
      theme: `${g.plan.theme.code} ${g.plan.theme.name}`,
      category: CATEGORY_LABELS[g.plan.category],
      angle: g.plan.angle,
      targetAudience: g.plan.theme.targetAudience,
      primaryKeyword: g.plan.primaryKeyword,
      secondaryKeywords: g.plan.secondaryKeywords,
      useCta: g.plan.useCta,
      image: { scene: g.plan.scene.id, composition: g.plan.composition.id, person: g.plan.person?.id ?? null, ...g.imageMeta },
    },
    title: g.draft.title,
    structure: g.draft.structure,
    overlayText: g.draft.overlayText,
    ...extra,
  });
}

function writePostJson(dir: string, data: Record<string, unknown>) {
  const file = path.join(dir, "post.json");
  let current: Record<string, unknown> = {};
  try {
    current = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    /* new */
  }
  writeFile(dir, "post.json", JSON.stringify({ ...current, ...data }, null, 2));
}

async function uploadImage(storage: StorageProvider, date: string, image: Buffer): Promise<{ key: string; url: string }> {
  // キャッシュ汚染を避けるため内容ハッシュ付きのキーにする
  const key = `generated/${date}/post-${shortHash(image.toString("base64"))}.jpg`;
  const url = await storage.upload(key, image, "image/jpeg");
  if (storage.publicHttps) await verifyPublicUrl(url);
  return { key, url };
}

/** STEP 10-11: GBP へ投稿して結果を保存 */
async function publish(cfg: Config, repo: PostRepository, rec: PostRecord, dir: string): Promise<RunOutcome> {
  if (!rec.caption || !rec.imagePublicUrl) throw new FatalError("投稿データ (本文/画像URL) が不完全です");
  const payload: LocalPostPayload = buildPayload(cfg, rec.caption, rec.imagePublicUrl, rec.ctaType === "LEARN_MORE");
  writePostJson(dir, { payload });

  const target = await verifyTargetLocation(cfg);
  logger.info(`投稿先確認OK: ${target.title} / ${target.address}`);

  repo.update(rec.id, { attempts: rec.attempts + 1 });
  logger.info("GBP投稿: 送信します");
  const { post, recovered } = await createLocalPost(cfg, rec.date, payload);
  logger.info(`GBP投稿レスポンス: name=${post.name} state=${post.state ?? "?"}${recovered ? " (既存投稿を検出)" : ""}`);

  const ok = repo.transition(rec.id, ["publishing"], "success", {
    googlePostId: post.name,
    googlePostState: post.state ?? null,
    googleSearchUrl: post.searchUrl ?? null,
    publishedAt: post.createTime ?? new Date().toISOString(),
    error: post.state === "REJECTED" ? "Google により投稿が却下されました (REJECTED)" : null,
  });
  if (!ok) logger.warn("DB の状態遷移に失敗しました (別プロセスが更新した可能性)");
  writePostJson(dir, { response: post, recovered, publishedAt: new Date().toISOString() });
  if (post.state === "REJECTED") {
    return { result: "failed", message: `投稿は作成されましたが Google に却下されました: ${post.name}`, postId: rec.id, outputDir: dir };
  }
  return { result: "success", message: `投稿しました: ${post.searchUrl ?? post.name}`, postId: rec.id, outputDir: dir };
}

/** メインのパイプライン */
export async function runPipeline(opts: RunOptions): Promise<RunOutcome> {
  const cfg = opts.config ?? loadConfig();
  const now = opts.now ?? new Date();
  const action = decideAction(cfg, opts.mode);
  if (opts.dateOverride && (action === "publish" || action === "pending")) {
    throw new FatalError("--date は generate / dry-run でのみ使用できます");
  }
  const date = opts.dateOverride ?? localDateString(now, cfg.TIMEZONE);
  const runId = `${date}-${opts.mode}-${crypto.randomBytes(3).toString("hex")}`;

  if (action === "publish" && cfg.AI_MOCK) throw new FatalError("AI_MOCK=true では本番投稿できません。");
  if (cfg.AI_MOCK) logger.warn("AI_MOCK=true: OpenAI を呼ばずにモックの文章・画像で実行します (動作確認用)");

  logger.info(`===== 開始 run=${runId} mode=${opts.mode} action=${action} date=${date} DRY_RUN=${cfg.DRY_RUN} AUTO_PUBLISH=${cfg.AUTO_PUBLISH} text=${cfg.OPENAI_TEXT_MODEL} image=${imageModel(cfg)} storage=${cfg.STORAGE_PROVIDER} =====`);

  if (!opts.repo) await pullState(cfg);
  const repo = opts.repo ?? new PostRepository();
  repo.startRun(runId, date, opts.mode);

  let outcome: RunOutcome;
  let currentId: number | undefined;
  try {
    outcome = await (async (): Promise<RunOutcome> => {
      const storage = action === "draft" ? null : createStorage(cfg);
      if (action === "publish" && storage && !storage.publicHttps) {
        throw new FatalError(`STORAGE_PROVIDER=${storage.name} は Google から取得できる公開URLを発行できません。r2 または gcs を設定してください。`);
      }

      // ---- 二重投稿防止 (STEP 2) ----
      let reuse: PostRecord | null = null;
      if (opts.mode === "daily" && action === "dry_run" && repo.findByDate(date, ["dry_run"]).some((r) => r.mode === "daily")) {
        // DRY_RUN 運用中のバックアップ cron で画像を二重生成しない (手動の npm run dry-run は毎回実行)
        return { result: "skipped", message: `${date} は毎日実行の DRY RUN 済みのため SKIP` };
      }
      if (action === "publish" || action === "pending") {
        if (repo.findByDate(date, ["success"]).length > 0) {
          return { result: "skipped", message: `${date} は投稿済み (status=success) のため SKIP` };
        }
        const inflight = repo.findByDate(date, ["publishing"])[0];
        if (inflight) {
          const age = Date.now() - Date.parse(inflight.updatedAt);
          if (age < STALE_PUBLISHING_MS) return { result: "skipped", message: `${date} の投稿処理が実行中 (id=${inflight.id}) のため SKIP` };
          // クラッシュした前回実行: Google 側を確認してから判断
          if (action === "publish" && inflight.caption) {
            const remote = await findExistingPost(cfg, date, inflight.caption);
            if (remote) {
              repo.transition(inflight.id, ["publishing"], "success", { googlePostId: remote.name, googlePostState: remote.state ?? null, googleSearchUrl: remote.searchUrl ?? null, publishedAt: remote.createTime ?? null });
              return { result: "skipped", message: `前回の投稿が Google 上に存在したため success に復旧しました (${remote.name})`, postId: inflight.id };
            }
          }
          repo.transition(inflight.id, ["publishing"], "failed", { error: "前回実行が publishing のまま中断 (Google 上に投稿なし)" });
          reuse = repo.get(inflight.id) ?? null;
        }
        const pending = repo.findByDate(date, ["pending"])[0];
        if (pending) {
          if (action === "pending") return { result: "skipped", message: `${date} は承認待ち (pending, id=${pending.id}) の投稿があるため SKIP。\`npm run approve\` で投稿できます` };
          reuse = pending;
        }
        const failed = repo.findByDate(date, ["failed"]);
        const attempts = failed.reduce((s, r) => s + r.attempts, 0) + (reuse?.attempts ?? 0);
        if (action === "publish" && attempts >= MAX_PUBLISH_ATTEMPTS_PER_DAY) {
          return { result: "skipped", message: `${date} は投稿試行が上限 (${MAX_PUBLISH_ATTEMPTS_PER_DAY}回) に達したため SKIP。logs/ と npm run history を確認してください` };
        }
        // 前回失敗した投稿内容が残っていれば再利用 (同一本文なら Google 側の重複検出が効く)
        if (!reuse && failed[0]?.caption && failed[0].imagePublicUrl) reuse = failed[0];
      }

      const isLiveDate = repo.findByDate(date, ["success", "pending", "publishing"]).length > 0;
      const dir =
        (action === "dry_run" || action === "draft") && isLiveDate
          ? path.join(paths.generated, date, "runs", runId)
          : path.join(paths.generated, date);

      // ---- 既存の下書きを投稿 (承認 / 再試行) ----
      if (reuse && action === "publish") {
        logger.info(`既存の投稿データを使用します (id=${reuse.id}, status=${reuse.status})`);
        if (reuse.status === "failed") {
          // failed → 新しい publishing 記録として扱う (UNIQUE 制約で同時実行を排除)
          const ok = repo.transition(reuse.id, ["failed"], "publishing", { runId, error: null });
          if (!ok) return { result: "skipped", message: "別の実行が先に投稿処理を開始したため SKIP" };
        } else if (!repo.transition(reuse.id, ["pending"], "publishing", { runId })) {
          return { result: "skipped", message: "別の実行が先に投稿処理を開始したため SKIP" };
        }
        currentId = reuse.id;
        return await publish(cfg, repo, repo.get(reuse.id)!, dir);
      }

      // ---- 新規生成 (STEP 3〜9) ----
      const gen = await generateContent(cfg, repo, date, now, action, opts.forceTheme);
      if ("rejected" in gen) {
        const id = repo.insert({ date, mode: opts.mode, status: "rejected", runId, error: gen.reason, ...recordFromGenerated(gen.partial) });
        if (gen.partial.draft) writeFile(dir, "caption.rejected.txt", gen.partial.draft.caption + "\n");
        if (gen.partial.validation) writeFile(dir, "validation.json", JSON.stringify({ validation: gen.partial.validation, valueScore: gen.partial.valueScore }, null, 2));
        return { result: "rejected", message: `品質基準を満たさないため投稿しません: ${gen.reason}`, postId: id, outputDir: dir };
      }
      savePreview(dir, gen, { runId, mode: opts.mode, action, date });
      const base = { date, mode: opts.mode, runId, imagePath: path.relative(paths.generated, path.join(dir, "post.jpg")), ...recordFromGenerated(gen) };

      if (action === "draft") {
        const id = repo.insert({ ...base, status: "draft" });
        writePostJson(dir, { payloadPreview: buildPayload(cfg, gen.draft.caption, "(未アップロード)", gen.plan.useCta) });
        return { result: "draft", message: `生成のみ完了 (アップロード・投稿なし)`, postId: id, outputDir: dir };
      }

      // STEP 8: 画像アップロード
      const { key, url } = await uploadImage(storage!, date, gen.image);
      logger.info(`画像アップロード: ${url}`);
      const payload = buildPayload(cfg, gen.draft.caption, url, gen.plan.useCta);
      writePostJson(dir, { imagePublicUrl: url, payload });

      if (action === "dry_run") {
        const id = repo.insert({ ...base, status: "dry_run", imageObjectKey: key, imagePublicUrl: url, ctaUrl: gen.plan.useCta ? cfg.WEBSITE_URL : null });
        return { result: "dry_run", message: `DRY RUN 完了 (Google へは投稿していません)。プレビュー: ${dir}`, postId: id, outputDir: dir };
      }

      // pending として確保 (UNIQUE 制約により同日に2件目は作れない)
      let id: number;
      try {
        id = repo.insert({ ...base, status: "pending", imageObjectKey: key, imagePublicUrl: url, ctaUrl: gen.plan.useCta ? cfg.WEBSITE_URL : null });
      } catch (err) {
        if (String(err).includes("UNIQUE")) return { result: "skipped", message: `${date} は別の実行が既に投稿データを作成済みのため SKIP` };
        throw err;
      }
      currentId = id;
      if (action === "pending") {
        return { result: "pending", message: `AUTO_PUBLISH=false: 承認待ち (pending) として保存しました。確認後 \`npm run approve\` で投稿します`, postId: id, outputDir: dir };
      }
      if (!repo.transition(id, ["pending"], "publishing")) return { result: "skipped", message: "別の実行が先に投稿処理を開始したため SKIP" };
      return await publish(cfg, repo, repo.get(id)!, dir);
    })();
  } catch (err) {
    const msg = redact(errorMessage(err));
    logger.error(`エラー: ${msg}`);
    if (currentId !== undefined) {
      const rec = repo.get(currentId);
      if (rec && (rec.status === "publishing" || rec.status === "pending")) {
        repo.update(currentId, { status: "failed", error: msg });
      }
    } else {
      repo.insert({ date, mode: opts.mode, status: "failed", runId, error: msg });
    }
    outcome = { result: "failed", message: msg, postId: currentId };
  }

  repo.finishRun(runId, outcome.result, outcome.message, outcome.postId);
  if (!opts.repo) {
    repo.close();
    if (opts.mode !== "generate") {
      try {
        await pushState(cfg);
      } catch (err) {
        logger.error(`状態同期の保存に失敗: ${redact(errorMessage(err))}`);
      }
    }
  }
  const log = outcome.result === "failed" || outcome.result === "rejected" ? logger.error.bind(logger) : logger.info.bind(logger);
  log(`===== 終了 run=${runId} result=${outcome.result}: ${outcome.message} =====`);
  return outcome;
}

/** 承認待ち (pending) の投稿を公開する */
export async function approvePending(date?: string): Promise<RunOutcome> {
  const cfg = loadConfig();
  const target = date ?? localDateString(new Date(), cfg.TIMEZONE);
  return runPipeline({ mode: "post", now: new Date(`${target}T03:00:00Z`), config: cfg });
}
