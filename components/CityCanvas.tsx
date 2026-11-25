"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";
import { Suspense, useEffect, useRef, useMemo } from "react";
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
  skyColor: string;
  sunColor: string;
  sunIntensity: number;
  ambientIntensity: number;
};

export const MAP_THEMES: Record<string, MapThemeConfig> = {
  "mega-world": {
    id: "mega-world",
    name: "Nature Mega World",
    tagline: "Hutan luas, lembah, danau alami & padang rumput berbunga",
    icon: "🌿",
    groundColor: "#5c9649",
    skyColor: "#bfe3ff",
    sunColor: "#fff8eb",
    sunIntensity: 2.1,
    ambientIntensity: 1.15,
  },
  "nature-valley": {
    id: "nature-valley",
    name: "Lembah Hijau",
    tagline: "Hutan pinus asri, tebing batu, danau & padang terbuka",
    icon: "🌲",
    groundColor: "#639c4d",
    skyColor: "#cdeaff",
    sunColor: "#fff5df",
    sunIntensity: 2.25,
    ambientIntensity: 1.2,
  },
  forest: {
    id: "forest",
    name: "Hutan Rimba",
    tagline: "Hutan lebat, pepohonan tinggi, pakis & jalur tanah alami",
    icon: "🌳",
    groundColor: "#3f7443",
    skyColor: "#a8d2c7",
    sunColor: "#ffefc8",
    sunIntensity: 1.85,
    ambientIntensity: 1.05,
  },
};

