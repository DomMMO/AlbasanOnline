import { TILE_SIZE } from "./constants";
import { buildDungeon, type BuiltDungeon, type DungeonRoom, type DungeonTheme } from "./dungeons";
import { Tile } from "./map";

// The big dungeons: five entered from the Dark Forest, two from Kızıl Kanyon and two from
// Ayaz Dağları. Much longer than the Goblin Cave: 30-40 mobs in packs along a chain of rooms,
// and 3-4 bosses in their own rooms. The exit at the end opens only when every boss is down.

export type BigDungeonId =
  | "abandoned_mine"
  | "sunken_temple"
  | "bone_crypt"
  | "orc_fortress"
  | "dragon_lair"
  | "red_caves"
  | "buried_caravanserai"
  | "frost_cavern"
  | "frost_citadel";

/** Open-world zones with big dungeon entrances. */
export type DungeonHost = "forest" | "canyon" | "frost";

export interface BigDungeon {
  id: BigDungeonId;
  name: string;
  minLevel: number;
  /** The zone its entrance is in, and the entrance tile there (kept clear by that zone's builder). */
  host: DungeonHost;
  entranceTile: { tx: number; ty: number };
  /** How dark it is inside (0..1); torches and fires glow. */
  dim: number;
  layout: BuiltDungeon;
}

const pack = (...mobs: [string, number][]): DungeonRoom => ({ kind: "pack", mobs });
const bossRoom = (boss: string, ...guards: [string, number][]): DungeonRoom => ({ kind: "boss", boss, guards });
const finalRoom = (boss: string, ...guards: [string, number][]): DungeonRoom => ({ kind: "boss", boss, guards, final: true });
const entrance: DungeonRoom = { kind: "entrance" };

interface DungeonSource extends Omit<BigDungeon, "layout"> {
  seed: number;
  wall: Tile;
  floor: Tile;
  theme: DungeonTheme;
  rooms: DungeonRoom[];
}

