import type { Vec2 } from "./box";

/**
 * Outline loops around the filled cells of a pixel grid, in grid units with
 * Y up: cell (row r, col c) spans x ∈ [c, c+1], y ∈ [-(r+1), -r]. Each
 * connected group of cells becomes one closed loop, ready to cut.
 */
export function traceCells(rows: string[], filled: (ch: string) => boolean): Vec2[][] {
  // Every filled cell contributes its four edges counter-clockwise; an edge
  // shared by two filled cells appears once in each direction and cancels.
  const edges = new Map<string, [Vec2, Vec2]>();
  const key = (a: Vec2, b: Vec2) => `${a[0]},${a[1]}>${b[0]},${b[1]}`;
  rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (!filled(ch)) return;
      const corners: Vec2[] = [
        [c, -r - 1],
        [c + 1, -r - 1],
        [c + 1, -r],
        [c, -r],
      ];
      corners.forEach((a, i) => {
        const b = corners[(i + 1) % 4];
        if (!edges.delete(key(b, a))) edges.set(key(a, b), [a, b]);
      });
    }),
  );

  const from = new Map<string, [Vec2, Vec2][]>();
  for (const e of edges.values()) {
    const k = `${e[0][0]},${e[0][1]}`;
    from.set(k, [...(from.get(k) ?? []), e]);
  }

  const loops: Vec2[][] = [];
  for (const start of edges.values()) {
    const sk = `${start[0][0]},${start[0][1]}`;
    if (!from.get(sk)?.includes(start)) continue; // already walked
    const loop: Vec2[] = [];
    let e: [Vec2, Vec2] | undefined = start;
    while (e) {
      const k = `${e[0][0]},${e[0][1]}`;
      from.set(k, from.get(k)!.filter((x) => x !== e));
      loop.push(e[0]);
      e = from.get(`${e[1][0]},${e[1][1]}`)?.[0];
    }
    loops.push(dropCollinear(loop));
  }
  return loops;
}

function dropCollinear(loop: Vec2[]): Vec2[] {
  return loop.filter((p, i) => {
    const a = loop[(i - 1 + loop.length) % loop.length];
    const b = loop[(i + 1) % loop.length];
    return (p[0] - a[0]) * (b[1] - p[1]) !== (p[1] - a[1]) * (b[0] - p[0]);
  });
}
