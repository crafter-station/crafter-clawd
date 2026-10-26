import type { BoxParams, Vec2 } from "./box";
import { clawdSpec } from "./clawd";
import { ANCHORS, FACES } from "./faces";
import { traceCells } from "./pixels";

// The "deal with it" sunglasses, split into pieces you can cut by hand from
// separate board: left lens, the bridge between them, right lens. Everything
// here is in mm, with the origin at the top-left of the sunglasses and y
// pointing down, the way you'd measure it on the board.

export type Rect = { x: number; y: number; w: number; h: number };
export type Step = { dir: "→" | "↓" | "←" | "↑"; len: number };

export type GlassPart = {
  /** L1, L2… left to right; B is the bridge. */
  id: string;
  label: string;
  /** Left edge of this piece, from the left edge of the sunglasses. */
  x0: number;
  w: number;
  h: number;
  /** Clockwise outline, piece-local, starting at the top-left corner. */
  outline: Vec2[];
  steps: Step[];
  /** One entry per 3 cm row: where the board runs, piece-local. */
  rows: { y: number; from: number; to: number }[];
  /** Top-left corners of the white pixels, piece-local. */
  whites: Vec2[];
  /** The viewing slit where it crosses this piece, piece-local. */
  slit: Rect | null;
  magnets: Vec2[];
  fits: boolean;
};

/** Board you cut from, mm; either way round. */
export type Sheet = { w: number; h: number };

export function glassesPlan(wearer: number, body: BoxParams, sheet: Sheet) {
  const spec = clawdSpec(wearer, body);
  const { top, px } = spec.faceGrid;
  const grid = FACES.shades.grid;
  const cols = grid[0].length;

  // The bridge is the run of columns where only the top bar has board.
  const bridge = [...Array(cols).keys()].filter((c) => grid[0][c] !== "." && grid.slice(1).every((r) => r[c] === "."));
  const b0 = bridge[0];
  const b1 = bridge[bridge.length - 1] + 1;
  // A lens wider than the sheet is cut into even strips on the 3 cm grid,
  // joined at the back once they're on the box.
  const long = Math.max(sheet.w, sheet.h);
  const short = Math.min(sheet.w, sheet.h);
  const maxCols = Math.max(1, Math.floor((grid.length * px <= short ? long : short) / px));
  const lens = (key: "L" | "R", name: string, c0: number, c1: number) => {
    const n = Math.ceil((c1 - c0) / maxCols);
    return Array.from({ length: n }, (_, i) => ({
      id: n > 1 ? `${key}${i + 1}` : key,
      label: n > 1 ? `${name}, piece ${i + 1} of ${n}` : name,
      c0: c0 + Math.round(((c1 - c0) * i) / n),
      c1: c0 + Math.round(((c1 - c0) * (i + 1)) / n),
    }));
  };
  const groups = [
    ...lens("L", "Left lens", 0, b0),
    { id: "B", label: "Bridge", c0: b0, c1: b1 },
    ...lens("R", "Right lens", b1, cols),
  ];

  const slitTop = body.height - (spec.slit.y + spec.slit.h) - top;
  const slit: Rect = { x: spec.slit.x, y: slitTop, w: spec.slit.w, h: spec.slit.h };

  const parts: GlassPart[] = groups.map(({ id, label, c0, c1 }) => {
    const x0 = c0 * px;
    const inside = (c: number) => c >= c0 && c < c1;
    const masked = grid.map((row) => [...row].map((ch, c) => (inside(c) ? ch : ".")).join(""));
    const [loop] = traceCells(masked, (ch) => ch !== ".");
    const outline = clockwiseFromTopLeft(loop.map(([x, y]): Vec2 => [x * px - x0, -y * px]));

    const rows = masked.flatMap((row, r) => {
      const filled = [...row].flatMap((ch, c) => (ch === "." ? [] : [c]));
      return filled.length ? [{ y: r * px, from: filled[0] * px - x0, to: (filled[filled.length - 1] + 1) * px - x0 }] : [];
    });
    const whites = masked.flatMap((row, r) => [...row].flatMap((ch, c) => (ch === "o" ? [[c * px - x0, r * px] as Vec2] : [])));

    const w = (c1 - c0) * px;
    const sx0 = Math.max(slit.x, x0);
    const sx1 = Math.min(slit.x + slit.w, x0 + w);
    const partSlit = sx1 > sx0 ? { x: sx0 - x0, y: slit.y, w: sx1 - sx0, h: slit.h } : null;

    const magnets = ANCHORS.filter(([, c]) => inside(c)).map(([r, c]): Vec2 => [(c + 0.5) * px - x0, (r + 0.5) * px]);

    return {
      id,
      label,
      x0,
      w,
      h: Math.max(...outline.map((p) => p[1])),
      outline,
      steps: outline.map((a, i) => step(a, outline[(i + 1) % outline.length])),
      rows,
      whites,
      slit: partSlit,
      magnets,
      fits: fits(w, Math.max(...outline.map((p) => p[1])), sheet),
    };
  });

  return {
    px,
    /** Top edge of the sunglasses, below the top of the box. */
    top,
    width: cols * px,
    height: grid.length * px,
    slit,
    parts,
  };
}

export type GlassesPlan = ReturnType<typeof glassesPlan>;

function fits(w: number, h: number, sheet: Sheet) {
  return (w <= sheet.w && h <= sheet.h) || (w <= sheet.h && h <= sheet.w);
}

function clockwiseFromTopLeft(loop: Vec2[]): Vec2[] {
  // With y down, a positive shoelace sum reads clockwise on the page.
  const area = loop.reduce((s, [x1, y1], i) => {
    const [x2, y2] = loop[(i + 1) % loop.length];
    return s + x1 * y2 - x2 * y1;
  }, 0);
  const pts = area < 0 ? [...loop].reverse() : loop;
  const start = pts.reduce((best, p, i) => {
    const b = pts[best];
    return p[1] < b[1] || (p[1] === b[1] && p[0] < b[0]) ? i : best;
  }, 0);
  return [...pts.slice(start), ...pts.slice(0, start)];
}

function step([x1, y1]: Vec2, [x2, y2]: Vec2): Step {
  if (y1 === y2) return { dir: x2 > x1 ? "→" : "←", len: Math.abs(x2 - x1) };
  return { dir: y2 > y1 ? "↓" : "↑", len: Math.abs(y2 - y1) };
}

/** mm → "12.5" cm, without trailing zeros. */
export const cm = (mm: number) => `${+(mm / 10).toFixed(2)}`;
