"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { phaseProgress, rectPoly, type Bounds, type Layout, type Part, type Vec2, type Wall } from "@/lib/box";
import { BOARD_COLORS, boardTile } from "@/lib/artwork";
import { CLAWD_INK, type ClawdSpec } from "@/lib/clawd";
import { SHINE } from "@/lib/artwork";
import type { FacePiece } from "@/lib/faces";
import { useBox, type Board } from "@/lib/store";

/** Scene units per millimetre (1 unit = 10 cm). */
const S = 0.01;
const FOV = 32;
const TILE_MM = 128;

export type CostumeScene = {
  spec: ClawdSpec;
  arm: Layout;
  armArt: HTMLCanvasElement;
  leg: Layout;
  legArt: HTMLCanvasElement;
  flagArt: HTMLCanvasElement;
  showWearer: boolean;
  xray: boolean;
  face: FacePiece;
};

type Props = {
  layout: Layout;
  art: HTMLCanvasElement;
  board: Board;
  thickness: number;
  costume: CostumeScene | null;
};

/** 0 → 1 as the costume's limbs come out once the body is fully folded. */
type Anim = () => number;

const storeFold = () => useBox.getState().fold;

/** How far each side door is pushed open (0–1), driven by the wearer's arms. */
const doorOpen: Partial<Record<Wall, number>> = {};
const DOOR_ANGLE = 1.2;
const folded = () => 1;

