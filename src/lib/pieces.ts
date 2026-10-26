import type { Bounds, Dieline } from "./box";

/** One distinct part of a project, cut `qty` times. */
export type Piece = {
  id: string;
  label: string;
  qty: number;
  dieline: Dieline;
  art: HTMLCanvasElement;
};

export type Placed = { piece: Piece; copy: number; dx: number; dy: number };

const GAP = 40;

const size = (b: Bounds) => ({ w: b.maxX - b.minX, h: b.maxY - b.minY });

/**
 * Lay pieces out on one sheet: the first (largest) on the left, the rest in
 * top-aligned columns to its right, one row per piece, starting a new column
 * once a column is as tall as the first piece. With `copies`, each row
 * repeats its piece `qty` times — that's the actual cut file.
 */
export function arrange(pieces: Piece[], copies: boolean) {
  const [first, ...rest] = pieces;
  const fb = first.dieline.bounds;
  const placed: Placed[] = [{ piece: first, copy: 0, dx: -fb.minX, dy: -fb.minY }];
  const height = size(fb).h;
  let colX = size(fb).w + GAP * 2;
  let colW = 0;
  let top = height;
  for (const piece of rest) {
    const b = piece.dieline.bounds;
    const { w, h } = size(b);
    const n = copies ? piece.qty : 1;
    if (top - h < 0 && top < height) {
      colX += colW + GAP * 2;
      colW = 0;
      top = height;
    }
    top -= h;
    for (let c = 0; c < n; c++) {
      placed.push({ piece, copy: c, dx: colX + c * (w + GAP) - b.minX, dy: top - b.minY });
    }
    colW = Math.max(colW, n * (w + GAP) - GAP);
    top -= GAP * 3.5; // room for the next row's label
  }

  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const { piece, dx, dy } of placed) {
    const b = piece.dieline.bounds;
    bounds.minX = Math.min(bounds.minX, b.minX + dx);
    bounds.minY = Math.min(bounds.minY, b.minY + dy);
    bounds.maxX = Math.max(bounds.maxX, b.maxX + dx);
    bounds.maxY = Math.max(bounds.maxY, b.maxY + dy);
  }
  return { placed, bounds };
}

/** Total board across every copy of every piece. */
export function totalAreaM2(pieces: Piece[]) {
  return pieces.reduce((sum, p) => {
    const { w, h } = size(p.dieline.bounds);
    return sum + (w * h * p.qty) / 1e6;
  }, 0);
}
