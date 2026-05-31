import { translateTextGoogle } from './translation';

export type ProgressCallback = (msg: string, pct: number) => void;

interface BBox { x0: number; y0: number; x1: number; y1: number }

interface LineData {
  text: string;
  bbox: BBox;
  height: number;
  isBold: boolean;
  confidence: number;
}

interface TextBlock {
  combinedText: string;
  bbox: BBox;
  estFontSize: number;
  isBold: boolean;
}

// ─────────────────────────────────────────────
// OCR 前処理：グレースケール＋コントラスト強調
// invert=true で「明るい背景に暗いテキスト」に変換
// （黒背景のカラーテキストに有効）
// ─────────────────────────────────────────────
function preprocessForOcr(srcCanvas: HTMLCanvasElement, invert: boolean): string {
  const { width: w, height: h } = srcCanvas;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const ctx = off.getContext('2d')!;
  ctx.drawImage(srcCanvas, 0, 0);

  const id = ctx.getImageData(0, 0, w, h);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    // グレースケール変換
    let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // コントラスト強調（暗部を下げ、明部を引き上げる）
    gray = Math.min(255, Math.max(0, (gray - 55) * 1.7));
    if (invert) gray = 255 - gray;
    d[i] = d[i + 1] = d[i + 2] = Math.round(gray);
  }
  ctx.putImageData(id, 0, 0);
  return off.toDataURL('image/png');
}

// ─────────────────────────────────────────────
// BBox ユーティリティ
// ─────────────────────────────────────────────
function bboxIou(a: BBox, b: BBox): number {
  const ix0 = Math.max(a.x0, b.x0);
  const iy0 = Math.max(a.y0, b.y0);
  const ix1 = Math.min(a.x1, b.x1);
  const iy1 = Math.min(a.y1, b.y1);
  if (ix0 >= ix1 || iy0 >= iy1) return 0;
  const inter = (ix1 - ix0) * (iy1 - iy0);
  const union = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - inter;
  return union > 0 ? inter / union : 0;
}

/** X軸方向の重なり率（0〜1）*/
function xOverlapRatio(a: BBox, b: BBox): number {
  const overlap = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const minW = Math.min(a.x1 - a.x0, b.x1 - b.x0);
  return minW > 0 ? overlap / minW : 0;
}

// ─────────────────────────────────────────────
// OCR結果から行データを抽出
// ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractLines(data: any): LineData[] {
  const MIN_CONF = 15;
  const MIN_H = 6;
  const MIN_W = 10;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawLines: any[] = data.lines || [];

  return rawLines
    .map((line) => {
      const text = (line.text || '').trim().replace(/\n/g, ' ');
      if (!text) return null;
      const conf: number = line.confidence ?? 0;
      if (conf < MIN_CONF) return null;
      const bbox = line.bbox as BBox;
      if (!bbox) return null;
      const h = bbox.y1 - bbox.y0;
      if (h < MIN_H || (bbox.x1 - bbox.x0) < MIN_W) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const words: any[] = line.words || [];
      const boldCount = words.filter((w) => w.is_bold).length;
      const isBold = words.length > 0 && boldCount / words.length > 0.4;
      return { text, bbox, height: h, isBold, confidence: conf };
    })
    .filter(Boolean) as LineData[];
}

// ─────────────────────────────────────────────
// 2スキャン結果のマージ
// 同じ位置のブロックは信頼度の高い方を採用
// ─────────────────────────────────────────────
function mergeLines(primary: LineData[], secondary: LineData[]): LineData[] {
  const merged: LineData[] = [...primary];

  for (const line of secondary) {
    const existing = merged.find((m) => bboxIou(m.bbox, line.bbox) > 0.25);
    if (!existing) {
      merged.push(line);
    } else if (line.confidence > existing.confidence) {
      // より信頼度が高い方で上書き
      existing.text = line.text;
      existing.confidence = line.confidence;
      existing.isBold = line.isBold;
    }
  }

  return merged.sort((a, b) => a.bbox.y0 - b.bbox.y0);
}

// ─────────────────────────────────────────────
// 行を視覚的ブロックにグループ化
// 縦間隔・フォントサイズ差・X重なりなしで新ブロック判定
// ─────────────────────────────────────────────
function groupIntoBlocks(lines: LineData[]): TextBlock[] {
  if (lines.length === 0) return [];

  const sortedH = [...lines.map((l) => l.height)].sort((a, b) => a - b);
  const medianH = sortedH[Math.floor(sortedH.length / 2)];

  // 高さが中央値の 1.4 倍超 → 見出し/大文字として太字扱い
  lines.forEach((line) => {
    if (line.height > medianH * 1.4) line.isBold = true;
  });

  const blocks: TextBlock[] = [];
  let group: LineData[] = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const curr = lines[i];
    const gap = curr.bbox.y0 - prev.bbox.y1;
    const heightDiff = Math.abs(curr.height - prev.height);

    // ── 新ブロック条件 ──
    // ① 縦の間隔が行高さの 0.9 倍超（段落間の空白）
    // ② フォントサイズが大きく変化（タイトル⇔本文）
    // ③ X軸で重なりがない（横並び列：左右ボックスなど）
    const isNewBlock =
      gap > prev.height * 0.9 ||
      heightDiff > medianH * 0.45 ||
      xOverlapRatio(prev.bbox, curr.bbox) < 0.2;

    if (isNewBlock) {
      blocks.push(buildBlock(group));
      group = [curr];
    } else {
      group.push(curr);
    }
  }
  blocks.push(buildBlock(group));
  return blocks;
}

