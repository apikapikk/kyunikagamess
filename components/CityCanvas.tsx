"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { ref, update } from "firebase/database";
import { realtimeDb } from "@/lib/firebase";

// ─── Types ───────────────────────────────────────────────────────────────────
export type Point = { x: number; z: number };
export type RemotePlayer = { name: string; position?: { x: number; z: number } };

export type JoystickInput = {
  x: number; // -1 to 1 (left to right)
  y: number; // -1 to 1 (down/reverse to up/forward)
};

export type ColliderBox = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type CityCanvasProps = {
  seed: number;
  questionCount: number;
  roomCode: string;
  playerId: string;
  players: Record<string, RemotePlayer>;
  questionPoints?: Point[];
  completedQuestionIndices?: number[];
  nearestQuestionIndex?: number | null;
  isQuizOpen?: boolean;
  joystickRef?: React.RefObject<JoystickInput>;
  isBrakingRef?: React.RefObject<boolean>;
  onPlayerPosUpdate?: (pos: { x: number; z: number }) => void;
  onNearQuestion?: (index: number | null) => void;
};

// ─── Asset Paths ─────────────────────────────────────────────────────────────
const suburbanRoot   = "/assets/3d-assets/kenney_city-kit-suburban_20/Models/GLB%20format";
const commercialRoot = "/assets/3d-assets/kenney_city-kit-commercial_2.1/Models/GLB%20format";
const roadsRoot      = "/assets/3d-assets/kenney_city-kit-roads/Models/GLB%20format";
const carRoot        = "/assets/3d-assets/kenney_car-kit/Models/GLB%20format";

// Player car choices
const playerCarOptions = [
  `${carRoot}/sedan-sports.glb`,
  `${carRoot}/suv-luxury.glb`,
  `${carRoot}/hatchback-sports.glb`,
  `${carRoot}/race-future.glb`,
  `${carRoot}/taxi.glb`,
];

// NPC traffic cars
const npcCarPaths = [
  `${carRoot}/sedan.glb`,
  `${carRoot}/suv.glb`,
  `${carRoot}/delivery.glb`,
  `${carRoot}/van.glb`,
  `${carRoot}/taxi.glb`,
  `${carRoot}/police.glb`,
  `${carRoot}/hatchback-sports.glb`,
];

// ─── Commercial Kit Assets ────────────────────────────────────────────────────
const skyscraperPaths = ["a", "b", "c", "d", "e"].map(
  (l) => `${commercialRoot}/building-skyscraper-${l}.glb`
);
const commercialPaths = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n"].map(
  (l) => `${commercialRoot}/building-${l}.glb`
);
const awningPath       = `${commercialRoot}/detail-awning.glb`;
const awningWidePath   = `${commercialRoot}/detail-awning-wide.glb`;
const parasolAPath     = `${commercialRoot}/detail-parasol-a.glb`;
const parasolBPath     = `${commercialRoot}/detail-parasol-b.glb`;

// ─── Suburban Kit Assets ──────────────────────────────────────────────────────
const suburbanLetters = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u"];
const suburbanBuildingPaths = suburbanLetters.map((l) => `${suburbanRoot}/building-type-${l}.glb`);
const treeLargePath    = `${suburbanRoot}/tree-large.glb`;
const treeSmallPath    = `${suburbanRoot}/tree-small.glb`;
const fencePath        = `${suburbanRoot}/fence-1x3.glb`;
const planterPath      = `${suburbanRoot}/planter.glb`;

// ─── Road Infrastructure ──────────────────────────────────────────────────────
const roadStraightPath = `${roadsRoot}/road-straight.glb`;
const roadCrossPath    = `${roadsRoot}/road-crossroad.glb`;
const roadCrossingPath = `${roadsRoot}/road-crossing.glb`;
const streetLightPath  = `${roadsRoot}/light-square.glb`;
const trafficLightPath = `${roadsRoot}/traffic-light.glb`;
const stopSignPath     = `${roadsRoot}/road-sign-stop.glb`;

// Preload key assets
useGLTF.preload(playerCarOptions[0]);
useGLTF.preload(playerCarOptions[1]);
useGLTF.preload(playerCarOptions[2]);
useGLTF.preload(playerCarOptions[3]);
useGLTF.preload(playerCarOptions[4]);
npcCarPaths.forEach((p) => useGLTF.preload(p));
skyscraperPaths.forEach((p) => useGLTF.preload(p));
commercialPaths.slice(0, 8).forEach((p) => useGLTF.preload(p));
suburbanBuildingPaths.slice(0, 10).forEach((p) => useGLTF.preload(p));
useGLTF.preload(awningPath);
useGLTF.preload(awningWidePath);
useGLTF.preload(parasolAPath);
useGLTF.preload(parasolBPath);
useGLTF.preload(treeLargePath);
useGLTF.preload(treeSmallPath);
useGLTF.preload(roadStraightPath);
useGLTF.preload(roadCrossPath);
useGLTF.preload(roadCrossingPath);
useGLTF.preload(streetLightPath);
useGLTF.preload(trafficLightPath);
useGLTF.preload(stopSignPath);
useGLTF.preload(fencePath);
useGLTF.preload(planterPath);

// ─── Seeded RNG ───────────────────────────────────────────────────────────────
function lcg(seed: number, index: number): number {
  return ((seed * 1664525 + index * 22695477 + 1013904223) & 0x7fffffff) / 0x7fffffff;
}

