import { TILE_SIZE } from "./constants";
import { Tile, TILE_COUNT } from "./map";

// Art a GM uploads in the map editor ("Kare görselleri") in place of what the game draws in code.
//   Tile slots (`index`): one ground tile each, square; the game builds its tileset from them.
//   Castle slots (`decor`): pieces of the castle the game draws standing up (castleWall, tower),
//   each with its own shape: the wall walk seen from above, the wall's front face, a whole tower.
// An upload is `w` x `h` pixels or 2, 3 or 4 times that (sharper when zoomed in).

export interface TileArtSlot {
  key: string;
  name: string;
  /** What the piece is and where it shows, for the editor. */
  hint: string;
  /** Tile slots: index in the client's tileset (Tile values, then the render-only wall faces). */
  index?: number;
  /** Size at 1x, in pixels. */
  w: number;
  h: number;
}

const tile = (key: string, name: string, index: number, hint: string): TileArtSlot => ({ key, name, hint, index, w: TILE_SIZE, h: TILE_SIZE });

/** Height of the castle wall's front face, and of a tower's, in pixels (client decor.ts draws them). */
export const CASTLE_WALL_H = 24;
export const CASTLE_TOWER_H = 40;
/** How far battlements rise above the top they stand on. */
export const CASTLE_MERLON_H = 6;

export const TILE_ART_SLOTS: TileArtSlot[] = [
  tile("grass", "Çimen", Tile.Grass, "Zemin karesi."),
  tile("grass_alt", "Açık Çimen", Tile.GrassAlt, "Zemin karesi."),
  tile("dark_grass", "Orman Zemini", Tile.DarkGrass, "Zemin karesi."),
  tile("flowers", "Çiçekli Çimen", Tile.Flower, "Zemin karesi."),
  tile("path", "Toprak Yol", Tile.Path, "Zemin karesi."),
  tile("cobble", "Arnavut Kaldırımı", Tile.Cobble, "Zemin karesi."),
  tile("plaza", "Meydan Taşı", Tile.Plaza, "Zemin karesi."),
  tile("market", "Pazar Tuğlası", Tile.Market, "Zemin karesi."),
  tile("cave_floor", "Mağara Zemini", Tile.CaveFloor, "Zemin karesi."),
  tile("bridge", "Köprü", Tile.Bridge, "Zemin karesi."),
  tile("tree", "Ağaç", Tile.Tree, "Engel karesi: arka planıyla birlikte çiz."),
  tile("water", "Su", Tile.Water, "Engel karesi."),
  tile("rock", "Kaya (üstten)", Tile.CaveWall, "Mağara duvarının tepesi."),
  tile("cave_wall_face", "Kaya (ön yüz)", TILE_COUNT, "Mağara duvarının, altında zemin olan karesi."),
  tile("wall", "Zindan duvarı (üstten)", Tile.Wall, "Kale dışındaki düz duvar karesi (zindanlar). Kalede görünmez: kaleyi aşağıdaki parçalar çizer."),
  tile("town_wall_face", "Zindan duvarı (ön yüz)", TILE_COUNT + 1, "Düz duvarın, altında zemin olan karesi (zindanlar)."),
  {
    key: "castle_top",
    name: "Kale duvarı · üst",
    hint: `Duvarın üstündeki yürüyüş yolu, tepeden. Her duvar karesine bir tane, ${CASTLE_WALL_H} px yukarı kaldırılarak çizilir; mazgallar üstüne eklenir.`,
    w: TILE_SIZE,
    h: TILE_SIZE,
  },
  {
    key: "castle_face",
    name: "Kale duvarı · ön yüz",
    hint: "Güneyi açık duvar karelerinin önden görünen taş yüzü: üst parçanın hemen altına, zemine kadar.",
    w: TILE_SIZE,
    h: CASTLE_WALL_H,
  },
  {
    key: "tower",
    name: "Kule (4×4)",
    hint: `Bütün kule tek görsel, yukarıdan aşağı: ${CASTLE_MERLON_H} px mazgal payı, ${4 * TILE_SIZE} px tepe, ${CASTLE_TOWER_H} px ön yüz. Alt kenarı kulenin zemindeki alt kenarına oturur. Bayrak görsele dahil.`,
    w: 4 * TILE_SIZE,
    h: CASTLE_MERLON_H + 4 * TILE_SIZE + CASTLE_TOWER_H,
  },
];

export const TILE_ART_BY_KEY: Record<string, TileArtSlot> = Object.fromEntries(TILE_ART_SLOTS.map((s) => [s.key, s]));

/** Accepted sizes for a slot: its 1x size and 2x, 3x, 4x. */
export function tileArtSizes(slot: TileArtSlot): { w: number; h: number }[] {
  return [1, 2, 3, 4].map((k) => ({ w: slot.w * k, h: slot.h * k }));
}

export const TILE_ART_MAX_BYTES = 256 * 1024;