export function resolveMapThemeConfig(themeKey?: string): MapThemeConfig {
  if (!themeKey) return MAP_THEMES["mega-world"];
  const lower = themeKey.toLowerCase();
  if (lower.includes("forest") || lower.includes("rimba")) {
    return MAP_THEMES.forest;
  }
  if (
    lower.includes("valley") ||
    lower.includes("lembah") ||
    lower.includes("camp")
  ) {
    return MAP_THEMES["nature-valley"];
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
  kind?: "building" | "prop";
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
const blockyNatureRoot = "/assets/3d-assets/ohmtap-ot39-blocky-nature/models/glb";
const stylizedNatureRoot = "/assets/3d-assets/Stylized%20Nature%20MegaKit%5BStandard%5D/glTF";
const kaykitForestRoot = "/assets/3d-assets/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf";
const voxelRiggedRoot = "/assets/3d-assets/Voxel_Animals_Farm_Forest_Wild/GLB_Rigged";

type AssetSpec = { path: string; baseScale: number };

const BLOCKY = {
  spruceSmall: { path: `${blockyNatureRoot}/A01_spruce_small.glb`, baseScale: 1.0 },
  spruceMedium: { path: `${blockyNatureRoot}/A02_spruce_medium.glb`, baseScale: 1.0 },
  spruceTall: { path: `${blockyNatureRoot}/A03_spruce_tall.glb`, baseScale: 1.0 },
  pine: { path: `${blockyNatureRoot}/A04_pine.glb`, baseScale: 1.0 },
  birchSmall: { path: `${blockyNatureRoot}/A05_birch_small.glb`, baseScale: 1.0 },
  birchTall: { path: `${blockyNatureRoot}/A06_birch_tall.glb`, baseScale: 1.0 },
  oak: { path: `${blockyNatureRoot}/A07_oak.glb`, baseScale: 1.0 },
  oakYoung: { path: `${blockyNatureRoot}/A08_oak_young.glb`, baseScale: 1.0 },
  deadTree: { path: `${blockyNatureRoot}/A09_dead_tree.glb`, baseScale: 1.0 },
  stump: { path: `${blockyNatureRoot}/A10_stump.glb`, baseScale: 1.0 },
  fallenLog: { path: `${blockyNatureRoot}/A11_fallen_log.glb`, baseScale: 1.0 },
  mushrooms: { path: `${blockyNatureRoot}/A12_mushrooms.glb`, baseScale: 1.0 },
  grassShort: { path: `${blockyNatureRoot}/B01_grass_short.glb`, baseScale: 1.0 },
  grassMedium: { path: `${blockyNatureRoot}/B02_grass_medium.glb`, baseScale: 1.0 },
  grassTall: { path: `${blockyNatureRoot}/B03_grass_tall.glb`, baseScale: 1.0 },
  flowersYellow: { path: `${blockyNatureRoot}/B04_flowers_yellow.glb`, baseScale: 1.0 },
  flowersWhite: { path: `${blockyNatureRoot}/B05_flowers_white.glb`, baseScale: 1.0 },
  flowersViolet: { path: `${blockyNatureRoot}/B06_flowers_violet.glb`, baseScale: 1.0 },
  flowersRed: { path: `${blockyNatureRoot}/B07_flowers_red.glb`, baseScale: 1.0 },
  bushRound: { path: `${blockyNatureRoot}/B08_bush_round.glb`, baseScale: 1.0 },
  bushBerry: { path: `${blockyNatureRoot}/B09_bush_berry.glb`, baseScale: 1.0 },
  bushFlowering: { path: `${blockyNatureRoot}/B10_bush_flowering.glb`, baseScale: 1.0 },
  fern: { path: `${blockyNatureRoot}/B11_fern.glb`, baseScale: 1.0 },
  rockSmall: { path: `${blockyNatureRoot}/C01_rock_small.glb`, baseScale: 1.0 },
  rockMedium: { path: `${blockyNatureRoot}/C02_rock_medium.glb`, baseScale: 1.0 },
  rockLarge: { path: `${blockyNatureRoot}/C03_rock_large.glb`, baseScale: 1.0 },
  cliff: { path: `${blockyNatureRoot}/C04_cliff.glb`, baseScale: 1.0 },
  pebbles: { path: `${blockyNatureRoot}/C05_pebbles.glb`, baseScale: 1.0 },
  reeds: { path: `${blockyNatureRoot}/C06_reeds.glb`, baseScale: 1.0 },
  lilyPad: { path: `${blockyNatureRoot}/C07_lily_pad.glb`, baseScale: 1.0 },
  lilyPadFlower: { path: `${blockyNatureRoot}/C08_lily_pad_flower.glb`, baseScale: 1.0 },
  pier: { path: `${blockyNatureRoot}/C09_pier.glb`, baseScale: 1.0 },
} satisfies Record<string, AssetSpec>;

const STYLIZED = {
  commonTree1: { path: `${stylizedNatureRoot}/CommonTree_1.gltf`, baseScale: 0.9 },
  commonTree2: { path: `${stylizedNatureRoot}/CommonTree_2.gltf`, baseScale: 0.88 },
  commonTree3: { path: `${stylizedNatureRoot}/CommonTree_3.gltf`, baseScale: 0.78 },
  pine1: { path: `${stylizedNatureRoot}/Pine_1.gltf`, baseScale: 0.92 },
  pine2: { path: `${stylizedNatureRoot}/Pine_2.gltf`, baseScale: 0.9 },
  pine3: { path: `${stylizedNatureRoot}/Pine_3.gltf`, baseScale: 0.9 },
  twistedTree1: { path: `${stylizedNatureRoot}/TwistedTree_1.gltf`, baseScale: 0.48 },
  twistedTree2: { path: `${stylizedNatureRoot}/TwistedTree_2.gltf`, baseScale: 0.45 },
  deadTree1: { path: `${stylizedNatureRoot}/DeadTree_1.gltf`, baseScale: 0.68 },
  bushCommon: { path: `${stylizedNatureRoot}/Bush_Common.gltf`, baseScale: 0.92 },
  bushFlowers: { path: `${stylizedNatureRoot}/Bush_Common_Flowers.gltf`, baseScale: 0.92 },
  fern1: { path: `${stylizedNatureRoot}/Fern_1.gltf`, baseScale: 0.22 },
  flower3Group: { path: `${stylizedNatureRoot}/Flower_3_Group.gltf`, baseScale: 0.42 },
  flower4Group: { path: `${stylizedNatureRoot}/Flower_4_Group.gltf`, baseScale: 0.4 },
  grassShort: { path: `${stylizedNatureRoot}/Grass_Common_Short.gltf`, baseScale: 0.55 },
  grassTall: { path: `${stylizedNatureRoot}/Grass_Common_Tall.gltf`, baseScale: 0.52 },
  grassWispy: { path: `${stylizedNatureRoot}/Grass_Wispy_Tall.gltf`, baseScale: 0.52 },
  clover1: { path: `${stylizedNatureRoot}/Clover_1.gltf`, baseScale: 0.75 },
  mushroomCommon: { path: `${stylizedNatureRoot}/Mushroom_Common.gltf`, baseScale: 0.95 },
  mushroomLaetiporus: { path: `${stylizedNatureRoot}/Mushroom_Laetiporus.gltf`, baseScale: 0.78 },
  rockMedium1: { path: `${stylizedNatureRoot}/Rock_Medium_1.gltf`, baseScale: 0.85 },
  rockMedium2: { path: `${stylizedNatureRoot}/Rock_Medium_2.gltf`, baseScale: 0.85 },
  rockPath1: { path: `${stylizedNatureRoot}/RockPath_Round_Small_1.gltf`, baseScale: 0.85 },
  rockPath2: { path: `${stylizedNatureRoot}/RockPath_Round_Small_2.gltf`, baseScale: 0.85 },
} satisfies Record<string, AssetSpec>;

const KAYKIT = {
  tree1A: { path: `${kaykitForestRoot}/Tree_1_A_Color1.gltf`, baseScale: 1.45 },
  tree2A: { path: `${kaykitForestRoot}/Tree_2_A_Color1.gltf`, baseScale: 1.45 },
  tree3A: { path: `${kaykitForestRoot}/Tree_3_A_Color1.gltf`, baseScale: 1.5 },
  tree4A: { path: `${kaykitForestRoot}/Tree_4_A_Color1.gltf`, baseScale: 1.4 },
  treeBare1A: { path: `${kaykitForestRoot}/Tree_Bare_1_A_Color1.gltf`, baseScale: 1.45 },
  bush1A: { path: `${kaykitForestRoot}/Bush_1_A_Color1.gltf`, baseScale: 4.5 },
  bush3A: { path: `${kaykitForestRoot}/Bush_3_A_Color1.gltf`, baseScale: 1.5 },
  grass1A: { path: `${kaykitForestRoot}/Grass_1_A_Color1.gltf`, baseScale: 1.4 },
  grass2A: { path: `${kaykitForestRoot}/Grass_2_A_Color1.gltf`, baseScale: 1.4 },
  rock1A: { path: `${kaykitForestRoot}/Rock_1_A_Color1.gltf`, baseScale: 2.2 },
  rock1C: { path: `${kaykitForestRoot}/Rock_1_C_Color1.gltf`, baseScale: 2.2 },
  rock3A: { path: `${kaykitForestRoot}/Rock_3_A_Color1.gltf`, baseScale: 2.0 },
} satisfies Record<string, AssetSpec>;

const NPC_ANIMAL_SPECIES = [
  { path: `${voxelRiggedRoot}/deer.glb`, scale: 0.52, speed: 2.4 },
  { path: `${voxelRiggedRoot}/fawn.glb`, scale: 0.54, speed: 2.2 },
  { path: `${voxelRiggedRoot}/fox.glb`, scale: 0.55, speed: 2.8 },
  { path: `${voxelRiggedRoot}/sheep.glb`, scale: 0.58, speed: 1.7 },
  { path: `${voxelRiggedRoot}/rabbit.glb`, scale: 0.52, speed: 2.6 },
  { path: `${voxelRiggedRoot}/duck.glb`, scale: 0.52, speed: 1.6 },
  { path: `${voxelRiggedRoot}/boar.glb`, scale: 0.56, speed: 2.1 },
  { path: `${voxelRiggedRoot}/hedgehog.glb`, scale: 0.55, speed: 1.4 },
] as const;

// Voxel animal scale tuned to match the 1 unit = 1m nature models
const PLAYER_MODEL_SCALE = 0.65;
const PLAYER_NAMETAG_Y = 1.45;

export const WORLD_LIMIT = 140.0;
export const WORLD_HALF_SIZE = WORLD_LIMIT;
export const AVENUES: number[] = [];
const WATER_LEVEL = -0.25;

// ─── Seeded Avalanche Hash RNG (zero linear/diagonal correlation) ─────────────
function lcg(seed: number, index: number): number {
  let h = (Math.imul(seed | 0, 0x27d4eb2d) ^ Math.imul((index + 1) | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ─── Deterministic Lakes & Trail Geometry ────────────────────────────────────
type LakeSpec = { x: number; z: number; radius: number };

function getLakeSpec(seed: number): LakeSpec {
  const angle = lcg(seed, 901) * Math.PI * 2;
  const dist = 42 + lcg(seed, 902) * 14;
  return {
    x: Math.cos(angle) * dist,
    z: Math.sin(angle) * dist,
    radius: 13.5 + lcg(seed, 903) * 3.5,
  };
}

function getPondSpec(seed: number): LakeSpec {
  const mainAngle = lcg(seed, 901) * Math.PI * 2;
  const angle = mainAngle + Math.PI * (0.75 + lcg(seed, 904) * 0.5);
  const dist = 70 + lcg(seed, 905) * 18;
  return {
    x: Math.cos(angle) * dist,
    z: Math.sin(angle) * dist,
    radius: 8.5 + lcg(seed, 906) * 2.5,
  };
}

function getTrail1Z(seed: number, x: number): number {
  const phaseA = (seed % 97) * 0.13;
  return Math.sin(x * 0.032 + phaseA) * 17.5 - Math.sin(phaseA) * 17.5;
}

function getTrail2X(seed: number, z: number): number {
  const phaseB = (seed % 53) * 0.19;
  return Math.sin(z * 0.03 + phaseB) * 18.0 - Math.sin(phaseB) * 18.0;
}

function getTrailDistance(seed: number, x: number, z: number): number {
  const d1 = Math.abs(z - getTrail1Z(seed, x));
  const d2 = Math.abs(x - getTrail2X(seed, z));
  return Math.min(d1, d2);
}

export function getNatureMapPreview(seed: number) {
  const lake = getLakeSpec(seed);
  const pond = getPondSpec(seed);
  const trail1Points: Point[] = [];
  const trail2Points: Point[] = [];
  for (let t = -WORLD_LIMIT; t <= WORLD_LIMIT; t += 8) {
    trail1Points.push({ x: t, z: getTrail1Z(seed, t) });
    trail2Points.push({ x: getTrail2X(seed, t), z: t });
  }
  return { lake, pond, trail1Points, trail2Points };
}

// ─── Continuous Terrain Height Function ──────────────────────────────────────
export function terrainHeight(seed: number, x: number, z: number): number {
  const s1 = (seed % 101) * 0.07;
  const s2 = (seed % 73) * 0.11;

  // Gentle rolling hills across the 280x280 world
  const hills =
    Math.sin(x * 0.03 + s1) * Math.cos(z * 0.028 + s2) * 1.25 +
    Math.sin((x + z) * 0.019 + s2) * 0.8;

  // Flatten central spawn clearing around (0, 0)
  const spawnDist = Math.hypot(x, z);
  const spawnFlatten = smoothstep(7, 20, spawnDist);

  // Flatten near trails so paths stay walkable
  const trailDist = getTrailDistance(seed, x, z);
  const trailFlatten = smoothstep(2.0, 8.0, trailDist);

  let h = hills * spawnFlatten * (0.3 + 0.7 * trailFlatten);

  // Scenic main lake & secondary pond depressions
  const lake = getLakeSpec(seed);
  const lakeDist = Math.hypot(x - lake.x, z - lake.z);
  if (lakeDist < lake.radius + 7.0) {
    const basin = 1 - smoothstep(lake.radius * 0.45, lake.radius + 6.5, lakeDist);
    h = THREE.MathUtils.lerp(h, -1.0, basin);
  }

  const pond = getPondSpec(seed);
  const pondDist = Math.hypot(x - pond.x, z - pond.z);
  if (pondDist < pond.radius + 5.5) {
    const basin = 1 - smoothstep(pond.radius * 0.45, pond.radius + 5.0, pondDist);
    h = THREE.MathUtils.lerp(h, -0.9, basin);
  }

  // Gently rising valley rim outside playable bounds
  const edgeDist = Math.max(Math.abs(x), Math.abs(z));
  if (edgeDist > WORLD_LIMIT - 2) {
    const rim = smoothstep(WORLD_LIMIT - 2, WORLD_LIMIT + 40, edgeDist);
    h += rim * 6.0;
  }

  return h;
}

// ─── Deterministic Question Spots in Natural Clearings ───────────────────────
export function seededPoints(seed: number, count: number): Point[] {
  const actualCount = Math.min(Math.max(count, 3), 24);
  const lake = getLakeSpec(seed);
  const pond = getPondSpec(seed);
  const candidates: Point[] = [];

  // Generate well-distributed candidate clearings across the 280x280 valley
  for (let i = 0; i < 240; i++) {
    const angle = i * 2.39996 + lcg(seed, i * 3) * 0.45;
    const radius = 20 + Math.sqrt((i + 1) / 240) * 98; // 20m to 118m from center
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    if (Math.abs(x) > 120 || Math.abs(z) > 120) continue;
    if (Math.hypot(x - lake.x, z - lake.z) < lake.radius + 5.5) continue;
    if (Math.hypot(x - pond.x, z - pond.z) < pond.radius + 5.0) continue;

    candidates.push({ x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(lcg(seed + i * 17, i) * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const MIN_GAP = 28;
  const selected: Point[] = [];
  for (const c of candidates) {
    if (selected.length >= actualCount) break;
    if (!selected.some((s) => Math.hypot(s.x - c.x, s.z - c.z) < MIN_GAP)) {
      selected.push(c);
    }
  }

  if (selected.length < actualCount) {
    for (const c of candidates) {
      if (selected.length >= actualCount) break;
      if (!selected.includes(c)) selected.push(c);
    }
  }

  return selected;
}

// ─── Generic GLB/glTF Model Component ────────────────────────────────────────
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
  return (
    <primitive
      object={cloned}
      position={position}
      rotation={rotation ?? [0, 0, 0]}
      scale={scale}
    />
  );
}

// ─── Procedural Vertex-Colored Nature Terrain ────────────────────────────────
function NatureGround({
  seed,
  themeId,
}: {
  seed: number;
  themeId: MapThemeId;
}) {
  const geometry = useMemo(() => {
    const size = 440;
    const segments = 180;
    const geom = new THREE.PlaneGeometry(size, size, segments, segments);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const lake = getLakeSpec(seed);
    const pond = getPondSpec(seed);

    const grassMain = new THREE.Color(
      themeId === "forest"
        ? "#356638"
        : themeId === "nature-valley"
        ? "#68a64c"
        : "#599645"
    );
    const grassLush = new THREE.Color(
      themeId === "forest"
        ? "#264d2b"
        : themeId === "nature-valley"
        ? "#528a3c"
        : "#457a36"
    );
    const dirtCore = new THREE.Color("#966c40");
    const dirtEdge = new THREE.Color("#b99260");
    const sandShore = new THREE.Color("#d8be86");
    const cliffTint = new THREE.Color("#6b756e");
    const tmpColor = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = terrainHeight(seed, x, z);
      pos.setY(i, y);

      const patch = 0.5 + 0.5 * Math.sin(x * 0.055 + z * 0.048 + seed * 0.1);
      tmpColor.copy(grassMain).lerp(grassLush, patch * 0.7);

      const trailDist = getTrailDistance(seed, x, z);
      if (trailDist < 4.5) {
        const edgeBlend = 1 - smoothstep(2.3, 4.5, trailDist);
        const coreBlend = 1 - smoothstep(1.0, 2.6, trailDist);
        tmpColor.lerp(dirtEdge, edgeBlend * 0.85);
        tmpColor.lerp(dirtCore, coreBlend * 0.88);
      }

      const lakeDist = Math.hypot(x - lake.x, z - lake.z);
      if (lakeDist < lake.radius + 3.8) {
        const shoreBlend = 1 - smoothstep(lake.radius - 0.5, lake.radius + 3.8, lakeDist);
        tmpColor.lerp(sandShore, shoreBlend * 0.94);
      }
      const pondDist = Math.hypot(x - pond.x, z - pond.z);
      if (pondDist < pond.radius + 3.0) {
        const shoreBlend = 1 - smoothstep(pond.radius - 0.5, pond.radius + 3.0, pondDist);
        tmpColor.lerp(sandShore, shoreBlend * 0.92);
      }

      if (y > 1.4) {
        const rockBlend = smoothstep(1.4, 4.8, y);
        tmpColor.lerp(cliffTint, rockBlend * 0.72);
      }

      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }

    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }, [seed, themeId]);

  const lake = useMemo(() => getLakeSpec(seed), [seed]);
  const pond = useMemo(() => getPondSpec(seed), [seed]);

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.95} metalness={0.02} />
      </mesh>
      <mesh
        position={[lake.x, WATER_LEVEL, lake.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[lake.radius + 1.4, 40]} />
        <meshStandardMaterial
          color="#38bdf8"
          transparent
          opacity={0.78}
          roughness={0.15}
          metalness={0.1}
        />
      </mesh>
      <mesh
        position={[pond.x, WATER_LEVEL, pond.z]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[pond.radius + 1.1, 32]} />
        <meshStandardMaterial
          color="#2dd4bf"
          transparent
          opacity={0.76}
          roughness={0.18}
          metalness={0.08}
        />
      </mesh>
    </group>
  );
}

// ─── Procedural Nature World Generator (Blocky + Stylized Nature MegaKit) ─────
type PlacedNatureItem = {
  path: string;
  pos: [number, number, number];
  ry: number;
  scale: number;
};

type NpcAnimalSpec = {
  path: string;
  homeX: number;
  homeZ: number;
  wanderRadius: number;
  scale: number;
  speed: number;
  phaseOffset: number;
};

function useNatureWorld(
  seed: number,
  mapThemeKey: string | undefined,
  questionPoints: Point[]
) {
  return useMemo(() => {
    const items: PlacedNatureItem[] = [];
    const colliders: ColliderBox[] = [];
    const npcAnimals: NpcAnimalSpec[] = [];
    const themeId = resolveMapThemeConfig(mapThemeKey).id;
    const lake = getLakeSpec(seed);
    const pond = getPondSpec(seed);

    const treePool: AssetSpec[] =
      themeId === "forest"
        ? [
            BLOCKY.spruceTall,
            BLOCKY.spruceMedium,
            BLOCKY.spruceSmall,
            BLOCKY.pine,
            BLOCKY.oak,
            BLOCKY.birchTall,
            STYLIZED.pine1,
            STYLIZED.pine2,
            STYLIZED.commonTree3,
            STYLIZED.twistedTree1,
            STYLIZED.twistedTree2,
            STYLIZED.deadTree1,
            KAYKIT.tree2A,
            KAYKIT.tree4A,
            KAYKIT.treeBare1A,
          ]
        : themeId === "nature-valley"
        ? [
            BLOCKY.pine,
            BLOCKY.spruceMedium,
            BLOCKY.spruceSmall,
            BLOCKY.birchSmall,
            BLOCKY.oakYoung,
            STYLIZED.pine1,
            STYLIZED.pine3,
            STYLIZED.commonTree1,
            STYLIZED.commonTree2,
            STYLIZED.twistedTree1,
            KAYKIT.tree1A,
            KAYKIT.tree2A,
            KAYKIT.tree3A,
            KAYKIT.tree4A,
          ]
        : [
            BLOCKY.oak,
            BLOCKY.oakYoung,
            BLOCKY.birchTall,
            BLOCKY.birchSmall,
            BLOCKY.spruceMedium,
            BLOCKY.pine,
            STYLIZED.commonTree1,
            STYLIZED.commonTree2,
            STYLIZED.commonTree3,
            STYLIZED.pine1,
            STYLIZED.pine2,
            STYLIZED.twistedTree1,
            KAYKIT.tree1A,
            KAYKIT.tree2A,
            KAYKIT.tree3A,
            KAYKIT.tree4A,
          ];

    const flowerPool: AssetSpec[] = [
      BLOCKY.flowersYellow,
      BLOCKY.flowersWhite,
      BLOCKY.flowersViolet,
      BLOCKY.flowersRed,
      STYLIZED.flower3Group,
      STYLIZED.flower4Group,
      STYLIZED.clover1,
    ];

    const grassPool: AssetSpec[] = [
      BLOCKY.grassShort,
      BLOCKY.grassMedium,
      BLOCKY.grassTall,
      BLOCKY.fern,
      STYLIZED.grassShort,
      STYLIZED.grassTall,
      STYLIZED.grassWispy,
      STYLIZED.fern1,
      KAYKIT.grass1A,
      KAYKIT.grass2A,
    ];

    const bushPool: AssetSpec[] = [
      BLOCKY.bushRound,
      BLOCKY.bushBerry,
      BLOCKY.bushFlowering,
      STYLIZED.bushCommon,
      STYLIZED.bushFlowers,
      KAYKIT.bush1A,
      KAYKIT.bush3A,
    ];

    const detailPool: AssetSpec[] = [
      BLOCKY.mushrooms,
      BLOCKY.stump,
      BLOCKY.fern,
      STYLIZED.fern1,
      STYLIZED.mushroomCommon,
      STYLIZED.mushroomLaetiporus,
      STYLIZED.clover1,
      KAYKIT.bush1A,
      KAYKIT.grass1A,
    ];

    const rockPool: AssetSpec[] = [
      BLOCKY.rockMedium,
      BLOCKY.rockLarge,
      STYLIZED.rockMedium1,
      STYLIZED.rockMedium2,
      KAYKIT.rock1A,
      KAYKIT.rock1C,
      KAYKIT.rock3A,
    ];

    const occupiedTrees: { x: number; z: number }[] = [];

    const isClearForProp = (x: number, z: number, minTrailDist = 4.0) => {
      if (Math.hypot(x, z) < 8.5) return false; // Spawn clearing
      if (Math.hypot(x - lake.x, z - lake.z) < lake.radius + 3.0) return false;
      if (Math.hypot(x - pond.x, z - pond.z) < pond.radius + 2.6) return false;
      if (getTrailDistance(seed, x, z) < minTrailDist) return false;
      if (questionPoints.some((qp) => Math.hypot(x - qp.x, z - qp.z) < 5.2)) {
        return false;
      }
      return true;
    };

    // 1. Main lake & secondary pond shoreline details
    const addWaterDetails = (body: LakeSpec, withPier: boolean, salt: number) => {
      const pierAngle = Math.atan2(-body.z, -body.x);
      const pierX = body.x + Math.cos(pierAngle) * (body.radius - 0.5);
      const pierZ = body.z + Math.sin(pierAngle) * (body.radius - 0.5);
      if (withPier) {
        items.push({
          path: BLOCKY.pier.path,
          pos: [pierX, WATER_LEVEL - 0.05, pierZ],
          ry: pierAngle + Math.PI / 2,
          scale: 1.05,
        });
      }

      const waterBlockRadius = body.radius * 0.68;
      colliders.push({
        minX: body.x - waterBlockRadius,
        maxX: body.x + waterBlockRadius,
        minZ: body.z - waterBlockRadius,
        maxZ: body.z + waterBlockRadius,
        kind: "building",
      });

      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + lcg(seed + salt, 500 + i) * 0.3;
        const r = body.radius + (lcg(seed + salt, 520 + i) - 0.3) * 1.5;
        const rx = body.x + Math.cos(a) * r;
        const rz = body.z + Math.sin(a) * r;
        if (withPier && Math.hypot(rx - pierX, rz - pierZ) < 3.2) continue;
        items.push({
          path: i % 3 === 0 ? BLOCKY.rockSmall.path : BLOCKY.reeds.path,
          pos: [rx, terrainHeight(seed, rx, rz), rz],
          ry: lcg(seed + salt, 540 + i) * Math.PI * 2,
          scale: 0.95 + lcg(seed + salt, 560 + i) * 0.4,
        });
      }

      for (let i = 0; i < 9; i++) {
        const a = lcg(seed + salt, 600 + i) * Math.PI * 2;
        const r = 1.5 + lcg(seed + salt, 620 + i) * (body.radius - 2.4);
        items.push({
          path: i % 2 === 0 ? BLOCKY.lilyPad.path : BLOCKY.lilyPadFlower.path,
          pos: [body.x + Math.cos(a) * r, WATER_LEVEL + 0.02, body.z + Math.sin(a) * r],
          ry: lcg(seed + salt, 640 + i) * Math.PI * 2,
          scale: 1.0 + lcg(seed + salt, 660 + i) * 0.35,
        });
      }
    };

    addWaterDetails(lake, true, 0);
    addWaterDetails(pond, false, 77);

    // 2. Sector-Based Organic Groves (8x8 jittered regions so NO area stays barren or lined up)
    const sectors = 8;
    const sectorSpan = (WORLD_LIMIT * 2 - 12) / sectors;
    const treesPerSector = themeId === "forest" ? 6 : themeId === "nature-valley" ? 4 : 5;

    for (let sx = 0; sx < sectors; sx++) {
      for (let sz = 0; sz < sectors; sz++) {
        const sectorIdx = sx * sectors + sz;
        const baseX = -WORLD_LIMIT + 6 + sx * sectorSpan;
        const baseZ = -WORLD_LIMIT + 6 + sz * sectorSpan;

        // Jittered grove center anywhere inside this 33x33m region
        const gx = baseX + lcg(seed + 41, sectorIdx * 7) * sectorSpan;
        const gz = baseZ + lcg(seed + 83, sectorIdx * 7 + 1) * sectorSpan;

        // Place trees clustered loosely + scattered around the sector
        for (let m = 0; m < treesPerSector; m++) {
          const idx = sectorIdx * 16 + m;
          const isCluster = m < treesPerSector - 1;
          const tx = isCluster
            ? gx + (lcg(seed + 13, idx * 2) - 0.5) * 20
            : baseX + lcg(seed + 17, idx * 2) * sectorSpan;
          const tz = isCluster
            ? gz + (lcg(seed + 21, idx * 2 + 1) - 0.5) * 20
            : baseZ + lcg(seed + 25, idx * 2 + 1) * sectorSpan;

          if (Math.abs(tx) > WORLD_LIMIT - 2 || Math.abs(tz) > WORLD_LIMIT - 2) continue;
          if (!isClearForProp(tx, tz, 4.1)) continue;
          if (occupiedTrees.some((t) => Math.hypot(t.x - tx, t.z - tz) < 4.2)) continue;

          const spec = treePool[Math.floor(lcg(seed + 7, idx) * treePool.length)];
          const jitter = 0.88 + lcg(seed + 19, idx) * 0.38;
          const ty = terrainHeight(seed, tx, tz);

          items.push({
            path: spec.path,
            pos: [tx, ty, tz],
            ry: lcg(seed + 23, idx) * Math.PI * 2,
            scale: spec.baseScale * jitter,
          });
          occupiedTrees.push({ x: tx, z: tz });
          colliders.push({
            minX: tx - 0.68,
            maxX: tx + 0.68,
            minZ: tz - 0.68,
            maxZ: tz + 0.68,
            kind: "building",
          });

          // Understory ferns / mushrooms / stumps / bushes near trees
          if (m % 2 === 0) {
            const fx = tx + (lcg(seed + 29, idx) - 0.5) * 4.2;
            const fz = tz + (lcg(seed + 31, idx) - 0.5) * 4.2;
            if (Math.hypot(fx - tx, fz - tz) > 1.3 && isClearForProp(fx, fz, 2.8)) {
              const detail = detailPool[Math.floor(lcg(seed + 33, idx) * detailPool.length)];
              items.push({
                path: detail.path,
                pos: [fx, terrainHeight(seed, fx, fz), fz],
                ry: lcg(seed + 37, idx) * Math.PI * 2,
                scale: detail.baseScale * (0.9 + lcg(seed + 43, idx) * 0.3),
              });
            }
          }
        }

        // Guarantee at least 1 rock or fallen log in most sectors so no zone feels empty
        if (lcg(seed + 111, sectorIdx) > 0.22) {
          const rx = baseX + lcg(seed + 113, sectorIdx * 3) * sectorSpan;
          const rz = baseZ + lcg(seed + 117, sectorIdx * 3 + 1) * sectorSpan;
          if (
            isClearForProp(rx, rz, 3.8) &&
            !occupiedTrees.some((t) => Math.hypot(t.x - rx, t.z - rz) < 3.0)
          ) {
            const isRock = sectorIdx % 4 !== 0;
            const spec = isRock
              ? rockPool[Math.floor(lcg(seed + 119, sectorIdx) * rockPool.length)]
              : BLOCKY.fallenLog;
            items.push({
              path: spec.path,
              pos: [rx, terrainHeight(seed, rx, rz), rz],
              ry: lcg(seed + 121, sectorIdx) * Math.PI * 2,
              scale: spec.baseScale * (0.9 + lcg(seed + 127, sectorIdx) * 0.35),
            });
            colliders.push({
              minX: rx - 1.0,
              maxX: rx + 1.0,
              minZ: rz - 1.0,
              maxZ: rz + 1.0,
              kind: "building",
            });
          }
        }

        // Guarantee meadow grass, wildflowers & bushes in EVERY sector
        for (let f = 0; f < 4; f++) {
          const fIdx = sectorIdx * 8 + f;
          const fx = baseX + lcg(seed + 211, fIdx * 2) * sectorSpan;
          const fz = baseZ + lcg(seed + 213, fIdx * 2 + 1) * sectorSpan;
          if (Math.hypot(fx - lake.x, fz - lake.z) < lake.radius + 1.8) continue;
          if (Math.hypot(fx - pond.x, fz - pond.z) < pond.radius + 1.6) continue;
          if (getTrailDistance(seed, fx, fz) < 2.3) continue;

          const roll = lcg(seed + 219, fIdx);
          const spec =
            roll < 0.42
              ? grassPool[Math.floor(lcg(seed + 221, fIdx) * grassPool.length)]
              : roll < 0.76
              ? flowerPool[Math.floor(lcg(seed + 223, fIdx) * flowerPool.length)]
              : bushPool[Math.floor(lcg(seed + 225, fIdx) * bushPool.length)];

          items.push({
            path: spec.path,
            pos: [fx, terrainHeight(seed, fx, fz), fz],
            ry: lcg(seed + 227, fIdx) * Math.PI * 2,
            scale: spec.baseScale * (0.9 + lcg(seed + 229, fIdx) * 0.42),
          });
        }
      }
    }

    // 3. Extra Free-Scattered Accent Trees, Rocks & Bushes in Open Spots
    for (let i = 0; i < 42; i++) {
      const tx = (lcg(seed + 701, i * 2) - 0.5) * 260;
      const tz = (lcg(seed + 709, i * 2 + 1) - 0.5) * 260;
      if (!isClearForProp(tx, tz, 4.3)) continue;
      if (occupiedTrees.some((t) => Math.hypot(t.x - tx, t.z - tz) < 4.5)) continue;

      const spec = treePool[Math.floor(lcg(seed + 719, i) * treePool.length)];
      items.push({
        path: spec.path,
        pos: [tx, terrainHeight(seed, tx, tz), tz],
        ry: lcg(seed + 727, i) * Math.PI * 2,
        scale: spec.baseScale * (0.95 + lcg(seed + 733, i) * 0.35),
      });
      occupiedTrees.push({ x: tx, z: tz });
      colliders.push({
        minX: tx - 0.7,
        maxX: tx + 0.7,
        minZ: tz - 0.7,
        maxZ: tz + 0.7,
        kind: "building",
      });
    }

    // 4. Trail-side pebbles & flat stone path accents so winding trails pop
    for (let t = -130; t <= 130; t += 10) {
      const edgeCandidates = [
        { x: t, z: getTrail1Z(seed, t) + (lcg(seed + 401, t + 200) > 0.5 ? 2.5 : -2.5) },
        { x: getTrail2X(seed, t) + (lcg(seed + 403, t + 200) > 0.5 ? 2.5 : -2.5), z: t },
      ];
      for (const c of edgeCandidates) {
        if (Math.hypot(c.x - lake.x, c.z - lake.z) < lake.radius + 2.2) continue;
        if (Math.hypot(c.x - pond.x, c.z - pond.z) < pond.radius + 2.0) continue;
        items.push({
          path: Math.abs(t) % 20 === 0 ? BLOCKY.rockSmall.path : BLOCKY.pebbles.path,
          pos: [c.x, terrainHeight(seed, c.x, c.z), c.z],
          ry: lcg(seed + 409, t + 300) * Math.PI * 2,
          scale: 1.05 + lcg(seed + 419, t + 300) * 0.35,
        });
      }

      if (Math.abs(t) % 20 === 0) {
        const s1x = t;
        const s1z = getTrail1Z(seed, t);
        if (Math.hypot(s1x - lake.x, s1z - lake.z) > lake.radius + 2.5) {
          const stone = t % 40 === 0 ? STYLIZED.rockPath1 : STYLIZED.rockPath2;
          items.push({
            path: stone.path,
            pos: [s1x, terrainHeight(seed, s1x, s1z) + 0.03, s1z],
            ry: lcg(seed + 431, t + 300) * Math.PI * 2,
            scale: stone.baseScale,
          });
        }
      }
    }

    // 7. Scenic outer perimeter cliffs & border forest (beyond WORLD_LIMIT)
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const r = WORLD_LIMIT + 9 + lcg(seed + 301, i) * 14;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      const isCliff = i % 3 === 0;
      const borderTree = treePool[i % treePool.length];
      items.push({
        path: isCliff ? BLOCKY.cliff.path : borderTree.path,
        pos: [cx, terrainHeight(seed, cx, cz) - 0.3, cz],
        ry: a + Math.PI + (lcg(seed + 307, i) - 0.5) * 0.6,
        scale: isCliff
          ? 2.2 + lcg(seed + 311, i) * 0.9
          : borderTree.baseScale * (1.2 + lcg(seed + 313, i) * 0.45),
      });
    }

    // 8. Ambient Wildlife NPCs (8 roaming animals, kept light & lively)
    for (let i = 0; i < NPC_ANIMAL_SPECIES.length; i++) {
      const species = NPC_ANIMAL_SPECIES[i];
      // Place duck near the main lake shore; others in clearings around the world
      let hx: number;
      let hz: number;
      if (species.path.endsWith("/duck.glb")) {
        const shoreAngle = lcg(seed + 801, i) * Math.PI * 2;
        hx = lake.x + Math.cos(shoreAngle) * (lake.radius + 3.2);
        hz = lake.z + Math.sin(shoreAngle) * (lake.radius + 3.2);
      } else {
        const a = (i / NPC_ANIMAL_SPECIES.length) * Math.PI * 2 + lcg(seed + 811, i) * 0.5;
        const d = 22 + lcg(seed + 821, i) * 72;
        hx = Math.cos(a) * d;
        hz = Math.sin(a) * d;
      }
      npcAnimals.push({
        path: species.path,
        homeX: hx,
        homeZ: hz,
        wanderRadius: species.path.endsWith("/duck.glb") ? 4.5 : 12 + lcg(seed + 831, i) * 6,
        scale: species.scale,
        speed: species.speed,
        phaseOffset: lcg(seed + 841, i) * 100,
      });
    }

    return { items, colliders, npcAnimals };
  }, [seed, mapThemeKey, questionPoints]);
}

// ─── Rigged Animal Procedural Animation Helpers ──────────────────────────────
type RigPart = {
  obj: THREE.Object3D;
  baseRotX: number;
  baseRotY: number;
  baseRotZ: number;
};

type RigParts = {
  body?: RigPart;
  head?: RigPart;
  tail?: RigPart;
  legFL?: RigPart;
  legFR?: RigPart;
  legBL?: RigPart;
  legBR?: RigPart;
  legL?: RigPart;
  legR?: RigPart;
  wingL?: RigPart;
  wingR?: RigPart;
};

function captureRigParts(root: THREE.Object3D): RigParts {
  const parts: RigParts = {};
  const toPart = (obj: THREE.Object3D): RigPart => ({
    obj,
    baseRotX: obj.rotation.x,
    baseRotY: obj.rotation.y,
    baseRotZ: obj.rotation.z,
  });

  root.traverse((child) => {
    const name = child.name;
    if (!name) return;
    if (name.endsWith("__body")) parts.body = toPart(child);
    else if (name.endsWith("__head")) parts.head = toPart(child);
    else if (name.endsWith("__tail")) parts.tail = toPart(child);
    else if (name.endsWith("__leg_fl")) parts.legFL = toPart(child);
    else if (name.endsWith("__leg_fr")) parts.legFR = toPart(child);
    else if (name.endsWith("__leg_bl")) parts.legBL = toPart(child);
    else if (name.endsWith("__leg_br")) parts.legBR = toPart(child);
    else if (name.endsWith("__leg_l")) parts.legL = toPart(child);
    else if (name.endsWith("__leg_r")) parts.legR = toPart(child);
    else if (name.endsWith("__wing_l")) parts.wingL = toPart(child);
    else if (name.endsWith("__wing_r")) parts.wingR = toPart(child);
  });

  return parts;
}

function animateRigParts(
  parts: RigParts,
  walkPhase: number,
  speedRatio: number,
  elapsedTime: number
) {
  const moving = speedRatio > 0.05;
  const swing = moving ? Math.sin(walkPhase) * 0.6 * Math.min(speedRatio, 1) : 0;

  if (parts.legFL) parts.legFL.obj.rotation.x = parts.legFL.baseRotX + swing;
  if (parts.legBR) parts.legBR.obj.rotation.x = parts.legBR.baseRotX + swing;
  if (parts.legFR) parts.legFR.obj.rotation.x = parts.legFR.baseRotX - swing;
  if (parts.legBL) parts.legBL.obj.rotation.x = parts.legBL.baseRotX - swing;

  if (parts.legL) parts.legL.obj.rotation.x = parts.legL.baseRotX + swing;
  if (parts.legR) parts.legR.obj.rotation.x = parts.legR.baseRotX - swing;

  if (parts.wingL) {
    const flap = moving ? Math.abs(Math.sin(walkPhase)) * 0.45 * speedRatio : 0;
    parts.wingL.obj.rotation.z = parts.wingL.baseRotZ + flap;
  }
  if (parts.wingR) {
    const flap = moving ? Math.abs(Math.sin(walkPhase)) * 0.45 * speedRatio : 0;
    parts.wingR.obj.rotation.z = parts.wingR.baseRotZ - flap;
  }

  if (parts.head) {
    const nod = moving
      ? Math.sin(walkPhase * 2) * 0.07 * speedRatio
      : Math.sin(elapsedTime * 1.8) * 0.04;
    parts.head.obj.rotation.x = parts.head.baseRotX + nod;
  }

  if (parts.tail) {
    const wag = moving
      ? Math.sin(walkPhase * 1.5) * 0.35
      : Math.sin(elapsedTime * 3.0) * 0.16;
    parts.tail.obj.rotation.y = parts.tail.baseRotY + wag;
  }

  if (parts.body) {
    const bobRot = moving ? Math.sin(walkPhase * 2) * 0.04 * speedRatio : 0;
    parts.body.obj.rotation.x = parts.body.baseRotX + bobRot;
  }
}

// ─── Roaming Ambient Wildlife NPC ────────────────────────────────────────────
function RoamingNpcAnimal({
  spec,
  index,
  terrainSeed,
  npcPositionsRef,
}: {
  spec: NpcAnimalSpec;
  index: number;
  terrainSeed: number;
  npcPositionsRef: React.MutableRefObject<Array<{ x: number; z: number }>>;
}) {
  const { scene } = useGLTF(spec.path);
  const animalScene = useMemo(() => scene.clone(true), [scene]);
  const rigParts = useMemo(() => captureRigParts(animalScene), [animalScene]);

  const groupRef = useRef<THREE.Group>(null);
  const posRef = useRef(new THREE.Vector3(spec.homeX, 0, spec.homeZ));
  const targetRef = useRef(new THREE.Vector3(spec.homeX, 0, spec.homeZ));
  const headingRef = useRef((index * 1.3) % (Math.PI * 2));
  const walkPhaseRef = useRef(spec.phaseOffset);
  const stepCounterRef = useRef(1);
  const pauseTimerRef = useRef(0.5 + (index % 3) * 0.8);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    let movingSpeed = 0;

    if (pauseTimerRef.current > 0) {
      pauseTimerRef.current -= dt;
      if (pauseTimerRef.current <= 0) {
        const s = stepCounterRef.current++;
        const a = lcg(terrainSeed + index * 37, s * 2) * Math.PI * 2;
        const r = (0.35 + lcg(terrainSeed + index * 53, s * 2 + 1) * 0.65) * spec.wanderRadius;
        targetRef.current.set(
          THREE.MathUtils.clamp(spec.homeX + Math.cos(a) * r, -WORLD_LIMIT + 4, WORLD_LIMIT - 4),
          0,
          THREE.MathUtils.clamp(spec.homeZ + Math.sin(a) * r, -WORLD_LIMIT + 4, WORLD_LIMIT - 4)
        );
      }
    } else {
      const dx = targetRef.current.x - posRef.current.x;
      const dz = targetRef.current.z - posRef.current.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.45) {
        pauseTimerRef.current = 1.8 + lcg(terrainSeed + index * 19, stepCounterRef.current) * 2.5;
      } else {
        const desiredHeading = Math.atan2(dx, dz);
        let diff = desiredHeading - headingRef.current;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        headingRef.current += diff * Math.min(1, dt * 4.5);

        const step = Math.min(dist, spec.speed * dt);
        posRef.current.x += (dx / dist) * step;
        posRef.current.z += (dz / dist) * step;
        movingSpeed = spec.speed;
        walkPhaseRef.current += dt * (spec.speed * 3.8);
      }
    }

    const speedRatio = movingSpeed > 0 ? 0.65 : 0;
    animateRigParts(rigParts, walkPhaseRef.current, speedRatio, state.clock.elapsedTime + spec.phaseOffset);

    const gy = terrainHeight(terrainSeed, posRef.current.x, posRef.current.z);
    if (groupRef.current) {
      groupRef.current.position.set(posRef.current.x, gy, posRef.current.z);
      groupRef.current.rotation.y = headingRef.current;
    }
    npcPositionsRef.current[index] = { x: posRef.current.x, z: posRef.current.z };
  });

  return (
    <group
      ref={groupRef}
      position={[spec.homeX, terrainHeight(terrainSeed, spec.homeX, spec.homeZ), spec.homeZ]}
    >
      <primitive object={animalScene} scale={spec.scale} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.5, 16]} />
        <meshBasicMaterial color="#111" transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

// ─── Remote Player Pet Avatar ────────────────────────────────────────────────
function RemotePetAvatar({
  player,
  petIdx,
  terrainSeed,
  showNameTag,
}: {
  player: RemotePlayer;
  petIdx: number;
  terrainSeed: number;
  showNameTag: boolean;
}) {
  const petPath = playerPetOptions[petIdx % playerPetOptions.length];
  const { scene } = useGLTF(petPath);
  const petScene = useMemo(() => scene.clone(true), [scene]);
  const rigParts = useMemo(() => captureRigParts(petScene), [petScene]);

  const groupRef = useRef<THREE.Group>(null);
  const targetX = player.position?.x ?? 0;
  const targetZ = player.position?.z ?? 0;
  const smoothPosRef = useRef(new THREE.Vector3(targetX, 0, targetZ));
  const headingRef = useRef(0);
  const walkPhaseRef = useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const dx = targetX - smoothPosRef.current.x;
    const dz = targetZ - smoothPosRef.current.z;
    const dist = Math.hypot(dx, dz);

    smoothPosRef.current.x = THREE.MathUtils.lerp(smoothPosRef.current.x, targetX, 1 - Math.pow(0.001, dt * 6));
    smoothPosRef.current.z = THREE.MathUtils.lerp(smoothPosRef.current.z, targetZ, 1 - Math.pow(0.001, dt * 6));

    if (dist > 0.04) {
      const desiredHeading = Math.atan2(dx, dz);
      let diff = desiredHeading - headingRef.current;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      headingRef.current += diff * Math.min(1, dt * 10);
    }

    const speedRatio = Math.min(dist * 2.5, 1);
    if (speedRatio > 0.05) {
      walkPhaseRef.current += dt * (speedRatio * 14 + 4);
    }
    animateRigParts(rigParts, walkPhaseRef.current, speedRatio, state.clock.elapsedTime);

    const gy = terrainHeight(terrainSeed, smoothPosRef.current.x, smoothPosRef.current.z);
    if (groupRef.current) {
      groupRef.current.position.set(smoothPosRef.current.x, gy, smoothPosRef.current.z);
      groupRef.current.rotation.y = headingRef.current;
    }
  });

  return (
    <group ref={groupRef} position={[targetX, terrainHeight(terrainSeed, targetX, targetZ), targetZ]}>
      <primitive object={petScene} scale={PLAYER_MODEL_SCALE} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.65, 20]} />
        <meshBasicMaterial color="#111" transparent opacity={0.25} />
      </mesh>
      {showNameTag && (
        <Html position={[0, player.nameTagY ?? PLAYER_NAMETAG_Y, 0]} center distanceFactor={12} zIndexRange={[2, 0]}>
          <div className="player-nametag">{player.name}</div>
        </Html>
      )}
    </group>
  );
}

