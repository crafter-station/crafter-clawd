"use client";

import { useEffect, useId, useState } from "react";
import type { Layout, Vec2 } from "@/lib/box";
import { arrange, type Piece } from "@/lib/pieces";

/** Every piece flat, artwork underneath, cut and crease lines on top. */
export default function DielineView({ pieces, layout }: { pieces: Piece[]; layout: Layout }) {
  const { placed, bounds } = arrange(pieces, false);
  const sw = bounds.maxX - bounds.minX;
  const sh = bounds.maxY - bounds.minY;
  const fs = Math.max(sw, sh) * 0.014;
  const pad = fs * 4;

  return (
    <svg
      viewBox={`${bounds.minX - pad} ${-bounds.maxY - pad} ${sw + pad * 2} ${sh + pad * 1.6}`}
      className="h-full w-full"
      role="img"
      aria-label="Flat dielines with artwork"
    >
      {placed.map(({ piece, dx, dy }, i) => (
        <g key={piece.id} transform={`translate(${dx} ${-dy})`}>
          <PieceView piece={piece} fs={fs} />
          {i === 0 ? (
            <Dimensions layout={layout} fs={fs} pad={pad} />
          ) : (
            <text
              x={piece.dieline.bounds.minX}
              y={-piece.dieline.bounds.maxY - fs * 0.6}
              fontSize={fs}
              fill="#57534e"
              fontFamily="var(--font-geist-sans), sans-serif"
              fontWeight={600}
            >
              {piece.label} {piece.qty > 1 && <tspan fill="#a8a29e">×{piece.qty}</tspan>}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function PieceView({ piece, fs }: { piece: Piece; fs: number }) {
  const clip = `clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [src, setSrc] = useState("");
  useEffect(() => {
    // The 3D view samples the same canvas; the data URL is just for <image>.
    const id = requestAnimationFrame(() => setSrc(piece.art.toDataURL("image/png")));
    return () => cancelAnimationFrame(id);
  }, [piece.art]);

  const { cut, holes, creases, bounds } = piece.dieline;
  // SVG is Y-down; flip sheet space on the way in.
  const path = (pts: Vec2[]) => `M${pts.map(([x, y]) => `${x},${-y}`).join("L")}Z`;
  const outline = [cut, ...holes].map(path).join("");

  return (
    <>
      <defs>
        <clipPath id={clip}>
          <path d={outline} clipRule="evenodd" />
        </clipPath>
      </defs>
      {src && (
        <image
          href={src}
          x={bounds.minX}
          y={-bounds.maxY}
          width={bounds.maxX - bounds.minX}
          height={bounds.maxY - bounds.minY}
          preserveAspectRatio="none"
          clipPath={`url(#${clip})`}
        />
      )}
      <path d={outline} fill="none" stroke="#dc2626" strokeWidth={fs * 0.12} strokeLinejoin="round" />
      {creases.map(([a, b], i) => (
        <line
          key={i}
          x1={a[0]}
          y1={-a[1]}
          x2={b[0]}
          y2={-b[1]}
          stroke="#2563eb"
          strokeWidth={fs * 0.12}
          strokeDasharray={`${fs * 0.5} ${fs * 0.3}`}
        />
      ))}
    </>
  );
}

function Dimensions({ layout, fs, pad }: { layout: Layout; fs: number; pad: number }) {
  const { minX, minY, maxX, maxY } = layout.bounds;
  const { front, right, back, left, top, bottom } = layout.faces;
  const spans = [front, right, back, left, { x: left.x + left.w, w: maxX - (left.x + left.w) }];
  const rows = [
    { y: minY, h: bottom.h },
    { y: front.y, h: front.h },
    { y: front.y + front.h, h: top.h },
  ].filter((r) => r.h > 0);

  return (
    <g fill="#78716c" fontSize={fs} fontFamily="var(--font-geist-mono), monospace" textAnchor="middle">
      {spans.map((s, i) => (
        <Dim key={i} x1={s.x} x2={s.x + s.w} y={-maxY - pad * 0.45} fs={fs} />
      ))}
      {rows.map((r, i) => (
        <DimV key={i} y1={-(r.y + r.h)} y2={-r.y} x={minX - pad * 0.45} fs={fs} />
      ))}
    </g>
  );
}

function Dim({ x1, x2, y, fs }: { x1: number; x2: number; y: number; fs: number }) {
  const tick = fs * 0.35;
  return (
    <g stroke="#a8a29e" strokeWidth={fs * 0.06}>
      <line x1={x1} x2={x2} y1={y} y2={y} />
      <line x1={x1} x2={x1} y1={y - tick} y2={y + tick} />
      <line x1={x2} x2={x2} y1={y - tick} y2={y + tick} />
      <text x={(x1 + x2) / 2} y={y - fs * 0.45} stroke="none">
        {Math.round(x2 - x1)}
      </text>
    </g>
  );
}

function DimV({ y1, y2, x, fs }: { y1: number; y2: number; x: number; fs: number }) {
  const tick = fs * 0.35;
  const cy = (y1 + y2) / 2;
  return (
    <g stroke="#a8a29e" strokeWidth={fs * 0.06}>
      <line x1={x} x2={x} y1={y1} y2={y2} />
      <line x1={x - tick} x2={x + tick} y1={y1} y2={y1} />
      <line x1={x - tick} x2={x + tick} y1={y2} y2={y2} />
      <text x={x - fs * 0.45} y={cy} stroke="none" transform={`rotate(-90 ${x - fs * 0.45} ${cy})`}>
        {Math.round(y2 - y1)}
      </text>
    </g>
  );
}
