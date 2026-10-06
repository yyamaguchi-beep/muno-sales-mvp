import { execFileSync } from "node:child_process";
import sharp, { type OverlayOptions } from "sharp";
import { logger } from "../utils/logger.js";

let jpFontAvailable: boolean | null = null;

/** fontconfig に日本語フォントがあるか (なければ文字合成をスキップして豆腐化を防ぐ) */
export function hasJapaneseFont(): boolean {
  if (jpFontAvailable !== null) return jpFontAvailable;
  try {
    const out = execFileSync("fc-list", [":lang=ja", "family"], { encoding: "utf8", timeout: 5000 });
    jpFontAvailable = out.trim().length > 0;
  } catch {
    jpFontAvailable = false;
  }
  return jpFontAvailable;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

export interface FinalizeOptions {
  size: number;
  overlayText?: string;
  disclaimer?: string;
  fontFamily: string;
}

/**
 * 生成画像を Google 投稿用に仕上げる:
 *  - 正方形にクロップ & リサイズ
 *  - (任意) 短い日本語フレーズを正確なフォントで合成 (画像AIに文字を描かせない)
 *  - (任意) 「画像はイメージです」の小さな注記 (実在施設写真との誤認防止)
 *  - JPEG 化・メタデータ除去・5MB 未満
 */
export async function finalizeImage(raw: Buffer, opts: FinalizeOptions): Promise<Buffer> {
  const size = opts.size;
  const base = sharp(raw).rotate().resize(size, size, { fit: "cover", position: "attention" });
  const layers: OverlayOptions[] = [];
  const canText = hasJapaneseFont();
  if ((opts.overlayText || opts.disclaimer) && !canText) {
    logger.warn("日本語フォントが見つからないため、画像への文字合成をスキップします (apt install fonts-noto-cjk で解決)");
  }

  if (canText && opts.overlayText) {
    const text = escapeXml(opts.overlayText);
    const fontSize = Math.round(size * 0.042);
    const padX = Math.round(fontSize * 0.9);
    const approxWidth = Math.round([...opts.overlayText].length * fontSize * 1.02 + padX * 2);
    const h = Math.round(fontSize * 2.1);
    const x = Math.round(size * 0.05);
    const y = Math.round(size - h - size * 0.07);
    layers.push({
      input: Buffer.from(
        `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <rect x="${x}" y="${y}" width="${approxWidth}" height="${h}" rx="${h / 2}" fill="#FFFFFF" fill-opacity="0.9"/>
          <text x="${x + padX}" y="${y + h / 2}" dominant-baseline="central" font-family="${escapeXml(opts.fontFamily)}"
                font-size="${fontSize}" font-weight="700" fill="#2F4A3A">${text}</text>
        </svg>`,
      ),
      top: 0,
      left: 0,
    });
  }

  if (canText && opts.disclaimer) {
    const fs = Math.max(14, Math.round(size * 0.017));
    layers.push({
      input: Buffer.from(
        `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <text x="${size - Math.round(size * 0.025)}" y="${size - Math.round(size * 0.022)}" text-anchor="end"
                font-family="${escapeXml(opts.fontFamily)}" font-size="${fs}" fill="#FFFFFF" fill-opacity="0.92"
                stroke="#000000" stroke-opacity="0.35" stroke-width="2" paint-order="stroke">${escapeXml(opts.disclaimer)}</text>
        </svg>`,
      ),
      top: 0,
      left: 0,
    });
  }

  let quality = 88;
  for (;;) {
    const out = await base
      .clone()
      .composite(layers)
      .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer(); // メタデータは付与しない (sharp の既定)
    if (out.length < 4.8 * 1024 * 1024 || quality <= 60) return out;
    quality -= 8;
  }
}
