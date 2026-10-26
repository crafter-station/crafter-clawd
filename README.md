# Crafter Station · Clawd costume

Build a wearable cardboard Clawd, sized to you, flying a **Just Ship It** flag. Design it in 3D,
then export cut-ready dielines (SVG/DXF) and print artwork (PNG).

Open source by [Crafter Station](https://crafter.run). MIT licensed — fork it, rebrand it, wear it.

**Stack:** Next.js 16 (App Router) · React Three Fiber + drei · Maker.js · Zustand · Tailwind v4

```bash
pnpm install
pnpm dev
```

## How it works

One parametric model drives everything, in `src/lib/box.ts`:

```
BoxParams (L, W, H, board) ──► buildLayout()
                                 ├─ cut / crease paths ──► Dieline view + SVG/DXF export (Maker.js)
                                 ├─ face rectangles     ──► print-sheet artwork (canvas)
                                 └─ part tree (hinges)  ──► 3D folding (R3F)
```

- **Folding:** each panel is a `<group>` whose origin is on its fold line, nested in hinge
  order (front → right → back → left → glue tab, plus flaps per wall). Global `fold` 0→1 is
  split into phases (walls, bottom minor/major, top minor/major), so it folds like a real box.
- **Artwork:** a single canvas covers the whole flat blank. The 3D panels sample it through
  UVs and the dieline view shows it directly, so the flat print and the folded box always match.
- **Exports:** SVG and DXF with `red` = cut and `blue` = crease layers, plus a print PNG of
  the artwork at 4 px/mm.

| File | What |
|---|---|
| `src/lib/box.ts` | FEFCO 0201 geometry: layout, part tree, cut/crease paths |
| `src/lib/artwork.ts` | Board texture + print-sheet rendering |
| `src/lib/export.ts` | Maker.js SVG/DXF export |
| `src/components/BoxScene.tsx` | R3F scene, folding, auto-framing camera |
| `src/components/DielineView.tsx` | Flat dieline with dimensions |
| `src/components/Sidebar.tsx` | Controls |

## Clawd costume

"Build a Clawd costume" in the sidebar sizes a wearable Clawd from the wearer's height
(`src/lib/clawd.ts`, using standard body-proportion ratios):

- **Body:** RSC with an open bottom, worn from just above the head to the hips. A viewing slit
  is cut in the sunglasses band at eye height (back it with black mesh).
- **Legs ×4:** shallow closed boxes hung in a row under the front edge with a duct-tape hinge.
  The bottom of the body is open and the wearer walks behind them; a knee that bumps a leg just
  swings it forward.
- **Arms ×2:** closed boxes on the side walls at shoulder height. Below each one, a door rises
  from the hem of the side wall (slit up both sides, creased across the top) so the wearer's real
  arms can push out sideways and forward; it falls shut when they drop.
- **Vents:** a row of slots in the front and back top flaps, over the head, for airflow.
- **Flag:** one strip folded over a dowel, printed on both sides: "Just Ship It" under the Crafter Station wordmark (editable in the sidebar).
- Crafter Station wordmark on the chest and back, plus a QR to crafter.run. Toggle branding off
  for a plain Clawd.

SVG/DXF/PNG exports contain every copy of every piece. The body blank is wider than standard
sheet stock, so cut it in two at a corner crease and tape the seam.

Also needed: dowel (~0.55 × wearer height), black mesh for the slit, shoulder straps.

## Not production-accurate yet

- No board-thickness allowances: panels equal the entered L/W/H. Real dielines add
  allowances per crease, depending on the flute, to hit internal dimensions.
- No bleed or safe zone on the print sheet.
- Only FEFCO 0201. Next: 0427 mailer, tuck-end cartons.

## Contributing

PRs welcome. Keep geometry in `src/lib`, keep it parametric, and check the exports still cut.

## Ideas for next steps

- More styles (each one is just another `buildLayout`)
- Drag-and-place artwork directly on the 3D box (raycast → sheet UV)
- PDF export with print marks
- Save/share designs (Postgres) and quoting from `blankStats()`

## License

[MIT](LICENSE) © Crafter Station. Clawd is Anthropic's mascot; this is a fan-made costume kit.