// ─── Expansive City Grid Constants ────────────────────────────────────────────
// Major avenues at -60, -40, -20, 0, 20, 40, 60 (Spans -72 to +72 across a 180x180 map)
export const AVENUES = [-60, -40, -20, 0, 20, 40, 60];
export const ROAD_TILE_SCALE = 4.0; // Tile bounds are exactly 4x4 units
export const ROAD_STEP = 4.0;
export const ROAD_MIN = -72;
export const ROAD_MAX = 72;

// ─── Road-Aligned Candidate Spots for Questions ───────────────────────────────
export const candidateSpots: Point[] = [
  // Central Downtown Avenues
  { x: 0, z: -10 },
  { x: 0, z: 10 },
  { x: -10, z: 0 },
  { x: 10, z: 0 },
  // Major Central Crossroads
  { x: 0, z: -20 },
  { x: 0, z: 20 },
  { x: -20, z: 0 },
  { x: 20, z: 0 },
  // Midtown Intersections
  { x: -20, z: -20 },
  { x: 20, z: -20 },
  { x: -20, z: 20 },
  { x: 20, z: 20 },
  // Boulevard Landmarks
  { x: -20, z: -10 },
  { x: -20, z: 10 },
  { x: 20, z: -10 },
  { x: 20, z: 10 },
  { x: -10, z: -20 },
  { x: 10, z: -20 },
  { x: -10, z: 20 },
  { x: 10, z: 20 },
  // Intermediate Avenues (Ring at ±40)
  { x: 0, z: -30 },
  { x: 0, z: 30 },
  { x: -30, z: 0 },
  { x: 30, z: 0 },
  { x: -40, z: 0 },
  { x: 40, z: 0 },
  { x: 0, z: -40 },
  { x: 0, z: 40 },
  { x: -40, z: -20 },
  { x: -40, z: 20 },
  { x: 40, z: -20 },
  { x: 40, z: 20 },
  { x: -20, z: -40 },
  { x: 20, z: -40 },
  { x: -20, z: 40 },
  { x: 20, z: 40 },
  { x: -40, z: -40 },
  { x: 40, z: -40 },
  { x: -40, z: 40 },
  { x: 40, z: 40 },
  { x: -30, z: -40 },
  { x: 30, z: -40 },
  { x: -30, z: 40 },
  { x: 30, z: 40 },
  // Outer Parkway Avenues (Ring at ±60)
  { x: 0, z: -50 },
  { x: 0, z: 50 },
  { x: -50, z: 0 },
  { x: 50, z: 0 },
  { x: -60, z: 0 },
  { x: 60, z: 0 },
  { x: 0, z: -60 },
  { x: 0, z: 60 },
  { x: -60, z: -20 },
  { x: -60, z: 20 },
  { x: 60, z: -20 },
  { x: 60, z: 20 },
  { x: -20, z: -60 },
  { x: 20, z: -60 },
  { x: -20, z: 60 },
  { x: 20, z: 60 },
  { x: -60, z: -40 },
  { x: -60, z: 40 },
  { x: 60, z: -40 },
  { x: 60, z: 40 },
  { x: -40, z: -60 },
  { x: 40, z: -60 },
  { x: -40, z: 60 },
  { x: 40, z: 60 },
  { x: -60, z: -60 },
  { x: 60, z: -60 },
  { x: -60, z: 60 },
  { x: 60, z: 60 },
];

