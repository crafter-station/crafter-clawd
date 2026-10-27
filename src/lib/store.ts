import { create } from "zustand";
import type { BoxParams } from "./box";
import { CLAWD_ORANGE, DEFAULT_FLAG_TEXT, PLAIN_FLAG_TEXT, clawdBody } from "./clawd";
import type { FaceId } from "./faces";

export type Board = "kraft" | "white";

export type Design = {
  board: Board;
  /** null = unprinted board. */
  printColor: string | null;
  logo: string | null;
  logoScale: number;
};

export const CRAFTER_URL = "https://crafter.run";
export const REPO_URL = "https://github.com/crafter-station/crafter-clawd";

const DESIGN: Design = {
  board: "white",
  printColor: CLAWD_ORANGE,
  logo: "/crafter-station-wordmark.svg",
  logoScale: 0.46,
};

export type Costume = {
  /** Wearer's height in mm. */
  wearer: number;
  flagText: string;
  showWearer: boolean;
  /** Crafter Station wordmarks, back QR and flag logo; off gives a plain Clawd. */
  branding: boolean;
  /** See-through board, to show how the wearer sits inside. */
  xray: boolean;
  /** Which face piece is on in the preview; all of them are in the cut file. */
  face: FaceId;
};

const WEARER = 1750;
const BOARD_MM = 7;
/** The box we already have, folded: 78 cm front, 75.5 cm tall. */
const OUR_BOX = { length: 780, height: 755 };

type State = {
  params: BoxParams;
  design: Design;
  costume: Costume;
  /** 0 = flat blanks, 1 = assembled costume. */
  fold: number;
  playing: boolean;
  setParams: (p: Partial<BoxParams>) => void;
  setCostume: (c: Partial<Costume>) => void;
  setFold: (fold: number) => void;
  playFold: () => void;
};

let raf = 0;

export const useBox = create<State>((set, get) => ({
  params: { ...clawdBody(WEARER, BOARD_MM), ...OUR_BOX },
  design: DESIGN,
  costume: { wearer: WEARER, flagText: DEFAULT_FLAG_TEXT, branding: true, showWearer: true, xray: false, face: "shades" },
  fold: 1,
  playing: false,
  setParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),
  setCostume: (c) =>
    set((s) => {
      const costume = { ...s.costume, ...c };
      // Swap the flag's default line along with the branding, unless it's been edited.
      if (c.branding !== undefined && !c.flagText) {
        const [from, to] = c.branding ? [PLAIN_FLAG_TEXT, DEFAULT_FLAG_TEXT] : [DEFAULT_FLAG_TEXT, PLAIN_FLAG_TEXT];
        if (s.costume.flagText === from) costume.flagText = to;
      }
      // Re-fit the body only when the wearer changes; manual tweaks otherwise stick.
      const params = c.wearer ? clawdBody(costume.wearer, s.params.thickness) : s.params;
      return { costume, params };
    }),
  setFold: (fold) => {
    cancelAnimationFrame(raf);
    set({ fold, playing: false });
  },
  // Folds towards whichever end is further away.
  playFold: () => {
    cancelAnimationFrame(raf);
    const from = get().fold;
    const to = from > 0.5 ? 0 : 1;
    const duration = 2600 * Math.abs(to - from);
    const start = performance.now();
    set({ playing: true });
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      set({ fold: from + (to - from) * t });
      if (t < 1) raf = requestAnimationFrame(tick);
      else set({ playing: false });
    };
    raf = requestAnimationFrame(tick);
  },
}));
