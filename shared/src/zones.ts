import { TILE_SIZE } from "./constants";
import { buildGoblinCave, buildJackLair, buildPvpArena, type DungeonLayout, type SpawnZone } from "./dungeons";
import { buildForest, FOREST_SPOTS } from "./forest";
import { NODE_SPAWNS } from "./data/gathering";
import { NPCS } from "./data/npcs";
import { applyMapEdits, type MapEdits } from "./mapEdits";
import { BIG_DUNGEON_IDS, BIG_DUNGEONS, bigDungeonEntrance, dungeonsIn, type BigDungeonId, type DungeonHost } from "./bigDungeons";
import { buildCanyon, CANYON_SPOTS } from "./canyon";
import { buildFrost, FROST_SPOTS } from "./frost";
import { buildVolcano, VOLCANO_SPOTS } from "./volcano";
import { CAVE_BRIDGE, CAVE_ENTRANCE_TILE, CAVE_TORCHES, generateWorldMap, type WorldMap } from "./map";
import { buildTown, TOWN_SPOTS } from "./town";
import { buildHarbor, HARBOR_SPOTS } from "./harbor";
import { buildKeepHall, KEEP_HALL_SPOTS } from "./keepHall";

// A zone is one map with its own room on the server: the main town, the open hunting
// grounds, a shared PvP arena, or an instanced dungeon that every party gets a private copy of.
// Town and hunting grounds are "persistent": the character's zone and position are saved
// there and you log back in where you left. Every other zone is entered through a portal
// and leaving it puts you back at the portal you used.

export type ZoneId = "town" | "world" | "forest" | "canyon" | "frost" | "volcano" | "harbor" | "keep_hall" | "goblin_cave" | "jack_lair" | "pvp_arena" | BigDungeonId;

/** New characters start here; the zone anyone can join without a portal ticket. */
export const HOME_ZONE: ZoneId = "town";

/** "door": a doorway in a building; nothing is drawn, only the name above it. */
export type PortalStyle = "cave" | "exit" | "cursed" | "pvp" | "gate" | "door";

export interface PortalDef {
  id: string;
  /** Feet position in pixels. */
  x: number;
  y: number;
  to: ZoneId;
  label: string;
  style: PortalStyle;
  minLevel?: number;
  /** Only usable after the zone's boss is dead. */
  requiresClear?: boolean;
  /** Where the player stands in this zone after coming back through the portal. */
  returnTo?: { x: number; y: number };
  /** Where the player appears in the destination zone (otherwise its saved spot or spawn). */
  arriveAt?: { x: number; y: number };
  /** Teleport gate: walking into it is enough, no need to press E. */
  auto?: boolean;
}

export interface ZoneDef {
  id: ZoneId;
  name: string;
  /** Instanced zones get a fresh copy per entry. */
  instanced: boolean;
  /** The character's zone and position are saved here (log back in where you left). */
  persistent?: boolean;
  /** Players can fight each other here (free-for-all). */
  pvp?: boolean;
  /** Players can open market stalls here (on market tiles). */
  market?: boolean;
  /** Players with a rod can fish at the water's edge here. */
  fishing?: boolean;
  /** Under the sky: gets dark at night, and its mobs grow stronger then. */
  outdoor?: boolean;
  /** Indoors: always this dark (0..1), so fires and torches glow. */
  dim?: number;
  npcs: string[];
  portals: PortalDef[];
  /** Shown on the death screen. */
  respawnText: string;
}

export const PORTAL_RANGE = TILE_SIZE * 2;
/** Walking this close to a teleport gate (feet to centre) sends you through. */
export const AUTO_GATE_RANGE = 10;

const caveEntrance = { x: (CAVE_ENTRANCE_TILE.tx + 1) * TILE_SIZE, y: (CAVE_ENTRANCE_TILE.ty + 1) * TILE_SIZE };

