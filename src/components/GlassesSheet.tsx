"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { CLAWD_INK, CLAWD_ORANGE } from "@/lib/clawd";
import { cm, glassesPlan, type GlassPart, type GlassesPlan, type Rect } from "@/lib/glasses";
import { useBox } from "@/lib/store";

// A build sheet for the "deal with it" sunglasses, for cutting by hand with a
// ruler: every piece is drawn on its 3 cm grid with the squares to cut away
// crossed out, and every number lands on the grid or a half centimetre.

export default function GlassesSheet() {
  const params = useBox((s) => s.params);
  const wearer = useBox((s) => s.costume.wearer);
  const [sheet, setSheet] = useState({ w: 250, h: 160 });
  const plan = useMemo(() => glassesPlan(wearer, params, sheet), [wearer, params, sheet]);
  const g = cm(plan.px);

  return (
    <div className="min-h-dvh bg-stone-100 text-stone-900">
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <div className="flex items-center justify-between print:hidden">
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-900">
            ← Back to the costume
          </Link>
          <button
            onClick={() => window.print()}
            className="rounded-full bg-stone-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-stone-700"
          >
            Print
          </button>
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sunglasses build sheet</h1>
        <p className="mt-1 text-sm text-stone-500">
          &ldquo;Deal with it&rdquo; face for a {cm(params.length)} × {cm(params.height)} cm box. All measurements in cm.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Fact label="Whole sunglasses" value={`${cm(plan.width)} × ${cm(plan.height)}`} />
          <Fact label="Grid square" value={`${g} × ${g}`} />
          <Fact label="Top edge, from box top" value={cm(plan.top)} />
          <label className="rounded-xl border border-stone-200 bg-white px-4 py-3 print:hidden">
            <span className="text-[11px] uppercase tracking-[0.08em] text-stone-400">Your sheet</span>
            <span className="mt-1 flex items-center gap-1 font-mono text-sm">
              <NumberInput value={sheet.w} onChange={(w) => setSheet((s) => ({ ...s, w }))} />×
              <NumberInput value={sheet.h} onChange={(h) => setSheet((s) => ({ ...s, h }))} />
            </span>
          </label>
        </div>

        <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold">On the box</h2>
          <p className="mt-1 text-sm text-stone-500">
            {plan.parts.length} pieces, glued side by side. The top edge of the sunglasses sits {cm(plan.top)} cm below the
            top of the box, flush with both sides.
          </p>
          <Placement plan={plan} boxW={params.length} boxH={params.height} />
        </section>

        <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold">With a ruler, for every piece</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-stone-600">
            <li>Draw the piece&apos;s rectangle on the board.</li>
            <li>
              Mark every {g} cm along the top and the left edge and draw the grid lines across. Every edge of the piece is
              on one of these lines.
            </li>
            <li>Cross out the squares shown crossed in the drawing, then cut along the outline.</li>
            <li>Cut the slit window where a piece has one (red, dashed). It is on the eye line, so you see through it.</li>
            <li>Glue a white square on each white cell, and a magnet behind the marked cell.</li>
          </ol>
        </section>

        {plan.parts.map((part) => (
          <PartCard key={part.id} part={part} px={plan.px} sheet={sheet} />
        ))}
      </div>
    </div>
  );
}

