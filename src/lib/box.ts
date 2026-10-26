// FEFCO 0201 — Regular Slotted Container (RSC), and its flap-less variants
// (open-bottom body, open tube). Every measurement is in millimetres, in
// "sheet space": the flat blank lies on the XY plane, outside (printed) face
// towards +Z, Y pointing up.
//
//            ┌──────┐ ┌──┐ ┌──────┐ ┌──┐
//            │ top  │ │  │ │ top  │ │  │          ← flaps (depth = W/2)
//            ├──────┼─┴──┴─┼──────┼─┴──┴─┐
//            │FRONT │RIGHT │ BACK │ LEFT │ glue ← walls (height = H)
//            ├──────┼─┬──┬─┼──────┼─┬──┬─┘
//            │ bot  │ │  │ │ bot  │ │  │
//            └──────┘ └──┘ └──────┘ └──┘
//              L       W      L       W

export type BoxParams = {
  length: number;
  width: number;
  height: number;
  thickness: number;
  glueTab: number;
};

export type Vec2 = [number, number];
export type Rect = { x: number; y: number; w: number; h: number };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
export type Face = "front" | "right" | "back" | "left" | "top" | "bottom";
export type Wall = "front" | "right" | "back" | "left";

/** Which side of the hinge the board sits on, so overlapping flaps never z-fight. */
export type Layer = "in" | "out" | "deep";

export type Part = {
  id: string;
  rect: Rect;
  /** Cut-outs through this panel, in sheet space. */
  holes: Vec2[][];
  /** Panel shape when it isn't just its rect (e.g. notched), in sheet space. */
  outline?: Vec2[];
  /** A door in this wall: swings open on its own, independent of the fold. */
  door?: Wall;
  /** A point on the hinge line, in sheet space. */
  pivot: Vec2;
  axis: "x" | "y";
  /** Fully-folded rotation in radians. */
  angle: number;
  /** Slice of the global 0→1 fold progress during which this part moves. */
  phase: [number, number];
  layer: Layer;
  children: Part[];
};

/** What a cutting table needs: outline, inner cut-outs and crease lines. */
export type Dieline = {
  cut: Vec2[];
  holes: Vec2[][];
  creases: [Vec2, Vec2][];
  bounds: Bounds;
};

export type Layout = Dieline & {
  root: Part;
  faces: Record<Face, Rect>;
};

export type LayoutOptions = {
  top?: boolean;
  bottom?: boolean;
  /** Cut-outs per wall, in wall-local coordinates (origin at its bottom-left). */
  holes?: Partial<Record<Wall, Vec2[][]>>;
  /** Openings cut up from the bottom edge of a wall (open-bottom boxes only), wall-local. */
  notches?: Partial<Record<Wall, Notch[]>>;
  /** Cut-outs through the top flaps, local to each flap (origin at its left end of the hinge). */
  topHoles?: Partial<Record<Wall, Vec2[][]>>;
};

/**
 * An opening rising from a wall's bottom edge; x is its left side. As a door
 * it's only slit up both sides and creased across the top, so the board stays
 * attached and swings outward.
 */
export type Notch = { x: number; w: number; h: number; door?: boolean };

/** Notch cut line from its bottom-right corner, right to left (two slits of width s for a door). */
function notchPath({ x, w, h, door }: Notch, x0: number, s: number): Vec2[] {
  const [l, r] = [x0 + x, x0 + x + w];
  if (door)
    return [
      [r, 0],
      [r, h],
      [r - s, h],
      [r - s, 0],
      [l + s, 0],
      [l + s, h],
      [l, h],
      [l, 0],
    ];
  const c = Math.min(w / 4, h / 4, 40);
  return [
    [r, 0],
    [r, h - c],
    [r - c, h],
    [l + c, h],
    [l, h - c],
    [l, 0],
  ];
}

export const BOARDS = [
  { id: "E", label: "E-flute", thickness: 1.6, note: "Retail, mailers" },
  { id: "B", label: "B-flute", thickness: 3, note: "Most shipping boxes" },
  { id: "C", label: "C-flute", thickness: 4, note: "Heavier goods" },
  { id: "BC", label: "BC double wall", thickness: 7, note: "Moving, costumes" },
] as const;

/** Most corrugated sheet stock tops out around here. */
export const MAX_SHEET_MM = 2400;

