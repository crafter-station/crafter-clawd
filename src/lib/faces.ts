import { rectPoly, type Dieline, type Vec2 } from "./box";
import type { ClawdSpec } from "./clawd";
import { traceCells } from "./pixels";

// Clawd's personality lives in its face: a separate relief piece (black
// foamy or doubled cardboard) that sits on the front and swaps out.
//
// Every face is drawn on the same 26 × 5 pixel grid across the front, and
// every eye covers the two ANCHOR cells. That's where the magnets go, so one
// pair of magnets in the body holds any face.

export type FaceId = "shades" | "square" | "excited" | "happy";

/** Row/col of the magnet cells, shared by every face. */
export const ANCHORS: [number, number][] = [
  [1, 5],
  [1, 20],
];

const COLS = 26;
const ROWS = 5;

function grid(stamps: [string[], number, number][]): string[] {
  const g = Array.from({ length: ROWS }, () => Array<string>(COLS).fill("."));
  for (const [rows, r0, c0] of stamps)
    rows.forEach((row, r) => [...row].forEach((ch, c) => ch !== "." && (g[r0 + r][c0 + c] = ch)));
  return g.map((r) => r.join(""));
}

const SQUARE = ["###", "###", "###"];
const RIGHT = ["##..", ".##.", "..##", ".##.", "##.."];
const LEFT = RIGHT.map((r) => [...r].reverse().join(""));
const ARC = [".####.", "##..##", "#....#"];

/** `#` = black, `o` = white highlight glued on top. */
export const FACES: Record<FaceId, { label: string; grid: string[] }> = {
  shades: {
    label: "Deal with it",
    grid: [
      "##########################",
      "###o#o######..####o#o#####",
      ".###o#o#####..#####o#o###.",
      "..###o#####....####o####..",
      "...#######......#######...",
    ],
  },
  square: { label: "Classic", grid: grid([[SQUARE, 1, 5], [SQUARE, 1, 18]]) },
  excited: { label: "Excited", grid: grid([[RIGHT, 0, 4], [LEFT, 0, 18]]) },
  happy: { label: "Happy", grid: grid([[ARC, 1, 4], [ARC, 1, 16]]) },
};

export const FACE_IDS = Object.keys(FACES) as FaceId[];
export const FACE_ROWS = ROWS;

export type FacePiece = {
  id: FaceId;
  dieline: Dieline;
  /** Outlines of the black base, in front-wall coordinates (mm). */
  loops: Vec2[][];
  /** Viewing slit cut through this face, if it covers it. */
  slit: Vec2[] | null;
  /** Bottom-left corners of the white highlight squares (mm). */
  whites: Vec2[];
  px: number;
};

/** Grid cell → front-wall millimetres. */
export function cellOrigin(spec: ClawdSpec, bodyHeight: number) {
  const { top, px } = spec.faceGrid;
  const y0 = bodyHeight - top;
  return {
    px,
    point: ([x, y]: Vec2): Vec2 => [x * px, y0 + y * px],
    cell: (r: number, c: number): Vec2 => [c * px, y0 - (r + 1) * px],
  };
}

export function facePiece(id: FaceId, spec: ClawdSpec, bodyHeight: number): FacePiece {
  const { grid } = FACES[id];
  const { px, point, cell } = cellOrigin(spec, bodyHeight);
  const loops = traceCells(grid, (ch) => ch !== ".").map((loop) => loop.map(point));

  // The slit sits on the eye line; cut it through any face that covers it.
  const s = spec.slit;
  const covers = loops.some((loop) => {
    const xs = loop.map((p) => p[0]);
    const ys = loop.map((p) => p[1]);
    return Math.min(...xs) <= s.x && Math.max(...xs) >= s.x + s.w && Math.min(...ys) <= s.y && Math.max(...ys) >= s.y + s.h;
  });
  const slit = covers ? rectPoly(s.x, s.y, s.w, s.h) : null;

  const whites: Vec2[] = [];
  grid.forEach((row, r) => [...row].forEach((ch, c) => ch === "o" && whites.push(cell(r, c))));

  const all = loops.flat();
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  return {
    id,
    loops,
    slit,
    whites,
    px,
    dieline: {
      cut: loops[0],
      // Other islands (the second eye) are cut alongside, plus the slit.
      holes: [...loops.slice(1), ...(slit ? [slit] : [])],
      creases: [],
      bounds: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
    },
  };
}

/** One white highlight square, cut from white foamy. */
export function shineDieline(px: number): Dieline {
  return { cut: rectPoly(0, 0, px, px), holes: [], creases: [], bounds: { minX: 0, minY: 0, maxX: px, maxY: px } };
}
