"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { buildLayout, flagDieline } from "@/lib/box";
import { drawArtwork, drawFacePiece, drawFlag, drawShine } from "@/lib/artwork";
import { clawdSpec } from "@/lib/clawd";
import { FACES, FACE_IDS, facePiece, shineDieline } from "@/lib/faces";
import type { Piece } from "@/lib/pieces";
import { CRAFTER_URL, useBox } from "@/lib/store";
import BoxScene, { type CostumeScene } from "./BoxScene";
import DielineView from "./DielineView";
import Sidebar from "./Sidebar";

function useImage(src: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) return;
    const el = new Image();
    el.onload = () => setImg(el);
    el.src = src;
  }, [src]);
  return src ? img : null;
}

export default function Designer() {
  const params = useBox((s) => s.params);
  const design = useBox((s) => s.design);
  const { wearer, flagText, branding, showWearer, xray, face } = useBox((s) => s.costume);
  const setCostume = useBox((s) => s.setCostume);

  const spec = useMemo(() => clawdSpec(wearer, params), [wearer, params]);
  const layout = useMemo(() => buildLayout(params, spec.bodyOptions), [params, spec]);
  const loaded = useImage(design.logo);
  const logo = branding ? loaded : null;
  const art = useMemo(
    () => drawArtwork(layout, design, logo, { faceGrid: spec.faceGrid, qr: branding ? CRAFTER_URL : undefined }),
    [layout, design, logo, spec, branding],
  );

  // Limbs share the body's board and print, without the face or back art.
  const parts = useMemo(() => {
    const arm = buildLayout(spec.arm.params, spec.armOptions);
    const leg = buildLayout(spec.leg.params, spec.legOptions);
    const flag = flagDieline(spec.flag.w, spec.flag.h);
    return {
      arm,
      armArt: drawArtwork(arm, design, null),
      leg,
      legArt: drawArtwork(leg, design, null),
      flag,
      flagArt: drawFlag(flag, flagText, logo),
    };
  }, [spec, design, flagText, logo]);

  // Every face goes in the cut file so they can be swapped; the preview wears one.
  const faces = useMemo(
    () =>
      FACE_IDS.map((id) => {
        const piece = facePiece(id, spec, params.height);
        return { piece, art: drawFacePiece(piece) };
      }),
    [spec, params.height],
  );
  const shine = useMemo(() => {
    const dieline = shineDieline(spec.faceGrid.px * 0.86);
    const qty = faces.reduce((n, f) => n + f.piece.whites.length, 0);
    return { dieline, art: drawShine(dieline), qty };
  }, [spec, faces]);

  const current = faces.find((f) => f.piece.id === face)!.piece;
  const scene = useMemo<CostumeScene>(
    () => ({ spec, ...parts, showWearer, xray, face: current }),
    [spec, parts, showWearer, xray, current],
  );

  const pieces = useMemo<Piece[]>(
    () => [
      { id: "body", label: "Body", qty: 1, dieline: layout, art },
      { id: "arm", label: "Arm", qty: 2, dieline: parts.arm, art: parts.armArt },
      { id: "leg", label: "Leg", qty: 4, dieline: parts.leg, art: parts.legArt },
      { id: "flag", label: "Flag", qty: 1, dieline: parts.flag, art: parts.flagArt },
      ...faces.map(({ piece, art }) => ({
        id: `face-${piece.id}`,
        label: `Face · ${FACES[piece.id].label}`,
        qty: 1,
        dieline: piece.dieline,
        art,
      })),
      ...(shine.qty ? [{ id: "shine", label: "Shine (white)", qty: shine.qty, dieline: shine.dieline, art: shine.art }] : []),
    ],
    [layout, art, parts, faces, shine],
  );
  const [showDieline, setShowDieline] = useState(true);

  return (
    <div className="flex h-dvh w-full flex-col-reverse bg-stone-100 md:flex-row">
      <div className="h-[46dvh] shrink-0 md:h-full md:w-auto">
        <Sidebar layout={layout} pieces={pieces} />
      </div>

      <main className="relative flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1 bg-[radial-gradient(ellipse_at_50%_35%,#ffffff_0%,#f1efeb_55%,#e4e0d9_100%)]">
          <BoxScene layout={layout} art={art} board={design.board} thickness={params.thickness} costume={scene} />
          <FoldControl />
          <div className="absolute right-4 top-4 flex gap-1.5">
            <Toggle on={showWearer} onClick={() => setCostume({ showWearer: !showWearer })}>
              Person
            </Toggle>
            <Toggle on={xray} onClick={() => setCostume({ xray: !xray })}>
              X-ray
            </Toggle>
            <button
              onClick={snapshot}
              className="rounded-full border border-stone-300 bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-700 backdrop-blur hover:bg-white"
            >
              Snapshot
            </button>
          </div>
        </div>

        <div
          className={`relative shrink-0 border-t border-stone-200 bg-white transition-[height] duration-300 ${
            showDieline ? "h-[34%]" : "h-10"
          }`}
        >
          <div className="absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-between px-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="font-semibold uppercase tracking-[0.08em] text-stone-500">Dieline</span>
              {showDieline && (
                <>
                  <Legend color="#dc2626" label="Cut" />
                  <Legend color="#2563eb" label="Crease" dashed />
                </>
              )}
            </div>
            <button onClick={() => setShowDieline((v) => !v)} className="text-xs text-stone-500 hover:text-stone-900">
              {showDieline ? "Hide" : "Show"}
            </button>
          </div>
          {showDieline && (
            <div className="absolute inset-0 top-10 p-3">
              <DielineView layout={layout} pieces={pieces} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FoldControl() {
  const fold = useBox((s) => s.fold);
  const playing = useBox((s) => s.playing);
  const setFold = useBox((s) => s.setFold);
  const playFold = useBox((s) => s.playFold);

  return (
    <div className="absolute bottom-5 left-1/2 flex w-[min(420px,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-full border border-stone-200 bg-white/85 py-2 pl-2 pr-5 shadow-lg shadow-stone-900/5 backdrop-blur">
      <button
        onClick={playFold}
        disabled={playing}
        className="shrink-0 rounded-full bg-stone-900 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-stone-700 disabled:opacity-60"
      >
        {fold > 0.5 ? "Unfold" : "Fold"}
      </button>
      <span className="text-[11px] text-stone-400">Flat</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={fold}
        onChange={(e) => setFold(Number(e.target.value))}
        className="w-full accent-stone-900"
        aria-label="Fold"
      />
      <span className="text-[11px] text-stone-400">Box</span>
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur ${
        on ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white/80 text-stone-700 hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-stone-500">
      <svg width="18" height="4">
        <line x1="0" y1="2" x2="18" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dashed ? "4 3" : undefined} />
      </svg>
      {label}
    </span>
  );
}

function snapshot() {
  const canvas = document.querySelector<HTMLCanvasElement>("#box-scene canvas");
  if (!canvas) return;
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "crafter-clawd.png";
  a.click();
}
