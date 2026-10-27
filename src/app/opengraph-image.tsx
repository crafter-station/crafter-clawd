import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { CLAWD_INK, CLAWD_ORANGE } from "@/lib/clawd";

export const alt = "Crafter Station · Clawd costume — Just Ship It";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Clawd on a 16×14 grid, same shapes as the sidebar icon: [x, y, w, h, fill].
const CLAWD: [number, number, number, number, string][] = [
  [3, 1, 10, 8, CLAWD_ORANGE],
  [1, 4, 2, 2.5, CLAWD_ORANGE],
  [13, 4, 2, 2.5, CLAWD_ORANGE],
  ...[3.6, 6.2, 8.8, 11.4].map((x): [number, number, number, number, string] => [x, 9, 1.2, 3, CLAWD_ORANGE]),
  [3, 3, 10, 0.8, CLAWD_INK],
  [3.4, 3.6, 4, 1.4, CLAWD_INK],
  [8.6, 3.6, 4, 1.4, CLAWD_INK],
  [4.2, 3.8, 0.6, 0.6, "#fff"],
  [9.4, 3.8, 0.6, 0.6, "#fff"],
];
const PX = 26;

export default async function Image() {
  const wordmark = await readFile(join(process.cwd(), "public/crafter-station-wordmark.svg"));
  const wordmarkSrc = `data:image/svg+xml;base64,${wordmark.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#f5f2ec", padding: 72 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={wordmarkSrc} alt="" width={308} height={60} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 36, color: "#78716c" }}>A wearable cardboard Clawd</div>
            <div style={{ fontSize: 112, color: CLAWD_INK, letterSpacing: -4, lineHeight: 1.05 }}>
              Just Ship It
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#78716c" }}>
            clawd.crafter.run · open source
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", position: "relative", width: 16 * PX, height: 14 * PX }}>
            {CLAWD.map(([x, y, w, h, fill], i) => (
              <div
                key={i}
                style={{ position: "absolute", left: x * PX, top: y * PX, width: w * PX, height: h * PX, background: fill }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