function buildBlock(lines: LineData[]): TextBlock {
  return {
    combinedText: lines.map((l) => l.text).join(' '),
    bbox: {
      x0: Math.min(...lines.map((l) => l.bbox.x0)),
      y0: lines[0].bbox.y0,
      x1: Math.max(...lines.map((l) => l.bbox.x1)),
      y1: lines[lines.length - 1].bbox.y1,
    },
    isBold: lines.some((l) => l.isBold),
    estFontSize: Math.round(Math.max(...lines.map((l) => l.height)) * 0.82),
  };
}

// ─────────────────────────────────────────────
// 背景色サンプリング
// ─────────────────────────────────────────────
function sampleBgColor(ctx: CanvasRenderingContext2D, bbox: BBox, pad = 10) {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const px = Math.max(0, bbox.x0 - pad);
  const py = Math.max(0, bbox.y0 - pad);
  const pw = Math.min(cw - px, bbox.x1 - bbox.x0 + pad * 2);
  const ph = Math.min(ch - py, bbox.y1 - bbox.y0 + pad * 2);
  if (pw <= 0 || ph <= 0) return { r: 255, g: 255, b: 255 };

  const d = ctx.getImageData(px, py, pw, ph).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let row = 0; row < ph; row++) {
    for (let col = 0; col < pw; col++) {
      if (row < pad || row >= ph - pad || col < pad || col >= pw - pad) {
        const i = (row * pw + col) * 4;
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
      }
    }
  }
  if (n === 0) return { r: 255, g: 255, b: 255 };
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

function contrastColor(bg: { r: number; g: number; b: number }): string {
  return (0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b) / 255 > 0.5 ? '#111111' : '#ffffff';
}

// ─────────────────────────────────────────────
// テキスト描画（推定フォントサイズ・太字対応）
// ─────────────────────────────────────────────
function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  bbox: BBox,
  color: string,
  isBold: boolean,
  estFontSize: number
) {
  const w = bbox.x1 - bbox.x0;
  const h = bbox.y1 - bbox.y0;
  if (w < 5 || h < 5) return;

  const fontWeight = isBold ? 'bold' : 'normal';
  let fontSize = Math.min(estFontSize, h * 0.92);
  const minSize = 8;

  while (fontSize >= minSize) {
    ctx.font = `${fontWeight} ${Math.round(fontSize)}px "Noto Sans JP","Noto Sans",Arial,sans-serif`;
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > w - 6 && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);

    const lh = fontSize * 1.3;
    const totalH = lines.length * lh;
    if (totalH <= h + lh || fontSize <= minSize) {
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      const startY = bbox.y0 + Math.max(2, (h - totalH) / 2);
      lines.forEach((l, i) => ctx.fillText(l, bbox.x0 + 4, startY + i * lh, w - 8));
      return;
    }
    fontSize = Math.floor(fontSize * 0.85);
  }
}

// ─────────────────────────────────────────────
// メイン：画像翻訳
// ─────────────────────────────────────────────
export async function translateImage(
  imageDataUrl: string,
  targetLang: string,
  onProgress: ProgressCallback = () => {}
): Promise<{ resultDataUrl: string; detectedCount: number; translatedCount: number }> {

  // 1. 画像ロード
  onProgress('画像を読み込み中...', 5);
  const img = document.createElement('img');
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('画像の読み込みに失敗しました'));
    img.src = imageDataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  // 2. 前処理（通常 + 反転）
  const normalUrl = preprocessForOcr(canvas, false);   // 明背景向け
  const invertUrl = preprocessForOcr(canvas, true);    // 暗背景+カラーテキスト向け

  // 3. 2パス OCR（同一ワーカーで逐次実行）
  onProgress('OCRスキャン (1/2 通常)...', 10);
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('jpn+eng');

  const r1 = await worker.recognize(normalUrl);
  onProgress('OCRスキャン (2/2 反転)...', 25);
  const r2 = await worker.recognize(invertUrl);
  await worker.terminate();

  // 4. 結果マージ（信頼度ベース）
  const lines1 = extractLines(r1.data);
  const lines2 = extractLines(r2.data);
  const merged = mergeLines(lines1, lines2);

  if (merged.length === 0) {
    onProgress('テキストが検出されませんでした', 100);
    return { resultDataUrl: canvas.toDataURL('image/png'), detectedCount: 0, translatedCount: 0 };
  }

  // 5. ブロックグループ化
  const blocks = groupIntoBlocks(merged);
  onProgress(`${blocks.length}ブロック検出。翻訳開始...`, 35);

  // 6. 翻訳・描画
  let translatedCount = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = block.combinedText.trim();
    if (!text) continue;

    const pct = 35 + Math.round(((i + 1) / blocks.length) * 60);
    onProgress(`翻訳中... (${i + 1}/${blocks.length}): "${text.slice(0, 20)}"`, pct);

    const bg = sampleBgColor(ctx, block.bbox);
    // 背景塗りつぶし
    ctx.fillStyle = `rgb(${bg.r},${bg.g},${bg.b})`;
    ctx.fillRect(block.bbox.x0, block.bbox.y0,
      block.bbox.x1 - block.bbox.x0, block.bbox.y1 - block.bbox.y0);

    try {
      const translated = await translateTextGoogle(text, targetLang);
      drawTextBlock(ctx, translated, block.bbox, contrastColor(bg), block.isBold, block.estFontSize);
      translatedCount++;
    } catch (e) {
      console.warn('翻訳失敗:', text, e);
    }
  }

  onProgress('完了！', 100);
  return {
    resultDataUrl: canvas.toDataURL('image/png'),
    detectedCount: blocks.length,
    translatedCount,
  };
}
