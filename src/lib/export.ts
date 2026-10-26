import type { IModel } from "makerjs";
import type { Dieline } from "./box";
import { arrange, type Piece } from "./pieces";

// Production files. Layer names follow the usual die-making convention:
// red = cut, blue = crease. Most CAM tools (ArtiosCAD, Kongsberg, laser
// software) map these straight to tools. Every copy of every piece is laid
// out on one sheet.

async function sheetModel(pieces: Piece[]): Promise<[typeof import("makerjs"), IModel]> {
  const makerjs = (await import("makerjs")).default;
  const models: Record<string, IModel> = {};
  for (const { piece, copy, dx, dy } of arrange(pieces, true).placed) {
    models[`${piece.id}-${copy + 1}`] = { origin: [dx, dy], models: dielineModel(makerjs, piece.dieline) };
  }
  return [makerjs, { units: makerjs.unitType.Millimeter, models }];
}

function dielineModel(makerjs: typeof import("makerjs"), d: Dieline): Record<string, IModel> {
  const cutModels: Record<string, IModel> = { outline: new makerjs.models.ConnectTheDots(true, d.cut) };
  d.holes.forEach((hole, i) => (cutModels[`hole-${i}`] = new makerjs.models.ConnectTheDots(true, hole)));
  const crease: IModel = { layer: "blue", paths: {} };
  d.creases.forEach(([a, b], i) => (crease.paths![`crease-${i}`] = new makerjs.paths.Line(a, b)));
  return { cut: { layer: "red", models: cutModels }, crease };
}

export async function exportSVG(pieces: Piece[], name: string) {
  const [makerjs, model] = await sheetModel(pieces);
  const svg = makerjs.exporter.toSVG(model, { units: makerjs.unitType.Millimeter, strokeWidth: "0.25mm" });
  download(new Blob([svg], { type: "image/svg+xml" }), `${name}-dieline.svg`);
}

export async function exportDXF(pieces: Piece[], name: string) {
  const [makerjs, model] = await sheetModel(pieces);
  const dxf = makerjs.exporter.toDXF(model, { units: makerjs.unitType.Millimeter });
  download(new Blob([dxf], { type: "application/dxf" }), `${name}-dieline.dxf`);
}

/** All artwork composed on one sheet, matching the dieline layout. */
export function exportArtwork(pieces: Piece[], name: string) {
  const { placed, bounds } = arrange(pieces, true);
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  const k = Math.min(4, 8192 / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * k);
  canvas.height = Math.ceil(h * k);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const { piece, dx, dy } of placed) {
    const b = piece.dieline.bounds;
    ctx.drawImage(
      piece.art,
      (b.minX + dx - bounds.minX) * k,
      (bounds.maxY - (b.maxY + dy)) * k,
      (b.maxX - b.minX) * k,
      (b.maxY - b.minY) * k,
    );
  }
  canvas.toBlob((blob) => blob && download(blob, `${name}-print.png`), "image/png");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
