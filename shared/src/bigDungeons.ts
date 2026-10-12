import { TILE_SIZE } from "./constants";
import { buildDungeon, type BuiltDungeon, type DungeonRoom } from "./dungeons";
import { Tile } from "./map";

// The five big dungeons, all entered from the Dark Forest. Much longer than the Goblin Cave:
// 30-40 mobs in packs along a chain of rooms, and 3-4 bosses in their own rooms. The exit
// at the end opens only when every boss is down.

export type BigDungeonId = "abandoned_mine" | "sunken_temple" | "bone_crypt" | "orc_fortress" | "dragon_lair";

export interface BigDungeon {
  id: BigDungeonId;
  name: string;
  minLevel: number;
  /** Entrance tile in the Dark Forest (kept clear by buildForest). */
  forestTile: { tx: number; ty: number };
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
  rooms: DungeonRoom[];
}

const list: DungeonSource[] = [
  {
    id: "abandoned_mine",
    name: "Terk Edilmiş Maden",
    minLevel: 9,
    forestTile: { tx: 7, ty: 24 },
    seed: 501,
    wall: Tile.CaveWall,
    floor: Tile.CaveFloor,
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
    forestTile: { tx: 25, ty: 19 },
    seed: 502,
    wall: Tile.Wall,
    floor: Tile.Plaza,
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
    forestTile: { tx: 14, ty: 5 },
    seed: 503,
    wall: Tile.Wall,
    floor: Tile.Cobble,
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
    forestTile: { tx: 8, ty: 37 },
    seed: 504,
    wall: Tile.Wall,
    floor: Tile.Path,
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
    forestTile: { tx: 32, ty: 4 },
    seed: 505,
    wall: Tile.CaveWall,
    floor: Tile.CaveFloor,
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
];

export const BIG_DUNGEONS: Record<BigDungeonId, BigDungeon> = Object.fromEntries(
  list.map(({ rooms, seed, wall, floor, ...dungeon }) => [dungeon.id, { ...dungeon, layout: buildDungeon({ seed, wall, floor, rooms }) }]),
) as Record<BigDungeonId, BigDungeon>;

export const BIG_DUNGEON_IDS = Object.keys(BIG_DUNGEONS) as BigDungeonId[];

/** Feet position of a forest entrance, and where you stand when you come back out. */
export function bigDungeonEntrance(dungeon: BigDungeon) {
  const { tx, ty } = dungeon.forestTile;
  return {
    portal: { x: (tx + 0.5) * TILE_SIZE, y: (ty + 1) * TILE_SIZE },
    returnTo: { x: (tx + 0.5) * TILE_SIZE, y: (ty + 3) * TILE_SIZE },
  };
}