/** The hunting grounds' teleport gate back to town, on the old crossroads plaza. */
const worldTownGate = { x: 29.5 * TILE_SIZE, y: 22 * TILE_SIZE };
/** At the north end of the valley's main road: the way into the Dark Forest. */
const worldForestGate = { x: 33 * TILE_SIZE, y: 5 * TILE_SIZE };
/** At the west and east ends of the valley's cross road: Kızıl Kanyon and Ayaz Dağları. */
const worldCanyonGate = { x: 3.5 * TILE_SIZE, y: 25 * TILE_SIZE };
const worldFrostGate = { x: 60.5 * TILE_SIZE, y: 25 * TILE_SIZE };
/** At the south end of the valley's main road: the way down to Kor Toprakları. */
const worldVolcanoGate = { x: 33 * TILE_SIZE, y: 46 * TILE_SIZE };

/** Entrances of the big dungeons in an open-world zone; each one's way out leads back to it. */
function dungeonPortals(host: DungeonHost): PortalDef[] {
  return dungeonsIn(host).map((dungeon) => {
    const { portal, returnTo } = bigDungeonEntrance(dungeon);
    return { id: `${dungeon.id}_entrance`, ...portal, to: dungeon.id, label: dungeon.name, style: "cave" as const, minLevel: dungeon.minLevel, returnTo };
  });
}

/** Where the valley's mobs live (tiles on the 64x48 valley map, crossroads at 32,24). */
const WORLD_SPAWN_ZONES: SpawnZone[] = [
  { mob: "slime", tx: 24, ty: 17, radius: 6, count: 6 },
  { mob: "slime", tx: 41, ty: 31, radius: 6, count: 5 },
  { mob: "wolf", tx: 50, ty: 11, radius: 7, count: 5 },
  { mob: "goblin", tx: 13, ty: 37, radius: 7, count: 5 },
  // Night only (see MobDef.nightOnly): they come out at dusk and fade at dawn.
  { mob: "shadow_slime", tx: 24, ty: 17, radius: 6, count: 3 },
  { mob: "shadow_slime", tx: 41, ty: 31, radius: 6, count: 3 },
  { mob: "ghost_wolf", tx: 50, ty: 11, radius: 7, count: 3 },
];