export default function BoxScene(props: Props) {
  return (
    <Canvas
      id="box-scene"
      dpr={[1, 2]}
      camera={{ position: [4.2, 3.2, 6.4], fov: FOV, near: 0.05, far: 400 }}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 8, 6]} intensity={1.6} />
      <directionalLight position={[-6, 3, -4]} intensity={0.35} />
      {/* Built from lightformers so nothing is fetched at runtime. */}
      <Environment resolution={256} environmentIntensity={0.6}>
        <Lightformer form="rect" intensity={3} position={[0, 6, 2]} scale={[10, 4, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.5} position={[-6, 2, 3]} scale={[4, 6, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={1} position={[6, 2, -3]} scale={[4, 6, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="ring" color="#fff4e6" intensity={2} position={[3, 4, 6]} scale={3} />
      </Environment>
      <Box {...props} />
      <ContactShadows position={[0, 0, 0]} scale={40} resolution={1024} blur={2.6} opacity={0.5} far={12} />
      <OrbitControls makeDefault enableDamping minDistance={1} maxDistance={150} maxPolarAngle={Math.PI / 2 - 0.04} />
    </Canvas>
  );
}

function Box({ layout, art, board, thickness, costume }: Props) {
  const root = useRef<THREE.Group>(null);
  const appear = useRef(0);
  const anim = useCallback(() => appear.current, []);
  const materials = useBoardMaterials(art, board);
  const { minX, maxX, minY } = layout.bounds;
  const L = layout.faces.front.w;
  const W = layout.faces.right.w;
  const H = layout.faces.front.h;

  useFrame((_, delta) => {
    const fold = useBox.getState().fold;
    const target = costume && fold > 0.999 ? 1 : 0;
    appear.current += (target - appear.current) * (1 - Math.exp(-Math.min(delta, 0.1) * 3.2));
    if (Math.abs(target - appear.current) < 1e-4) appear.current = target;

    // Keep the blank centred and resting on the floor as it folds up; a
    // costume then rises to where the wearer carries it.
    const walls = phaseProgress(fold, [0, 0.4]);
    const bottom = phaseProgress(fold, [0.4, 0.68]);
    const lift = costume ? (costume.spec.topFromFloor - H) * ease(appear.current) : 0;
    root.current?.position.set(
      THREE.MathUtils.lerp(-(minX + maxX) / 2, -L / 2, walls) * S,
      (THREE.MathUtils.lerp(-minY, thickness, bottom) + lift) * S,
      THREE.MathUtils.lerp(0, W / 2, walls) * S,
    );
  });

  return (
    <group ref={root} scale={S}>
      <PartNode part={layout.root} parentPivot={[0, 0]} layout={layout} materials={materials} thickness={thickness} getFold={storeFold} />
      {costume && <CostumeParts costume={costume} body={{ L, W, H }} board={board} thickness={thickness} anim={anim} />}
      <CameraRig layout={layout} thickness={thickness} costume={costume} anim={anim} />
    </group>
  );
}

const ease = (t: number) => t * t * (3 - 2 * t);
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

/** Arms, legs, flag and (optionally) the wearer — positioned in the folded body's frame. */
function CostumeParts({
  costume,
  body,
  board,
  thickness,
  anim,
}: {
  costume: CostumeScene;
  body: { L: number; W: number; H: number };
  board: Board;
  thickness: number;
  anim: Anim;
}) {
  const { spec, arm, armArt, leg, legArt, flagArt, showWearer, xray, face } = costume;
  const { L, W, H } = body;
  const rightArm = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const flag = useRef<THREE.Group>(null);
  const wearer = useRef<THREE.Group>(null);

  const armP = spec.arm.params;
  const armY = H - spec.arm.centerFromTop;
  const legP = spec.leg.params;
  const lift = spec.topFromFloor - H;

  useFrame(() => {
    const a = anim();
    const visible = a > 0.001;
    const grow = Math.max(easeOutBack(a), 0.001);
    for (const g of [rightArm.current, leftArm.current]) {
      if (!g) continue;
      g.visible = visible;
      g.scale.set(1, grow, 1);
    }
    legs.current.forEach((g) => {
      if (!g) return;
      g.visible = visible;
      g.scale.set(1, Math.max(ease(a), 0.001), 1);
    });
    if (flag.current) {
      flag.current.visible = a > 0.5;
      flag.current.scale.setScalar(Math.max(easeOutBack(clamp((a - 0.5) * 2)), 0.001));
    }
    if (wearer.current) {
      wearer.current.visible = showWearer && a > 0.98;
    }
  });

  const flagBase: [number, number, number] = [
    L + armP.height * 0.55,
    armY + armP.length * 0.2,
    -W / 2 + armP.width / 2 + spec.flag.radius + 2,
  ];

  return (
    <>
      {/* Arms: closed boxes on each side wall, length pointing outward. */}
      <group position={[L, armY, -W / 2]}>
        <group ref={rightArm} rotation-z={-Math.PI / 2}>
          <group position={[-armP.length / 2, 0, armP.width / 2]}>
            <FoldedPiece layout={arm} art={armArt} board={board} thickness={thickness} />
          </group>
        </group>
      </group>
      <group position={[0, armY, -W / 2]}>
        <group ref={leftArm} rotation-z={Math.PI / 2}>
          <group position={[-armP.length / 2, 0, armP.width / 2]}>
            <FoldedPiece layout={arm} art={armArt} board={board} thickness={thickness} />
          </group>
        </group>
      </group>

      {/* Legs: a row of shallow boxes hung under the front edge; the wearer walks behind them. */}
      {spec.leg.xs.map((x, i) => (
        <group key={i} ref={(g) => void (legs.current[i] = g)} position={[x, 0, -thickness]}>
          <group position={[-legP.length / 2, -legP.height, 0]}>
            <FoldedPiece layout={leg} art={legArt} board={board} thickness={thickness} />
          </group>
        </group>
      ))}

      <FaceRelief key={face.id} face={face} />

      {/* Mesh behind the eye slit: you see out, nobody sees in. Body-coloured,
          unless the face covers the slit (the sunglasses), which brings its own black. */}
      <mesh position={[spec.slit.x + spec.slit.w / 2, spec.slit.y + spec.slit.h / 2, -thickness - 1]}>
        <planeGeometry args={[spec.slit.w + 60, spec.slit.h + 60]} />
        <meshStandardMaterial
          color={face.slit ? "#0c0c0c" : MESH_ORANGE}
          roughness={1}
          side={THREE.DoubleSide}
          transparent={xray}
          opacity={xray ? 0.3 : 1}
        />
      </mesh>

      <group ref={flag} position={flagBase}>
        <Flag spec={spec} art={flagArt} thickness={thickness} />
      </group>

      <group ref={wearer}>
        <Wearer
          spec={spec}
          x={L / 2}
          hips={[L / 2 - spec.hipHalf, L / 2 + spec.hipHalf]}
          z={spec.wearerZ}
          lift={lift}
          swing={xray && showWearer}
        />
      </group>

    </>
  );
}

/** Foamy / doubled board, plus the gap the magnets leave. */
const RELIEF = 6;
/** Orange tulle seen through the slit reads a shade darker than the board. */
const MESH_ORANGE = "#c9560f";
const MAGNET_GAP = 3;
const SHINE_DEPTH = 2;

/** The swappable face, raised off the front. Pops in whenever it changes. */
function FaceRelief({ face }: { face: FacePiece }) {
  const ref = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  const geometry = useMemo(() => {
    const shapes = face.loops.map((loop) => {
      const shape = new THREE.Shape(loop.map(([x, y]) => new THREE.Vector2(x, y)));
      const s = face.slit;
      if (s) {
        const [sx, sy] = s[0];
        const xs = loop.map((p) => p[0]);
        const ys = loop.map((p) => p[1]);
        if (sx > Math.min(...xs) && sx < Math.max(...xs) && sy > Math.min(...ys) && sy < Math.max(...ys))
          shape.holes.push(new THREE.Path(s.map(([x, y]) => new THREE.Vector2(x, y))));
      }
      return shape;
    });
    return new THREE.ExtrudeGeometry(shapes, { depth: RELIEF, bevelEnabled: false });
  }, [face]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    if (!ref.current) return;
    born.current ??= state.clock.elapsedTime;
    const t = clamp((state.clock.elapsedTime - born.current) / 0.55);
    const e = 1 - (1 - t) ** 3;
    ref.current.position.z = MAGNET_GAP + (1 - e) * 160;
    ref.current.rotation.x = (1 - e) * -0.35;
  });

  const inner = face.px * 0.86;
  return (
    <group ref={ref} position-z={MAGNET_GAP}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={CLAWD_INK} roughness={0.75} />
      </mesh>
      {face.whites.map(([x, y], i) => (
        <mesh key={i} position={[x + face.px / 2, y + face.px / 2, RELIEF + SHINE_DEPTH / 2]}>
          <boxGeometry args={[inner, inner, SHINE_DEPTH]} />
          <meshStandardMaterial color={SHINE} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Flag({ spec, art, thickness }: { spec: ClawdSpec; art: HTMLCanvasElement; thickness: number }) {
  const { w, h, pole, angle, radius } = spec.flag;
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(w, h, thickness * 2);
    const uv = g.getAttribute("uv");
    // Front (+z) shows the right half of the strip, back (-z) the left half;
    // the crease between them wraps the pole.
    for (let i = 16; i < 24; i++) uv.setX(i, i < 20 ? 0.5 + uv.getX(i) * 0.5 : uv.getX(i) * 0.5);
    uv.needsUpdate = true;
    return g;
  }, [w, h, thickness]);
  const materials = useMemo(() => {
    const map = new THREE.CanvasTexture(art);
    map.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.MeshStandardMaterial({ map, roughness: 0.7, alphaTest: 0.5 });
    const edge = new THREE.MeshStandardMaterial({ color: CLAWD_INK, roughness: 0.8 });
    return [edge, edge, edge, edge, face, face];
  }, [art]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => materials.forEach((m) => ("map" in m && (m.map as THREE.Texture | null)?.dispose(), m.dispose())), [materials]);

  return (
    <group rotation-z={-angle}>
      <mesh position={[0, pole * 0.44, 0]}>
        <cylinderGeometry args={[radius, radius, pole * 1.12, 16]} />
        <meshStandardMaterial color="#1f1b18" roughness={0.6} />
      </mesh>
      <mesh geometry={geometry} material={materials} position={[w / 2 + radius, pole - h / 2, 0]} />
    </group>
  );
}

/**
 * The wearer, built from standard body proportions (fractions of stature).
 * Their arms hang inside the body with the hands out under the hem; the
 * cardboard arms are fixed to the side walls.
 */
function Wearer({
  spec,
  x,
  hips,
  z,
  lift,
  swing,
}: {
  spec: ClawdSpec;
  x: number;
  hips: number[];
  z: number;
  lift: number;
  /** Lift the arms out through the side openings and back, on a loop. */
  swing: boolean;
}) {
  const h = spec.wearer;
  const arms = useRef<(THREE.Group | null)[]>([]);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    arms.current.forEach((g, i) => {
      if (!g) return;
      const side = i === 0 ? 1 : -1;
      const out = swing ? (0.5 - 0.5 * Math.cos(t * 1.4 + i * Math.PI * 0.35)) ** 1.5 : 0;
      g.rotation.z = side * (RELAXED + out * (RAISED - RELAXED));
      // The door on that side gets pushed open ahead of the arm.
      doorOpen[side > 0 ? "right" : "left"] = Math.min(1, out * 1.3);
    });
  });
  /** Height above the floor (as a fraction of stature) → body-frame y. */
  const y = (f: number) => f * h - lift;
  const shoeH = h * 0.045;
  const torsoR = h * 0.085;
  const torsoTop = 0.815;
  const torsoBottom = 0.52;
  const upper = h * 0.18;
  const fore = h * 0.15;
  return (
    <group position={[x, 0, z]}>
      {/* Head and neck */}
      <mesh position={[0, y(0.935), 0]} scale={[1, 1.25, 1.1]}>
        <sphereGeometry args={[h * 0.05, 24, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      <mesh position={[0, y(0.855), 0]}>
        <cylinderGeometry args={[h * 0.022, h * 0.025, h * 0.06, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      {/* Torso */}
      <mesh position={[0, y((torsoTop + torsoBottom) / 2), 0]} scale={[1, 1, 0.62]}>
        <capsuleGeometry args={[torsoR, (torsoTop - torsoBottom) * h - torsoR * 2, 8, 24]} />
        <meshStandardMaterial color={SHIRT} roughness={0.85} />
      </mesh>
      {/* Arms, relaxed: a little out to the side, forearms a little forward. */}
      {[1, -1].map((side) => (
        <group
          key={side}
          ref={(g) => void (arms.current[side > 0 ? 0 : 1] = g)}
          position={[side * h * 0.112, y(0.805), 0]}
          rotation-z={side * RELAXED}
        >
          <mesh position={[0, -upper / 2, 0]}>
            <capsuleGeometry args={[h * 0.024, upper - h * 0.03, 6, 16]} />
            <meshStandardMaterial color={SHIRT} roughness={0.85} />
          </mesh>
          <group position={[0, -upper, 0]} rotation-x={-0.4}>
            <mesh position={[0, -fore / 2, 0]}>
              <capsuleGeometry args={[h * 0.019, fore - h * 0.02, 6, 16]} />
              <meshStandardMaterial color={SKIN} roughness={0.7} />
            </mesh>
            <mesh position={[0, -fore - h * 0.045, 0]} scale={[0.75, 1, 0.45]}>
              <capsuleGeometry args={[h * 0.028, h * 0.04, 6, 16]} />
              <meshStandardMaterial color={SKIN} roughness={0.7} />
            </mesh>
          </group>
        </group>
      ))}
      {/* Legs, standing in the thigh sleeves. */}
      {hips.map((hx, i) => {
        const top = y(0.54);
        const bottom = shoeH - lift;
        return (
          <group key={i} position={[hx - x, 0, 0]}>
            <mesh position={[0, (top + bottom) / 2, 0]}>
              <cylinderGeometry args={[h * 0.036, h * 0.022, top - bottom, 20]} />
              <meshStandardMaterial color={JEANS} roughness={0.9} />
            </mesh>
            <mesh position={[0, -lift + shoeH / 2, h * 0.02]}>
              <boxGeometry args={[h * 0.055, shoeH, h * 0.15]} />
              <meshStandardMaterial color="#f1efea" roughness={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Arm abduction (radians): hanging relaxed, and lifted out through the side opening. */
const RELAXED = 0.14;
const RAISED = 1.05;
const SKIN = "#d8a983";
const SHIRT = "#2f3b4c";
const JEANS = "#33415a";

/** A piece rendered fully folded (limbs are assembled before they're attached). */
function FoldedPiece({ layout, art, board, thickness }: { layout: Layout; art: HTMLCanvasElement; board: Board; thickness: number }) {
  const materials = useBoardMaterials(art, board);
  return <PartNode part={layout.root} parentPivot={[0, 0]} layout={layout} materials={materials} thickness={thickness} getFold={folded} />;
}

type NodeProps = {
  part: Part;
  parentPivot: Vec2;
  layout: Layout;
  materials: THREE.Material[];
  thickness: number;
  getFold: () => number;
};

function PartNode({ part, parentPivot, layout, materials, thickness, getFold }: NodeProps) {
  const ref = useRef<THREE.Group>(null);
  const { rect, pivot, axis, angle, phase, layer } = part;
  const geometry = useMemo(() => panelGeometry(part, layout.bounds, thickness), [part, layout.bounds, thickness]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    // Doors open outward (+z) as the arm pushes them; everything else follows the fold.
    const a = part.door ? -DOOR_ANGLE * (doorOpen[part.door] ?? 0) : angle * phaseProgress(getFold(), phase);
    ref.current?.rotation.set(axis === "x" ? a : 0, axis === "y" ? a : 0, 0);
  });

  // "in" sits behind the hinge, "out" in front of it, so overlapping flaps
  // stack the way real board does instead of z-fighting.
  const z = { in: -thickness / 2, out: thickness / 2, deep: -thickness * 1.5 }[layer];

  return (
    <group ref={ref} position={[pivot[0] - parentPivot[0], pivot[1] - parentPivot[1], 0]}>
      <mesh
        geometry={geometry}
        material={materials}
        position={[rect.x + rect.w / 2 - pivot[0], rect.y + rect.h / 2 - pivot[1], z]}
      />
      {part.children.map((child) => (
        <PartNode
          key={child.id}
          part={child}
          parentPivot={pivot}
          layout={layout}
          materials={materials}
          thickness={thickness}
          getFold={getFold}
        />
      ))}
    </group>
  );
}

/**
 * A panel of board, centred on its rect. The outside (+Z) face samples its
 * slice of the print sheet; the inside (-Z) face gets unprinted board, also
 * in sheet space so the fibres run continuously across folds. Panels with
 * cut-outs are extruded from a shape instead of being a plain box.
 */
function panelGeometry({ rect, holes, outline }: Part, bounds: Bounds, thickness: number) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const sw = bounds.maxX - bounds.minX;
  const sh = bounds.maxY - bounds.minY;
  const sheetUV = (x: number, y: number): Vec2 => [(x - bounds.minX) / sw, (y - bounds.minY) / sh];
  const tileUV = (x: number, y: number): Vec2 => [x / TILE_MM, y / TILE_MM];

  if (!holes.length && !outline) {
    const g = new THREE.BoxGeometry(rect.w, rect.h, thickness);
    const pos = g.getAttribute("position");
    const uv = g.getAttribute("uv");
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z — four vertices each.
    for (let i = 16; i < 24; i++) {
      const [u, v] = (i < 20 ? sheetUV : tileUV)(pos.getX(i) + cx, pos.getY(i) + cy);
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
    return g;
  }

  const local = (pts: Vec2[]) => pts.map(([x, y]) => new THREE.Vector2(x - cx, y - cy));
  const shape = new THREE.Shape(local(outline ?? rectPoly(rect.x, rect.y, rect.w, rect.h)));
  for (const hole of holes) shape.holes.push(new THREE.Path(local(hole)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  g.translate(0, 0, -thickness / 2);

  // Extrude emits the back cap, then the front cap (one group), then sides.
  // Split the caps so they take the same material slots as BoxGeometry.
  const [caps, sides] = g.groups;
  const half = caps.count / 2;
  g.clearGroups();
  g.addGroup(0, half, 5);
  g.addGroup(half, half, 4);
  g.addGroup(sides.start, sides.count, 0);

  const pos = g.getAttribute("position");
  const uv = g.getAttribute("uv");
  for (let i = 0; i < caps.count; i++) {
    const [u, v] = (i < half ? tileUV : sheetUV)(pos.getX(i) + cx, pos.getY(i) + cy);
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return g;
}

function useBoardMaterials(art: HTMLCanvasElement, board: Board) {
  const gl = useThree((s) => s.gl);
  const xray = useBox((s) => s.costume.xray);

  const outside = useMemo(() => {
    const map = new THREE.CanvasTexture(art);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = gl.capabilities.getMaxAnisotropy();
    return new THREE.MeshStandardMaterial({ map, roughness: 0.82, metalness: 0 });
  }, [art, gl]);

  const inside = useMemo(() => {
    const map = new THREE.CanvasTexture(boardTile(board));
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.92, color: "#e9e1d6" });
  }, [board]);

  const edge = useMemo(
    () => new THREE.MeshStandardMaterial({ color: BOARD_COLORS[board].edge, roughness: 0.95 }),
    [board],
  );

  useEffect(() => () => (outside.map?.dispose(), outside.dispose()), [outside]);
  useEffect(() => () => (inside.map?.dispose(), inside.dispose()), [inside]);
  useEffect(() => () => edge.dispose(), [edge]);

  // X-ray: ghost the board so the wearer shows through.
  useEffect(() => {
    for (const m of [outside, inside, edge]) {
      m.transparent = xray;
      m.opacity = xray ? 0.22 : 1;
      m.depthWrite = !xray;
      m.needsUpdate = true;
    }
  }, [xray, outside, inside, edge]);

  return useMemo(() => [edge, edge, edge, edge, outside, inside], [edge, outside, inside]);
}

/**
 * Re-frames the camera whenever the thing on screen changes size (resizing,
 * folding, a costume assembling), then lets go so orbiting and zooming stay
 * in the user's hands.
 */
function CameraRig({
  layout,
  thickness,
  costume,
  anim,
}: {
  layout: Layout;
  thickness: number;
  costume: CostumeScene | null;
  anim: Anim;
}) {
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null;
  const camera = useThree((s) => s.camera);
  const last = useRef({ dist: 0, x: 0, y: 0, active: true });
  const target = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    if (!controls) return;
    const fold = useBox.getState().fold;
    const walls = phaseProgress(fold, [0, 0.4]);
    const { minX, maxX } = layout.bounds;
    const { front, right, top, bottom } = layout.faces;
    const [L, W, H] = [front.w, right.w, front.h];

    // Bounding box of the part-folded blank: flaps stick out until they fold.
    const sx = THREE.MathUtils.lerp(maxX - minX, L, walls);
    const sz = THREE.MathUtils.lerp(0, W, walls);
    const sy =
      H +
      bottom.h * (1 - phaseProgress(fold, [0.4, 0.68])) +
      top.h * (1 - phaseProgress(fold, [0.7, 1])) +
      thickness * 2;
    const box = { minX: -sx / 2, maxX: sx / 2, minY: 0, maxY: sy };

    const a = anim();
    if (costume && a > 0) {
      const { spec } = costume;
      const lift = (spec.topFromFloor - H) * ease(a);
      const armOut = spec.arm.params.height * a;
      const armY = lift + H - spec.arm.centerFromTop;
      const { w, pole, angle } = spec.flag;
      const poleX = L / 2 + armOut * 0.55 + Math.sin(angle) * pole * a;
      const poleY = armY + Math.cos(angle) * pole * a;
      box.minX = Math.min(box.minX, -L / 2 - armOut);
      box.maxX = Math.max(box.maxX, L / 2 + armOut, poleX + Math.cos(angle) * w * a);
      box.maxY = Math.max(box.maxY + lift, poleY);
    }

    const r = (Math.hypot(box.maxX - box.minX, box.maxY - box.minY, sz) / 2) * S;
    const dist = (r / Math.sin(THREE.MathUtils.degToRad(FOV / 2))) * 1.22;
    const x = ((box.minX + box.maxX) / 2) * S;
    const y = ((box.minY + box.maxY) / 2) * S;

    const l = last.current;
    if (Math.abs(dist - l.dist) > 1e-4 || Math.abs(y - l.y) > 1e-4 || Math.abs(x - l.x) > 1e-4) l.active = true;
    Object.assign(l, { dist, x, y });
    if (!l.active) return;

    // Frame-rate independent easing; hand control back once settled.
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * 7);
    target.set(x, y, 0);
    controls.target.lerp(target, k);
    offset.copy(camera.position).sub(controls.target);
    const len = THREE.MathUtils.lerp(offset.length(), dist, k);
    offset.setLength(len);
    camera.position.copy(controls.target).add(offset);
    controls.update();
    if (Math.abs(len - dist) < dist * 0.002 && controls.target.distanceTo(target) < 0.002) l.active = false;
  });

  return null;
}

function clamp(v: number) {
  return Math.min(1, Math.max(0, v));
}