// ─── 3D Question Marker with Sky Beam & Pulsing Ground Ring ──────────────────
function QuestionMarker({
  point,
  index,
  terrainSeed,
  completed,
  isNearest,
}: {
  point: Point;
  index: number;
  terrainSeed: number;
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
    <group position={[point.x, terrainHeight(terrainSeed, point.x, point.z), point.z]}>
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

      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[1.5, 1.9, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={completed ? 0.35 : 0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
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

// ─── Non-Penetrating Obstacle Collision Resolution ───────────────────────────
function resolveObstacleCollision(
  pos: THREE.Vector3,
  radius: number,
  colliders: ColliderBox[]
): boolean {
  let hit = false;

  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    const closestX = Math.max(box.minX, Math.min(pos.x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(pos.z, box.maxZ));

    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      hit = true;
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const overlap = radius - dist;
        pos.x += (dx / dist) * overlap;
        pos.z += (dz / dist) * overlap;
      } else {
        const dMinX = Math.abs(pos.x - box.minX);
        const dMaxX = Math.abs(pos.x - box.maxX);
        const dMinZ = Math.abs(pos.z - box.minZ);
        const dMaxZ = Math.abs(pos.z - box.maxZ);
        const minEdge = Math.min(dMinX, dMaxX, dMinZ, dMaxZ);

        if (minEdge === dMinX) pos.x = box.minX - radius;
        else if (minEdge === dMaxX) pos.x = box.maxX + radius;
        else if (minEdge === dMinZ) pos.z = box.minZ - radius;
        else pos.z = box.maxZ + radius;
      }
    }
  }

  return hit;
}

// ─── Player Pet Controller with Rigged Animation & Smooth Camera ─────────────
function PlayerPetController({
  roomCode,
  playerId,
  terrainSeed,
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
}: {
  roomCode: string;
  playerId: string;
  terrainSeed: number;
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
}) {
  const petGroupRef = useRef<THREE.Group>(null);

  const posRef = useRef(new THREE.Vector3(0, 0, 0));
  const headingRef = useRef(0);
  const speedRef = useRef(0);
  const bumpRef = useRef(0);
  const hopRef = useRef(0);

  const steerAngleRef = useRef(0);
  const smoothCamYawRef = useRef(0);
  const camPosRef = useRef(new THREE.Vector3(0, 3.5, -7.4));
  const camLookRef = useRef(new THREE.Vector3(0, 1.0, 3.5));

  const keys = useRef<Record<string, boolean>>({});
  const lastSync = useRef(0);
  const lastPosReport = useRef(0);
  const { camera, gl } = useThree();

  const { scene: petBase } = useGLTF(petPath);
  const petScene = useMemo(() => petBase.clone(true), [petBase]);
  const rigParts = useMemo(() => captureRigParts(petScene), [petScene]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        if (!isQuizOpen) e.preventDefault();
      }
      keys.current[k] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [isQuizOpen]);

  const targetSwipeYaw = useRef(0);
  const targetSwipePitch = useRef(0.42);
  const swipeYaw = useRef(0);
  const swipePitch = useRef(0.42);
  const isDraggingCamRef = useRef(false);

  useEffect(() => {
    const canvas = gl.domElement;

    let activePointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const isJoystickZone = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(".mobile-controls-layer, .virtual-joystick-base")) {
        return true;
      }
      const rect = canvas.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      return relX > rect.width * 0.65 && relY > rect.height * 0.72;
    };

    const onDown = (e: PointerEvent) => {
      if (activePointerId !== null) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (isJoystickZone(e)) return;

      activePointerId = e.pointerId;
      isDraggingCamRef.current = true;
      lastX = e.clientX;
      lastY = e.clientY;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      if (e.pointerType === "mouse" && !(e.buttons & 1)) {
        activePointerId = null;
        isDraggingCamRef.current = false;
        return;
      }

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      const yawSens = e.pointerType === "touch" ? 0.0085 : 0.0065;
      const pitchSens = e.pointerType === "touch" ? 0.005 : 0.004;

      targetSwipeYaw.current -= dx * yawSens;
      targetSwipePitch.current = THREE.MathUtils.clamp(
        targetSwipePitch.current + dy * pitchSens,
        0.16,
        1.08
      );
    };

    const onEnd = (e: PointerEvent) => {
      if (e.pointerId !== activePointerId) return;
      activePointerId = null;
      isDraggingCamRef.current = false;
      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onEnd);
    canvas.addEventListener("pointercancel", onEnd);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onEnd);
      canvas.removeEventListener("pointercancel", onEnd);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const maxFwd = 16.5;
    let rawSteer = 0;

    if (isQuizOpen) {
      speedRef.current = 0;
      steerAngleRef.current = 0;
    } else {
      const joyX = joystickRef?.current?.x ?? 0;
      const joyY = joystickRef?.current?.y ?? 0;
      const isBraking = isBrakingRef?.current ?? false;

      const keyAccel = keys.current["w"] || keys.current["arrowup"] ? 1 : 0;
      const keyReverse = keys.current["s"] || keys.current["arrowdown"] ? 1 : 0;
      const keyLeft = keys.current["a"] || keys.current["arrowleft"] ? 1 : 0;
      const keyRight = keys.current["d"] || keys.current["arrowright"] ? 1 : 0;

      const fwdThrottle = Math.max(keyAccel, joyY > 0 ? joyY : 0);
      const revThrottle = Math.max(keyReverse, joyY < 0 ? -joyY : 0);

      if (keyLeft) rawSteer = 1;
      else if (keyRight) rawSteer = -1;
      else if (Math.abs(joyX) > 0.04) rawSteer = -joyX;

      steerAngleRef.current = THREE.MathUtils.lerp(
        steerAngleRef.current,
        rawSteer,
        1 - Math.pow(0.001, dt * 9.5)
      );

      const maxRev = 6.5;
      const acc = 22.0;
      const coastDrag = 2.8;
      const activeBrake = 24.0;

      if (isBraking) {
        speedRef.current = THREE.MathUtils.lerp(speedRef.current, 0, dt * 14);
        if (Math.abs(speedRef.current) < 0.08) speedRef.current = 0;
      } else if (fwdThrottle > 0.04) {
        if (speedRef.current < -0.3) {
          speedRef.current += activeBrake * dt;
        } else {
          speedRef.current = Math.min(speedRef.current + acc * fwdThrottle * dt, maxFwd * fwdThrottle);
        }
      } else if (revThrottle > 0.04) {
        if (speedRef.current > 0.5) {
          speedRef.current = Math.max(speedRef.current - activeBrake * revThrottle * dt, 0);
        } else {
          speedRef.current = Math.max(speedRef.current - acc * 0.75 * revThrottle * dt, -maxRev * revThrottle);
        }
      } else {
        speedRef.current *= Math.exp(-coastDrag * dt);
        if (Math.abs(speedRef.current) < 0.05) speedRef.current = 0;
      }

      const currentSpeedMag = Math.abs(speedRef.current);
      const speedFactor = THREE.MathUtils.clamp(currentSpeedMag / (maxFwd * 0.4), 0.3, 1.0);
      const steerRate = 2.5 * speedFactor;
      const steerDir = Math.sign(speedRef.current || 1);

      if (Math.abs(steerAngleRef.current) > 0.01 && currentSpeedMag > 0.05) {
        headingRef.current += steerAngleRef.current * steerRate * dt * steerDir;
      }

      const moveDir = new THREE.Vector3(Math.sin(headingRef.current), 0, Math.cos(headingRef.current));
      posRef.current.addScaledVector(moveDir, speedRef.current * dt);

      const hitObstacle = resolveObstacleCollision(posRef.current, 0.85, colliders);

      let hitBorder = false;
      if (posRef.current.x < -WORLD_LIMIT) { posRef.current.x = -WORLD_LIMIT; hitBorder = true; }
      if (posRef.current.x > WORLD_LIMIT) { posRef.current.x = WORLD_LIMIT; hitBorder = true; }
      if (posRef.current.z < -WORLD_LIMIT) { posRef.current.z = -WORLD_LIMIT; hitBorder = true; }
      if (posRef.current.z > WORLD_LIMIT) { posRef.current.z = WORLD_LIMIT; hitBorder = true; }

      // Soft collision with roaming NPC animals
      let hitNpc = false;
      const npcs = npcPositionsRef.current;
      for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        if (!npc) continue;
        const dx = posRef.current.x - npc.x;
        const dz = posRef.current.z - npc.z;
        const dist = Math.hypot(dx, dz);
        const minDist = 1.4;
        if (dist < minDist) {
          hitNpc = true;
          if (dist > 0.0001) {
            const push = minDist - dist;
            posRef.current.x += (dx / dist) * push;
            posRef.current.z += (dz / dist) * push;
          }
        }
      }

      let hitPlayer = false;
      for (const [id, rp] of Object.entries(remotePlayers)) {
        if (id === playerId || !rp.position) continue;
        const dx = posRef.current.x - rp.position.x;
        const dz = posRef.current.z - rp.position.z;
        const dist = Math.hypot(dx, dz);
        const minDist = 1.7;
        if (dist < minDist) {
          hitPlayer = true;
          if (dist > 0.0001) {
            const push = minDist - dist;
            posRef.current.x += (dx / dist) * push;
            posRef.current.z += (dz / dist) * push;
          }
        }
      }

      if (hitObstacle || hitBorder) {
        speedRef.current *= 0.65;
        bumpRef.current = Math.min(bumpRef.current + 0.03, 0.07);
      } else if (hitPlayer || hitNpc) {
        speedRef.current *= 0.5;
        bumpRef.current = Math.min(bumpRef.current + 0.04, 0.09);
      }
    }

    // ── Rigged Limb Animation & Gentle Hop ──
    const curSpeed = Math.abs(speedRef.current);
    const speedRatio = THREE.MathUtils.clamp(curSpeed / maxFwd, 0, 1);
    if (curSpeed > 0.15) {
      hopRef.current += dt * (curSpeed * 1.15 + 6.5);
    }
    animateRigParts(rigParts, hopRef.current, speedRatio, state.clock.elapsedTime);

    const hopY = curSpeed > 0.15 ? Math.abs(Math.sin(hopRef.current)) * 0.12 : 0;
    const waddleZ = curSpeed > 0.15 ? Math.sin(hopRef.current * 0.5) * 0.03 : 0;

    bumpRef.current = THREE.MathUtils.lerp(bumpRef.current, 0, dt * 10);
    const tiltZ = !isQuizOpen ? -steerAngleRef.current * 0.05 : 0;

    const groundY = terrainHeight(terrainSeed, posRef.current.x, posRef.current.z);
    if (petGroupRef.current) {
      petGroupRef.current.position.set(posRef.current.x, groundY + bumpRef.current + hopY, posRef.current.z);
      petGroupRef.current.rotation.y = headingRef.current;
      petGroupRef.current.rotation.z = THREE.MathUtils.lerp(
        petGroupRef.current.rotation.z,
        tiltZ + waddleZ,
        1 - Math.pow(0.001, dt)
      );
    }

    // ── Smooth Damped Follow Camera + Auto-Recenter When Walking ──
    if (curSpeed > 0.35 && !isDraggingCamRef.current) {
      // Wrap targetSwipeYaw into [-PI, PI] so recentering always takes the shortest path
      while (targetSwipeYaw.current > Math.PI) {
        targetSwipeYaw.current -= Math.PI * 2;
        swipeYaw.current -= Math.PI * 2;
      }
      while (targetSwipeYaw.current < -Math.PI) {
        targetSwipeYaw.current += Math.PI * 2;
        swipeYaw.current += Math.PI * 2;
      }
      const recenterFactor = 1 - Math.exp(-dt * 3.2);
      targetSwipeYaw.current = THREE.MathUtils.lerp(targetSwipeYaw.current, 0, recenterFactor);
      targetSwipePitch.current = THREE.MathUtils.lerp(targetSwipePitch.current, 0.42, recenterFactor * 0.75);
    }

    const orbitDamp = 1 - Math.exp(-dt * 15);
    swipeYaw.current = THREE.MathUtils.lerp(swipeYaw.current, targetSwipeYaw.current, orbitDamp);
    swipePitch.current = THREE.MathUtils.lerp(swipePitch.current, targetSwipePitch.current, orbitDamp);

    const targetCamTotalYaw = headingRef.current + swipeYaw.current;
    smoothCamYawRef.current = THREE.MathUtils.lerp(
      smoothCamYawRef.current,
      targetCamTotalYaw,
      1 - Math.pow(0.001, dt * 6.5)
    );

    const pitch = swipePitch.current;
    const camRadius = 7.4;
    const camOffX = -Math.sin(smoothCamYawRef.current) * Math.cos(pitch) * camRadius;
    const camOffY = Math.sin(pitch) * camRadius;
    const camOffZ = -Math.cos(smoothCamYawRef.current) * Math.cos(pitch) * camRadius;

    const desiredCam = new THREE.Vector3(
      posRef.current.x + camOffX,
      groundY + camOffY,
      posRef.current.z + camOffZ
    );
    camPosRef.current.lerp(desiredCam, 1 - Math.pow(0.0001, dt * 8));
    camera.position.copy(camPosRef.current);

    const lookLead = Math.min(curSpeed * 0.1, 1.5);
    const desiredLook = new THREE.Vector3(
      posRef.current.x + Math.sin(headingRef.current) * lookLead,
      groundY + 0.85,
      posRef.current.z + Math.cos(headingRef.current) * lookLead
    );
    camLookRef.current.lerp(desiredLook, 1 - Math.pow(0.001, dt * 8));
    camera.lookAt(camLookRef.current);

    // ── Position & Proximity Reporting ──
    if (performance.now() - lastPosReport.current > 120) {
      lastPosReport.current = performance.now();
      onPlayerPosUpdate?.({ x: posRef.current.x, z: posRef.current.z });

      let nearIdx: number | null = null;
      for (let i = 0; i < questionPoints.length; i++) {
        const qp = questionPoints[i];
        if (Math.hypot(qp.x - posRef.current.x, qp.z - posRef.current.z) <= 3.8) {
          nearIdx = i;
          break;
        }
      }
      onNearQuestion?.(nearIdx);
    }

    // ── Firebase Sync (throttled) ──
    if (
      Math.abs(speedRef.current) > 0.1 &&
      realtimeDb &&
      playerId &&
      performance.now() - lastSync.current > 250
    ) {
      lastSync.current = performance.now();
      void update(
        ref(realtimeDb, `rooms/${roomCode}/positions/${playerId}`),
        { x: posRef.current.x, z: posRef.current.z }
      ).catch((err) => console.error("Position sync failed", err));
    }
  });

  return (
    <group ref={petGroupRef}>
      <primitive object={petScene} scale={PLAYER_MODEL_SCALE} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.65, 20]} />
        <meshBasicMaterial color="#111" transparent opacity={0.28} />
      </mesh>
      {playerName && !isQuizOpen && (
        <Html position={[0, PLAYER_NAMETAG_Y, 0]} center distanceFactor={12} zIndexRange={[2, 0]}>
          <div className="player-nametag player-nametag--self">{playerName}</div>
        </Html>
      )}
    </group>
  );
}

