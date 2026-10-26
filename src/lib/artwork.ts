import type { Bounds, Dieline, Layout, Rect, Vec2 } from "./box";
import QRCode from "qrcode";
import { CLAWD_INK, CLAWD_ORANGE } from "./clawd";
import { ANCHORS, FACE_ROWS, type FacePiece } from "./faces";
import type { Board, Design } from "./store";

// The print sheet: one canvas covering the whole flat blank. The 3D preview
// samples it per panel through UVs and the dieline view shows it as-is, so
// what you see folded is exactly what gets printed flat.

const MAX_PX = 4096;
const PX_PER_MM = 4;
export const SHINE = "#f5f2ec";
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

export const BOARD_COLORS: Record<Board, { base: string; edge: string }> = {
  kraft: { base: "#c49a6c", edge: "#a87f53" },
  white: { base: "#f2eee6", edge: "#d9cdb8" },
};

const tiles = new Map<Board, HTMLCanvasElement>();

/** Seeded so the fibres don't shimmer every time the sheet is redrawn. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tileable board-surface texture: base colour, mottling and paper fibres. */
export function boardTile(board: Board) {
  const cached = tiles.get(board);
  if (cached) return cached;
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const rand = mulberry32(board === "kraft" ? 7 : 11);
  const kraft = board === "kraft";
  ctx.fillStyle = BOARD_COLORS[board].base;
  ctx.fillRect(0, 0, size, size);

  // Wrap every mark across the edges so the tile repeats seamlessly.
  const wrapped = (draw: (ox: number, oy: number) => void) => {
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) draw(ox, oy);
  };

  for (let i = 0; i < 220; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 20 + rand() * 70;
    const light = rand() > 0.5;
    const a = (kraft ? 0.05 : 0.025) * rand();
    wrapped((ox, oy) => {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, light ? `rgba(255,240,215,${a})` : `rgba(90,55,20,${a})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    });
  }

  ctx.lineCap = "round";
  for (let i = 0; i < (kraft ? 2600 : 900); i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 2 + rand() * 9;
    const ang = rand() * Math.PI;
    const dark = rand() > 0.35;
    ctx.strokeStyle = dark
      ? `rgba(70,40,15,${(kraft ? 0.22 : 0.08) * rand()})`
      : `rgba(255,245,225,${(kraft ? 0.25 : 0.4) * rand()})`;
    ctx.lineWidth = 0.4 + rand() * 0.8;
    wrapped((ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(x + ox + Math.cos(ang) * len, y + oy + Math.sin(ang) * len);
      ctx.stroke();
    });
  }
  tiles.set(board, c);
  return c;
}

/** A blank canvas covering a sheet, with helpers from sheet mm to canvas px. */
function sheetCanvas({ minX, minY, maxX, maxY }: Bounds) {
  const k = Math.min(PX_PER_MM, MAX_PX / Math.max(maxX - minX, maxY - minY));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((maxX - minX) * k);
  canvas.height = Math.ceil((maxY - minY) * k);
  const ctx = canvas.getContext("2d")!;
  // Sheet space is Y-up millimetres; the canvas is Y-down pixels.
  const toPx = (r: Rect) => ({
    x: (r.x - minX) * k,
    y: (maxY - (r.y + r.h)) * k,
    w: r.w * k,
    h: r.h * k,
  });
  const pt = ([x, y]: Vec2): Vec2 => [(x - minX) * k, (maxY - y) * k];
  return { canvas, ctx, k, toPx, pt };
}

export type Decorations = {
  /** Face grid on the front: top edge (mm below the top of the face) and pixel size. */
  faceGrid?: { top: number; px: number };
  /** Back panel: wordmark, a QR code to this URL, and the URL spelled out. */
  qr?: string;
};

export function drawArtwork(
  layout: Layout,
  design: Design,
  logo: HTMLImageElement | null,
  decorations: Decorations = {},
) {
  const { canvas, ctx, k, toPx } = sheetCanvas(layout.bounds);

  ctx.fillStyle = ctx.createPattern(boardTile(design.board), "repeat")!;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (design.printColor) {
    // Ink on kraft soaks in; multiply keeps the fibres showing through.
    ctx.globalCompositeOperation = design.board === "kraft" ? "multiply" : "source-over";
    ctx.globalAlpha = design.board === "kraft" ? 0.92 : 0.97;
    ctx.fillStyle = design.printColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  if (decorations.faceGrid) {
    const face = toPx(layout.faces.front);
    const { top, px } = decorations.faceGrid;

    // Magnet marks: every face piece covers these, so they never show when worn.
    ctx.strokeStyle = "rgba(21,20,19,0.55)";
    ctx.lineWidth = Math.max(1, px * k * 0.04);
    for (const [r, c] of ANCHORS) {
      const cx = face.x + (c + 0.5) * px * k;
      const cy = face.y + (top + (r + 0.5) * px) * k;
      const rad = px * k * 0.28;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.moveTo(cx - rad * 1.4, cy);
      ctx.lineTo(cx + rad * 1.4, cy);
      ctx.moveTo(cx, cy - rad * 1.4);
      ctx.lineTo(cx, cy + rad * 1.4);
      ctx.stroke();
    }

    // Wordmark on the chest, below the face.
    if (logo) {
      const pad = Math.min(face.w, face.h) * 0.1;
      const below = face.y + (top + px * FACE_ROWS) * k + pad;
      const area = { x: face.x + pad, y: below, w: face.w - pad * 2, h: face.y + face.h - pad - below };
      const ratio = logo.naturalWidth / logo.naturalHeight;
      const w = Math.min(area.w, area.h * ratio) * Math.min(1, design.logoScale / 0.5);
      const h = w / ratio;
      ctx.drawImage(logo, area.x + (area.w - w) / 2, area.y + (area.h - h) / 2, w, h);
    }
  }

  if (decorations.qr) drawBack(ctx, toPx(layout.faces.back), decorations.qr, logo);

  return canvas;
}

/** Back panel: wordmark up top, a scannable QR code, then the URL. */
function drawBack(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  url: string,
  logo: HTMLImageElement | null,
) {
  const cx = box.x + box.w / 2;

  if (logo) {
    const ratio = logo.naturalWidth / logo.naturalHeight;
    const w = box.w * 0.62;
    ctx.drawImage(logo, cx - w / 2, box.y + box.h * 0.1, w, w / ratio);
  }

  // Dark modules on a light quiet zone; orange alone is too low-contrast to scan reliably.
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const size = Math.min(box.h * 0.46, box.w * 0.4);
  const m = size / (n + 8);
  const x0 = cx - size / 2;
  const y0 = box.y + box.h * 0.27;
  ctx.fillStyle = "#f5f2ec";
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = CLAWD_INK;
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.modules.get(r, c)) ctx.fillRect(x0 + (c + 4) * m - 0.25, y0 + (r + 4) * m - 0.25, m + 0.5, m + 0.5);

  const label = url.replace(/^https?:\/\//, "");
  let fs = box.h * 0.085;
  ctx.font = `800 ${fs}px ${FONT}`;
  const tw = ctx.measureText(label).width;
  if (tw > box.w * 0.8) {
    fs *= (box.w * 0.8) / tw;
    ctx.font = `800 ${fs}px ${FONT}`;
  }
  ctx.fillStyle = CLAWD_INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, y0 + size + (box.y + box.h - (y0 + size)) * 0.45);
}

/** A face piece as cut: black base (slit and all), white highlights on top. */
export function drawFacePiece(piece: FacePiece) {
  const { canvas, ctx, k, pt } = sheetCanvas(piece.dieline.bounds);
  ctx.beginPath();
  for (const loop of [...piece.loops, ...(piece.slit ? [piece.slit] : [])]) {
    loop.forEach((p, i) => (i ? ctx.lineTo(...pt(p)) : ctx.moveTo(...pt(p))));
    ctx.closePath();
  }
  ctx.fillStyle = CLAWD_INK;
  ctx.fill("evenodd");
  const inset = piece.px * 0.07;
  ctx.fillStyle = SHINE;
  for (const [x, y] of piece.whites) {
    const [px0, py0] = pt([x + inset, y + piece.px - inset]);
    ctx.fillRect(px0, py0, (piece.px - inset * 2) * k, (piece.px - inset * 2) * k);
  }
  return canvas;
}

export function drawShine(d: Dieline) {
  const { canvas, ctx } = sheetCanvas(d.bounds);
  ctx.fillStyle = SHINE;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * The flag strip: black board, text on both halves so it reads from either
 * side once folded over the pole. Outside the cut line is transparent so the
 * 3D flag gets its rounded corners from the same canvas.
 */
export function drawFlag(dieline: Dieline, text: string, logo: HTMLImageElement | null = null) {
  const { canvas, ctx, k, pt } = sheetCanvas(dieline.bounds);
  ctx.beginPath();
  dieline.cut.forEach((p, i) => (i ? ctx.lineTo(...pt(p)) : ctx.moveTo(...pt(p))));
  ctx.closePath();
  ctx.fillStyle = CLAWD_INK;
  ctx.fill();

  const w = (dieline.bounds.maxX / 2) * k;
  const h = dieline.bounds.maxY * k;
  const mark = logo && tinted(logo, "#ffffff");
  for (const x0 of [0, w]) {
    if (!mark) {
      flagText(ctx, text, { x: x0 + w * 0.08, y: h * 0.1, w: w * 0.84, h: h * 0.8 });
      continue;
    }
    const mw = Math.min(w * 0.72, h * 0.2 * (mark.width / mark.height));
    const mh = mw * (mark.height / mark.width);
    ctx.drawImage(mark, x0 + (w - mw) / 2, h * 0.11, mw, mh);
    flagText(ctx, text, { x: x0 + w * 0.1, y: h * 0.11 + mh + h * 0.06, w: w * 0.8, h: h * 0.89 - mh - h * 0.17 });
  }
  return canvas;
}

/** The logo recoloured to a single ink, at a resolution good enough for print. */
function tinted(img: HTMLImageElement, color: string) {
  const c = document.createElement("canvas");
  const scale = 1600 / Math.max(img.naturalWidth, img.naturalHeight);
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

function flagText(
  ctx: CanvasRenderingContext2D,
  text: string,
  area: { x: number; y: number; w: number; h: number },
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return;
  const serif = "Georgia, 'Times New Roman', serif";
  // Shrink until the greedy-wrapped lines fit the area.
  let size = area.h * 0.34;
  let lines: string[] = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    ctx.font = `700 ${size}px ${serif}`;
    lines = [];
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > area.w) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (widest <= area.w && lines.length * size * 1.02 <= area.h) break;
    size *= 0.92;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lh = size * 1.02;
  const y0 = area.y + area.h / 2 - ((lines.length - 1) * lh) / 2;
  const depth = Math.max(1, size * 0.05);
  lines.forEach((l, i) => {
    const x = area.x + area.w / 2;
    const y = y0 + i * lh;
    // A darker offset copy reads as the raised edge of the lettering.
    ctx.fillStyle = "#7a3209";
    ctx.fillText(l, x + depth, y + depth);
    ctx.fillStyle = CLAWD_ORANGE;
    ctx.fillText(l, x, y);
  });
}