export function seededPoints(seed: number, count: number): Point[] {
  const actualCount = Math.min(Math.max(count, 3), candidateSpots.length);
  const spots = [...candidateSpots];
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(lcg(seed + i * 17, i) * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  return spots.slice(0, actualCount);
}

// ─── Generic Model Component ──────────────────────────────────────────────────
function Model({
  path,
  position,
  rotation,
  scale = 1,
}: {
  path: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={cloned} position={position} rotation={rotation ?? [0, 0, 0]} scale={scale} />;
}

// ─── Seamless Road Network (Edge-to-Edge Snapping, 0 Gaps) ────────────────────
function RoadGrid() {
  const roadCoords: number[] = [];
  for (let c = ROAD_MIN; c <= ROAD_MAX; c += ROAD_STEP) {
    roadCoords.push(c);
  }

  // Intersections at all avenue crossings (5x5 = 25 crossroads)
  const crossroads: [number, number, number][] = AVENUES.flatMap((x) =>
    AVENUES.map((z) => [x, 0, z] as [number, number, number])
  );

  // Horizontal road tiles along Z = -40, -20, 0, 20, 40
  const hSegments: { pos: [number, number, number]; path: string }[] = [];
  for (const z of AVENUES) {
    for (const x of roadCoords) {
      if (AVENUES.includes(x)) continue; // skip crossroads
      // Place crosswalk tile directly adjacent to crossroads
      const isCrosswalk = AVENUES.some((ax) => Math.abs(x - ax) === ROAD_STEP);
      const path = isCrosswalk ? roadCrossingPath : roadStraightPath;
      hSegments.push({ pos: [x, 0, z], path });
    }
  }

  // Vertical road tiles along X = -40, -20, 0, 20, 40
  const vSegments: { pos: [number, number, number]; path: string }[] = [];
  for (const x of AVENUES) {
    for (const z of roadCoords) {
      if (AVENUES.includes(z)) continue; // skip crossroads
      const isCrosswalk = AVENUES.some((az) => Math.abs(z - az) === ROAD_STEP);
      const path = isCrosswalk ? roadCrossingPath : roadStraightPath;
      vSegments.push({ pos: [x, 0, z], path });
    }
  }

  return (
    <>
      {crossroads.map((pos, i) => (
        <Model key={`rc-${i}`} path={roadCrossPath} position={pos} scale={ROAD_TILE_SCALE} />
      ))}
      {hSegments.map(({ pos, path }, i) => (
        <Model key={`rh-${i}`} path={path} position={pos} rotation={[0, 0, 0]} scale={ROAD_TILE_SCALE} />
      ))}
      {vSegments.map(({ pos, path }, i) => (
        <Model key={`rv-${i}`} path={path} position={pos} rotation={[0, Math.PI / 2, 0]} scale={ROAD_TILE_SCALE} />
      ))}
    </>
  );
}

// ─── Buildings & Props Structure ──────────────────────────────────────────────
type PlacedBuilding = {
  path: string;
  x: number;
  z: number;
  ry: number;
  scale: number;
  propPath?: string;
  propPos?: [number, number, number];
  propScale?: number;
};

// ─── City Districts Generator (Downtown Skyscrapers + Commercial + Suburban) ──
function useCityBlocks(seed: number) {
  return useMemo(() => {
    const buildings: PlacedBuilding[] = [];
    const trees: { path: string; pos: [number, number, number]; scale: number }[] = [];
    const colliders: ColliderBox[] = [];

    // The city is composed of 36 blocks (6x6) between the 7 avenues
    // Block bounds between avenue pairs:
    const blockIntervals = [
      { min: -57.5, max: -42.5 }, // col 0: -50
      { min: -37.5, max: -22.5 }, // col 1: -30
      { min: -17.5, max: -2.5 },  // col 2: -10
      { min: 2.5, max: 17.5 },    // col 3: 10
      { min: 22.5, max: 37.5 },   // col 4: 30
      { min: 42.5, max: 57.5 },   // col 5: 50
    ];

    let itemIdx = 0;

    blockIntervals.forEach((xBlock, col) => {
      blockIntervals.forEach((zBlock, row) => {
        // District classification:
        // Central 4 blocks (col: 2,3; row: 2,3) = Downtown Skyscraper Core + Plaza
        // Intermediate blocks (col: 1-4; row: 1-4) = Commercial & Shopping Boulevard
        // Outer ring (col: 0 or 5; row: 0 or 5) = Suburban Residential Neighborhoods

        const p1 = { x: xBlock.min + 3.2, z: zBlock.min + 3.2 };
        const p2 = { x: xBlock.max - 3.2, z: zBlock.min + 3.2 };
        const p3 = { x: xBlock.min + 3.2, z: zBlock.max - 3.2 };
        const p4 = { x: xBlock.max - 3.2, z: zBlock.max - 3.2 };
        const centerP = { x: (xBlock.min + xBlock.max) / 2, z: (zBlock.min + zBlock.max) / 2 };

        if (col === 2 && row === 2) {
          // ── District 1: Downtown Financial Core (Tall Skyscrapers) ──
          [p1, p2, p3, p4].forEach((p, idx) => {
            const sc = 2.8;
            buildings.push({
              path: skyscraperPaths[(idx + seed) % skyscraperPaths.length],
              x: p.x,
              z: p.z,
              ry: (idx * Math.PI) / 2,
              scale: sc,
            });
            colliders.push({
              minX: p.x - 1.7,
              maxX: p.x + 1.7,
              minZ: p.z - 1.7,
              maxZ: p.z + 1.7,
            });
          });
          // Central courtyard tree & planter
          trees.push({ path: treeLargePath, pos: [centerP.x, 0, centerP.z], scale: 1.4 });
          colliders.push({
            minX: centerP.x - 0.7,
            maxX: centerP.x + 0.7,
            minZ: centerP.z - 0.7,
            maxZ: centerP.z + 0.7,
          });
        } else if (col === 3 && row === 2) {
          // ── District 2: Shopping Boulevard & Cafe Terraces ──
          const stores = [
            { p: p1, detail: awningPath, dPos: [p1.x, 1.6, p1.z + 2.0] as [number, number, number] },
            { p: p2, detail: awningWidePath, dPos: [p2.x, 1.6, p2.z + 2.0] as [number, number, number] },
            { p: p3, detail: parasolAPath, dPos: [p3.x, 0, p3.z - 2.0] as [number, number, number] },
            { p: p4, detail: parasolBPath, dPos: [p4.x, 0, p4.z - 2.0] as [number, number, number] },
          ];
          stores.forEach(({ p, detail, dPos }, idx) => {
            const sc = 2.4;
            buildings.push({
              path: commercialPaths[(idx + seed * 3) % commercialPaths.length],
              x: p.x,
              z: p.z,
              ry: idx < 2 ? 0 : Math.PI,
              scale: sc,
              propPath: detail,
              propPos: dPos,
              propScale: 1.3,
            });
            colliders.push({
              minX: p.x - 1.6,
              maxX: p.x + 1.6,
              minZ: p.z - 1.6,
              maxZ: p.z + 1.6,
            });
          });
        } else if (col === 2 && row === 3) {
          // ── District 3: Corporate Tech Hub ──
          [p1, p2, p3, p4].forEach((p, idx) => {
            const isSkyscraper = idx === 0 || idx === 3;
            const path = isSkyscraper
              ? skyscraperPaths[(idx + seed * 2) % skyscraperPaths.length]
              : commercialPaths[(idx + 4) % commercialPaths.length];
            const sc = isSkyscraper ? 2.7 : 2.4;
            buildings.push({
              path,
              x: p.x,
              z: p.z,
              ry: (idx * Math.PI) / 2,
              scale: sc,
            });
            colliders.push({
              minX: p.x - 1.65,
              maxX: p.x + 1.65,
              minZ: p.z - 1.65,
              maxZ: p.z + 1.65,
            });
          });
          trees.push({ path: planterPath, pos: [centerP.x, 0, centerP.z], scale: 1.5 });
        } else if (col === 3 && row === 3) {
          // ── District 4: Central Civic Park & Plaza ──
          // Landmark cultural building at center
          buildings.push({
            path: commercialPaths[(seed + 5) % commercialPaths.length],
            x: centerP.x,
            z: centerP.z,
            ry: 0,
            scale: 2.5,
          });
          colliders.push({
            minX: centerP.x - 1.6,
            maxX: centerP.x + 1.6,
            minZ: centerP.z - 1.6,
            maxZ: centerP.z + 1.6,
          });
          // 4 park corner trees
          [p1, p2, p3, p4].forEach((p) => {
            trees.push({ path: treeLargePath, pos: [p.x, 0, p.z], scale: 1.5 });
            colliders.push({
              minX: p.x - 0.7,
              maxX: p.x + 0.7,
              minZ: p.z - 0.7,
              maxZ: p.z + 0.7,
            });
          });
        } else if (col >= 1 && col <= 4 && row >= 1 && row <= 4) {
          // ── Intermediate Zone: Commercial Retail, Restaurants & Plaza Blocks ──
          [p1, p2, p3, p4].forEach((p, idx) => {
            const sc = 2.4;
            const path = commercialPaths[(itemIdx + idx + seed) % commercialPaths.length];
            const ry = idx < 2 ? 0 : Math.PI;
            const hasAwning = (idx + col + row) % 3 === 0;
            const hasParasol = (idx + col + row) % 3 === 1;

            buildings.push({
              path,
              x: p.x,
              z: p.z,
              ry,
              scale: sc,
              propPath: hasAwning ? awningPath : hasParasol ? parasolAPath : undefined,
              propPos: hasAwning
                ? [p.x, 1.6, ry === 0 ? p.z + 2.0 : p.z - 2.0]
                : hasParasol
                ? [p.x, 0, ry === 0 ? p.z + 2.0 : p.z - 2.0]
                : undefined,
              propScale: 1.25,
            });
            colliders.push({
              minX: p.x - 1.6,
              maxX: p.x + 1.6,
              minZ: p.z - 1.6,
              maxZ: p.z + 1.6,
            });
          });
          // Block center tree/planter
          trees.push({
            path: (col + row) % 2 === 0 ? treeLargePath : planterPath,
            pos: [centerP.x, 0, centerP.z],
            scale: 1.3,
          });
          colliders.push({
            minX: centerP.x - 0.7,
            maxX: centerP.x + 0.7,
            minZ: centerP.z - 0.7,
            maxZ: centerP.z + 0.7,
          });
          itemIdx += 4;
        } else {
          // ── Outer 20 Blocks: Suburban Residential Neighborhoods ──
          [p1, p2, p3, p4].forEach((p, idx) => {
            const sc = 2.3;
            const model = suburbanBuildingPaths[(itemIdx + seed) % suburbanBuildingPaths.length];
            itemIdx++;

            // Rotation faces toward nearest avenue
            const ry = idx < 2 ? 0 : Math.PI;
            buildings.push({
              path: model,
              x: p.x,
              z: p.z,
              ry,
              scale: sc,
            });
            colliders.push({
              minX: p.x - 1.55,
              maxX: p.x + 1.55,
              minZ: p.z - 1.55,
              maxZ: p.z + 1.55,
            });

            // Yard tree
            const treeX = p.x + (idx % 2 === 0 ? 1.8 : -1.8);
            const treeZ = p.z + (ry === 0 ? 1.8 : -1.8);
            trees.push({
              path: (idx + col) % 2 === 0 ? treeLargePath : treeSmallPath,
              pos: [treeX, 0, treeZ],
              scale: 1.2,
            });
          });
        }
      });
    });

    return { buildings, trees, colliders };
  }, [seed]);
}

// ─── Street Furniture (Illuminated Boulevards, Signals, Signs) ────────────────
function StreetFurniture() {
  const streetProps = useMemo(() => {
    const lights: [number, number, number, number][] = [];
    const trafficLights: [number, number, number, number][] = [];
    const stopSigns: [number, number, number, number][] = [];

    // Street lights along all 5 avenues on both curbs
    for (const avenue of AVENUES) {
      for (let c = ROAD_MIN + 6; c <= ROAD_MAX - 6; c += 16) {
        // Horizontal avenue curbs
        lights.push([c, 0, avenue - 2.4, 0]);
        lights.push([c, 0, avenue + 2.4, Math.PI]);
        // Vertical avenue curbs
        lights.push([avenue - 2.4, 0, c, Math.PI / 2]);
        lights.push([avenue + 2.4, 0, c, -Math.PI / 2]);
      }
    }

    // Traffic signals and stop signs at major intersections
    for (const ax of AVENUES) {
      for (const az of AVENUES) {
        trafficLights.push([ax + 2.5, 0, az + 2.5, Math.PI]);
        trafficLights.push([ax - 2.5, 0, az - 2.5, 0]);
        stopSigns.push([ax + 2.5, 0, az - 2.5, -Math.PI / 2]);
      }
    }

    return { lights, trafficLights, stopSigns };
  }, []);

  return (
    <>
      {streetProps.lights.map(([x, y, z, ry], i) => (
        <Model key={`sl-${i}`} path={streetLightPath} position={[x, y, z]} rotation={[0, ry, 0]} scale={1.2} />
      ))}
      {streetProps.trafficLights.map(([x, y, z, ry], i) => (
        <Model key={`tl-${i}`} path={trafficLightPath} position={[x, y, z]} rotation={[0, ry, 0]} scale={1.2} />
      ))}
      {streetProps.stopSigns.map(([x, y, z, ry], i) => (
        <Model key={`ss-${i}`} path={stopSignPath} position={[x, y, z]} rotation={[0, ry, 0]} scale={1.2} />
      ))}
    </>
  );
}

// ─── Multi-Avenue NPC Traffic ─────────────────────────────────────────────────
type NpcRoute = {
  carPath: string;
  sx: number; sz: number;
  ex: number; ez: number;
  speed: number;
  offset: number;
};

function NpcCar({
  route,
  index,
  npcPositionsRef,
}: {
  route: NpcRoute;
  index: number;
  npcPositionsRef: React.MutableRefObject<Array<{ x: number; z: number }>>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const t = useRef(route.offset);
  const { scene } = useGLTF(route.carPath);
  const carScene = useMemo(() => scene.clone(true), [scene]);
  const len = useMemo(() => Math.hypot(route.ex - route.sx, route.ez - route.sz), [route]);
  const angle = useMemo(() => Math.atan2(route.ex - route.sx, route.ez - route.sz), [route]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    t.current = (t.current + (delta * route.speed) / len) % 1;
    const curX = route.sx + (route.ex - route.sx) * t.current;
    const curZ = route.sz + (route.ez - route.sz) * t.current;
    groupRef.current.position.set(curX, 0, curZ);
    groupRef.current.rotation.y = angle;

    npcPositionsRef.current[index] = { x: curX, z: curZ };
  });

  return (
    <group ref={groupRef}>
      <primitive object={carScene} scale={0.95} />
    </group>
  );
}

function NpcTraffic({
  seed,
  npcPositionsRef,
}: {
  seed: number;
  npcPositionsRef: React.MutableRefObject<Array<{ x: number; z: number }>>;
}) {
  const routes = useMemo<NpcRoute[]>(() => {
    const list: NpcRoute[] = [];

    // Horizontal avenues: 2-way traffic
    AVENUES.forEach((z, li) => {
      // Eastbound lane
      list.push({
        carPath: npcCarPaths[(seed + li * 2) % npcCarPaths.length],
        sx: ROAD_MIN, sz: z + 0.9,
        ex: ROAD_MAX, ez: z + 0.9,
        speed: 5.5 + lcg(seed + li, 1) * 3,
        offset: lcg(seed + li, 2),
      });
      // Westbound lane
      list.push({
        carPath: npcCarPaths[(seed + li * 2 + 1) % npcCarPaths.length],
        sx: ROAD_MAX, sz: z - 0.9,
        ex: ROAD_MIN, ez: z - 0.9,
        speed: 5.5 + lcg(seed + li, 3) * 3,
        offset: lcg(seed + li, 4),
      });
    });

    // Vertical avenues: 2-way traffic
    AVENUES.forEach((x, li) => {
      // Southbound lane
      list.push({
        carPath: npcCarPaths[(seed + li * 2 + 2) % npcCarPaths.length],
        sx: x + 0.9, sz: ROAD_MIN,
        ex: x + 0.9, ez: ROAD_MAX,
        speed: 5.5 + lcg(seed + li, 5) * 3,
        offset: lcg(seed + li, 6),
      });
      // Northbound lane
      list.push({
        carPath: npcCarPaths[(seed + li * 2 + 3) % npcCarPaths.length],
        sx: x - 0.9, sz: ROAD_MAX,
        ex: x - 0.9, ez: ROAD_MIN,
        speed: 5.5 + lcg(seed + li, 7) * 3,
        offset: lcg(seed + li, 8),
      });
    });

    return list;
  }, [seed]);

  return (
    <>
      {routes.map((r, i) => (
        <NpcCar key={`npc-${i}`} route={r} index={i} npcPositionsRef={npcPositionsRef} />
      ))}
    </>
  );
}

// ─── Remote Player Car Avatar ─────────────────────────────────────────────────
function RemoteCarAvatar({ player, carIdx }: { player: RemotePlayer; carIdx: number }) {
  const { scene } = useGLTF(npcCarPaths[carIdx % npcCarPaths.length]);
  const carScene = useMemo(() => scene.clone(true), [scene]);
  const x = player.position?.x ?? 0;
  const z = player.position?.z ?? 0;
  return (
    <group position={[x, 0, z]}>
      <primitive object={carScene} scale={0.95} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.6, 0.75, 24]} />
        <meshBasicMaterial color="#f28b72" />
      </mesh>
    </group>
  );
}

