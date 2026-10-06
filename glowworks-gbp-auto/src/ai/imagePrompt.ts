import type { Config } from "../config.js";
import { NEGATIVE_CONSTRAINTS } from "../content/imageScenes.js";
import type { PostPlan } from "../content/planner.js";
import type { SeasonContext } from "../content/season.js";
import type { CaptionDraft } from "./caption.js";
import { generateJson } from "./openaiClient.js";

export interface ImagePromptSpec {
  subject: string;
  locationContext: string;
  action: string;
  cameraAngle: string;
  lighting: string;
  composition: string;
  clothing: string;
  facialExpression: string;
  background: string;
  brandMood: string;
  negativeConstraints: string[];
}

export const BRAND_MOOD =
  "bright, warm, clean, contemporary and approachable; natural light; plants; white, beige and soft green palette; slightly stylish but modest; a realistic small Japanese work-support office (not a hospital, not a corporate office); feels welcoming to young adults";

const SPEC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "locationContext", "action", "cameraAngle", "lighting", "composition", "clothing", "facialExpression", "background", "brandMood", "negativeConstraints"],
  properties: {
    subject: { type: "string" },
    locationContext: { type: "string" },
    action: { type: "string" },
    cameraAngle: { type: "string" },
    lighting: { type: "string" },
    composition: { type: "string" },
    clothing: { type: "string" },
    facialExpression: { type: "string" },
    background: { type: "string" },
    brandMood: { type: "string" },
    negativeConstraints: { type: "array", items: { type: "string" } },
  },
} as const;

/** 計画から決定的に作るベース仕様 (モック時・AI失敗時もこれで画像生成できる) */
export function baseSpec(plan: PostPlan, season: SeasonContext): ImagePromptSpec {
  const p = plan.person;
  return {
    subject: p ? `${plan.scene.subject}; the person is ${p.text}` : plan.scene.subject,
    locationContext: plan.scene.context,
    action: plan.scene.action,
    cameraAngle: plan.composition.text,
    lighting: plan.lighting,
    composition: `${plan.composition.text}; square 1:1 frame; leave natural breathing room near the bottom edge`,
    clothing: p ? `${p.clothing}, everyday casual clothes appropriate for ${season.season} in Japan (${season.imageHint})` : `seasonal details: ${season.imageHint}`,
    facialExpression: p ? plan.expression : "no people in frame",
    background: "modest Japanese interior: light wood, beige walls, a few green plants, tidy shelves, no readable signs",
    brandMood: BRAND_MOOD,
    negativeConstraints: [...NEGATIVE_CONSTRAINTS],
  };
}

export function specToPrompt(spec: ImagePromptSpec): string {
  const neg = Array.from(new Set([...NEGATIVE_CONSTRAINTS, ...spec.negativeConstraints]));
  return [
    "Photorealistic documentary-style photograph, shot on a full-frame camera, natural color grading. This is an illustrative image visual, not a photo of a specific real facility.",
    `Subject: ${spec.subject}.`,
    `Location/context: ${spec.locationContext}.`,
    `Action: ${spec.action}.`,
    `Camera angle: ${spec.cameraAngle}.`,
    `Lighting: ${spec.lighting}.`,
    `Composition: ${spec.composition}.`,
    `Clothing: ${spec.clothing}.`,
    `Facial expression: ${spec.facialExpression}.`,
    `Background: ${spec.background}.`,
    `Brand mood: ${spec.brandMood}.`,
    `Do NOT render any text, letters, numbers or logos anywhere in the image.`,
    `Negative constraints: ${neg.join("; ")}.`,
  ].join("\n");
}

/**
 * キャプション全文ではなく、計画 + キャプションの要点から専用の IMAGE PROMPT を作る。
 * AI はベース仕様を「今回の本文に合わせて具体化」するだけで、構図・人物・シーンの割当は変えない。
 */
export async function buildImagePrompt(
  cfg: Config,
  plan: PostPlan,
  season: SeasonContext,
  draft: CaptionDraft,
): Promise<{ spec: ImagePromptSpec; prompt: string }> {
  const base = baseSpec(plan, season);
  if (cfg.AI_MOCK) return { spec: base, prompt: specToPrompt(base) };

  const refined = await generateJson<ImagePromptSpec>(cfg, {
    label: "画像プロンプト生成",
    schemaName: "image_prompt_spec",
    schema: SPEC_SCHEMA,
    system: `You are an art director for a Japanese welfare work-support office (就労継続支援B型). You write precise English prompts for a photorealistic image model.
Rules:
- Keep the assigned scene, camera angle, composition and person exactly; only make details concrete so the image matches today's post.
- Japanese people in their 20s-50s, natural expressions, no exaggerated smiles, no stereotypical depiction of disability.
- A realistic, modest Japanese work-support office or home. Not a hospital, not a western or luxury office.
- The image is an illustrative visual of work/usage scenes, not a depiction of the actual facility's interior.
- Never ask for text, signs, logos or readable screens.`,
    user: `Today's post (Japanese) title: ${draft.title}\nKey point: ${draft.hook}\nTheme: ${plan.theme.name} / ${plan.angle}\n\nBase spec (JSON):\n${JSON.stringify(base, null, 2)}`,
  });
  // 割当は厳守させる (AI が構図を変えても上書き)
  const spec: ImagePromptSpec = {
    ...refined,
    cameraAngle: base.cameraAngle,
    composition: base.composition,
    brandMood: BRAND_MOOD,
    negativeConstraints: Array.from(new Set([...base.negativeConstraints, ...refined.negativeConstraints])),
  };
  return { spec, prompt: specToPrompt(spec) };
}