export const ZONES: Record<ZoneId, ZoneDef> = {
  town: {
    id: "town",
    outdoor: true,
    name: "Ana Merkez",
    instanced: false,
    persistent: true,
    market: true,
    npcs: [
      "weaponsmith",
      "armorer",
      "scribe",
      "alchemist",
      "blacksmith",
      "jeweler",
      "storekeeper",
      "commander",
      "sage",
      "cook",
      "craftsman",
      "stable_master",
      "guard_gate_north",
      "guard_gate_south",
      "guard_keep_west",
      "guard_keep_east",
    ],
    respawnText: "Şehir meydanında yeniden doğacaksın.",
    portals: [
      {
        id: "town_field_gate",
        ...TOWN_SPOTS.fieldGate,
        to: "world",
        label: "Başlangıç Vadisi",
        style: "gate",
        auto: true,
        arriveAt: { x: worldTownGate.x + TILE_SIZE * 3, y: worldTownGate.y + TILE_SIZE * 2 },
      },
      {
        id: "town_harbor_gate",
        ...TOWN_SPOTS.harborGate,
        to: "harbor",
        label: "Liman",
        style: "gate",
        auto: true,
        arriveAt: HARBOR_SPOTS.fromTown,
      },
      {
        id: "town_keep_door",
        ...TOWN_SPOTS.keepDoor,
        to: "keep_hall",
        label: "İç Kale",
        style: "door",
        auto: true,
        arriveAt: KEEP_HALL_SPOTS.fromTown,
      },
      {
        id: "pvp_arena_entrance",
        ...TOWN_SPOTS.pvpPortal,
        to: "pvp_arena",
        label: "Kan Arenası (PvP)",
        style: "pvp",
        minLevel: 5,
        returnTo: TOWN_SPOTS.pvpReturn,
      },
    ],
  },
  world: {
    id: "world",
    outdoor: true,
    name: "Başlangıç Vadisi",
    instanced: false,
    persistent: true,
    npcs: ["hunter"],
    respawnText: "Vadideki şehir kapısının yanında yeniden doğacaksın.",
    portals: [
      { id: "world_town_gate", ...worldTownGate, to: "town", label: "Ana Merkez", style: "gate", auto: true, arriveAt: TOWN_SPOTS.fromField },
      {
        id: "world_forest_gate",
        ...worldForestGate,
        to: "forest",
        label: "Kara Orman",
        style: "gate",
        auto: true,
        minLevel: 8,
        arriveAt: FOREST_SPOTS.fromValley,
      },
      {
        id: "world_canyon_gate",
        ...worldCanyonGate,
        to: "canyon",
        label: "Kızıl Kanyon",
        style: "gate",
        auto: true,
        minLevel: 20,
        arriveAt: CANYON_SPOTS.fromValley,
      },
      {
        id: "world_frost_gate",
        ...worldFrostGate,
        to: "frost",
        label: "Ayaz Dağları",
        style: "gate",
        auto: true,
        minLevel: 30,
        arriveAt: FROST_SPOTS.fromValley,
      },
      {
        id: "world_volcano_gate",
        ...worldVolcanoGate,
        to: "volcano",
        label: "Kor Toprakları",
        style: "gate",
        auto: true,
        minLevel: 40,
        arriveAt: VOLCANO_SPOTS.fromValley,
      },
      {
        id: "goblin_cave_entrance",
        ...caveEntrance,
        to: "goblin_cave",
        label: "Goblin Mağarası",
        style: "cave",
        minLevel: 5,
        returnTo: { x: caveEntrance.x, y: caveEntrance.y - TILE_SIZE * 2 },
      },
    ],
  },
  forest: {
    id: "forest",
    outdoor: true,
    name: "Kara Orman",
    instanced: false,
    persistent: true,
    npcs: ["ranger", "peddler"],
    respawnText: "Korucuların kampında yeniden doğacaksın.",
    portals: [
      ...dungeonPortals("forest"),
      {
        id: "forest_valley_gate",
        ...FOREST_SPOTS.valleyGate,
        to: "world",
        label: "Başlangıç Vadisi",
        style: "gate",
        auto: true,
        arriveAt: { x: worldForestGate.x, y: worldForestGate.y + TILE_SIZE * 3 },
      },
    ],
  },
  canyon: {
    id: "canyon",
    outdoor: true,
    name: "Kızıl Kanyon",
    instanced: false,
    persistent: true,
    npcs: ["caravan_master", "canyon_scout"],
    respawnText: "Kervan konağında yeniden doğacaksın.",
    portals: [
      ...dungeonPortals("canyon"),
      {
        id: "canyon_valley_gate",
        ...CANYON_SPOTS.valleyGate,
        to: "world",
        label: "Başlangıç Vadisi",
        style: "gate",
        auto: true,
        arriveAt: { x: worldCanyonGate.x + TILE_SIZE * 3, y: worldCanyonGate.y },
      },
    ],
  },
  frost: {
    id: "frost",
    outdoor: true,
    name: "Ayaz Dağları",
    instanced: false,
    persistent: true,
    npcs: ["furrier", "mountain_guide"],
    respawnText: "Avcı barınağında yeniden doğacaksın.",
    portals: [
      ...dungeonPortals("frost"),
      {
        id: "frost_valley_gate",
        ...FROST_SPOTS.valleyGate,
        to: "world",
        label: "Başlangıç Vadisi",
        style: "gate",
        auto: true,
        arriveAt: { x: worldFrostGate.x - TILE_SIZE * 3, y: worldFrostGate.y },
      },
    ],
  },
  volcano: {
    id: "volcano",
    outdoor: true,
    name: "Kor Toprakları",
    instanced: false,
    persistent: true,
    npcs: ["ember_trader", "ash_sentinel"],
    respawnText: "Kor Karakolu'nda yeniden doğacaksın.",
    portals: [
      ...dungeonPortals("volcano"),
      {
        id: "volcano_valley_gate",
        ...VOLCANO_SPOTS.valleyGate,
        to: "world",
        label: "Başlangıç Vadisi",
        style: "gate",
        auto: true,
        arriveAt: { x: worldVolcanoGate.x, y: worldVolcanoGate.y - TILE_SIZE * 3 },
      },
    ],
  },
  harbor: {
    id: "harbor",
    outdoor: true,
    name: "Liman",
    instanced: false,
    persistent: true,
    fishing: true,
    npcs: ["fisherman"],
    respawnText: "Limanda yeniden doğacaksın.",
    portals: [
      { id: "harbor_town_gate", ...HARBOR_SPOTS.townGate, to: "town", label: "Ana Merkez", style: "gate", auto: true, arriveAt: TOWN_SPOTS.fromHarbor },
    ],
  },
  keep_hall: {
    id: "keep_hall",
    name: "İç Kale",
    instanced: false,
    persistent: true,
    dim: 0.6,
    npcs: [
      "master_warrior",
      "master_shaman",
      "master_rogue",
      "master_archer",
      "master_druid",
      "master_priest",
      "master_necromancer",
      "guard_hall_west",
      "guard_hall_east",
    ],
    respawnText: "Kalenin büyük salonunda yeniden doğacaksın.",
    portals: [{ id: "keep_hall_door", ...KEEP_HALL_SPOTS.door, to: "town", label: "Ana Merkez", style: "door", auto: true, arriveAt: TOWN_SPOTS.fromKeep }],
  },
  pvp_arena: {
    id: "pvp_arena",
    outdoor: true,
    name: "Kan Arenası",
    instanced: false,
    pvp: true,
    npcs: [],
    respawnText: "Arenada yeniden doğacaksın.",
    portals: [{ id: "pvp_exit", x: 32 * TILE_SIZE, y: 35 * TILE_SIZE, to: "town", label: "Çıkış", style: "exit" }],
  },
  goblin_cave: {
    id: "goblin_cave",
    name: "Goblin Mağarası",
    instanced: true,
    npcs: [],
    respawnText: "Mağaranın girişinde yeniden doğacaksın.",
    portals: [
      { id: "cave_exit", x: 4.5 * TILE_SIZE, y: 4 * TILE_SIZE, to: "world", label: "Çıkış", style: "exit" },
      { id: "arena_exit", x: 41.5 * TILE_SIZE, y: 15 * TILE_SIZE, to: "world", label: "Çıkış", style: "exit", requiresClear: true },
      // Beating Grukk earns the way down to the second boss.
      { id: "jack_portal", x: 47.5 * TILE_SIZE, y: 15 * TILE_SIZE, to: "jack_lair", label: "Jack'in Mahzeni", style: "cursed", requiresClear: true },
    ],
  },
  jack_lair: {
    id: "jack_lair",
    name: "Jack'in Mahzeni",
    instanced: true,
    npcs: [],
    respawnText: "Mahzenin girişinde yeniden doğacaksın.",
    portals: [
      { id: "lair_exit", x: 13.5 * TILE_SIZE, y: 25 * TILE_SIZE, to: "world", label: "Çıkış", style: "exit" },
      { id: "lair_exit_top", x: 17.5 * TILE_SIZE, y: 4 * TILE_SIZE, to: "world", label: "Çıkış", style: "exit", requiresClear: true },
    ],
  },
  ...(Object.fromEntries(
    BIG_DUNGEON_IDS.map((id) => {
      const { name, layout, host, dim } = BIG_DUNGEONS[id];
      const zone: ZoneDef = {
        id,
        name,
        instanced: true,
        dim,
        npcs: [],
        respawnText: "Zindanın girişinde yeniden doğacaksın.",
        portals: [
          { id: `${id}_exit`, ...layout.entrancePortal, to: host, label: "Çıkış", style: "exit" },
          { id: `${id}_final_exit`, ...layout.exitPortal, to: host, label: "Çıkış", style: "exit", requiresClear: true },
        ],
      };
      return [id, zone];
    }),
  ) as Record<BigDungeonId, ZoneDef>),
};

