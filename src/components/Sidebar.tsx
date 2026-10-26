"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BOARDS, MAX_SHEET_MM, blankStats, type Layout } from "@/lib/box";
import { CLAWD_INK, CLAWD_ORANGE } from "@/lib/clawd";
import { ANCHORS, FACES, FACE_IDS } from "@/lib/faces";
import { exportArtwork, exportDXF, exportSVG } from "@/lib/export";
import { totalAreaM2, type Piece } from "@/lib/pieces";
import { CRAFTER_URL, useBox } from "@/lib/store";

const FILE_NAME = "crafter-clawd";

export default function Sidebar({ layout, pieces }: { layout: Layout; pieces: Piece[] }) {
  const { params, costume, setParams, setCostume } = useBox();
  const stats = blankStats(layout);
  const oversize = pieces.some((p) => {
    const b = blankStats(p.dieline);
    return Math.max(b.width, b.height) > MAX_SHEET_MM;
  });

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-stone-200 bg-white md:w-[340px] md:border-r">
      <header className="flex items-center gap-3 border-b border-stone-200 px-5 py-4">
        <ClawdIcon className="size-10 shrink-0" />
        <div className="leading-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/crafter-station-wordmark.svg" alt="Crafter Station" className="h-5 w-auto" />
          <p className="mt-1.5 text-xs text-stone-500">Clawd costume kit · cardboard</p>
        </div>
      </header>

      <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
        <p className="text-xs leading-relaxed text-stone-600">
          A wearable Clawd sized to you. Worn head to hips, open at the bottom; you see out through a slit on the eye
          line (back it with mesh). Clawd&apos;s legs hang in a row at the front; you walk behind them, and your arms push out through doors in the sides.
          Slots in the top let you breathe.
        </p>

        <Section title="Wearer">
          <Range
            label="Height"
            value={costume.wearer}
            min={1400}
            max={2000}
            step={10}
            display={`${(costume.wearer / 10).toFixed(0)} cm`}
            onChange={(wearer) => setCostume({ wearer })}
          />
          <label className="flex cursor-pointer items-center justify-between text-[13px] text-stone-600">
            Show the person
            <input
              type="checkbox"
              checked={costume.showWearer}
              onChange={(e) => setCostume({ showWearer: e.target.checked })}
              className="size-4 accent-stone-900"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-between text-[13px] text-stone-600">
            X-ray: see how you fit inside
            <input
              type="checkbox"
              checked={costume.xray}
              onChange={(e) => setCostume({ xray: e.target.checked })}
              className="size-4 accent-stone-900"
            />
          </label>
        </Section>

        <Section title="Face" hint="swappable, magnetic">
          <div className="grid grid-cols-2 gap-1.5">
            {FACE_IDS.map((id) => (
              <button
                key={id}
                onClick={() => setCostume({ face: id })}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 transition ${
                  costume.face === id ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-200 hover:border-stone-400"
                }`}
              >
                <FacePreview grid={FACES[id].grid} />
                <span className="text-[12px] text-stone-700">{FACES[id].label}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-stone-500">
            Each face is its own relief piece (black foamy 5–10 mm or doubled board) held by 2 magnets. Every eye covers
            the same 2 magnet spots (marked on the front), so one pair in the body fits all faces. All {FACE_IDS.length}{" "}
            faces are in the cut file.
          </p>
          <Link href="/glasses" className="block text-[13px] font-medium text-stone-900 underline underline-offset-4">
            Sunglasses build sheet, cut by hand →
          </Link>
        </Section>

        <Section title="Branding">
          <label className="flex cursor-pointer items-center justify-between text-[13px] text-stone-600">
            Show Crafter Station branding
            <input
              type="checkbox"
              checked={costume.branding}
              onChange={(e) => setCostume({ branding: e.target.checked })}
              className="size-4 accent-stone-900"
            />
          </label>
          <p className="text-[11px] leading-relaxed text-stone-500">
            {costume.branding
              ? "Wordmark on the chest and back, the flag logo, and a QR to " + CRAFTER_URL.replace("https://", "") + " on the back."
              : "Plain Clawd: no wordmarks, no QR, no flag logo."}
          </p>
        </Section>

        <Section title="Flag" hint={costume.branding ? "under the Crafter Station wordmark" : undefined}>
          <input
            value={costume.flagText}
            onChange={(e) => setCostume({ flagText: e.target.value })}
            placeholder="You're absolutely right!"
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
        </Section>

        {costume.branding && (
          <Section title="Back" hint="scan me">
            <p className="text-[13px] text-stone-600">
              QR code to <span className="font-medium text-stone-900">{CRAFTER_URL.replace("https://", "")}</span>, printed
              on a light patch so it scans from across the room.
            </p>
          </Section>
        )}

        <Section title="Body" hint="panel size, mm">
          <Dimension label="Length" value={params.length} min={400} max={1400} onChange={(length) => setParams({ length })} />
          <Dimension label="Width" value={params.width} min={200} max={800} onChange={(width) => setParams({ width })} />
          <Dimension label="Height" value={params.height} min={400} max={1200} onChange={(height) => setParams({ height })} />
        </Section>

        <Section title="Board">
          <div className="grid grid-cols-2 gap-1.5">
            {BOARDS.map((b) => (
              <button
                key={b.id}
                onClick={() => setParams({ thickness: b.thickness })}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  params.thickness === b.thickness
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200 hover:border-stone-400"
                }`}
              >
                <div className="text-[13px] font-medium">{b.label}</div>
                <div className={`text-[11px] ${params.thickness === b.thickness ? "text-stone-300" : "text-stone-500"}`}>
                  {b.thickness} mm · {b.note}
                </div>
              </button>
            ))}
          </div>
        </Section>
      </div>

      <footer className="space-y-3 border-t border-stone-200 bg-stone-50 px-5 py-4">
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-stone-500">Body blank</dt>
            <dd className="font-mono text-stone-900">
              {Math.round(stats.width)} × {Math.round(stats.height)} mm
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Board, all {pieces.reduce((n, p) => n + p.qty, 0)} pieces</dt>
            <dd className="font-mono text-stone-900">{totalAreaM2(pieces).toFixed(2)} m²</dd>
          </div>
        </dl>
        {oversize && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
            Bigger than a standard sheet (~{MAX_SHEET_MM / 1000} m). Cut the body in two at a corner crease and tape
            the seam inside.
          </p>
        )}
        <p className="text-[11px] leading-relaxed text-stone-500">
          Also need: a {Math.round(costume.wearer * 0.55)} mm dowel for the flag, orange mesh for the eye slit (black
          on the sunglasses), {ANCHORS.length * (FACE_IDS.length + 1)} neodymium disc magnets (15–20 mm; mind the
          polarity), duct tape for the leg hinges, and shoulder straps.
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          <ExportButton onClick={() => exportSVG(pieces, FILE_NAME)}>SVG</ExportButton>
          <ExportButton onClick={() => exportDXF(pieces, FILE_NAME)}>DXF</ExportButton>
          <ExportButton onClick={() => exportArtwork(pieces, FILE_NAME)}>Print PNG</ExportButton>
        </div>
        <p className="text-center text-[11px] text-stone-400">Made with 💛 by Cris</p>
      </footer>
    </aside>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
        {title}
        {hint && <span className="font-normal normal-case tracking-normal text-stone-400">{hint}</span>}
      </h2>
      {children}
    </section>
  );
}

