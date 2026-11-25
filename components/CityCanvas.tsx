"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";
import { Suspense, useEffect, useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { ref, update } from "firebase/database";
import { realtimeDb } from "@/lib/firebase";
import { playerPetOptions } from "@/lib/player-characters";

// ─── Types ───────────────────────────────────────────────────────────────────
export type Point = { x: number; z: number };
export type RemotePlayer = {
  name: string;
  position?: { x: number; z: number };
  petIndex?: number;
  nameTagY?: number;
};

export type MapThemeId =
  | "mega-world"
  | "metropolis"
  | "nature-valley"
  | "forest"
  | "industrial-zone"
  | "suburban-town"
  | "random";

export type MapThemeConfig = {
  id: MapThemeId;
  name: string;
  tagline: string;
  icon: string;
  groundColor: string;
  sunColor: string;
  sunIntensity: number;
  ambientIntensity: number;
};

export const MAP_THEMES: Record<string, MapThemeConfig> = {
  "mega-world": {
    id: "mega-world",
    name: "Mega Gabungan (4 Distrik)",
    tagline: "Metropolis Sentral, Industri, Suburbia & Lembah Alam",
    icon: "🌐",
    groundColor: "#6fa379",
    sunColor: "#ffffff",
    sunIntensity: 2.2,
    ambientIntensity: 1.7,
  },
  metropolis: {
    id: "metropolis",
    name: "Metropolis Sentral",
    tagline: "Gedung Pencakar Langit, Pusat Bisnis & Shopping Boulevard",
    icon: "🏙️",
    groundColor: "#88b58d",
    sunColor: "#ffffff",
    sunIntensity: 2.2,
    ambientIntensity: 1.7,
  },
  "nature-valley": {
    id: "nature-valley",
    name: "Lembah Hijau & Camping",
    tagline: "Hutan Pinus Asri, Perkemahan, Tebing & Jembatan Alam",
    icon: "🌲",
    groundColor: "#4d945a",
    sunColor: "#fff7e6",
    sunIntensity: 2.4,
    ambientIntensity: 1.8,
  },
  forest: {
    id: "forest",
    name: "Hutan Rimba",
    tagline: "Hutan lebat, jalur tanah, pepohonan tinggi & semak alami",
    icon: "🌳",
    groundColor: "#315f3d",
    sunColor: "#fff4d6",
    sunIntensity: 1.9,
    ambientIntensity: 1.55,
  },
  "industrial-zone": {
    id: "industrial-zone",
    name: "Kawasan Industri & Cargo",
    tagline: "Pabrik Modern, Kontainer Kargo, Tangki & Cerobong",
    icon: "🏭",
    groundColor: "#4b545f",
    sunColor: "#ffe5cc",
    sunIntensity: 2.0,
    ambientIntensity: 1.6,
  },
  "suburban-town": {
    id: "suburban-town",
    name: "Kota Suburbia Asri",
    tagline: "Hunian Perumahan Asri, Pagar Rapi, Taman & Driveway",
    icon: "🏡",
    groundColor: "#70a374",
    sunColor: "#ffffff",
    sunIntensity: 2.2,
    ambientIntensity: 1.7,
  },
};

export function resolveMapThemeConfig(themeKey?: string): MapThemeConfig {
  if (!themeKey) return MAP_THEMES["mega-world"];
  const lower = themeKey.toLowerCase();
  if (lower.includes("forest") || lower.includes("rimba")) {
    return MAP_THEMES.forest;
  }
  if (lower.includes("nature") || lower.includes("lembah") || lower.includes("hutan") || lower.includes("camp")) {
    return MAP_THEMES["nature-valley"];
  }
  if (lower.includes("industr") || lower.includes("cargo") || lower.includes("pabrik")) {
    return MAP_THEMES["industrial-zone"];
  }
  if (lower.includes("suburb") || lower.includes("asri") || lower.includes("perumahan") || lower.includes("warm") || lower.includes("sunny")) {
    return MAP_THEMES["suburban-town"];
  }
  if (lower.includes("metropol") || lower.includes("downtown") || lower.includes("sentral") || lower.includes("city")) {
    return MAP_THEMES["metropolis"];
  }
  if (MAP_THEMES[themeKey]) return MAP_THEMES[themeKey];
  return MAP_THEMES["mega-world"];
}

export type JoystickInput = {
  x: number; // -1 to 1 (left to right)
  y: number; // -1 to 1 (down/reverse to up/forward)
};

export type ColliderBox = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  kind?: "building" | "prop"; // prop colliders can be knocked away
};

