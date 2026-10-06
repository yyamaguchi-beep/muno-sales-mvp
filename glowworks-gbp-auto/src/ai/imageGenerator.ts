import fs from "node:fs";
import path from "node:path";
import { toFile } from "openai";
import { imageModel, paths, type Config } from "../config.js";
import { hash32 } from "../utils/text.js";
import { mockImage } from "./mock.js";
import { OPENAI_HINTS, openai, toHttpError } from "./openaiClient.js";
import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";

const REF_EXT = /\.(jpe?g|png|webp)$/i;

export function listReferenceImages(): string[] {
  try {
    return fs
      .readdirSync(paths.reference)
      .filter((f) => REF_EXT.test(f))
      .map((f) => path.join(paths.reference, f))
      .sort();
  } catch {
    return [];
  }
}

export interface GeneratedImage {
  raw: Buffer;
  model: string;
  mode: "generate" | "edit" | "mock";
  referenceFile?: string;
}

/**
 * 画像を1枚生成する (失敗時は最大2回まで)。
 * assets/reference/ に実際の店舗写真があり IMAGE_MODE が edit/auto の場合は編集モードで、
 * 実際の空間をベースにした利用シーンを作る。
 */
export async function generateImage(cfg: Config, prompt: string, date: string, label: string): Promise<GeneratedImage> {
  if (cfg.AI_MOCK) return { raw: await mockImage(label, date), model: "mock", mode: "mock" };

  const model = imageModel(cfg);
  const refs = listReferenceImages();
  const useEdit = cfg.IMAGE_MODE === "edit" || (cfg.IMAGE_MODE === "auto" && refs.length > 0);
  if (cfg.IMAGE_MODE === "edit" && refs.length === 0) {
    logger.warn("IMAGE_MODE=edit ですが assets/reference/ に画像がないため、通常生成で作成します。");
  }

  return withRetry(
    async () => {
      try {
        if (useEdit && refs.length > 0) {
          const ref = refs[hash32(date) % refs.length]!;
          const editPrompt = `Use the reference photo only as the base environment (room layout, furniture, colors). Keep the space recognizable and realistic; do not add fake signage or text. Stage the following scene in it:\n${prompt}`;
          const res = await openai(cfg).images.edit({
            model,
            image: await toFile(fs.createReadStream(ref), path.basename(ref)),
            prompt: editPrompt,
            size: cfg.OPENAI_IMAGE_SIZE as "1024x1024",
            quality: cfg.OPENAI_IMAGE_QUALITY,
            n: 1,
          });
          const b64 = res.data?.[0]?.b64_json;
          if (!b64) throw new Error("画像編集APIのレスポンスに画像がありません");
          return { raw: Buffer.from(b64, "base64"), model, mode: "edit" as const, referenceFile: path.basename(ref) };
        }
        const res = await openai(cfg).images.generate({
          model,
          prompt,
          size: cfg.OPENAI_IMAGE_SIZE as "1024x1024",
          quality: cfg.OPENAI_IMAGE_QUALITY,
          output_format: "jpeg",
          output_compression: 92,
          moderation: "auto",
          n: 1,
        });
        const b64 = res.data?.[0]?.b64_json;
        if (!b64) throw new Error("画像生成APIのレスポンスに画像がありません");
        return { raw: Buffer.from(b64, "base64"), model, mode: "generate" as const };
      } catch (err) {
        throw toHttpError(err);
      }
    },
    { label: `画像生成 (${model})`, maxAttempts: 2, baseDelayMs: 5000, hints: OPENAI_HINTS },
  );
}