const PHASE = {
  walls: [0, 0.4],
  bottomMinor: [0.4, 0.55],
  bottomMajor: [0.52, 0.68],
  topMinor: [0.7, 0.85],
  topMajor: [0.82, 1],
} satisfies Record<string, [number, number]>;

const QUARTER = Math.PI / 2;
const WALLS: Wall[] = ["front", "right", "back", "left"];

export function slotWidth(p: BoxParams) {
  return Math.max(p.thickness, 3);
}

export function buildLayout(p: BoxParams, opts: LayoutOptions = {}): Layout {
  const { top = true, bottom = true, holes = {}, notches = {}, topHoles = {} } = opts;
  const { length: L, width: W, height: H, glueTab: g } = p;
  const fh = W / 2;
  const s = slotWidth(p);
  const xs = [0, L, L + W, 2 * L + W, 2 * L + 2 * W];
  const X = xs[4];
  const taper = Math.min(g * 0.35, H * 0.15);

  // Flaps are inset by half a slot on every edge shared with a neighbour.
  const flapSpan = (i: number): [number, number] => [
    xs[i] + (i > 0 ? s / 2 : 0),
    xs[i + 1] - (i < 3 ? s / 2 : 0),
  ];

  const flapHoles = WALLS.map((w, i) =>
    top ? (topHoles[w] ?? []).map((poly) => poly.map(([x, y]): Vec2 => [x + flapSpan(i)[0], y + H])) : [],
  );

  const flaps = (i: number): Part[] => {
    const [l, r] = flapSpan(i);
    const major = i % 2 === 0;
    const parts: Part[] = [];
    if (top)
      parts.push({
        id: `top-${i}`,
        rect: { x: l, y: H, w: r - l, h: fh },
        holes: flapHoles[i],
        pivot: [xs[i], H],
        axis: "x",
        angle: -QUARTER,
        phase: major ? PHASE.topMajor : PHASE.topMinor,
        layer: major ? "out" : "in",
        children: [],
      });
    if (bottom)
      parts.push({
        id: `bottom-${i}`,
        rect: { x: l, y: -fh, w: r - l, h: fh },
        holes: [],
        pivot: [xs[i], 0],
        axis: "x",
        angle: QUARTER,
        phase: major ? PHASE.bottomMajor : PHASE.bottomMinor,
        layer: major ? "out" : "in",
        children: [],
      });
    return parts;
  };

  const glue: Part = {
    id: "glue",
    rect: { x: X, y: taper, w: g, h: H - 2 * taper },
    holes: [],
    pivot: [X, 0],
    axis: "y",
    angle: QUARTER,
    phase: PHASE.walls,
    layer: "deep",
    children: [],
  };

  const wallHoles = WALLS.map((w, i) =>
    (holes[w] ?? []).map((poly) => poly.map(([x, y]): Vec2 => [x + xs[i], y])),
  );
  // Notches only make sense where no bottom flap hangs off the edge.
  const wallNotches = WALLS.map((w) => (bottom ? [] : [...(notches[w] ?? [])].sort((a, b) => b.x - a.x)));
  // In 3D the wall loses the whole notch; a door fills it back in as its own panel.
  const wallOutline = (i: number): Vec2[] | undefined =>
    wallNotches[i].length
      ? [
          [xs[i], 0],
          [xs[i], H],
          [xs[i + 1], H],
          [xs[i + 1], 0],
          ...wallNotches[i].flatMap(({ x, w, h }) => [[xs[i] + x + w, 0], [xs[i] + x + w, h], [xs[i] + x, h], [xs[i] + x, 0]] as Vec2[]),
        ]
      : undefined;
  const doors = (i: number): Part[] =>
    wallNotches[i]
      .filter((n) => n.door)
      .map((n, k) => ({
        id: `door-${i}-${k}`,
        rect: { x: xs[i] + n.x + s, y: 0, w: n.w - 2 * s, h: n.h },
        holes: [],
        pivot: [xs[i] + n.x + s, n.h],
        axis: "x",
        angle: 0,
        phase: PHASE.walls,
        layer: "in",
        door: WALLS[i],
        children: [],
      }));

  // Walls hinge off one another in a chain: front → right → back → left → glue.
  let next: Part[] = [glue];
  for (let i = 3; i >= 0; i--) {
    const wall: Part = {
      id: `wall-${i}`,
      rect: { x: xs[i], y: 0, w: xs[i + 1] - xs[i], h: H },
      holes: wallHoles[i],
      outline: wallOutline(i),
      pivot: [xs[i], 0],
      axis: "y",
      angle: i === 0 ? 0 : QUARTER,
      phase: PHASE.walls,
      layer: "in",
      children: [...flaps(i), ...doors(i), ...next],
    };
    next = [wall];
  }

  // Outline, clockwise from the bottom-left corner.
  const cut: Vec2[] = [[0, bottom ? -fh : 0], [0, top ? H + fh : H]];
  if (top) {
    for (let i = 0; i < 4; i++) {
      const [l, r] = flapSpan(i);
      if (i > 0) cut.push([l, H], [l, H + fh]);
      cut.push([r, H + fh], [r, H]);
    }
  } else {
    cut.push([X, H]);
  }
  cut.push([X + g, H - taper], [X + g, taper], [X, 0]);
  if (bottom) {
    for (let i = 3; i >= 0; i--) {
      const [l, r] = flapSpan(i);
      if (i < 3) cut.push([r, 0]);
      cut.push([r, -fh], [l, -fh]);
      if (i > 0) cut.push([l, 0]);
    }
    cut.pop(); // back at the starting corner; the path is closed implicitly
  } else {
    // Bottom edge runs right to left back to the start, dipping into each notch.
    for (let i = 3; i >= 0; i--) for (const n of wallNotches[i]) cut.push(...notchPath(n, xs[i], s));
  }

  const creases: [Vec2, Vec2][] = [];
  for (let i = 0; i < 4; i++) {
    const [l, r] = flapSpan(i);
    if (top) creases.push([[l, H], [r, H]]);
    if (bottom) creases.push([[l, 0], [r, 0]]);
    creases.push([[xs[i + 1], 0], [xs[i + 1], H]]);
    for (const n of wallNotches[i])
      if (n.door) creases.push([[xs[i] + n.x + s, n.h], [xs[i] + n.x + n.w - s, n.h]]);
  }

  const [tl, tr] = flapSpan(0);
  return {
    root: next[0],
    bounds: { minX: 0, minY: bottom ? -fh : 0, maxX: X + g, maxY: top ? H + fh : H },
    faces: {
      front: { x: 0, y: 0, w: L, h: H },
      right: { x: L, y: 0, w: W, h: H },
      back: { x: L + W, y: 0, w: L, h: H },
      left: { x: 2 * L + W, y: 0, w: W, h: H },
      top: { x: tl, y: H, w: tr - tl, h: top ? fh : 0 },
      bottom: { x: tl, y: -fh, w: tr - tl, h: bottom ? fh : 0 },
    },
    cut,
    holes: [...wallHoles.flat(), ...flapHoles.flat()],
    creases,
  };
}