function Dimension({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-stone-600">{label}</span>
        <div className="flex items-center gap-1 rounded-md border border-stone-200 px-2 py-0.5 focus-within:border-stone-500">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) onChange(Math.min(max, v));
            }}
            className="w-12 bg-transparent text-right font-mono text-[13px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-[11px] text-stone-400">mm</span>
        </div>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-stone-900" />
    </div>
  );
}

function Range({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-stone-600">{label}</span>
        <span className="font-mono text-stone-900">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-stone-900" />
    </div>
  );
}

function ExportButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-xs font-medium text-stone-800 transition hover:border-stone-900 hover:bg-stone-900 hover:text-white"
    >
      {children}
    </button>
  );
}

/** Clawd in pixels: orange body, sunglasses, stubby arms, four legs. */
function ClawdIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 14" className={className} shapeRendering="crispEdges" aria-hidden>
      <rect x="3" y="1" width="10" height="8" fill={CLAWD_ORANGE} />
      <rect x="1" y="4" width="2" height="2.5" fill={CLAWD_ORANGE} />
      <rect x="13" y="4" width="2" height="2.5" fill={CLAWD_ORANGE} />
      {[3.6, 6.2, 8.8, 11.4].map((x) => (
        <rect key={x} x={x} y="9" width="1.2" height="3" fill={CLAWD_ORANGE} />
      ))}
      <rect x="3" y="3" width="10" height="0.8" fill={CLAWD_INK} />
      <rect x="3.4" y="3.6" width="4" height="1.4" fill={CLAWD_INK} />
      <rect x="8.6" y="3.6" width="4" height="1.4" fill={CLAWD_INK} />
      <rect x="4.2" y="3.8" width="0.6" height="0.6" fill="#fff" />
      <rect x="9.4" y="3.8" width="0.6" height="0.6" fill="#fff" />
    </svg>
  );
}

/** A face's pixel grid as a tiny orange swatch. */
function FacePreview({ grid }: { grid: string[] }) {
  const cols = grid[0].length;
  return (
    <svg viewBox={`-1 -2 ${cols + 2} ${grid.length + 4}`} className="h-8 w-full" shapeRendering="crispEdges" aria-hidden>
      <rect x={-1} y={-2} width={cols + 2} height={grid.length + 4} fill={CLAWD_ORANGE} rx={1} />
      {grid.flatMap((row, r) =>
        [...row].map((ch, c) =>
          ch === "." ? null : <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={ch === "o" ? "#f5f2ec" : CLAWD_INK} />,
        ),
      )}
    </svg>
  );
}