function PartCard({ part, px, sheet }: { part: GlassPart; px: number; sheet: { w: number; h: number } }) {
  const cols = Math.round(part.w / px);
  const rows = Math.round(part.h / px);
  const cutAway = part.rows.flatMap((r, i) => {
    const gaps = [
      ...(r.from > 0 ? [`${cm(0)}–${cm(r.from)}`] : []),
      ...(r.to < part.w ? [`${cm(r.to)}–${cm(part.w)}`] : []),
    ];
    return gaps.length ? [{ row: i + 1, y: r.y, gaps }] : [];
  });
  const slitSplits = part.slit && part.slit.w >= part.w;

  return (
    <section className="mt-8 break-inside-avoid rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          <span className="mr-2 rounded-md bg-stone-900 px-2 py-0.5 font-mono text-sm text-white">{part.id}</span>
          {part.label}
        </h2>
        <span className={`text-xs ${part.fits ? "text-stone-500" : "font-medium text-amber-700"}`}>
          {cm(part.w)} × {cm(part.h)} cm ·{" "}
          {part.fits ? `fits your ${cm(sheet.w)} × ${cm(sheet.h)} sheet` : "bigger than your sheet"}
        </span>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <PartDrawing part={part} px={px} />

        <div className="space-y-4 text-sm">
          <Step n={1} title={`Rectangle ${cm(part.w)} × ${cm(part.h)}`}>
            {cols} squares across, {rows} down.
          </Step>
          <Step n={2} title="Cut away">
            {cutAway.length ? (
              <ul className="space-y-0.5 font-mono text-[13px]">
                {cutAway.map((c) => (
                  <li key={c.row}>
                    row {c.row} ({cm(c.y)}–{cm(c.y + px)} down): {c.gaps.join(" and ")} across
                  </li>
                ))}
              </ul>
            ) : (
              "Nothing, it's a plain rectangle."
            )}
          </Step>
          <Step n={3} title="Or follow the outline">
            <p className="text-stone-500">From the top-left corner, clockwise:</p>
            <p className="mt-1 font-mono text-[13px] leading-relaxed">
              {part.steps.map((s, i) => (
                <span key={i} className="mr-2 inline-block">
                  {s.dir}
                  {cm(s.len)}
                </span>
              ))}
            </p>
          </Step>
          {part.slit && (
            <Step n={4} title="Slit">
              {slitSplits ? (
                <>
                  The slit takes {cm(part.slit.h)} cm out of the middle, leaving two strips {cm(part.w)} ×{" "}
                  {cm(part.slit.y)} and {cm(part.w)} × {cm(part.h - part.slit.y - part.slit.h)}. Cut those, or use black tape
                  instead.
                </>
              ) : (
                <>
                  {cm(part.slit.w)} × {cm(part.slit.h)} window: {cm(part.slit.x)}–{cm(part.slit.x + part.slit.w)} across,{" "}
                  {cm(part.slit.y)}–{cm(part.slit.y + part.slit.h)} down{openSide(part.slit, part.w)}.
                </>
              )}
            </Step>
          )}
          {(part.whites.length > 0 || part.magnets.length > 0) && (
            <Step n={part.slit ? 5 : 4} title="White squares and magnet">
              {part.whites.length > 0 && (
                <p>
                  {part.whites.length} white {plural(part.whites.length, "square")}, {cm(px)} × {cm(px)} (or {cm(px - 4)} centred):
                  <span className="mt-1 block font-mono text-[13px]">
                    {part.whites.map(([x, y]) => `${cm(x)} across, ${cm(y)} down`).join(" · ")}
                  </span>
                </p>
              )}
              {part.magnets.map(([x, y], i) => (
                <p key={i} className="mt-1">
                  Magnet centre: {cm(x)} across, {cm(y)} down.
                </p>
              ))}
            </Step>
          )}
        </div>
      </div>
    </section>
  );
}

/** The piece on its grid: board in ink, cut-away squares crossed, rulers on two sides. */
function PartDrawing({ part, px }: { part: GlassPart; px: number }) {
  const m = px * 0.9;
  const cols = Math.round(part.w / px);
  const rows = Math.round(part.h / px);
  const kept = (r: number, c: number) => {
    const row = part.rows[r];
    return row && c * px >= row.from && (c + 1) * px <= row.to;
  };
  const fs = px * 0.32;
  const d = part.outline.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ") + "Z";

  return (
    // Same scale for every piece, so the bridge looks as small as it is.
    <svg
      viewBox={`${-m} ${-m} ${part.w + m * 1.4} ${part.h + m * 1.4}`}
      width={(part.w + m * 1.4) * 2}
      className="h-auto max-w-full"
    >
      {/* Rulers: tick and label at every grid line. */}
      {Array.from({ length: cols + 1 }, (_, c) => (
        <g key={`x${c}`}>
          <line x1={c * px} y1={-px * 0.2} x2={c * px} y2={0} stroke="#a8a29e" strokeWidth={0.8} />
          <text x={c * px} y={-px * 0.32} fontSize={fs} textAnchor="middle" fill="#78716c" fontFamily="ui-monospace, monospace">
            {cm(c * px)}
          </text>
        </g>
      ))}
      {Array.from({ length: rows + 1 }, (_, r) => (
        <g key={`y${r}`}>
          <line x1={-px * 0.2} y1={r * px} x2={0} y2={r * px} stroke="#a8a29e" strokeWidth={0.8} />
          <text
            x={-px * 0.3}
            y={r * px + fs * 0.35}
            fontSize={fs}
            textAnchor="end"
            fill="#78716c"
            fontFamily="ui-monospace, monospace"
          >
            {cm(r * px)}
          </text>
        </g>
      ))}

      {/* Squares to cut away. */}
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) =>
          kept(r, c) ? null : (
            <g key={`${r}-${c}`} stroke="#d6d3d1" strokeWidth={0.8}>
              <rect x={c * px} y={r * px} width={px} height={px} fill="#fafaf9" strokeDasharray="3 3" />
              <line x1={c * px + 6} y1={r * px + 6} x2={(c + 1) * px - 6} y2={(r + 1) * px - 6} />
              <line x1={(c + 1) * px - 6} y1={r * px + 6} x2={c * px + 6} y2={(r + 1) * px - 6} />
            </g>
          ),
        ),
      )}

      <path d={d} fill={CLAWD_INK} />
      {/* Grid lines over the board, as you'd draw them. */}
      {Array.from({ length: cols - 1 }, (_, c) => (
        <line key={`gc${c}`} x1={(c + 1) * px} y1={0} x2={(c + 1) * px} y2={part.h} stroke="#ffffff22" strokeWidth={0.8} />
      ))}
      {Array.from({ length: rows - 1 }, (_, r) => (
        <line key={`gr${r}`} x1={0} y1={(r + 1) * px} x2={part.w} y2={(r + 1) * px} stroke="#ffffff22" strokeWidth={0.8} />
      ))}
      {part.whites.map(([x, y], i) => (
        <rect key={i} x={x + 2} y={y + 2} width={px - 4} height={px - 4} fill="#f5f2ec" />
      ))}
      {part.slit && (
        <rect
          x={part.slit.x}
          y={part.slit.y}
          width={part.slit.w}
          height={part.slit.h}
          fill="#f5f5f4"
          stroke="#dc2626"
          strokeWidth={1.2}
          strokeDasharray="4 3"
        />
      )}
      {part.magnets.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={px * 0.28} fill="none" stroke={CLAWD_ORANGE} strokeWidth={1.6} />
          <circle cx={x} cy={y} r={1.6} fill={CLAWD_ORANGE} />
        </g>
      ))}
      <path d={d} fill="none" stroke="#dc2626" strokeWidth={1.2} />
    </svg>
  );
}