export type CityCanvasProps = {
  seed: number;
  questionCount: number;
  roomCode: string;
  playerId: string;
  playerName?: string;
  players: Record<string, RemotePlayer>;
  mapTheme?: string;
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
const natureRoot     = "/assets/3d-assets/kenney_nature-kit/Models/GLTF%20format";
const industrialRoot = "/assets/3d-assets/kenney_city-kit-industrial_2.0/Models/GLB%20format";
const blockyNatureRoot = "/assets/3d-assets/ohmtap-ot39-blocky-nature/models/glb";

// Keep the pet avatars visually comparable to the traffic cars. The Kenney
// pet models are slightly taller than the car models at their native scale.
const PLAYER_MODEL_SCALE = 0.65;
const PLAYER_NAMETAG_Y = 1.25;

// NPC traffic cars (vehicles in the city streets)
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

// ─── Nature Kit Assets (New!) ─────────────────────────────────────────────────
const naturePineDefaultPath  = `${natureRoot}/tree_pineDefaultA.glb`;
const naturePineTallPath     = `${natureRoot}/tree_pineTallA.glb`;
const naturePineRoundPath    = `${natureRoot}/tree_pineRoundA.glb`;
const natureOakPath          = `${natureRoot}/tree_oak.glb`;
const natureTreeDetailedPath = `${natureRoot}/tree_detailed.glb`;
const natureRockLargeAPath   = `${natureRoot}/rock_largeA.glb`;
const natureRockLargeBPath   = `${natureRoot}/rock_largeB.glb`;
const natureRockTallPath     = `${natureRoot}/rock_tallA.glb`;
const natureRockSmallPath    = `${natureRoot}/rock_smallA.glb`;
const natureCliffRockPath    = `${natureRoot}/cliff_block_rock.glb`;
const natureCliffStonePath   = `${natureRoot}/cliff_block_stone.glb`;
const natureTentOpenPath     = `${natureRoot}/tent_detailedOpen.glb`;
const natureTentClosedPath   = `${natureRoot}/tent_smallClosed.glb`;
const natureCampfirePath     = `${natureRoot}/campfire_stones.glb`;
const natureBridgeWoodPath   = `${natureRoot}/bridge_wood.glb`;
const natureBushPath         = `${natureRoot}/plant_bush.glb`;
const natureLogStackPath     = `${natureRoot}/log_stack.glb`;

// OhmTap OT-39: lightweight blocky nature set used by the dense forest biome.
const blockyForestTreePaths = [
  "A01_spruce_small", "A02_spruce_medium", "A03_spruce_tall", "A04_pine",
  "A05_birch_small", "A06_birch_tall", "A07_oak", "A08_oak_young",
].map((name) => `${blockyNatureRoot}/${name}.glb`);
const blockyForestGroundPaths = [
  "B01_grass_short", "B02_grass_medium", "B08_bush_round", "B11_fern",
].map((name) => `${blockyNatureRoot}/${name}.glb`);
const blockyForestDetailPaths = [
  "A10_stump", "A11_fallen_log", "A12_mushrooms", "C01_rock_small", "C02_rock_medium",
].map((name) => `${blockyNatureRoot}/${name}.glb`);

// ─── Industrial Kit Assets (New!) ─────────────────────────────────────────────
const industrialBuildingAPath    = `${industrialRoot}/building-a.glb`;
const industrialBuildingBPath    = `${industrialRoot}/building-b.glb`;
const industrialBuildingCPath    = `${industrialRoot}/building-c.glb`;
const industrialBuildingDPath    = `${industrialRoot}/building-d.glb`;
const industrialBuildingEPath    = `${industrialRoot}/building-e.glb`;
const industrialBuildingFPath    = `${industrialRoot}/building-f.glb`;
const industrialChimneyBasicPath = `${industrialRoot}/chimney-basic.glb`;
const industrialChimneyLargePath = `${industrialRoot}/chimney-large.glb`;
const industrialTankPath         = `${industrialRoot}/detail-tank.glb`;
const industrialTankLargePath    = `${industrialRoot}/detail-tank-large.glb`;
const industrialContainerAPath   = `${industrialRoot}/shipping-container-a.glb`;
const industrialContainerBPath   = `${industrialRoot}/shipping-container-b.glb`;
const industrialContainerCPath   = `${industrialRoot}/shipping-container-c.glb`;
const industrialWaterTowerPath   = `${industrialRoot}/water-tower.glb`;
const industrialWindmillPath     = `${industrialRoot}/windmill.glb`;
const industrialSolarPath        = `${industrialRoot}/solar-panel-portrait.glb`;

// ─── Road Infrastructure ──────────────────────────────────────────────────────
const roadStraightPath = `${roadsRoot}/road-straight.glb`;
const roadCrossPath    = `${roadsRoot}/road-crossroad.glb`;
const roadCrossingPath = `${roadsRoot}/road-crossing.glb`;
const streetLightPath  = `${roadsRoot}/light-square.glb`;
const trafficLightPath = `${roadsRoot}/traffic-light.glb`;
const stopSignPath     = `${roadsRoot}/road-sign-stop.glb`;

// ─── Street Props (knockable small objects) ───────────────────────────────────
const conePath         = `${roadsRoot}/construction-cone.glb`;
const dumpsterPath     = `${roadsRoot}/dumpster.glb`;
const electricityPolePath = `${roadsRoot}/electricity-pole-single.glb`;

// ─── Low-detail Commercial Background Buildings ───────────────────────────────
const lowDetailPaths = ["a","b","c","d","e","f","g","h","i","j"].map(
  (l) => `${commercialRoot}/low-detail-building-${l}.glb`
);

// ─── Suburban Path Tiles ──────────────────────────────────────────────────────
const pathLongPath     = `${suburbanRoot}/path-long.glb`;

// Keep the initial request queue small. The rest of the world loads
// progressively so mobile devices can show the first frame sooner.
npcCarPaths.forEach((p) => useGLTF.preload(p));
useGLTF.preload(roadStraightPath);
useGLTF.preload(roadCrossPath);
useGLTF.preload(roadCrossingPath);

// ─── Seeded RNG ───────────────────────────────────────────────────────────────
function lcg(seed: number, index: number): number {
  return ((seed * 1664525 + index * 22695477 + 1013904223) & 0x7fffffff) / 0x7fffffff;
}

// ─── Expansive City Grid Constants (Expanded to 260x260 World, 100 Blocks) ─────
// 11 major avenues across -100 to +100 (road runs from -112 to +112)
export const AVENUES = [-100, -80, -60, -40, -20, 0, 20, 40, 60, 80, 100];
export const ROAD_TILE_SCALE = 4.0; // Tile bounds are exactly 4x4 units
export const ROAD_STEP = 4.0;
export const ROAD_MIN = -112;
export const ROAD_MAX = 112;
export const WORLD_HALF_SIZE = 130;
export const WORLD_LIMIT = 108.0;

// ─── Road-Aligned Candidate Spots for Questions (Distributed across 260x260) ──
export const candidateSpots: Point[] = [
  // Central Core (Ring 0)
  { x: 0, z: -10 }, { x: 0, z: 10 }, { x: -10, z: 0 }, { x: 10, z: 0 },
  { x: 0, z: -20 }, { x: 0, z: 20 }, { x: -20, z: 0 }, { x: 20, z: 0 },
  { x: -20, z: -20 }, { x: 20, z: -20 }, { x: -20, z: 20 }, { x: 20, z: 20 },
  { x: -20, z: -10 }, { x: -20, z: 10 }, { x: 20, z: -10 }, { x: 20, z: 10 },
  { x: -10, z: -20 }, { x: 10, z: -20 }, { x: -10, z: 20 }, { x: 10, z: 20 },

  // Inner-Mid Ring (Ring ±40)
  { x: 0, z: -30 }, { x: 0, z: 30 }, { x: -30, z: 0 }, { x: 30, z: 0 },
  { x: -40, z: 0 }, { x: 40, z: 0 }, { x: 0, z: -40 }, { x: 0, z: 40 },
  { x: -40, z: -20 }, { x: -40, z: 20 }, { x: 40, z: -20 }, { x: 40, z: 20 },
  { x: -20, z: -40 }, { x: 20, z: -40 }, { x: -20, z: 40 }, { x: 20, z: 40 },
  { x: -40, z: -40 }, { x: 40, z: -40 }, { x: -40, z: 40 }, { x: 40, z: 40 },
  { x: -30, z: -40 }, { x: 30, z: -40 }, { x: -30, z: 40 }, { x: 30, z: 40 },

  // Mid-Outer Ring (Ring ±60)
  { x: 0, z: -50 }, { x: 0, z: 50 }, { x: -50, z: 0 }, { x: 50, z: 0 },
  { x: -60, z: 0 }, { x: 60, z: 0 }, { x: 0, z: -60 }, { x: 0, z: 60 },
  { x: -60, z: -20 }, { x: -60, z: 20 }, { x: 60, z: -20 }, { x: 60, z: 20 },
  { x: -20, z: -60 }, { x: 20, z: -60 }, { x: -20, z: 60 }, { x: 20, z: 60 },
  { x: -60, z: -40 }, { x: -60, z: 40 }, { x: 60, z: -40 }, { x: 60, z: 40 },
  { x: -40, z: -60 }, { x: 40, z: -60 }, { x: -40, z: 60 }, { x: 40, z: 60 },
  { x: -60, z: -60 }, { x: 60, z: -60 }, { x: -60, z: 60 }, { x: 60, z: 60 },

  // Outer Ring (Ring ±80)
  { x: 0, z: -70 }, { x: 0, z: 70 }, { x: -70, z: 0 }, { x: 70, z: 0 },
  { x: -80, z: 0 }, { x: 80, z: 0 }, { x: 0, z: -80 }, { x: 0, z: 80 },
  { x: -80, z: -20 }, { x: -80, z: 20 }, { x: 80, z: -20 }, { x: 80, z: 20 },
  { x: -20, z: -80 }, { x: 20, z: -80 }, { x: -20, z: 80 }, { x: 20, z: 80 },
  { x: -80, z: -40 }, { x: -80, z: 40 }, { x: 80, z: -40 }, { x: 80, z: 40 },
  { x: -40, z: -80 }, { x: 40, z: -80 }, { x: -40, z: 80 }, { x: 40, z: 80 },
  { x: -80, z: -60 }, { x: 80, z: -60 }, { x: -80, z: 60 }, { x: 80, z: 60 },
  { x: -60, z: -80 }, { x: 60, z: -80 }, { x: -60, z: 80 }, { x: 60, z: 80 },
  { x: -80, z: -80 }, { x: 80, z: -80 }, { x: -80, z: 80 }, { x: 80, z: 80 },

  // Expanded Perimeter Ring (Ring ±100 & Inter-avenue avenues)
  { x: 0, z: -90 }, { x: 0, z: 90 }, { x: -90, z: 0 }, { x: 90, z: 0 },
  { x: -100, z: 0 }, { x: 100, z: 0 }, { x: 0, z: -100 }, { x: 0, z: 100 },
  { x: -100, z: -20 }, { x: -100, z: 20 }, { x: 100, z: -20 }, { x: 100, z: 20 },
  { x: -20, z: -100 }, { x: 20, z: -100 }, { x: -20, z: 100 }, { x: 20, z: 100 },
  { x: -100, z: -40 }, { x: -100, z: 40 }, { x: 100, z: -40 }, { x: 100, z: 40 },
  { x: -40, z: -100 }, { x: 40, z: -100 }, { x: -40, z: 100 }, { x: 40, z: 100 },
  { x: -100, z: -60 }, { x: 100, z: -60 }, { x: -100, z: 60 }, { x: 100, z: 60 },
  { x: -60, z: -100 }, { x: 60, z: -100 }, { x: -60, z: 100 }, { x: 60, z: 100 },
  { x: -100, z: -80 }, { x: 100, z: -80 }, { x: -100, z: 80 }, { x: 100, z: 80 },
  { x: -80, z: -100 }, { x: 80, z: -100 }, { x: -80, z: 100 }, { x: 80, z: 100 },
  { x: -100, z: -100 }, { x: 100, z: -100 }, { x: -100, z: 100 }, { x: 100, z: 100 },
];

export function seededPoints(seed: number, count: number): Point[] {
  const actualCount = Math.min(Math.max(count, 3), candidateSpots.length);
  const spots = [...candidateSpots];
  // Shuffle deterministically
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(lcg(seed + i * 17, i) * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  // Greedy spread selection: enforce minimum 30-unit gap between chosen spots
  const MIN_GAP = 30;
  const selected: Point[] = [];
  for (const candidate of spots) {
    if (selected.length >= actualCount) break;
    const tooClose = selected.some(
      (s) => Math.hypot(s.x - candidate.x, s.z - candidate.z) < MIN_GAP
    );
    if (!tooClose) selected.push(candidate);
  }
  // If not enough spread spots, fill with remaining (shouldn't happen with large candidateSpots)
  if (selected.length < actualCount) {
    for (const candidate of spots) {
      if (selected.length >= actualCount) break;
      if (!selected.includes(candidate)) selected.push(candidate);
    }
  }
  return selected;
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

// ─── City Districts Generator (Downtown, Nature, Industrial, Suburban & Mega) ─
function useCityBlocks(seed: number, mapThemeKey?: string) {
  return useMemo(() => {
    const buildings: PlacedBuilding[] = [];
    const trees: { path: string; pos: [number, number, number]; scale: number }[] = [];
    const colliders: ColliderBox[] = [];

    const themeConfig = resolveMapThemeConfig(mapThemeKey);
    const themeId = themeConfig.id;

    // 10 blocks (10x10 = 100 blocks) between 11 avenues
    const blockIntervals = [
      { min: -97.5, max: -82.5 }, // col 0: -90
      { min: -77.5, max: -62.5 }, // col 1: -70
      { min: -57.5, max: -42.5 }, // col 2: -50
      { min: -37.5, max: -22.5 }, // col 3: -30
      { min: -17.5, max: -2.5 },  // col 4: -10
      { min: 2.5, max: 17.5 },    // col 5: 10
      { min: 22.5, max: 37.5 },   // col 6: 30
      { min: 42.5, max: 57.5 },   // col 7: 50
      { min: 62.5, max: 77.5 },   // col 8: 70
      { min: 82.5, max: 97.5 },   // col 9: 90
    ];

    let itemIdx = 0;

    blockIntervals.forEach((xBlock, col) => {
      blockIntervals.forEach((zBlock, row) => {
        const p1 = { x: xBlock.min + 3.2, z: zBlock.min + 3.2 };
        const p2 = { x: xBlock.max - 3.2, z: zBlock.min + 3.2 };
        const p3 = { x: xBlock.min + 3.2, z: zBlock.max - 3.2 };
        const p4 = { x: xBlock.max - 3.2, z: zBlock.max - 3.2 };
        const centerP = { x: (xBlock.min + xBlock.max) / 2, z: (zBlock.min + zBlock.max) / 2 };

        let blockType: "metropolis-core" | "metropolis-comm" | "nature" | "industrial" | "suburban" = "suburban";

        if (themeId === "nature-valley" || themeId === "forest") {
          blockType = "nature";
        } else if (themeId === "industrial-zone") {
          blockType = "industrial";
        } else if (themeId === "suburban-town") {
          blockType = "suburban";
        } else if (themeId === "metropolis") {
          if (col >= 3 && col <= 6 && row >= 3 && row <= 6) {
            blockType = "metropolis-core";
          } else {
            blockType = "metropolis-comm";
          }
        } else {
          // "mega-world" 4 distinct quadrants
          if (col < 5 && row < 5) {
            blockType = (col >= 2 && row >= 2) ? "metropolis-core" : "metropolis-comm";
          } else if (col >= 5 && row < 5) {
            blockType = "industrial";
          } else if (col < 5 && row >= 5) {
            blockType = "suburban";
          } else {
            blockType = "nature";
          }
        }

        // ── Block Type Implementations ──
        if (blockType === "nature") {
          // NATURE VALLEY / FULL FOREST BIOME
          if (themeId === "forest") {
            const forestPoints = [
              p1,
              p2,
              p3,
              p4,
              { x: centerP.x - 2.1, z: centerP.z + 1.8 },
              { x: centerP.x + 2.0, z: centerP.z - 1.7 },
            ];
            forestPoints.forEach((p, idx) => {
              trees.push({
                path: blockyForestTreePaths[(itemIdx + idx + col + row) % blockyForestTreePaths.length],
                pos: [p.x, 0, p.z],
                scale: idx < 4 ? 0.72 : 0.58,
              });
              // Keep only the main trees solid so collision checks remain light.
              if (idx < 4) {
                colliders.push({ minX: p.x - 0.75, maxX: p.x + 0.75, minZ: p.z - 0.75, maxZ: p.z + 0.75 });
              }
            });
            // Low vegetation fills the gaps without adding collision work for
            // every decorative object.
            [
              { x: centerP.x - 2.2, z: centerP.z - 2.1 },
              { x: centerP.x + 2.2, z: centerP.z + 2.0 },
            ].forEach((p, idx) => {
              trees.push({
                path: blockyForestGroundPaths[(itemIdx + idx + col * 2 + row) % blockyForestGroundPaths.length],
                pos: [p.x, 0, p.z],
                scale: idx === 0 ? 1.15 : 0.9,
              });
            });
            buildings.push({
              path: blockyForestDetailPaths[(itemIdx + col + row) % blockyForestDetailPaths.length],
              x: centerP.x,
              z: centerP.z,
              ry: (col + row) * 0.6,
              scale: 0.9,
            });
            itemIdx += 6;
          } else {
          const isCamp = (col + row) % 3 === 0;
          const isRockOutcrop = (col * 3 + row) % 4 === 1;

          if (isCamp) {
            buildings.push({
              path: (col + row) % 2 === 0 ? natureTentOpenPath : natureTentClosedPath,
              x: p1.x,
              z: p1.z,
              ry: 0,
              scale: 1.6,
            });
            colliders.push({ minX: p1.x - 1.2, maxX: p1.x + 1.2, minZ: p1.z - 1.2, maxZ: p1.z + 1.2 });

            buildings.push({
              path: natureCampfirePath,
              x: centerP.x,
              z: centerP.z,
              ry: 0,
              scale: 1.4,
              propPath: natureLogStackPath,
              propPos: [centerP.x + 2.0, 0, centerP.z],
              propScale: 1.2,
            });
            colliders.push({ minX: centerP.x - 0.9, maxX: centerP.x + 0.9, minZ: centerP.z - 0.9, maxZ: centerP.z + 0.9 });

            buildings.push({
              path: natureBridgeWoodPath,
              x: p4.x,
              z: p4.z,
              ry: Math.PI / 4,
              scale: 1.6,
            });
            colliders.push({ minX: p4.x - 1.3, maxX: p4.x + 1.3, minZ: p4.z - 1.3, maxZ: p4.z + 1.3 });

            [p2, p3].forEach((p, idx) => {
              trees.push({
                path: idx === 0 ? naturePineTallPath : naturePineRoundPath,
                pos: [p.x, 0, p.z],
                scale: 1.7,
              });
              colliders.push({ minX: p.x - 0.7, maxX: p.x + 0.7, minZ: p.z - 0.7, maxZ: p.z + 0.7 });
            });
          } else if (isRockOutcrop) {
            buildings.push({
              path: natureCliffRockPath,
              x: centerP.x,
              z: centerP.z,
              ry: (col * Math.PI) / 3,
              scale: 2.2,
            });
            colliders.push({ minX: centerP.x - 1.8, maxX: centerP.x + 1.8, minZ: centerP.z - 1.8, maxZ: centerP.z + 1.8 });

            [p1, p2, p3, p4].forEach((p, idx) => {
              const rockModel = idx % 2 === 0 ? natureRockLargeAPath : natureRockTallPath;
              buildings.push({
                path: rockModel,
                x: p.x,
                z: p.z,
                ry: idx * 1.2,
                scale: 1.6,
              });
              colliders.push({ minX: p.x - 1.2, maxX: p.x + 1.2, minZ: p.z - 1.2, maxZ: p.z + 1.2 });
            });
          } else {
            [p1, p2, p3, p4].forEach((p, idx) => {
              const treePaths = [naturePineDefaultPath, naturePineTallPath, natureOakPath, natureTreeDetailedPath];
              const tPath = treePaths[(itemIdx + idx) % treePaths.length];
              trees.push({
                path: tPath,
                pos: [p.x, 0, p.z],
                scale: 1.8,
              });
              colliders.push({ minX: p.x - 0.8, maxX: p.x + 0.8, minZ: p.z - 0.8, maxZ: p.z + 0.8 });
            });

            buildings.push({
              path: natureRockSmallPath,
              x: centerP.x,
              z: centerP.z,
              ry: 0.5,
              scale: 1.5,
              propPath: natureBushPath,
              propPos: [centerP.x + 1.5, 0, centerP.z + 1.5],
              propScale: 1.3,
            });
            colliders.push({ minX: centerP.x - 0.8, maxX: centerP.x + 0.8, minZ: centerP.z - 0.8, maxZ: centerP.z + 0.8 });
          }
          }
          itemIdx += 4;
        } else if (blockType === "industrial") {
          // INDUSTRIAL CARGO & FACTORY BIOME
          const indBuildings = [
            industrialBuildingAPath, industrialBuildingBPath, industrialBuildingCPath,
            industrialBuildingDPath, industrialBuildingEPath, industrialBuildingFPath
          ];
          const hasContainers = (col + row) % 2 === 0;

          if (hasContainers) {
            const containerPaths = [industrialContainerAPath, industrialContainerBPath, industrialContainerCPath];
            [p1, p2, p3, p4].forEach((p, idx) => {
              const cPath = containerPaths[(itemIdx + idx) % containerPaths.length];
              buildings.push({
                path: cPath,
                x: p.x,
                z: p.z,
                ry: idx % 2 === 0 ? 0 : Math.PI / 2,
                scale: 1.8,
              });
              colliders.push({ minX: p.x - 1.3, maxX: p.x + 1.3, minZ: p.z - 1.3, maxZ: p.z + 1.3 });
            });

            const isWater = (col + row) % 4 === 0;
            buildings.push({
              path: isWater ? industrialWaterTowerPath : industrialSolarPath,
              x: centerP.x,
              z: centerP.z,
              ry: 0,
              scale: isWater ? 2.0 : 1.7,
            });
            colliders.push({ minX: centerP.x - 1.2, maxX: centerP.x + 1.2, minZ: centerP.z - 1.2, maxZ: centerP.z + 1.2 });
          } else {
            [p1, p2, p3, p4].forEach((p, idx) => {
              const bPath = indBuildings[(itemIdx + idx) % indBuildings.length];
              const isChimney = idx === 1;
              buildings.push({
                path: bPath,
                x: p.x,
                z: p.z,
                ry: (idx * Math.PI) / 2,
                scale: 2.3,
                propPath: isChimney ? industrialChimneyBasicPath : industrialTankPath,
                propPos: isChimney ? [p.x, 2.0, p.z] : [p.x + 1.6, 0, p.z],
                propScale: 1.4,
              });
              colliders.push({ minX: p.x - 1.6, maxX: p.x + 1.6, minZ: p.z - 1.6, maxZ: p.z + 1.6 });
            });
            buildings.push({
              path: industrialTankLargePath,
              x: centerP.x,
              z: centerP.z,
              ry: 0,
              scale: 1.8,
            });
            colliders.push({ minX: centerP.x - 1.3, maxX: centerP.x + 1.3, minZ: centerP.z - 1.3, maxZ: centerP.z + 1.3 });
          }
          itemIdx += 4;
        } else if (blockType === "metropolis-core") {
          // DOWNTOWN SKYSCRAPERS
          [p1, p2, p3, p4].forEach((p, idx) => {
            const sc = 2.8;
            buildings.push({
              path: skyscraperPaths[(idx + seed + itemIdx) % skyscraperPaths.length],
              x: p.x,
              z: p.z,
              ry: (idx * Math.PI) / 2,
              scale: sc,
            });
            colliders.push({
              minX: p.x - 1.7, maxX: p.x + 1.7, minZ: p.z - 1.7, maxZ: p.z + 1.7,
            });
          });
          trees.push({ path: treeLargePath, pos: [centerP.x, 0, centerP.z], scale: 1.4 });
          colliders.push({
            minX: centerP.x - 0.7, maxX: centerP.x + 0.7, minZ: centerP.z - 0.7, maxZ: centerP.z + 0.7,
          });
          itemIdx += 4;
        } else if (blockType === "metropolis-comm") {
          // COMMERCIAL RETAIL, SHOPS & CAFES
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
              minX: p.x - 1.6, maxX: p.x + 1.6, minZ: p.z - 1.6, maxZ: p.z + 1.6,
            });
          });
          trees.push({
            path: (col + row) % 2 === 0 ? treeLargePath : planterPath,
            pos: [centerP.x, 0, centerP.z],
            scale: 1.3,
          });
          colliders.push({
            minX: centerP.x - 0.7, maxX: centerP.x + 0.7, minZ: centerP.z - 0.7, maxZ: centerP.z + 0.7,
          });
          itemIdx += 4;
        } else {
          // SUBURBAN RESIDENTIAL HOMES & GARDENS
          [p1, p2, p3, p4].forEach((p, idx) => {
            const sc = 2.3;
            const model = suburbanBuildingPaths[(itemIdx + seed) % suburbanBuildingPaths.length];
            itemIdx++;
            const ry = idx < 2 ? 0 : Math.PI;
            buildings.push({
              path: model,
              x: p.x,
              z: p.z,
              ry,
              scale: sc,
            });
            colliders.push({
              minX: p.x - 1.55, maxX: p.x + 1.55, minZ: p.z - 1.55, maxZ: p.z + 1.55,
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
  }, [seed, mapThemeKey]);
}

// ─── Suburban Path Tiles + Fence + Driveway extra assets ─────────────────────
const fence1x2Path     = `${suburbanRoot}/fence-1x2.glb`;
const fence1x4Path     = `${suburbanRoot}/fence-1x4.glb`;
const fence2x2Path     = `${suburbanRoot}/fence-2x2.glb`;
const fenceLowPath     = `${suburbanRoot}/fence-low.glb`;
const drivewayShortPath = `${suburbanRoot}/driveway-short.glb`;
const drivewayLongPath  = `${suburbanRoot}/driveway-long.glb`;
const pathStonesLongPath = `${suburbanRoot}/path-stones-long.glb`;
const pathStonesShortPath = `${suburbanRoot}/path-stones-short.glb`;
const pathStonesMessyPath = `${suburbanRoot}/path-stones-messy.glb`;
const pathShortPath    = `${suburbanRoot}/path-short.glb`;

// preload extra suburban assets
useGLTF.preload(fence1x2Path);
useGLTF.preload(fence1x4Path);
useGLTF.preload(fence2x2Path);
useGLTF.preload(fenceLowPath);
useGLTF.preload(drivewayShortPath);
useGLTF.preload(drivewayLongPath);
useGLTF.preload(pathStonesLongPath);
useGLTF.preload(pathStonesShortPath);
useGLTF.preload(pathStonesMessyPath);
useGLTF.preload(pathShortPath);

// ─── Street Furniture (Illuminated Boulevards, Signals, Signs) ────────────────
function StreetFurniture() {
  const streetProps = useMemo(() => {
    const lights: [number, number, number, number][] = [];
    const trafficLights: [number, number, number, number][] = [];
    const stopSigns: [number, number, number, number][] = [];

    // Street lights along avenues on curbs
    for (const avenue of AVENUES) {
      for (let c = ROAD_MIN + 6; c <= ROAD_MAX - 6; c += 24) {
        // Horizontal avenue curbs
        lights.push([c, 0, avenue - 2.4, 0]);
        lights.push([c, 0, avenue + 2.4, Math.PI]);
        // Vertical avenue curbs
        lights.push([avenue - 2.4, 0, c, Math.PI / 2]);
        lights.push([avenue + 2.4, 0, c, -Math.PI / 2]);
      }
    }

    // Traffic signals and stop signs at selected intersections
    for (const ax of AVENUES) {
      for (const az of AVENUES) {
        if ((ax + az) % 40 === 0) {
          trafficLights.push([ax + 2.5, 0, az + 2.5, Math.PI]);
          stopSigns.push([ax + 2.5, 0, az - 2.5, -Math.PI / 2]);
        }
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

// ─── Street Props (Curb Decorations: Cones, Planters, Electricity Poles, Fences, Driveways) ─────
function StreetProps({ seed }: { seed: number }) {
  const propList = useMemo(() => {
    const items: { path: string; pos: [number, number, number]; rot: number; scale: number }[] = [];

    // Place props along avenue curbs at regular intervals
    const propPaths = [conePath, planterPath, electricityPolePath, planterPath, conePath];
    let idx = 0;
    for (const avenue of AVENUES) {
      for (let c = ROAD_MIN + 10; c <= ROAD_MAX - 10; c += 14) {
        const r1 = lcg(seed + idx, 1);
        const r2 = lcg(seed + idx, 2);
        if (r1 > 0.45) { // 55% of slots get a prop — denser
          const propPath = propPaths[Math.floor(r2 * propPaths.length)];
          const offset = 3.0 + r1 * 0.5;
          // Horizontal avenue: prop on north & south curbs
          items.push({ path: propPath, pos: [c, 0, avenue - offset], rot: 0, scale: 1.1 });
          if (lcg(seed + idx, 3) > 0.35) {
            items.push({ path: propPath, pos: [c, 0, avenue + offset], rot: Math.PI, scale: 1.1 });
          }
          // Vertical avenue: prop on east & west curbs
          items.push({ path: propPath, pos: [avenue - offset, 0, c], rot: Math.PI / 2, scale: 1.1 });
          if (lcg(seed + idx, 4) > 0.35) {
            items.push({ path: propPath, pos: [avenue + offset, 0, c], rot: -Math.PI / 2, scale: 1.1 });
          }
        }
        // Dumpster occasionally
        if (lcg(seed + idx, 5) > 0.84) {
          items.push({ path: dumpsterPath, pos: [c + 1, 0, avenue - 3.2], rot: 0, scale: 1.0 });
        }
        idx++;
      }
    }

    // ── Suburban fence rows along outer block perimeters ──
    const outerBlockCenters = [-90, -70, 70, 90]; // outer blocks
    const innerBlockCenters = [-50, -30, -10, 10, 30, 50];  // inner blocks
    const fenceVariants = [fence1x2Path, fence1x4Path, fence2x2Path, fenceLowPath];

    for (const bx of outerBlockCenters) {
      for (const bz of [...outerBlockCenters, ...innerBlockCenters]) {
        const fi = Math.floor(lcg(seed + bx * 7 + bz, 10) * fenceVariants.length);
        const fencePath2 = fenceVariants[fi];
        const ry = lcg(seed + bx + bz, 11) > 0.5 ? Math.PI / 2 : 0;
        // Front fence of suburban block
        items.push({ path: fencePath2, pos: [bx, 0, bz - 5.5], rot: ry, scale: 1.3 });
        items.push({ path: fencePath2, pos: [bx, 0, bz + 5.5], rot: ry + Math.PI, scale: 1.3 });
        // Side fence
        items.push({ path: fencePath2, pos: [bx - 5.5, 0, bz], rot: ry + Math.PI / 2, scale: 1.3 });
        items.push({ path: fencePath2, pos: [bx + 5.5, 0, bz], rot: ry - Math.PI / 2, scale: 1.3 });
      }
    }

    // ── Driveway tiles in front of suburban houses ──
    const drivewayPaths2 = [drivewayShortPath, drivewayLongPath];
    for (const bx of outerBlockCenters) {
      for (const bz of outerBlockCenters) {
        const dIdx = Math.floor(lcg(seed + bx + bz, 20) * drivewayPaths2.length);
        items.push({ path: drivewayPaths2[dIdx], pos: [bx, 0, bz - 4.0], rot: 0, scale: 1.1 });
        items.push({ path: drivewayPaths2[dIdx], pos: [bx, 0, bz + 4.0], rot: Math.PI, scale: 1.1 });
      }
    }

    // ── Path stone decorations in midtown plazas ──
    const pathStonePaths = [pathStonesLongPath, pathStonesShortPath, pathStonesMessyPath, pathShortPath];
    for (const bx of innerBlockCenters) {
      for (const bz of innerBlockCenters) {
        const psIdx = Math.floor(lcg(seed + bx * 3 + bz, 30) * pathStonePaths.length);
        if (lcg(seed + bx + bz * 2, 31) > 0.4) {
          items.push({ path: pathStonePaths[psIdx], pos: [bx + 2, 0, bz], rot: 0, scale: 1.0 });
          items.push({ path: pathStonePaths[psIdx], pos: [bx - 2, 0, bz], rot: Math.PI, scale: 1.0 });
        }
      }
    }

    return items;
  }, [seed]);

  return (
    <>
      {propList.map((p, i) => (
        <Model key={`sp-${i}`} path={p.path} position={p.pos} rotation={[0, p.rot, 0]} scale={p.scale} />
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

    // Select 4 avenue corridors for NPC traffic across the 260x260 world
    const npcHAvenues = [-40, 40]; // 2 horizontal corridors
    const npcVAvenues = [-40, 40]; // 2 vertical corridors

    npcHAvenues.forEach((z, li) => {
      // Eastbound lane
      list.push({
        carPath: npcCarPaths[(seed + li * 2) % npcCarPaths.length],
        sx: ROAD_MIN, sz: z + 0.9,
        ex: ROAD_MAX, ez: z + 0.9,
        speed: 6.0 + lcg(seed + li, 1) * 3,
        offset: lcg(seed + li, 2),
      });
      // Westbound lane
      list.push({
        carPath: npcCarPaths[(seed + li * 2 + 1) % npcCarPaths.length],
        sx: ROAD_MAX, sz: z - 0.9,
        ex: ROAD_MIN, ez: z - 0.9,
        speed: 6.0 + lcg(seed + li, 3) * 3,
        offset: lcg(seed + li, 4),
      });
    });

    npcVAvenues.forEach((x, li) => {
      // Southbound lane
      list.push({
        carPath: npcCarPaths[(seed + li * 2 + 2) % npcCarPaths.length],
        sx: x + 0.9, sz: ROAD_MIN,
        ex: x + 0.9, ez: ROAD_MAX,
        speed: 6.0 + lcg(seed + li, 5) * 3,
        offset: lcg(seed + li, 6),
      });
      // Northbound lane
      list.push({
        carPath: npcCarPaths[(seed + li * 2 + 3) % npcCarPaths.length],
        sx: x - 0.9, sz: ROAD_MAX,
        ex: x - 0.9, ez: ROAD_MIN,
        speed: 6.0 + lcg(seed + li, 7) * 3,
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

// ─── Flying Prop State (knocked small objects) ────────────────────────────────
type FlyingPropState = {
  id: number;
  path: string;
  startX: number;
  startZ: number;
  velX: number;
  velZ: number;
  spin: number;
  age: number; // seconds since spawned
};

const MAX_FLYING_DURATION = 1.5; // seconds

function FlyingPropMesh({ prop }: { prop: FlyingPropState }) {
  const { scene } = useGLTF(prop.path);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const meshRef = useRef<THREE.Group>(null);
  const ageRef = useRef(prop.age);

  useFrame((_, delta) => {
    ageRef.current += delta;
    if (!meshRef.current) return;
    const t = ageRef.current;
    // parabolic arc: gravity pulls down after peak
    const gravity = 9.8;
    const vY0 = 4.0; // initial upward velocity
    const y = Math.max(0, vY0 * t - 0.5 * gravity * t * t);
    meshRef.current.position.set(
      prop.startX + prop.velX * t,
      y,
      prop.startZ + prop.velZ * t
    );
    meshRef.current.rotation.y += prop.spin * delta;
    meshRef.current.rotation.x += prop.spin * 0.5 * delta;
  });

  return (
    <group ref={meshRef} position={[prop.startX, 0, prop.startZ]}>
      <primitive object={cloned} scale={1.0} />
    </group>
  );
}

// ─── Remote Player Pet Avatar ─────────────────────────────────────────────────
function RemotePetAvatar({
  player,
  petIdx,
  showNameTag,
}: {
  player: RemotePlayer;
  petIdx: number;
  showNameTag: boolean;
}) {
  const petPath = playerPetOptions[petIdx % playerPetOptions.length];
  const { scene } = useGLTF(petPath);
  const petScene = useMemo(() => scene.clone(true), [scene]);
  const x = player.position?.x ?? 0;
  const z = player.position?.z ?? 0;
  return (
    <group position={[x, 0, z]}>
      <primitive object={petScene} scale={PLAYER_MODEL_SCALE} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.65, 20]} />
        <meshBasicMaterial color="#111" transparent opacity={0.25} />
      </mesh>
      {/* Player name tag floating above remote pet */}
      {showNameTag && (
        <Html position={[0, player.nameTagY ?? PLAYER_NAMETAG_Y, 0]} center distanceFactor={12} zIndexRange={[2, 0]}>
          <div className="player-nametag">{player.name}</div>
        </Html>
      )}
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
// Returns 'building' if hit a solid building, 'prop' if hit a small prop, false if no hit
function resolveObstacleCollision(
  carPos: THREE.Vector3,
  carRadius: number,
  colliders: ColliderBox[]
): "building" | "prop" | false {
  let hitKind: "building" | "prop" | false = false;

  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    const closestX = Math.max(box.minX, Math.min(carPos.x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(carPos.z, box.maxZ));

    const dx = carPos.x - closestX;
    const dz = carPos.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < carRadius * carRadius) {
      const kind = box.kind ?? "building";
      hitKind = hitKind === "building" ? "building" : kind;

      // Props don't push back the car (car passes through with minor deceleration)
      if (kind === "prop") continue;

      // Buildings: rigid push out
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

  return hitKind;
}

// ─── Player Pet Controller with Expansive Speed, Hop Physics & Collision ──────
function PlayerPetController({
  roomCode,
  playerId,
  playerName = "",
  petPath,
  colliders,
  npcPositionsRef,
  remotePlayers,
  questionPoints = [],
  isQuizOpen = false,
  joystickRef,
  isBrakingRef,
  onPlayerPosUpdate,
  onNearQuestion,
  onPropHit,
}: {
  roomCode: string;
  playerId: string;
  playerName?: string;
  petPath: string;
  colliders: ColliderBox[];
  npcPositionsRef: React.MutableRefObject<Array<{ x: number; z: number }>>;
  remotePlayers: Record<string, RemotePlayer>;
  questionPoints?: Point[];
  isQuizOpen?: boolean;
  joystickRef?: React.RefObject<JoystickInput>;
  isBrakingRef?: React.RefObject<boolean>;
  onPlayerPosUpdate?: (pos: { x: number; z: number }) => void;
  onNearQuestion?: (index: number | null) => void;
  onPropHit?: (pos: { x: number; z: number }, heading: number) => void;
}) {
  const petGroupRef = useRef<THREE.Group>(null);

  // Character starts at center intersection (0, 0, 0)
  const posRef     = useRef(new THREE.Vector3(0, 0, 0));
  const headingRef = useRef(0);
  const speedRef   = useRef(0);
  const bumpRef    = useRef(0);
  const hopRef     = useRef(0); // Cute running bounce animation

  // Smooth steering & damped camera follow refs
  const steerAngleRef   = useRef(0);
  const smoothCamYawRef = useRef(0);

  // Camera placed 7.4 units behind pet
  const camPosRef  = useRef(new THREE.Vector3(0, 3.5, -7.4));
  const camLookRef = useRef(new THREE.Vector3(0, 1.0, 3.5));

  const keys          = useRef<Record<string, boolean>>({});
  const lastSync      = useRef(0);
  const lastPosReport = useRef(0);
  const { camera, gl } = useThree();
  // Loaded inside the player boundary so the rest of the city can render
  // while the selected avatar is still downloading.
  const { scene: petBase } = useGLTF(petPath);
  const petScene = useMemo(() => petBase.clone(true), [petBase]);

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

  // Touch / pointer swipe for rotating camera orbit (yaw + pitch)
  const swipeYaw   = useRef(0);
  const swipePitch = useRef(0.42); // ~24° elevation in radians
  useEffect(() => {
    const canvas = gl.domElement;
    let lastX = 0;
    let lastY = 0;
    const isJoystickZone = (e: PointerEvent) => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      return e.clientX > cw * 0.65 && e.clientY > ch * 0.72;
    };
    const onDown = (e: PointerEvent) => {
      if (isJoystickZone(e)) return;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!(e.buttons & 1)) return;
      if (isJoystickZone(e)) return;
      swipeYaw.current   -= (e.clientX - lastX) * 0.007;
      swipePitch.current  = THREE.MathUtils.clamp(
        swipePitch.current + (e.clientY - lastY) * 0.004,
        0.18,  // ~10° min (looking nearly level)
        1.1    // ~63° max (looking steeply down)
      );
      lastX = e.clientX;
      lastY = e.clientY;
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
    let rawSteer = 0;

    if (isQuizOpen) {
      speedRef.current = 0;
      steerAngleRef.current = 0;
    } else {
      const joyX = joystickRef?.current?.x ?? 0;
      const joyY = joystickRef?.current?.y ?? 0;
      const isBraking = isBrakingRef?.current ?? false;

      const keyAccel   = (keys.current["w"] || keys.current["arrowup"]) ? 1 : 0;
      const keyReverse = (keys.current["s"] || keys.current["arrowdown"]) ? 1 : 0;
      const keyLeft    = (keys.current["a"] || keys.current["arrowleft"]) ? 1 : 0;
      const keyRight   = (keys.current["d"] || keys.current["arrowright"]) ? 1 : 0;

      // Throttle inputs
      const fwdThrottle = Math.max(keyAccel, joyY > 0 ? joyY : 0);
      const revThrottle = Math.max(keyReverse, joyY < 0 ? -joyY : 0);

      // Raw steering input: keyboard overrides joystick if pressed
      if (keyLeft) rawSteer = 1;
      else if (keyRight) rawSteer = -1;
      else if (Math.abs(joyX) > 0.04) rawSteer = -joyX;

      // ── Smooth Steering Interpolation ──
      // Transitions smoothly towards target angle, eliminating sudden snap
      const steerLerpSpeed = 9.5;
      steerAngleRef.current = THREE.MathUtils.lerp(
        steerAngleRef.current,
        rawSteer,
        1 - Math.pow(0.001, dt * steerLerpSpeed)
      );

      // Cruise dynamics tuned for expansive 260x260 world
      const maxFwd = 17.5;
      const maxRev = 7.0;
      const acc = 22.0;
      const coastDrag = 2.4;  // Natural rolling coasting (smooth glide on throttle release)
      const activeBrake = 24.0; // Responsive deceleration on active brake or reverse key

      if (isBraking) {
        speedRef.current = THREE.MathUtils.lerp(speedRef.current, 0, dt * 14);
        if (Math.abs(speedRef.current) < 0.08) speedRef.current = 0;
      } else if (fwdThrottle > 0.04) {
        if (speedRef.current < -0.3) {
          // If reversing, forward key acts as smooth brake first
          speedRef.current += activeBrake * dt;
        } else {
          const targetMax = maxFwd * fwdThrottle;
          speedRef.current = Math.min(speedRef.current + acc * fwdThrottle * dt, targetMax);
        }
      } else if (revThrottle > 0.04) {
        if (speedRef.current > 0.5) {
          // If moving forward, reverse key acts as smooth progressive brake!
          // This eliminates the violent instant velocity reversal
          speedRef.current = Math.max(speedRef.current - activeBrake * revThrottle * dt, 0);
        } else {
          const targetRev = -maxRev * revThrottle;
          speedRef.current = Math.max(speedRef.current - (acc * 0.75) * revThrottle * dt, targetRev);
        }
      } else {
        // Smooth rolling coasting with gentle drag
        const dragFactor = Math.exp(-coastDrag * dt);
        speedRef.current *= dragFactor;
        if (Math.abs(speedRef.current) < 0.05) speedRef.current = 0;
      }

      // ── Dynamic Speed-Adaptive Turning Curve ──
      const currentSpeedMag = Math.abs(speedRef.current);
      // Turning is stable at high speeds and nimble at low-mid speeds
      const speedFactor = THREE.MathUtils.clamp(currentSpeedMag / (maxFwd * 0.4), 0.28, 1.0);
      const steerRate = 2.45 * speedFactor;
      const steerDir = Math.sign(speedRef.current || 1);

      if (Math.abs(steerAngleRef.current) > 0.01 && currentSpeedMag > 0.05) {
        headingRef.current += steerAngleRef.current * steerRate * dt * steerDir;
      }

      // Movement vector
      const moveDir = new THREE.Vector3(Math.sin(headingRef.current), 0, Math.cos(headingRef.current));
      posRef.current.addScaledVector(moveDir, speedRef.current * dt);

      // ── Collision Resolution with Smooth Wall Sliding ──
      const carRadius = 0.85;
      const hitResult = resolveObstacleCollision(posRef.current, carRadius, colliders);
      const hitBuilding = hitResult === "building";
      const hitProp     = hitResult === "prop";

      // Expanded City Outer Boundary Limit (108.0 units for 260x260 world)
      const limit = WORLD_LIMIT;
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

      // Smooth collision sliding (damps velocity instead of violent negative bounce)
      if (hitBuilding || hitBorder) {
        speedRef.current *= 0.65;
        bumpRef.current = Math.min(bumpRef.current + 0.04, 0.08);
      } else if (hitNpc || hitPlayer) {
        speedRef.current *= 0.4;
        bumpRef.current = Math.min(bumpRef.current + 0.06, 0.12);
      } else if (hitProp) {
        speedRef.current *= 0.85;
        bumpRef.current = Math.min(bumpRef.current + 0.03, 0.06);
        onPropHit?.({ x: posRef.current.x, z: posRef.current.z }, headingRef.current);
      }
    }

    // ── Cute Running Hop & Waddle Animation ──
    const curSpeed = Math.abs(speedRef.current);
    if (curSpeed > 0.15) {
      hopRef.current += dt * (curSpeed * 1.3 + 7.0);
    }
    const hopY = curSpeed > 0.15 ? Math.abs(Math.sin(hopRef.current)) * 0.16 : 0;
    const waddleZ = curSpeed > 0.15 ? Math.sin(hopRef.current * 0.5) * 0.04 : 0;

    bumpRef.current = THREE.MathUtils.lerp(bumpRef.current, 0, dt * 10);
    const tiltZ = !isQuizOpen ? -steerAngleRef.current * 0.05 : 0;

    if (petGroupRef.current) {
      petGroupRef.current.position.set(posRef.current.x, bumpRef.current + hopY, posRef.current.z);
      petGroupRef.current.rotation.y = headingRef.current;
      petGroupRef.current.rotation.z = THREE.MathUtils.lerp(
        petGroupRef.current.rotation.z, tiltZ + waddleZ, 1 - Math.pow(0.001, dt)
      );
    }

    // ── Buttery Smooth Damped Follow Camera ──
    const targetCamTotalYaw = headingRef.current + swipeYaw.current;
    // Damped camera rotation follows pet with silky smooth lag (~6.5 rad/s)
    smoothCamYawRef.current = THREE.MathUtils.lerp(
      smoothCamYawRef.current,
      targetCamTotalYaw,
      1 - Math.pow(0.001, dt * 6.5)
    );

    const pitch = swipePitch.current; // 0.18–1.1 radians
    const camRadius = 7.4;
    const camOffX = -Math.sin(smoothCamYawRef.current) * Math.cos(pitch) * camRadius;
    const camOffY =  Math.sin(pitch) * camRadius;
    const camOffZ = -Math.cos(smoothCamYawRef.current) * Math.cos(pitch) * camRadius;

    const desiredCam = new THREE.Vector3(
      posRef.current.x + camOffX,
      posRef.current.y + camOffY,
      posRef.current.z + camOffZ,
    );
    camPosRef.current.lerp(desiredCam, 1 - Math.pow(0.0001, dt * 8));
    camera.position.copy(camPosRef.current);

    // Dynamic look-ahead: gently leads ahead in motion direction for excellent visibility
    const lookLead = Math.min(curSpeed * 0.1, 1.6);
    const desiredLook = new THREE.Vector3(
      posRef.current.x + Math.sin(headingRef.current) * lookLead,
      posRef.current.y + 0.8,
      posRef.current.z + Math.cos(headingRef.current) * lookLead,
    );
    camLookRef.current.lerp(desiredLook, 1 - Math.pow(0.001, dt * 8));
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
      performance.now() - lastSync.current > 250
    ) {
      lastSync.current = performance.now();
      void update(
        ref(realtimeDb, `rooms/${roomCode}/positions/${playerId}`),
        { x: posRef.current.x, z: posRef.current.z },
      ).catch((err) => console.error("Position sync failed", err));
    }
  });

  return (
    <group ref={petGroupRef}>
      <primitive object={petScene} scale={PLAYER_MODEL_SCALE} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.65, 20]} />
        <meshBasicMaterial color="#111" transparent opacity={0.28} />
      </mesh>
      {/* Player name tag floating above local pet */}
      {playerName && !isQuizOpen && (
        <Html position={[0, PLAYER_NAMETAG_Y, 0]} center distanceFactor={12} zIndexRange={[2, 0]}>
          <div className="player-nametag player-nametag--self">{playerName}</div>
        </Html>
      )}
    </group>
  );
}

// ─── Full City Scene ──────────────────────────────────────────────────────────
// Knockable prop paths (small, can fly when hit)
const KNOCKABLE_PROP_PATHS = [conePath, planterPath, dumpsterPath];
let flyingPropIdCounter = 0;

function CityScene({
  seed,
  questionCount,
  roomCode,
  playerId,
  playerName = "",
  players,
  mapTheme = "mega-world",
  questionPoints: customPoints,
  completedQuestionIndices = [],
  nearestQuestionIndex = null,
  isQuizOpen = false,
  joystickRef,
  isBrakingRef,
  onPlayerPosUpdate,
  onNearQuestion,
}: CityCanvasProps) {
  const themeConfig = useMemo(() => resolveMapThemeConfig(mapTheme), [mapTheme]);

  const points = useMemo(
    () => customPoints && customPoints.length > 0 ? customPoints : seededPoints(seed, questionCount),
    [customPoints, seed, questionCount]
  );

  const npcPositionsRef = useRef<Array<{ x: number; z: number }>>([]);

  // Flying props state: small objects knocked away by player car
  const [flyingProps, setFlyingProps] = useState<FlyingPropState[]>([]);
  const lastPropHitRef = useRef(0);
  const flyingPropTimeoutsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const timeouts = flyingPropTimeoutsRef.current;
    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timeouts.clear();
    };
  }, []);

  const handlePropHit = useMemo(() => (pos: { x: number; z: number }, heading: number) => {
    const now = performance.now();
    if (now - lastPropHitRef.current < 400) return;
    lastPropHitRef.current = now;

    const propPath = KNOCKABLE_PROP_PATHS[Math.floor(Math.random() * KNOCKABLE_PROP_PATHS.length)];
    const spreadAngle = heading + (Math.random() - 0.5) * 1.4;
    const speed = 3.5 + Math.random() * 3;
    const newProp: FlyingPropState = {
      id: ++flyingPropIdCounter,
      path: propPath,
      startX: pos.x + Math.sin(heading) * 1.5,
      startZ: pos.z + Math.cos(heading) * 1.5,
      velX: Math.sin(spreadAngle) * speed,
      velZ: Math.cos(spreadAngle) * speed,
      spin: (Math.random() - 0.5) * 10,
      age: 0,
    };
    setFlyingProps((prev) => [...prev.slice(-4), newProp]);
    const timeoutId = window.setTimeout(() => {
      flyingPropTimeoutsRef.current.delete(timeoutId);
      setFlyingProps((prev) => prev.filter((p) => p.id !== newProp.id));
    }, MAX_FLYING_DURATION * 1000 + 100);
    flyingPropTimeoutsRef.current.add(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playerPetIdx = useMemo(() => {
    const selectedPetIndex = players[playerId]?.petIndex;
    if (typeof selectedPetIndex === "number" && selectedPetIndex >= 0) {
      return selectedPetIndex % playerPetOptions.length;
    }
    let h = 0;
    for (let i = 0; i < playerId.length; i++) h = (h * 31 + playerId.charCodeAt(i)) & 0xffff;
    return h % playerPetOptions.length;
  }, [playerId, players]);

  const { buildings, trees, colliders } = useCityBlocks(seed, mapTheme);

  return (
    <>
      {/* Lighting tuned dynamically to chosen Map Theme */}
      <ambientLight intensity={themeConfig.ambientIntensity} />
      <directionalLight position={[20, 30, 15]} intensity={themeConfig.sunIntensity} color={themeConfig.sunColor} />
      <directionalLight position={[-20, 15, -15]} intensity={0.6} color="#c8d8ff" />

      {/* Expansive Ground Plane (260x260) with Map Theme palette */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[260, 260]} />
        <meshStandardMaterial color={themeConfig.groundColor} />
      </mesh>

      {/* Seamless Continuous Road Network */}
      <Suspense fallback={null}><RoadGrid /></Suspense>

      {/* Thematic Buildings, Nature Kits, Industrial Kits, Houses & Props */}
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

      {/* Street Props (Cones, Planters, Fences, Driveways, Path Stones along sidewalks) */}
      <Suspense fallback={null}><StreetProps seed={seed} /></Suspense>

      {/* Flying Props (knocked away on prop collision) */}
      <Suspense fallback={null}>
        {flyingProps.map((fp) => (
          <FlyingPropMesh key={`fp-${fp.id}`} prop={fp} />
        ))}
      </Suspense>

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

      {/* Remote Players' Pets */}
      <Suspense fallback={null}>
        {Object.entries(players)
          .filter(([id, p]) => id !== playerId && typeof p?.name === "string" && p.position !== undefined)
          .map(([id, p], i, entries) => {
            const x = p.position?.x ?? 0;
            const z = p.position?.z ?? 0;
            const stackedBefore = entries.slice(0, i).filter(([, other]) => {
              const ox = other.position?.x ?? 0;
              const oz = other.position?.z ?? 0;
              return Math.hypot(x - ox, z - oz) < 2.2;
            }).length;
            return (
              <RemotePetAvatar
                key={`remote-${id}`}
                player={{ ...p, nameTagY: PLAYER_NAMETAG_Y + Math.min(stackedBefore, 4) * 0.24 }}
                petIdx={p.petIndex ?? i + 1}
                showNameTag={!isQuizOpen}
              />
            );
          })}
      </Suspense>

      {/* Local Player Pet with Complete Smooth Physics & Hop System */}
      <Suspense fallback={null}>
        <PlayerPetController
          roomCode={roomCode}
          playerId={playerId}
          playerName={playerName}
          petPath={playerPetOptions[playerPetIdx]}
          colliders={colliders}
          npcPositionsRef={npcPositionsRef}
          remotePlayers={players}
          questionPoints={points}
          isQuizOpen={isQuizOpen}
          joystickRef={joystickRef}
          isBrakingRef={isBrakingRef}
          onPlayerPosUpdate={onPlayerPosUpdate}
          onNearQuestion={onNearQuestion}
          onPropHit={handlePropHit}
        />
      </Suspense>
    </>
  );
}

// ─── Canvas Export ────────────────────────────────────────────────────────────
export default function CityCanvas(props: CityCanvasProps) {
  return (
    <Canvas
      className="city-canvas"
      camera={{ position: [0, 3.5, -7.2], fov: 52 }}
      dpr={[1, 1]}
      performance={{ min: 0.6, max: 1, debounce: 200 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>
        <CityScene {...props} />
      </Suspense>
    </Canvas>
  );
}