// ─── 3D Question Marker with 16m Sky Beam & Pulsing Ground Ring ───────────────
function QuestionMarker({
  point,
  index,
  completed,
  isNearest,
}: {
  point: Point;
  index: number;
  completed: boolean;
  isNearest: boolean;
}) {
  const diamondRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (diamondRef.current) {
      diamondRef.current.rotation.y += delta * 1.6;
      diamondRef.current.position.y = 1.9 + Math.sin(state.clock.elapsedTime * 2.5 + index) * 0.25;
    }
    if (ringRef.current && !completed) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3.5) * 0.12;
      ringRef.current.scale.set(pulse, pulse, 1);
    }
  });

  const color = completed ? "#22c55e" : isNearest ? "#f59e0b" : "#8b5cf6";
  const emissive = completed ? "#15803d" : isNearest ? "#d97706" : "#6d28d9";

  return (
    <group position={[point.x, 0, point.z]}>
      <mesh position={[0, 8, 0]}>
        <cylinderGeometry args={[0.3, 0.7, 16, 16, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={completed ? 0.2 : 0.48}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      <group ref={diamondRef} position={[0, 1.9, 0]}>
        <mesh>
          <octahedronGeometry args={[0.65, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={emissive}
            emissiveIntensity={0.8}
            roughness={0.2}
          />
        </mesh>
      </group>

      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[1.5, 1.9, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={completed ? 0.35 : 0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[1.5, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={completed ? 0.1 : 0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─── Fast, Non-Penetrating Collision Resolution ───────────────────────────────
function resolveObstacleCollision(
  carPos: THREE.Vector3,
  carRadius: number,
  colliders: ColliderBox[]
): boolean {
  let hit = false;

  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    const closestX = Math.max(box.minX, Math.min(carPos.x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(carPos.z, box.maxZ));

    const dx = carPos.x - closestX;
    const dz = carPos.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < carRadius * carRadius) {
      hit = true;
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const overlap = carRadius - dist;
        carPos.x += (dx / dist) * overlap;
        carPos.z += (dz / dist) * overlap;
      } else {
        const dMinX = Math.abs(carPos.x - box.minX);
        const dMaxX = Math.abs(carPos.x - box.maxX);
        const dMinZ = Math.abs(carPos.z - box.minZ);
        const dMaxZ = Math.abs(carPos.z - box.maxZ);
        const minEdge = Math.min(dMinX, dMaxX, dMinZ, dMaxZ);

        if (minEdge === dMinX) carPos.x = box.minX - carRadius;
        else if (minEdge === dMaxX) carPos.x = box.maxX + carRadius;
        else if (minEdge === dMinZ) carPos.z = box.minZ - carRadius;
        else carPos.z = box.maxZ + carRadius;
      }
    }
  }

  return hit;
}

// ─── Player Car Controller with Expansive Speed & Collision ───────────────────
function PlayerCarController({
  roomCode,
  playerId,
  carScene,
  colliders,
  npcPositionsRef,
  remotePlayers,
  questionPoints = [],
  isQuizOpen = false,
  joystickRef,
  isBrakingRef,
  onPlayerPosUpdate,
  onNearQuestion,
}: {
  roomCode: string;
  playerId: string;
  carScene: THREE.Object3D;
  colliders: ColliderBox[];
  npcPositionsRef: React.MutableRefObject<Array<{ x: number; z: number }>>;
  remotePlayers: Record<string, RemotePlayer>;
  questionPoints?: Point[];
  isQuizOpen?: boolean;
  joystickRef?: React.RefObject<JoystickInput>;
  isBrakingRef?: React.RefObject<boolean>;
  onPlayerPosUpdate?: (pos: { x: number; z: number }) => void;
  onNearQuestion?: (index: number | null) => void;
}) {
  const carGroupRef = useRef<THREE.Group>(null);

  // Car starts at center intersection (0, 0, 0)
  const posRef     = useRef(new THREE.Vector3(0, 0, 0));
  const headingRef = useRef(0);
  const speedRef   = useRef(0);
  const bumpRef    = useRef(0);

  // Camera placed 7.2 units behind car
  const camPosRef  = useRef(new THREE.Vector3(0, 3.5, -7.2));
  const camLookRef = useRef(new THREE.Vector3(0, 1.0, 3.5));

  const keys          = useRef<Record<string, boolean>>({});
  const lastSync      = useRef(0);
  const lastPosReport = useRef(0);
  const { camera, gl } = useThree();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k)) {
        if (!isQuizOpen) e.preventDefault();
      }
      keys.current[k] = true;
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [isQuizOpen]);

  // Touch / pointer swipe for rotating camera angle
  const swipeYaw = useRef(0);
  useEffect(() => {
    const canvas = gl.domElement;
    let lastX = 0;
    const onDown = (e: PointerEvent) => { lastX = e.clientX; };
    const onMove = (e: PointerEvent) => {
      if (!(e.buttons & 1)) return;
      swipeYaw.current -= (e.clientX - lastX) * 0.008;
      lastX = e.clientX;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    let steerInput = 0;

    if (isQuizOpen) {
      speedRef.current = 0;
    } else {
      const joyX = joystickRef?.current?.x ?? 0;
      const joyY = joystickRef?.current?.y ?? 0;
      const isBraking = isBrakingRef?.current ?? false;

      const keyAccel   = (keys.current["w"] || keys.current["arrowup"]) ? 1 : 0;
      const keyReverse = (keys.current["s"] || keys.current["arrowdown"]) ? 1 : 0;
      const keyLeft    = (keys.current["a"] || keys.current["arrowleft"]) ? 1 : 0;
      const keyRight   = (keys.current["d"] || keys.current["arrowright"]) ? 1 : 0;

      // Throttle (forward / reverse)
      const fwdThrottle = Math.max(keyAccel, joyY > 0 ? joyY : 0);
      const revThrottle = Math.max(keyReverse, joyY < 0 ? -joyY : 0);

      // Steering: keyboard overrides joystick if pressed
      if (keyLeft) steerInput = 1;
      else if (keyRight) steerInput = -1;
      else if (Math.abs(joyX) > 0.04) steerInput = -joyX;

      // Faster cruise speed for the expansive 180x180 city
      const maxFwd = 15.5;
      const maxRev = 5.5;
      const acc    = 22;
      const drag   = 8.5;

      if (isBraking) {
        speedRef.current = THREE.MathUtils.lerp(speedRef.current, 0, dt * 14);
        if (Math.abs(speedRef.current) < 0.08) speedRef.current = 0;
      } else if (fwdThrottle > 0.04) {
        const targetMax = maxFwd * fwdThrottle;
        speedRef.current = Math.min(speedRef.current + acc * fwdThrottle * dt, targetMax);
      } else if (revThrottle > 0.04) {
        const targetRev = -maxRev * revThrottle;
        speedRef.current = Math.max(speedRef.current - acc * revThrottle * dt, targetRev);
      } else {
        speedRef.current *= Math.pow(1 - drag * dt, 1);
        if (Math.abs(speedRef.current) < 0.05) speedRef.current = 0;
      }

      // Responsive steering: base factor so turning doesn't stall at low speed
      const currentSpeedMag = Math.abs(speedRef.current);
      const speedFactor = THREE.MathUtils.clamp(currentSpeedMag / (maxFwd * 0.35), 0.35, 1.0);
      const steerRate = 2.4 * speedFactor;
      const steerDir = Math.sign(speedRef.current || 1);

      if (Math.abs(steerInput) > 0.02 && currentSpeedMag > 0.08) {
        headingRef.current += steerInput * steerRate * dt * steerDir;
      }

      // Movement vector
      const moveDir = new THREE.Vector3(Math.sin(headingRef.current), 0, Math.cos(headingRef.current));
      posRef.current.addScaledVector(moveDir, speedRef.current * dt);

      // ── Collision Resolution ──
      const carRadius = 0.85;
      const hitBuilding = resolveObstacleCollision(posRef.current, carRadius, colliders);

      // City outer boundary limit
      const limit = 69.0;
      let hitBorder = false;
      if (posRef.current.x < -limit) { posRef.current.x = -limit; hitBorder = true; }
      if (posRef.current.x > limit)  { posRef.current.x = limit; hitBorder = true; }
      if (posRef.current.z < -limit) { posRef.current.z = -limit; hitBorder = true; }
      if (posRef.current.z > limit)  { posRef.current.z = limit; hitBorder = true; }

      // NPC Cars Collision
      let hitNpc = false;
      const npcs = npcPositionsRef.current;
      for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        if (!npc) continue;
        const dx = posRef.current.x - npc.x;
        const dz = posRef.current.z - npc.z;
        const dist = Math.hypot(dx, dz);
        const minDist = 1.9;
        if (dist < minDist) {
          hitNpc = true;
          if (dist > 0.0001) {
            const push = minDist - dist;
            posRef.current.x += (dx / dist) * push;
            posRef.current.z += (dz / dist) * push;
          }
        }
      }

      // Remote Players Collision
      let hitPlayer = false;
      for (const [id, rp] of Object.entries(remotePlayers)) {
        if (id === playerId || !rp.position) continue;
        const dx = posRef.current.x - rp.position.x;
        const dz = posRef.current.z - rp.position.z;
        const dist = Math.hypot(dx, dz);
        const minDist = 1.9;
        if (dist < minDist) {
          hitPlayer = true;
          if (dist > 0.0001) {
            const push = minDist - dist;
            posRef.current.x += (dx / dist) * push;
            posRef.current.z += (dz / dist) * push;
          }
        }
      }

      // Deceleration and tactile jolt on impact
      if (hitBuilding || hitBorder || hitNpc || hitPlayer) {
        speedRef.current *= 0.25;
        bumpRef.current = Math.min(bumpRef.current + 0.08, 0.15);
      }
    }

    bumpRef.current = THREE.MathUtils.lerp(bumpRef.current, 0, dt * 12);

    const tiltZ = !isQuizOpen
      ? -steerInput * 0.05
      : 0;

    if (carGroupRef.current) {
      carGroupRef.current.position.set(posRef.current.x, bumpRef.current, posRef.current.z);
      carGroupRef.current.rotation.y = headingRef.current;
      carGroupRef.current.rotation.z = THREE.MathUtils.lerp(
        carGroupRef.current.rotation.z, tiltZ, 1 - Math.pow(0.001, dt)
      );
    }

    // ── Camera Following Behind Car ──────────────────────────────────────────
    const camDist = 7.2;
    const camH    = 3.5;
    const camYaw  = headingRef.current + swipeYaw.current;

    const desiredCam = new THREE.Vector3(
      posRef.current.x - Math.sin(camYaw) * camDist,
      posRef.current.y + camH,
      posRef.current.z - Math.cos(camYaw) * camDist,
    );
    camPosRef.current.lerp(desiredCam, 1 - Math.pow(0.00001, dt));
    camera.position.copy(camPosRef.current);

    const desiredLook = new THREE.Vector3(
      posRef.current.x + Math.sin(headingRef.current) * 3.0,
      posRef.current.y + 1.0,
      posRef.current.z + Math.cos(headingRef.current) * 3.0,
    );
    camLookRef.current.lerp(desiredLook, 1 - Math.pow(0.001, dt));
    camera.lookAt(camLookRef.current);

    // ── Position & Proximity Reporting ───────────────────────────────────────
    if (performance.now() - lastPosReport.current > 120) {
      lastPosReport.current = performance.now();
      onPlayerPosUpdate?.({ x: posRef.current.x, z: posRef.current.z });

      let nearIdx: number | null = null;
      for (let i = 0; i < questionPoints.length; i++) {
        const qp = questionPoints[i];
        const d = Math.hypot(qp.x - posRef.current.x, qp.z - posRef.current.z);
        if (d <= 3.8) {
          nearIdx = i;
          break;
        }
      }
      onNearQuestion?.(nearIdx);
    }

    // ── Firebase Sync (throttled 100ms) ──────────────────────────────────────
    if (
      Math.abs(speedRef.current) > 0.1 &&
      realtimeDb &&
      playerId &&
      performance.now() - lastSync.current > 100
    ) {
      lastSync.current = performance.now();
      void update(
        ref(realtimeDb, `rooms/${roomCode}/players/${playerId}/position`),
        { x: posRef.current.x, z: posRef.current.z },
      ).catch((err) => console.error("Position sync failed", err));
    }
  });

  return (
    <group ref={carGroupRef}>
      <primitive object={carScene} scale={0.95} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[1.15, 24]} />
        <meshBasicMaterial color="#111" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// ─── Full City Scene ──────────────────────────────────────────────────────────
function CityScene({
  seed,
  questionCount,
  roomCode,
  playerId,
  players,
  questionPoints: customPoints,
  completedQuestionIndices = [],
  nearestQuestionIndex = null,
  isQuizOpen = false,
  joystickRef,
  isBrakingRef,
  onPlayerPosUpdate,
  onNearQuestion,
}: CityCanvasProps) {
  const points = useMemo(
    () => customPoints && customPoints.length > 0 ? customPoints : seededPoints(seed, questionCount),
    [customPoints, seed, questionCount]
  );

  const npcPositionsRef = useRef<Array<{ x: number; z: number }>>([]);

  const playerCarIdx = useMemo(() => {
    let h = 0;
    for (let i = 0; i < playerId.length; i++) h = (h * 31 + playerId.charCodeAt(i)) & 0xffff;
    return h % playerCarOptions.length;
  }, [playerId]);

  const { scene: playerCarBase } = useGLTF(playerCarOptions[playerCarIdx]);
  const playerCarScene = useMemo(() => playerCarBase.clone(true), [playerCarBase]);

  const { buildings, trees, colliders } = useCityBlocks(seed);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={1.7} />
      <directionalLight position={[20, 30, 15]} intensity={2.2} />
      <directionalLight position={[-20, 15, -15]} intensity={0.6} color="#c8d8ff" />

      {/* Expansive Ground Plane (180x180) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial color="#88b58d" />
      </mesh>

      {/* Seamless Continuous Road Network */}
      <Suspense fallback={null}><RoadGrid /></Suspense>

      {/* Buildings (Skyscrapers, Commercial Stores, Suburban Houses) */}
      <Suspense fallback={null}>
        {buildings.map((b, i) => (
          <group key={`b-${i}`}>
            <Model path={b.path} position={[b.x, 0, b.z]} rotation={[0, b.ry, 0]} scale={b.scale} />
            {b.propPath && b.propPos && (
              <Model
                path={b.propPath}
                position={b.propPos}
                rotation={[0, b.ry, 0]}
                scale={b.propScale ?? 1.2}
              />
            )}
          </group>
        ))}
        {trees.map((t, i) => (
          <Model key={`tree-${i}`} path={t.path} position={t.pos} scale={t.scale} />
        ))}
      </Suspense>

      {/* Street Furniture (Lamps, Signals, Signs) */}
      <Suspense fallback={null}><StreetFurniture /></Suspense>

      {/* Live Two-Way Traffic on Multi-Avenues */}
      <Suspense fallback={null}>
        <NpcTraffic seed={seed} npcPositionsRef={npcPositionsRef} />
      </Suspense>

      {/* 3D Question Markers with Sky Beams */}
      {points.map((pt, i) => (
        <QuestionMarker
          key={`qm-${i}`}
          point={pt}
          index={i}
          completed={completedQuestionIndices.includes(i)}
          isNearest={nearestQuestionIndex === i}
        />
      ))}

      {/* Remote Players' Cars */}
      {Object.entries(players)
        .filter(([id, p]) => id !== playerId && typeof p?.name === "string" && p.position !== undefined)
        .map(([id, p], i) => (
          <RemoteCarAvatar key={`remote-${id}`} player={p} carIdx={i + 1} />
        ))}

      {/* Local Player Car with Complete Collision System */}
      <PlayerCarController
        roomCode={roomCode}
        playerId={playerId}
        carScene={playerCarScene}
        colliders={colliders}
        npcPositionsRef={npcPositionsRef}
        remotePlayers={players}
        questionPoints={points}
        isQuizOpen={isQuizOpen}
        joystickRef={joystickRef}
        isBrakingRef={isBrakingRef}
        onPlayerPosUpdate={onPlayerPosUpdate}
        onNearQuestion={onNearQuestion}
      />
    </>
  );
}

// ─── Canvas Export ────────────────────────────────────────────────────────────
export default function CityCanvas(props: CityCanvasProps) {
  return (
    <Canvas
      className="city-canvas"
      camera={{ position: [0, 3.5, -7.2], fov: 52 }}
      dpr={[1, 1.25]}
    >
      <Suspense fallback={null}>
        <CityScene {...props} />
      </Suspense>
    </Canvas>
  );
}