// ─── Full Nature World Scene ─────────────────────────────────────────────────
function NatureScene({
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
  const npcPositionsRef = useRef<Array<{ x: number; z: number }>>([]);

  const points = useMemo(
    () => (customPoints && customPoints.length > 0 ? customPoints : seededPoints(seed, questionCount)),
    [customPoints, seed, questionCount]
  );

  const { items, colliders, npcAnimals } = useNatureWorld(seed, mapTheme, points);

  const playerPetIdx = useMemo(() => {
    const selectedPetIndex = players[playerId]?.petIndex;
    if (typeof selectedPetIndex === "number" && selectedPetIndex >= 0) {
      return selectedPetIndex % playerPetOptions.length;
    }
    let h = 0;
    for (let i = 0; i < playerId.length; i++) h = (h * 31 + playerId.charCodeAt(i)) & 0xffff;
    return h % playerPetOptions.length;
  }, [playerId, players]);

  return (
    <>
      <color attach="background" args={[themeConfig.skyColor]} />
      <fog attach="fog" args={[themeConfig.skyColor, 58, 175]} />

      <hemisphereLight args={[themeConfig.skyColor, themeConfig.groundColor, 0.75]} />
      <ambientLight intensity={themeConfig.ambientIntensity} />
      <directionalLight
        position={[32, 46, 22]}
        intensity={themeConfig.sunIntensity}
        color={themeConfig.sunColor}
      />
      <directionalLight position={[-24, 20, -18]} intensity={0.55} color="#d8ecff" />

      {/* Continuous Rolling Meadow, Trails & Lakes */}
      <NatureGround seed={seed} themeId={themeConfig.id} />

      {/* Trees, Rocks, Wildflowers, Bushes, Lake Props & Perimeter Cliffs */}
      <Suspense fallback={null}>
        {items.map((item, idx) => (
          <Model
            key={`nat-${idx}`}
            path={item.path}
            position={item.pos}
            rotation={[0, item.ry, 0]}
            scale={item.scale}
          />
        ))}
      </Suspense>

      {/* Ambient Roaming Wildlife NPCs */}
      <Suspense fallback={null}>
        {npcAnimals.map((animal, idx) => (
          <RoamingNpcAnimal
            key={`npc-animal-${idx}`}
            spec={animal}
            index={idx}
            terrainSeed={seed}
            npcPositionsRef={npcPositionsRef}
          />
        ))}
      </Suspense>

      {/* 3D Question Markers */}
      {points.map((pt, i) => (
        <QuestionMarker
          key={`qm-${i}`}
          point={pt}
          index={i}
          terrainSeed={seed}
          completed={completedQuestionIndices.includes(i)}
          isNearest={nearestQuestionIndex === i}
        />
      ))}

      {/* Remote Players' Rigged Pets */}
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
                terrainSeed={seed}
                showNameTag={!isQuizOpen}
              />
            );
          })}
      </Suspense>

      {/* Local Player Rigged Pet */}
      <Suspense fallback={null}>
        <PlayerPetController
          roomCode={roomCode}
          playerId={playerId}
          terrainSeed={seed}
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
        />
      </Suspense>
    </>
  );
}

// ─── Canvas Export ───────────────────────────────────────────────────────────
export default function CityCanvas(props: CityCanvasProps) {
  return (
    <Canvas
      className="city-canvas"
      style={{ touchAction: "none" }}
      camera={{ position: [0, 3.5, -7.2], fov: 52 }}
      dpr={[1, 1.5]}
      performance={{ min: 0.6, max: 1, debounce: 200 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>
        <NatureScene {...props} />
      </Suspense>
    </Canvas>
  );
}