const layouts = new Map<ZoneId, DungeonLayout>();

const BUILDERS: Record<ZoneId, () => DungeonLayout> = {
  town: buildTown,
  world: () => ({
    map: generateWorldMap(),
    mobs: [],
    spawnZones: WORLD_SPAWN_ZONES,
    decor: [{ kind: "bridge", ...CAVE_BRIDGE }, ...CAVE_TORCHES.map((t) => ({ kind: "torch" as const, ...t }))],
  }),
  forest: buildForest,
  canyon: buildCanyon,
  frost: buildFrost,
  volcano: buildVolcano,
  harbor: buildHarbor,
  keep_hall: buildKeepHall,
  goblin_cave: buildGoblinCave,
  jack_lair: buildJackLair,
  pvp_arena: buildPvpArena,
  ...(Object.fromEntries(BIG_DUNGEON_IDS.map((id) => [id, (): DungeonLayout => BIG_DUNGEONS[id].layout])) as unknown as Record<BigDungeonId, () => DungeonLayout>),
};

/** Map, fixed mob placements and spawn points of a zone. Built once and cached. */
/** Map editor changes per zone (see mapEdits.ts), laid over the generated maps. */
const zoneEdits = new Map<ZoneId, MapEdits>();

export function zoneLayout(zone: ZoneId): DungeonLayout & { map: WorldMap } {
  let layout = layouts.get(zone);
  if (!layout) {
    layout = applyMapEdits(BUILDERS[zone]() as DungeonLayout & { map: WorldMap }, zoneEdits.get(zone));
    layouts.set(zone, layout);
  }
  return layout as DungeonLayout & { map: WorldMap };
}