/** The box front with the pieces where they go. */
function Placement({ plan, boxW, boxH }: { plan: GlassesPlan; boxW: number; boxH: number }) {
  const m = 60;
  const fs = 20;
  const top = plan.top;
  return (
    <svg viewBox={`${-m} ${-m} ${boxW + m * 2} ${boxH + m * 1.4}`} className="mx-auto mt-4 w-full max-w-xl">
      <rect x={0} y={0} width={boxW} height={boxH} fill={CLAWD_ORANGE} stroke="#9a3412" strokeWidth={2} />
      {plan.parts.map((p) => (
        <g key={p.id} transform={`translate(${p.x0} ${top})`}>
          <path
            d={p.outline.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ") + "Z"}
            fill={CLAWD_INK}
            stroke="#ffffff"
            strokeWidth={2}
          />
          <text x={p.w / 2} y={p.id === "B" ? -10 : plan.height * 0.62} fontSize={fs} textAnchor="middle" fill={p.id === "B" ? CLAWD_INK : "#ffffff"} fontFamily="ui-monospace, monospace" fontWeight={700}>
            {p.id}
          </text>
        </g>
      ))}
      <rect
        x={plan.slit.x}
        y={top + plan.slit.y}
        width={plan.slit.w}
        height={plan.slit.h}
        fill="none"
        stroke="#dc2626"
        strokeWidth={2}
        strokeDasharray="6 4"
      />

      {/* Top of box → top of the sunglasses. */}
      <line x1={-24} y1={0} x2={-24} y2={top} stroke="#57534e" strokeWidth={1.5} />
      <text x={-30} y={top / 2} fontSize={fs} textAnchor="end" fill="#57534e" fontFamily="ui-monospace, monospace" transform={`rotate(-90 ${-30} ${top / 2})`}>
        {cm(top)}
      </text>
      <line x1={0} y1={-24} x2={boxW} y2={-24} stroke="#57534e" strokeWidth={1.5} />
      <text x={boxW / 2} y={-32} fontSize={fs} textAnchor="middle" fill="#57534e" fontFamily="ui-monospace, monospace">
        {cm(boxW)}
      </text>
      <text x={boxW + 12} y={boxH / 2} fontSize={fs} fill="#57534e" fontFamily="ui-monospace, monospace">
        {cm(boxH)}
      </text>
      {/* Where each piece starts, along the bottom of the sunglasses. */}
      {plan.parts.map((p) => (
        <text key={p.id} x={p.x0 + 4} y={top + plan.height + 26} fontSize={16} fill="#57534e" fontFamily="ui-monospace, monospace">
          {cm(p.x0)}
        </text>
      ))}
    </svg>
  );
}

function openSide(slit: Rect, w: number) {
  if (slit.x <= 0) return ", open on the left edge";
  if (slit.x + slit.w >= w) return ", open on the right edge";
  return "";
}

function plural(n: number, word: string) {
  return n === 1 ? word : `${word}s`;
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-medium">
        <span className="mr-2 text-stone-400">{n}.</span>
        {title}
      </p>
      <div className="mt-1 pl-5 text-stone-600">{children}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.08em] text-stone-400">{label}</p>
      <p className="mt-1 font-mono text-sm">{value} cm</p>
    </div>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (mm: number) => void }) {
  return (
    <input
      type="number"
      min={1}
      step={0.5}
      value={value / 10}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (v > 0) onChange(Math.round(v * 10));
      }}
      className="w-16 rounded-md border border-stone-200 px-2 py-0.5 text-sm outline-none focus:border-stone-500"
    />
  );
}