/**
 * A flag printed on both sides: one strip, folded in half over the pole.
 * The crease sits at x = w; the outer corners are rounded.
 */
export function flagDieline(w: number, h: number): Dieline {
  const r = Math.min(w, h) * 0.08;
  const arc = (cx: number, cy: number, a0: number): Vec2[] =>
    Array.from({ length: 7 }, (_, i) => {
      const a = a0 + (QUARTER * i) / 6;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });
  return {
    cut: [
      ...arc(r, r, Math.PI),
      ...arc(2 * w - r, r, Math.PI * 1.5),
      ...arc(2 * w - r, h - r, 0),
      ...arc(r, h - r, QUARTER),
    ],
    holes: [],
    creases: [[[w, 0], [w, h]]],
    bounds: { minX: 0, minY: 0, maxX: 2 * w, maxY: h },
  };
}

export const rectPoly = (x: number, y: number, w: number, h: number): Vec2[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];

export const circlePoly = (cx: number, cy: number, r: number, n = 48): Vec2[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });

/** Blank size and board area, the numbers a converter quotes from. */
export function blankStats(d: Dieline) {
  const { minX, minY, maxX, maxY } = d.bounds;
  const w = maxX - minX;
  const h = maxY - minY;
  return { width: w, height: h, areaM2: (w * h) / 1e6 };
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function phaseProgress(fold: number, [a, b]: [number, number]) {
  const t = clamp01((fold - a) / (b - a));
  return t * t * (3 - 2 * t);
}