/** The zone as generated in code, without map editor changes (the editor draws its edits over this). */
export function baseZoneLayout(zone: ZoneId): DungeonLayout & { map: WorldMap } {
  return BUILDERS[zone]() as DungeonLayout & { map: WorldMap };
}

/**
 * Sets (or clears, with null) a zone's map editor changes. The next zoneLayout() call builds
 * a fresh layout; rooms already running keep the map they started with.
 */
export function setZoneEdits(zone: ZoneId, edits: MapEdits | null) {
  if (edits && (edits.objects.length > 0 || edits.size)) zoneEdits.set(zone, edits);
  else zoneEdits.delete(zone);
  layouts.delete(zone);
}

/**
 * Why a zone cannot be resized to width x height tiles (an NPC, portal or gathering area of the
 * code would fall outside), or null when it can.
 */
export function zoneSizeProblem(zone: ZoneId, width: number, height: number): string | null {
  const outside = (x: number, y: number) => x >= width * TILE_SIZE || y > height * TILE_SIZE;
  for (const id of ZONES[zone].npcs) {
    const npc = NPCS[id];
    if (npc && outside(npc.x, npc.y)) return `${npc.name} haritanın dışında kalıyor (x ${Math.floor(npc.x / TILE_SIZE)}, y ${Math.floor(npc.y / TILE_SIZE)})`;
  }
  for (const portal of ZONES[zone].portals) {
    if (outside(portal.x, portal.y)) return `"${portal.label}" portalı haritanın dışında kalıyor (x ${Math.floor(portal.x / TILE_SIZE)}, y ${Math.floor(portal.y / TILE_SIZE)})`;
  }
  for (const spawn of NODE_SPAWNS[zone] ?? []) {
    if (spawn.tx >= width || spawn.ty >= height) return `Toplama alanı haritanın dışında kalıyor (x ${spawn.tx}, y ${spawn.ty})`;
  }
  return null;
}

/**
 * Why a stall cannot be opened at (x, y) in this zone, or null when it can: anywhere in a
 * market zone (Ana Merkez), only not in a doorway, a gate or on top of a townsperson.
 */
export function stallSpotProblem(zone: ZoneId, x: number, y: number): string | null {
  const def = ZONES[zone];
  if (!def.market) return "Pazar sadece Ana Merkez'de kurulabilir";
  const near = (p: { x: number; y: number }) => Math.hypot(p.x - x, p.y - y) < TILE_SIZE * 2.5;
  if (def.portals.some(near)) return "Kapının önüne tezgâh kurulmaz";
  if (def.npcs.some((id) => NPCS[id] && near(NPCS[id]))) return "Burada biri duruyor; biraz öteye kur";
  return null;
}

export function isZoneId(value: unknown): value is ZoneId {
  return typeof value === "string" && value in ZONES;
}

/** Zone to log a character into: its saved zone if that is a persistent one, else town. */
export function loginZone(saved: unknown): ZoneId {
  return isZoneId(saved) && ZONES[saved].persistent ? saved : HOME_ZONE;
}
