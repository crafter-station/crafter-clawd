import { rectPoly, type BoxParams, type LayoutOptions } from "./box";

// Clawd as a wearable costume. The body is worn from just above the head to
// the hips, open at the bottom. Proportions come from the wearer's height
// using standard anthropometric ratios, then bent toward Clawd's silhouette.
//
//                 ║ ║ ║ ║ ║ ║ ║                ← breathing vents in the top flaps
//                ┌──────────────────────────┐  ← 40 mm head clearance
//                │▀▀▀▀▀▀▀▀▀▀[slit]▀▀▀▀▀▀▀▀▀▀│  ← face piece (swappable) at eye line
//            ┌───┤ ▀▀▀▀▀▀▀        ▀▀▀▀▀▀▀  ├───┐
//            │arm│                          │arm│ ← shoulder height
//            └───┤                          ├───┘
//                ╯                          ╰      ← arm doors up from the hem, hinged at the top
//                └┬──┬──┬──┬──┬──┬──┬──┬┘  ← hips; the bottom is open
//                 └──┘  └──┘  └──┘  └──┘    ← Clawd's legs, a row along the front
//                         ║  ║                  (taped hinge: knees push them, they swing back)
//                         ║  ║               ← you walk behind them
//
// Seen from above, the legs are shallow boxes at the front edge and the
// wearer stands behind them, so nothing rigid wraps a moving joint.

export const CLAWD_ORANGE = "#ee6a1c";
export const CLAWD_INK = "#151413";
export const DEFAULT_FLAG_TEXT = "Just Ship It";
/** Clawd's own flag, for an unbranded costume. */
export const PLAIN_FLAG_TEXT = "You're absolutely right!";

const HEAD_CLEARANCE = 40;

/** The face is drawn on a pixel grid this many columns across the front (see faces.ts). */
const FACE_COLS = 26;

export type ClawdSpec = ReturnType<typeof clawdSpec>;

export function clawdSpec(wearer: number, body: BoxParams) {
  const { length: L, width: W, height: H, thickness } = body;
  const px = L / FACE_COLS;

  // Eye line: ~6.8% of stature below the crown, plus the clearance above it.
  const eyeFromTop = wearer * 0.068 + HEAD_CLEARANCE;
  // Shoulder (acromion) height is ~81.8% of stature.
  const shoulderFromTop = wearer * 0.182 + HEAD_CLEARANCE;

  // Legs are decoration hung along the front: wide like Clawd's, but shallow
  // so they stay out of the wearer's stride.
  const legW = Math.round(L * 0.15);
  const legDepth = Math.round(clamp(wearer * 0.045, 60, 90));
  const legLength = Math.round(wearer * 0.18);
  const armOut = Math.round(L * 0.16);
  const armHeight = Math.round(H * 0.3);
  const armDepth = Math.round(Math.min(W * 0.6, armHeight));

  const tube = (length: number, width: number, height: number): BoxParams => ({
    length,
    width,
    height,
    thickness,
    glueTab: Math.round(clamp(Math.min(length, height) * 0.3, 20, 35)),
  });

  const armCenter = Math.max(shoulderFromTop, H * 0.4);

  // Arm openings: notches rising from the hem of each side wall, centred on
  // the wearer and stopping just under Clawd's arm. Shoulders sit ~0.11h in
  // from the centre and the side walls ~L/2 out, so the arms can lift well
  // out to the side and swing forward and back.
  const wearerFromFront = (W + legDepth + thickness) / 2;
  const notchW = Math.round(Math.min(wearer * 0.15, 2 * (W - wearerFromFront - 30)));
  const notchH = Math.round(H - armCenter - armHeight / 2 - 30);
  // Doors rather than holes: slit up both sides, hinged at the top, pushed open by the arm.
  const notch = (fromFront: number) => [{ x: Math.round(fromFront - notchW / 2), w: notchW, h: notchH, door: true }];

  // Breathing vents: a row of slots in the front and back top flaps, over
  // the head, where only one layer of board covers it (the side flaps reach
  // in just W/2 from each end).
  const flapDepth = W / 2;
  const ventCount = 7;
  const ventW = 14;
  const ventPitch = 34;
  const ventLen = Math.round(flapDepth * 0.55);
  const flapMid = (L - Math.max(thickness, 3) / 2) / 2;
  const vents = Array.from({ length: ventCount }, (_, k) =>
    rectPoly(
      Math.round(flapMid + (k - (ventCount - 1) / 2) * ventPitch - ventW / 2),
      Math.round((flapDepth - ventLen) / 2),
      ventW,
      ventLen,
    ),
  );

  // Whole cm wide, half-cm tall, so it can be marked out with a ruler.
  const slitW = Math.round((wearer * 0.125) / 10) * 10;
  const slitH = Math.max(10, Math.round(Math.min(px * 0.62, 30) / 5) * 5);
  /** Front-wall-local rect of the viewing slit. */
  const slit = { x: (L - slitW) / 2, y: H - eyeFromTop - slitH / 2, w: slitW, h: slitH };
  const flagW = Math.round(wearer * 0.3);

  return {
    wearer,
    /** Body sits with its top this far above the floor. */
    topFromFloor: wearer + HEAD_CLEARANCE,
    /** Face grid: top edge (mm below the top of the front) and pixel size. Row 0 sits on the eye line. */
    faceGrid: { top: eyeFromTop - px / 2, px },
    slit,
    bodyOptions: {
      top: true,
      bottom: false,
      holes: {
        // Viewing slit on the eye line; back it with mesh in the body colour.
        front: [rectPoly(slit.x, slit.y, slit.w, slit.h)],
      },
      // The right wall runs front → back, the left one back → front.
      notches: { right: notch(wearerFromFront), left: notch(W - wearerFromFront) },
      topHoles: { front: vents, back: vents },
    } satisfies LayoutOptions,
    arm: {
      params: tube(armHeight, armDepth, armOut),
      centerFromTop: armCenter,
    },
    leg: {
      params: tube(legW, legDepth, legLength),
      xs: [0.125, 0.375, 0.625, 0.875].map((f) => f * L),
    },
    legOptions: { top: true, bottom: true } satisfies LayoutOptions,
    /** Wearer stands centred in the depth left behind the legs (z from the front, mm). */
    wearerZ: -wearerFromFront,
    /** Hip joints either side of the centre line. */
    hipHalf: wearer * 0.055,
    armOptions: { top: true, bottom: true } satisfies LayoutOptions,
    flag: {
      w: flagW,
      h: Math.round(flagW * 0.6),
      pole: Math.round(wearer * 0.55),
      angle: 0.5,
      radius: 6,
    },
  };
}

/** Body box for a given wearer height, keeping Clawd's wide stance. */
export function clawdBody(wearer: number, thickness: number): BoxParams {
  const height = Math.round(wearer * 0.43 + HEAD_CLEARANCE);
  return {
    length: Math.round(height * 1.25),
    // Deep enough for the wearer to stand behind the legs with room to stride.
    width: Math.round(wearer * 0.24),
    height,
    thickness,
    glueTab: 40,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