const list: DungeonSource[] = [
  {
    id: "abandoned_mine",
    name: "Terk Edilmiş Maden",
    minLevel: 9,
    host: "forest",
    entranceTile: { tx: 7, ty: 24 },
    dim: 0.5,
    seed: 501,
    wall: Tile.CaveWall,
    floor: Tile.CaveFloor,
    theme: "mine",
    rooms: [
      entrance,
      pack(["kobold_miner", 4], ["tunnel_rat", 2]),
      pack(["rock_slime", 3], ["kobold_miner", 3]),
      bossRoom("foreman_dorak", ["kobold_miner", 2]),
      pack(["tunnel_rat", 4], ["kobold_overseer", 1]),
      pack(["rock_slime", 3], ["kobold_overseer", 2]),
      bossRoom("crystal_golem", ["rock_slime", 2]),
      pack(["kobold_miner", 3], ["kobold_overseer", 2]),
      pack(["tunnel_rat", 3], ["rock_slime", 3]),
      pack(["kobold_overseer", 3], ["kobold_miner", 2]),
      finalRoom("mine_king", ["kobold_overseer", 2]),
    ],
  },
  {
    id: "sunken_temple",
    name: "Batık Tapınak",
    minLevel: 12,
    host: "forest",
    entranceTile: { tx: 25, ty: 19 },
    dim: 0.35,
    seed: 502,
    wall: Tile.Wall,
    floor: Tile.Plaza,
    theme: "temple",
    rooms: [
      entrance,
      pack(["temple_guard", 3], ["bog_slime", 2]),
      pack(["serpent_hound", 3], ["bog_slime", 2]),
      bossRoom("stone_warden", ["temple_guard", 2]),
      pack(["drowned_priest", 2], ["temple_guard", 3]),
      bossRoom("sacrifice_priestess"),
      pack(["serpent_hound", 4], ["drowned_priest", 1]),
      pack(["bog_slime", 3], ["temple_guard", 2]),
      bossRoom("tide_beast", ["serpent_hound", 2]),
      pack(["drowned_priest", 3], ["temple_guard", 2]),
      pack(["temple_guard", 3], ["serpent_hound", 2]),
      finalRoom("sunken_king", ["temple_guard", 2]),
    ],
  },
  {
    id: "bone_crypt",
    name: "Kemik Mahzeni",
    minLevel: 15,
    host: "forest",
    entranceTile: { tx: 14, ty: 5 },
    dim: 0.55,
    seed: 503,
    wall: Tile.Wall,
    floor: Tile.Cobble,
    theme: "crypt",
    rooms: [
      entrance,
      pack(["bone_soldier", 4], ["crypt_hound", 2]),
      pack(["grave_wraith", 2], ["bone_soldier", 3]),
      bossRoom("grave_keeper", ["bone_soldier", 2]),
      pack(["crypt_hound", 4], ["plague_slime", 1]),
      pack(["plague_slime", 3], ["grave_wraith", 2]),
      bossRoom("bone_beast", ["crypt_hound", 2]),
      pack(["bone_soldier", 3], ["grave_wraith", 2]),
      pack(["plague_slime", 2], ["crypt_hound", 3]),
      pack(["grave_wraith", 3], ["bone_soldier", 3]),
      finalRoom("lich_azgor", ["bone_soldier", 2]),
    ],
  },
  {
    id: "orc_fortress",
    name: "Ork Kalesi",
    minLevel: 18,
    host: "forest",
    entranceTile: { tx: 8, ty: 37 },
    dim: 0.3,
    seed: 504,
    wall: Tile.Wall,
    floor: Tile.Path,
    theme: "fortress",
    rooms: [
      entrance,
      pack(["orc_warrior", 4], ["war_wolf", 2]),
      pack(["orc_shaman", 2], ["orc_warrior", 3]),
      bossRoom("gate_keeper_grom", ["orc_warrior", 2]),
      pack(["war_wolf", 4], ["orc_shaman", 1]),
      bossRoom("wolf_rider_uruk", ["war_wolf", 2]),
      pack(["orc_brute", 2], ["orc_warrior", 3]),
      pack(["orc_shaman", 3], ["war_wolf", 2]),
      bossRoom("shaman_zulgar", ["orc_shaman", 2]),
      pack(["orc_brute", 3], ["orc_warrior", 2]),
      pack(["orc_warrior", 3], ["orc_shaman", 2]),
      finalRoom("warlord_mogthar", ["orc_brute", 2]),
    ],
  },
  {
    id: "dragon_lair",
    name: "Ejder İni",
    minLevel: 21,
    host: "forest",
    entranceTile: { tx: 32, ty: 4 },
    dim: 0.25,
    seed: 505,
    wall: Tile.CaveWall,
    floor: Tile.CaveFloor,
    theme: "lair",
    rooms: [
      entrance,
      pack(["dragon_cultist", 4], ["fire_slime", 2]),
      pack(["drake", 3], ["dragon_cultist", 2]),
      bossRoom("ash_warden", ["dragon_cultist", 2]),
      pack(["fire_slime", 4], ["dragonkin_guard", 1]),
      bossRoom("lava_giant"),
      pack(["drake", 3], ["dragonkin_guard", 2]),
      pack(["dragon_cultist", 3], ["fire_slime", 3]),
      bossRoom("dragon_priest", ["dragonkin_guard", 2]),
      pack(["dragonkin_guard", 3], ["drake", 2]),
      pack(["drake", 4], ["dragon_cultist", 2]),
      finalRoom("elder_dragon", ["drake", 2]),
    ],
  },
  {
    id: "red_caves",
    name: "Kızıl Mağaralar",
    minLevel: 22,
    host: "canyon",
    entranceTile: { tx: 5, ty: 22 },
    dim: 0.45,
    seed: 506,
    wall: Tile.RedRock,
    floor: Tile.Sand,
    theme: "redcave",
    rooms: [
      entrance,
      pack(["gnoll_hunter", 4], ["cave_hyena", 2]),
      pack(["dust_slime", 3], ["gnoll_hunter", 2]),
      bossRoom("gnoll_chief", ["gnoll_hunter", 2]),
      pack(["cave_hyena", 4], ["gnoll_seer", 1]),
      pack(["gnoll_seer", 2], ["dust_slime", 3]),
      bossRoom("hyena_matriarch", ["cave_hyena", 2]),
      pack(["red_minotaur", 2], ["gnoll_hunter", 3]),
      pack(["gnoll_seer", 2], ["red_minotaur", 2]),
      finalRoom("red_bull_tarhan", ["red_minotaur", 2]),
    ],
  },
  {
    id: "buried_caravanserai",
    name: "Gömülü Kervansaray",
    minLevel: 26,
    host: "canyon",
    entranceTile: { tx: 32, ty: 4 },
    dim: 0.4,
    seed: 507,
    wall: Tile.Wall,
    floor: Tile.Sand,
    theme: "ruins",
    rooms: [
      entrance,
      pack(["shrouded_dead", 4], ["tomb_jackal", 2]),
      pack(["cursed_merchant", 2], ["shrouded_dead", 3]),
      bossRoom("caravan_ghost", ["cursed_merchant", 2]),
      pack(["tomb_jackal", 4], ["sand_shade", 1]),
      pack(["ruin_golem", 2], ["shrouded_dead", 2]),
      bossRoom("vizier_kamil", ["shrouded_dead", 2]),
      pack(["sand_shade", 3], ["tomb_jackal", 2]),
      pack(["ruin_golem", 2], ["cursed_merchant", 2]),
      bossRoom("stone_sentinel", ["ruin_golem", 1]),
      pack(["sand_shade", 3], ["shrouded_dead", 3]),
      pack(["tomb_jackal", 3], ["cursed_merchant", 2]),
      pack(["ruin_golem", 2], ["sand_shade", 2]),
      pack(["shrouded_dead", 3], ["tomb_jackal", 3]),
      finalRoom("sand_sultan", ["sand_shade", 2]),
    ],
  },
  {
    id: "frost_cavern",
    name: "Buz Mağarası",
    minLevel: 31,
    host: "frost",
    entranceTile: { tx: 57, ty: 7 },
    dim: 0.3,
    seed: 508,
    wall: Tile.CaveWall,
    floor: Tile.Ice,
    theme: "ice",
    rooms: [
      entrance,
      pack(["ice_fox", 4], ["crystal_slime", 2]),
      pack(["frost_kobold", 3], ["crystal_slime", 2]),
      bossRoom("icebreaker_gorr", ["ice_elemental", 1]),
      pack(["ice_elemental", 2], ["frost_kobold", 3]),
      pack(["ice_fox", 3], ["frozen_spirit", 2]),
      bossRoom("snow_mother_fox", ["ice_fox", 2]),
      pack(["frozen_spirit", 3], ["frost_kobold", 2]),
      pack(["ice_elemental", 2], ["crystal_slime", 3]),
      pack(["frozen_spirit", 2], ["ice_fox", 3]),
      finalRoom("crystal_mother_neyra", ["frozen_spirit", 2]),
    ],
  },
  {
    id: "frost_citadel",
    name: "Ayaz Kalesi",
    minLevel: 35,
    host: "frost",
    entranceTile: { tx: 56, ty: 40 },
    dim: 0.3,
    seed: 509,
    wall: Tile.Wall,
    floor: Tile.Snow,
    theme: "citadel",
    rooms: [
      entrance,
      pack(["frost_knight", 3], ["ice_hound", 2]),
      pack(["frost_mage", 2], ["frost_knight", 2]),
      bossRoom("gate_commander_sergun", ["frost_knight", 2]),
      pack(["ice_hound", 4], ["frost_mage", 1]),
      pack(["giant_guard", 2], ["frost_knight", 2]),
      bossRoom("ice_witch_ayaza", ["frost_mage", 2]),
      pack(["winter_wraith", 3], ["ice_hound", 2]),
      pack(["giant_guard", 2], ["frost_mage", 2]),
      bossRoom("white_drake_kiragi", ["ice_hound", 2]),
      pack(["frost_knight", 3], ["winter_wraith", 2]),
      pack(["giant_guard", 2], ["winter_wraith", 2]),
      finalRoom("winter_king_ulukan", ["giant_guard", 2]),
    ],
  },
];

export const BIG_DUNGEONS: Record<BigDungeonId, BigDungeon> = Object.fromEntries(
  list.map(({ rooms, seed, wall, floor, theme, ...dungeon }) => [dungeon.id, { ...dungeon, layout: buildDungeon({ seed, wall, floor, theme, rooms }) }]),
) as Record<BigDungeonId, BigDungeon>;

export const BIG_DUNGEON_IDS = Object.keys(BIG_DUNGEONS) as BigDungeonId[];

/** The big dungeons whose entrances are in a zone. */
export function dungeonsIn(host: DungeonHost): BigDungeon[] {
  return BIG_DUNGEON_IDS.map((id) => BIG_DUNGEONS[id]).filter((dungeon) => dungeon.host === host);
}

/** Feet position of a dungeon's entrance in its host zone, and where you stand when you come back out. */
export function bigDungeonEntrance(dungeon: BigDungeon) {
  const { tx, ty } = dungeon.entranceTile;
  return {
    portal: { x: (tx + 0.5) * TILE_SIZE, y: (ty + 1) * TILE_SIZE },
    returnTo: { x: (tx + 0.5) * TILE_SIZE, y: (ty + 3) * TILE_SIZE },
  };
}
