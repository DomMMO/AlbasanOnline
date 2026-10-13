import { TILE_SIZE } from "./constants";
import { ICON_SHAPES, type IconShape } from "./data/items";
import { MOBS } from "./data/mobs";
import type { Decor, DungeonLayout, SpawnZone } from "./dungeons";
import { isBlockingTile, Tile, type WorldMap } from "./map";

// Map editor data (GM "Harita Editörü"). A zone's map is still generated in code; the editor
// stores a list of objects placed on top of it, and applyMapEdits() lays them over the
// generated map the same way on the server and in every client, so collision stays identical.
//
// Layers:
//   ground   - floor tiles (grass, path, cobble...): walkable
//   collider - blocking tiles (wall, tower, tree, rock, water, invisible blocker); drawn over the ground
//   spawn    - the player spawn point and mob spawn areas
//
// Coordinates are tiles (x, y), an object covers w x h tiles; z orders objects within a layer
// (higher wins); rotation is 0/90/180/270 degrees (tiles are drawn turned in the game).
//
// Decor follows the edits: walls (Tile.Wall) painted by the editor join the castle wall, which
// works out its own corners and battlements from its neighbours; towers are 4x4 objects.
// Painting never takes decor away (a building keeps standing on whatever is painted under it);
// only a "Süs Kaldır" area does, for the decor it touches.
//
// The map can also be resized: `size` grows or shrinks it at the right and bottom edges (the
// top-left corner stays put, so everything placed in code keeps its coordinates). New area is
// filled with `size.fill`; whatever falls outside a shrunk map is dropped.

export type MapLayer = "ground" | "collider" | "decor" | "spawn";

export const MAP_LAYERS: { id: MapLayer; name: string }[] = [
  { id: "ground", name: "Zemin" },
  { id: "collider", name: "Engel" },
  { id: "decor", name: "Süs" },
  { id: "spawn", name: "Doğuş" },
];

export interface MapPaletteItem {
  type: string;
  name: string;
  layer: MapLayer;
  /** The tile it puts down (ground and collider objects). */
  tile?: Tile;
  /** Always this many tiles square (towers, spawn points). */
  fixedSize?: number;
  /** Decor layer: what it puts down (its position is the object's). */
  decor?: DecorTemplate;
  /** Not offered in the palette (made by the editor itself). */
  hidden?: boolean;
}

/** A piece of decor without its position. */
export type DecorTemplate = { [K in Decor["kind"]]: Omit<Extract<Decor, { kind: K }>, "tx" | "ty"> }[Exclude<Decor["kind"], "castleWall" | "fence" | "clouds" | "colosseum" | "roundFence">];

/** What the editor's palette offers; the server rejects anything else. */
export const MAP_PALETTE: MapPaletteItem[] = [
  { type: "grass", name: "Çimen", layer: "ground", tile: Tile.Grass },
  { type: "grass_alt", name: "Açık Çimen", layer: "ground", tile: Tile.GrassAlt },
  { type: "dark_grass", name: "Orman Zemini", layer: "ground", tile: Tile.DarkGrass },
  { type: "flowers", name: "Çiçekli Çimen", layer: "ground", tile: Tile.Flower },
  { type: "path", name: "Toprak Yol", layer: "ground", tile: Tile.Path },
  { type: "cobble", name: "Arnavut Kaldırımı", layer: "ground", tile: Tile.Cobble },
  { type: "plaza", name: "Meydan Taşı", layer: "ground", tile: Tile.Plaza },
  { type: "market", name: "Pazar Tuğlası", layer: "ground", tile: Tile.Market },
  { type: "cave_floor", name: "Mağara Zemini", layer: "ground", tile: Tile.CaveFloor },
  { type: "bridge", name: "Köprü", layer: "ground", tile: Tile.Bridge },
  { type: "wall", name: "Kale Duvarı", layer: "collider", tile: Tile.Wall },
  { type: "tower", name: "Kule (4×4)", layer: "collider", tile: Tile.Wall, fixedSize: 4 },
  { type: "tree", name: "Ağaç", layer: "collider", tile: Tile.Tree },
  { type: "rock", name: "Kaya", layer: "collider", tile: Tile.CaveWall },
  { type: "water", name: "Su", layer: "collider", tile: Tile.Water },
  { type: "sky", name: "Gökyüzü (boşluk)", layer: "collider", tile: Tile.Sky },
  { type: "blocker", name: "Görünmez Engel", layer: "collider", tile: Tile.Solid },
  { type: "blocker_half", name: "Yarım Engel (½)", layer: "collider", fixedSize: 1 },
  { type: "blocker_quarter", name: "Küçük Engel (¼)", layer: "collider", fixedSize: 1 },
  { type: "unblock", name: "Engel Kaldır", layer: "collider" },
  { type: "remove_decor", name: "Süs Kaldır", layer: "collider" },
  // ---- Decor: houses, trees, plants, lamps and things (placed, moved, removed one by one) ----
  { type: "decor", name: "Süs", layer: "decor", hidden: true },
  { type: "hide_decor", name: "Kaldırılan süs", layer: "decor", hidden: true },
  { type: "d_house_s", name: "Ev (4×3)", layer: "decor", decor: { kind: "building", w: 4, h: 3, roof: 0x8a5a3a, chimney: true } },
  { type: "d_house_m", name: "Ev (5×4)", layer: "decor", decor: { kind: "building", w: 5, h: 4, roof: 0x3a5a7a, chimney: false } },
  { type: "d_house_l", name: "Ev (6×4)", layer: "decor", decor: { kind: "building", w: 6, h: 4, roof: 0x9c3b2e, chimney: true } },
  { type: "d_tree", name: "Büyük Ağaç", layer: "decor", decor: { kind: "bigTree", variant: 0 } },
  { type: "d_bush", name: "Çalı", layer: "decor", decor: { kind: "bush", variant: 0 } },
  { type: "d_fern", name: "Eğreltiotu", layer: "decor", decor: { kind: "plant", variant: 0 } },
  { type: "d_tallgrass", name: "Uzun Ot", layer: "decor", decor: { kind: "plant", variant: 3 } },
  { type: "d_flowers", name: "Sarı Çiçekler", layer: "decor", decor: { kind: "plant", variant: 5 } },
  { type: "d_flowers_pink", name: "Pembe Çiçekler", layer: "decor", decor: { kind: "plant", variant: 6 } },
  { type: "d_weed", name: "Yabani Ot", layer: "decor", decor: { kind: "plant", variant: 7 } },
  { type: "d_lamp", name: "Fener", layer: "decor", decor: { kind: "lamp" } },
  { type: "d_torch", name: "Meşale", layer: "decor", decor: { kind: "torch" } },
  { type: "d_banner", name: "Sancak", layer: "decor", decor: { kind: "banner", color: 0x9c2a2a } },
  { type: "d_barrel", name: "Fıçı", layer: "decor", decor: { kind: "prop", prop: "barrel" } },
  { type: "d_crate", name: "Sandık", layer: "decor", decor: { kind: "prop", prop: "crate" } },
  { type: "d_sack", name: "Çuval", layer: "decor", decor: { kind: "prop", prop: "sack" } },
  { type: "d_hay", name: "Saman Balyası", layer: "decor", decor: { kind: "prop", prop: "hay" } },
  { type: "d_well", name: "Kuyu (2×2)", layer: "decor", decor: { kind: "prop", prop: "well" } },
  { type: "d_dummy", name: "Antrenman Kuklası", layer: "decor", decor: { kind: "prop", prop: "dummy" } },
  { type: "d_cart", name: "Araba", layer: "decor", decor: { kind: "prop", prop: "cart" } },
  { type: "d_anvil", name: "Örs", layer: "decor", decor: { kind: "anvil" } },
  { type: "d_campfire", name: "Kamp Ateşi", layer: "decor", decor: { kind: "campfire" } },
  { type: "player_spawn", name: "Oyuncu Doğuşu", layer: "spawn", fixedSize: 1 },
  { type: "mob_spawn", name: "Yaratık Doğuşu", layer: "spawn", fixedSize: 1 },
];

export const MAP_PALETTE_BY_TYPE: Record<string, MapPaletteItem> = Object.fromEntries(MAP_PALETTE.map((p) => [p.type, p]));

export interface MobSpawnProps {
  mob: string;
  count: number;
  /** Tiles. */
  radius: number;
}

export interface MapObject {
  id: string;
  type: string;
  layer: MapLayer;
  x: number;
  y: number;
  /** Order within the layer: higher is placed later (wins). */
  z: number;
  w: number;
  h: number;
  rotation: 0 | 90 | 180 | 270;
  props?: MobSpawnProps;
  /**
   * Small blocker: which quarter of its tile (0 top-left, 1 top-right, 2 bottom-left, 3
   * bottom-right). Half blocker: which half (0 top, 1 bottom, 2 left, 3 right).
   */
  q?: number;
  /** Decor layer: the piece put down (its tx, ty follow the object's x, y). */
  decor?: Decor;
  /** "Kaldırılan süs": which piece of the map's own decor it takes away (decorRef). */
  ref?: string;
}

/** Decor that can be placed, moved or removed in the editor. */
export const EDITABLE_DECOR = new Set<Decor["kind"]>([
  "building", "fountain", "lamp", "anvil", "banner", "campfire", "tent", "grave", "torch", "signboard", "prop", "horse", "trough", "bush", "plant", "bigTree",
]);

/** Decor that stands on solid ground (you walk round it); plants, bushes and signboards you walk through. */
const SOLID_DECOR = new Set<Decor["kind"]>(["building", "fountain", "lamp", "anvil", "banner", "campfire", "tent", "grave", "torch", "prop", "horse", "trough", "bigTree"]);

/** A name for a piece of the map's own decor: its kind and its spot. */
export function decorRef(d: Decor): string | null {
  const f = decorFootprint(d);
  return f ? `${d.kind}@${f.tx},${f.ty}` : null;
}

const PROPS = ["barrel", "crate", "hay", "well", "cart", "column", "obelisk", "dummy", "sack"] as const;

/** Untrusted decor from the editor, checked field by field (unknown fields dropped), or why not. */
export function sanitizeDecor(input: unknown, width: number, height: number): Decor | string {
  if (!input || typeof input !== "object") return "süs verisi geçersiz";
  const d = input as Record<string, unknown>;
  const kind = d.kind as Decor["kind"];
  if (typeof kind !== "string" || !EDITABLE_DECOR.has(kind)) return "bu süs türü konamaz";
  if (!isInt(d.tx, 0, width - 1) || !isInt(d.ty, 0, height - 1)) return "süs harita dışında";
  const tx = d.tx;
  const ty = d.ty;
  const colour = (v: unknown) => isInt(v, 0, 0xffffff);
  const size = (v: unknown, max: number) => isInt(v, 1, max);
  switch (kind) {
    case "building": {
      if (!size(d.w, 12) || !size(d.h, 10) || !colour(d.roof)) return "ev ölçüsü ya da çatı rengi geçersiz";
      const out: Extract<Decor, { kind: "building" }> = { kind, tx, ty, w: d.w as number, h: d.h as number, roof: d.roof as number, chimney: d.chimney === true };
      if (d.ridge === "h" || d.ridge === "v") out.ridge = d.ridge;
      if (d.sign !== undefined && d.sign !== null) {
        const sign = d.sign as Record<string, unknown>;
        if (!ICON_SHAPES.includes(sign.shape as never) || !colour(sign.color)) return "tabela geçersiz";
        out.sign = { shape: sign.shape as IconShape, color: sign.color as number };
      }
      return out;
    }
    case "fountain":
      if (!size(d.w, 8) || !size(d.h, 8)) return "çeşme ölçüsü geçersiz";
      return { kind, tx, ty, w: d.w as number, h: d.h as number };
    case "tent":
      if (!size(d.w, 8) || !size(d.h, 8) || !colour(d.color)) return "çadır geçersiz";
      return { kind, tx, ty, w: d.w as number, h: d.h as number, color: d.color as number };
    case "banner":
      if (!colour(d.color)) return "sancak rengi geçersiz";
      return { kind, tx, ty, color: d.color as number };
    case "signboard":
      if (!size(d.w, 10) || typeof d.text !== "string" || d.text.length > 20) return "tabela geçersiz";
      return { kind, tx, ty, w: d.w as number, text: d.text };
    case "prop":
      if (!PROPS.includes(d.prop as never)) return "eşya türü geçersiz";
      return { kind, tx, ty, prop: d.prop as (typeof PROPS)[number] };
    case "horse": {
      const look = (d.look ?? {}) as Record<string, unknown>;
      if (![look.coat, look.mane, look.blanket, look.saddle].every(colour) || !["left", "right", "down"].includes(d.facing as string)) return "at geçersiz";
      return { kind, tx, ty, look: { coat: look.coat as number, mane: look.mane as number, blanket: look.blanket as number, saddle: look.saddle as number }, facing: d.facing as "left" | "right" | "down" };
    }
    case "bush":
    case "plant":
    case "bigTree":
      if (!isInt(d.variant, 0, 63)) return "çeşit geçersiz";
      return { kind, tx, ty, variant: d.variant };
    default:
      return { kind, tx, ty } as Decor;
  }
}

export interface MapSize {
  /** Tiles. */
  width: number;
  height: number;
  /** Palette type (ground or collider) the new area is filled with. */
  fill: string;
}

export interface MapEdits {
  version: 1;
  zone: string;
  /** Snap size the editor used, in pixels (informational). */
  grid: number;
  /** Resized map; absent keeps the generated size. */
  size?: MapSize;
  objects: MapObject[];
}

export const MAP_EDIT_LIMITS = {
  objects: 20_000,
  size: 16,
  mobCount: 15,
  mobRadius: 10,
  mapMin: 16,
  mapMax: 256,
};

/** Palette items a resized map's new area may be filled with. */
export const MAP_FILL_TYPES = MAP_PALETTE.filter((p) => p.tile !== undefined && !p.fixedSize).map((p) => p.type);

/** Mobs a spawn area may use: anything but bosses. */
export function spawnableMobs(): string[] {
  return Object.values(MOBS)
    .filter((m) => !m.boss)
    .map((m) => m.id);
}

const isInt = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/**
 * Strict check of untrusted editor data against a map of `width` x `height` tiles.
 * Returns clean data (unknown fields dropped) or the first problem found.
 */
export function validateMapEdits(input: unknown, zone: string, width: number, height: number): { ok: true; edits: MapEdits } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Geçersiz harita verisi" };
  const data = input as Record<string, unknown>;
  if (data.version !== 1) return { ok: false, error: "Desteklenmeyen sürüm" };
  let size: MapSize | undefined;
  if (data.size !== undefined && data.size !== null) {
    const s = data.size as Record<string, unknown>;
    const { mapMin, mapMax } = MAP_EDIT_LIMITS;
    if (typeof s !== "object" || !isInt(s.width, mapMin, mapMax) || !isInt(s.height, mapMin, mapMax)) {
      return { ok: false, error: `Harita boyutu ${mapMin}-${mapMax} kare olmalı` };
    }
    if (typeof s.fill !== "string" || !MAP_FILL_TYPES.includes(s.fill)) return { ok: false, error: "Geçersiz dolgu türü" };
    // The generated size needs no entry.
    if (s.width !== width || s.height !== height) size = { width: s.width, height: s.height, fill: s.fill };
    width = s.width;
    height = s.height;
  }
  if (!Array.isArray(data.objects)) return { ok: false, error: "objects bir liste olmalı" };
  if (data.objects.length > MAP_EDIT_LIMITS.objects) return { ok: false, error: `En fazla ${MAP_EDIT_LIMITS.objects} obje` };
  const grid = isInt(data.grid, 1, 256) ? data.grid : TILE_SIZE;
  const mobs = new Set(spawnableMobs());
  const ids = new Set<string>();
  const objects: MapObject[] = [];
  let playerSpawns = 0;
  for (const [i, raw] of data.objects.entries()) {
    const where = `Obje #${i + 1}`;
    if (!raw || typeof raw !== "object") return { ok: false, error: `${where}: geçersiz` };
    const o = raw as Record<string, unknown>;
    const item = typeof o.type === "string" ? MAP_PALETTE_BY_TYPE[o.type] : undefined;
    if (!item) return { ok: false, error: `${where}: bilinmeyen tür` };
    if (o.layer !== item.layer) return { ok: false, error: `${where}: ${item.name} "${item.layer}" katmanında olmalı` };
    if (typeof o.id !== "string" || o.id.length === 0 || o.id.length > 40 || ids.has(o.id)) return { ok: false, error: `${where}: geçersiz ya da tekrarlanan id` };
    ids.add(o.id);
    if (!isInt(o.z, 0, 100_000)) return { ok: false, error: `${where}: geçersiz z` };
    if (item.layer === "decor") {
      if (item.type === "hide_decor") {
        if (typeof o.ref !== "string" || !/^[a-zA-Z]{2,20}@\d{1,4},\d{1,4}$/.test(o.ref)) return { ok: false, error: `${where}: kaldırılan süs geçersiz` };
        objects.push({ id: o.id, type: item.type, layer: "decor", x: 0, y: 0, z: o.z as number, w: 1, h: 1, rotation: 0, ref: o.ref });
        continue;
      }
      // Its spot is the object's; its shape and size come from the decor itself.
      if (!isInt(o.x, 0, width - 1) || !isInt(o.y, 0, height - 1)) return { ok: false, error: `${where}: harita dışında` };
      const decor = sanitizeDecor({ ...(o.decor as object), tx: o.x, ty: o.y }, width, height);
      if (typeof decor === "string") return { ok: false, error: `${where}: ${decor}` };
      if (item.decor && item.decor.kind !== decor.kind) return { ok: false, error: `${where}: ${item.name} başka bir süse dönüşemez` };
      const f = decorFootprint(decor)!;
      if (f.tx + f.w > width || f.ty + f.h > height) return { ok: false, error: `${where}: harita dışına taşıyor` };
      objects.push({ id: o.id, type: item.type, layer: "decor", x: o.x as number, y: o.y as number, z: o.z as number, w: f.w, h: f.h, rotation: 0, decor });
      continue;
    }
    const w = item.fixedSize ?? (isInt(o.w, 1, MAP_EDIT_LIMITS.size) ? o.w : 1);
    const h = item.fixedSize ?? (isInt(o.h, 1, MAP_EDIT_LIMITS.size) ? o.h : 1);
    if (!isInt(o.x, 0, width - w) || !isInt(o.y, 0, height - h)) return { ok: false, error: `${where}: harita dışında` };
    if (!isInt(o.z, 0, 100_000)) return { ok: false, error: `${where}: geçersiz z` };
    if (![0, 90, 180, 270].includes(o.rotation as number)) return { ok: false, error: `${where}: dönüş 0, 90, 180 ya da 270 olmalı` };
    const object: MapObject = { id: o.id, type: item.type, layer: item.layer, x: o.x, y: o.y, z: o.z, w, h, rotation: o.rotation as MapObject["rotation"] };
    if (item.type === "blocker_quarter" || item.type === "blocker_half") {
      if (!isInt(o.q, 0, 3)) return { ok: false, error: `${where}: parça 0-3 olmalı` };
      object.q = o.q;
    }
    if (item.type === "player_spawn") {
      if (++playerSpawns > 1) return { ok: false, error: "Tek bir Oyuncu Doğuşu olabilir" };
    }
    if (item.type === "mob_spawn") {
      const p = (o.props ?? {}) as Record<string, unknown>;
      if (typeof p.mob !== "string" || !mobs.has(p.mob)) return { ok: false, error: `${where}: geçersiz yaratık` };
      if (!isInt(p.count, 1, MAP_EDIT_LIMITS.mobCount)) return { ok: false, error: `${where}: adet 1-${MAP_EDIT_LIMITS.mobCount} olmalı` };
      if (!isInt(p.radius, 1, MAP_EDIT_LIMITS.mobRadius)) return { ok: false, error: `${where}: yarıçap 1-${MAP_EDIT_LIMITS.mobRadius} olmalı` };
      object.props = { mob: p.mob, count: p.count, radius: p.radius };
    }
    objects.push(object);
  }
  return { ok: true, edits: { version: 1, zone, grid, ...(size ? { size } : {}), objects } };
}

/** Quarters a half blocker covers (blockMask bits): top, bottom, left, right. */
export const HALF_MASKS = [1 | 2, 4 | 8, 1 | 4, 2 | 8];

const LAYER_ORDER: Record<MapLayer, number> = { ground: 0, collider: 1, decor: 2, spawn: 3 };

const FLOORS = new Set<Tile>([Tile.Grass, Tile.GrassAlt, Tile.Flower, Tile.DarkGrass, Tile.Cobble, Tile.Plaza, Tile.Path, Tile.Market]);

/** The floor nearest a tile (what to put back where a building stood). */
function floorNear(tiles: Tile[][], x: number, y: number): Tile {
  for (let r = 1; r < 8; r++) {
    for (const [dx, dy] of [[0, r], [-r, 0], [r, 0], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]]) {
      const t = tiles[y + dy]?.[x + dx];
      if (t !== undefined && FLOORS.has(t)) return t;
    }
  }
  return Tile.Grass;
}

/**
 * The generated layout with the edits laid over it, as a new object (the generated one is
 * left untouched). Ground then collider objects overwrite tiles in z order; the player spawn
 * moves the spawn point; mob spawns add spawn areas. Rotations are kept for the renderer.
 */
export function applyMapEdits<L extends DungeonLayout & { map: WorldMap }>(generated: L, edits: MapEdits | null | undefined): L {
  if (!edits || (edits.objects.length === 0 && !edits.size)) return generated;
  const base = edits.size ? resizeLayout(generated, edits.size) : generated;
  const tiles = base.map.tiles.map((row) => [...row]);
  const rotations: Record<string, number> = { ...(base.rotations ?? {}) };
  let spawn = base.map.spawn;
  const spawnZones: SpawnZone[] = [...(base.spawnZones ?? [])];
  const ordered = [...edits.objects].sort((a, b) => LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer] || a.z - b.z);
  /** Cells an edit put a visible tile on (painting an invisible blocker leaves decor alone). */
  const covered = new Set<string>();
  const width = base.map.width;
  const blockMask = new Map(base.map.blockMask ?? []);
  const towers: MapObject[] = [];
  /** "Süs Kaldır" areas. */
  const removals: MapObject[] = [];
  for (const o of ordered) {
    const item = MAP_PALETTE_BY_TYPE[o.type];
    if (!item) continue;
    if (item.tile !== undefined) {
      if (o.type === "tower") towers.push(o);
      for (let y = o.y; y < o.y + o.h && y < base.map.height; y++) {
        for (let x = o.x; x < o.x + o.w && x < base.map.width; x++) {
          tiles[y][x] = item.tile;
          blockMask.delete(y * width + x);
          if (item.tile !== Tile.Solid) covered.add(`${x},${y}`);
          if (o.rotation) rotations[`${x},${y}`] = o.rotation;
          else delete rotations[`${x},${y}`];
        }
      }
    } else if ((o.type === "blocker_quarter" || o.type === "blocker_half") && o.q !== undefined) {
      // A quarter or a half of a tile that is not blocking already.
      const i = o.y * width + o.x;
      const mask = blockMask.get(i) ?? (isBlockingTile(tiles[o.y][o.x]) ? 15 : 0);
      blockMask.set(i, mask | (o.type === "blocker_half" ? HALF_MASKS[o.q] : 1 << o.q));
    } else if (o.type === "remove_decor") {
      removals.push(o);
    } else if (o.type === "unblock") {
      // Takes invisible blockers (whole or quarters) away; walls, trees and water stay.
      for (let y = o.y; y < o.y + o.h && y < base.map.height; y++) {
        for (let x = o.x; x < o.x + o.w && x < width; x++) {
          if (tiles[y][x] === Tile.Solid) blockMask.set(y * width + x, 0);
          else if (!isBlockingTile(tiles[y][x])) blockMask.delete(y * width + x);
        }
      }
    } else if (o.type === "player_spawn") {
      spawn = { x: (o.x + o.w / 2) * TILE_SIZE, y: (o.y + o.h) * TILE_SIZE };
    } else if (o.type === "mob_spawn" && o.props) {
      spawnZones.push({ mob: o.props.mob, tx: Math.floor(o.x + o.w / 2), ty: Math.floor(o.y + o.h / 2), radius: o.props.radius, count: o.props.count });
    }
  }
  // Decor the editor took away: gone, and the floor back where it stood.
  const hidden = new Set(ordered.filter((o) => o.type === "hide_decor" && o.ref).map((o) => o.ref!));
  const kept: Decor[] = [];
  for (const d of base.decor ?? []) {
    const ref = hidden.size > 0 ? decorRef(d) : null;
    if (!ref || !hidden.has(ref)) {
      kept.push(d);
      continue;
    }
    const f = decorFootprint(d)!;
    if (!SOLID_DECOR.has(d.kind)) continue;
    for (let y = f.ty; y < f.ty + f.h; y++) for (let x = f.tx; x < f.tx + f.w; x++) if (tiles[y]?.[x] === Tile.Solid) tiles[y][x] = floorNear(tiles, x, y);
  }
  // Decor the editor put down (or moved): where its object is, solid underfoot if it stands.
  const added: Decor[] = [];
  for (const o of ordered) {
    if (o.layer !== "decor" || !o.decor) continue;
    const d = { ...o.decor, tx: o.x, ty: o.y } as Decor;
    added.push(d);
    if (!SOLID_DECOR.has(d.kind)) continue;
    const f = decorFootprint(d)!;
    for (let y = f.ty; y < f.ty + f.h && y < base.map.height; y++) for (let x = f.tx; x < f.tx + f.w && x < base.map.width; x++) {
      tiles[y][x] = Tile.Solid;
      blockMask.delete(y * width + x);
    }
  }
  const decor = [...editDecor(kept, tiles, covered, towers, removals), ...added];
  return { ...base, map: { ...base.map, tiles, spawn, blockMask }, spawnZones, rotations, decor };
}

/** Tiles a piece of decor stands on, or null for decor laid out some other way. */
export function decorFootprint(d: Decor): { tx: number; ty: number; w: number; h: number } | null {
  switch (d.kind) {
    case "castleWall":
    case "fence":
    case "groundFrame":
    case "colosseum":
    case "clouds":
    case "roundFence":
      return null;
    case "prop":
      return { tx: d.tx, ty: d.ty, w: d.prop === "well" ? 2 : 1, h: d.prop === "well" ? 2 : 1 };
    default:
      return { tx: d.tx, ty: d.ty, w: "w" in d ? d.w : 1, h: "h" in d ? d.h : 1 };
  }
}

const TOWER_FLAGS = [0x9c2a2a, 0xe0a83f];

/**
 * Decor after the edits: whatever a "Süs Kaldır" area touches goes, editor towers are added, and
 * the castle wall runs along its old tiles that are still walls, every wall the editor put down
 * and the walls of a tower taken away.
 */
function editDecor(decor: Decor[], tiles: Tile[][], covered: Set<string>, towers: MapObject[], removals: MapObject[]): Decor[] {
  const hit = (f: { tx: number; ty: number; w: number; h: number }) =>
    removals.some((r) => f.tx < r.x + r.w && r.x < f.tx + f.w && f.ty < r.y + r.h && r.y < f.ty + f.h);
  const result: Decor[] = [];
  const freed: { tx: number; ty: number }[] = [];
  let castle: Extract<Decor, { kind: "castleWall" }> | undefined;
  for (const d of decor) {
    if (d.kind === "castleWall") castle = d;
    else if (d.kind === "fence") result.push({ ...d, tiles: d.tiles.filter((t) => !hit({ tx: t.tx, ty: t.ty, w: 1, h: 1 })) });
    else {
      const f = decorFootprint(d);
      if (!f || !hit(f)) result.push(d);
      else if (d.kind === "tower") for (let y = f.ty; y < f.ty + f.h; y++) for (let x = f.tx; x < f.tx + f.w; x++) freed.push({ tx: x, ty: y });
    }
  }
  towers.forEach((t, i) => result.push({ kind: "tower", tx: t.x, ty: t.y, w: t.w, h: t.h, flag: TOWER_FLAGS[i % 2] }));

  const underTower = new Set<string>();
  for (const d of result) {
    if (d.kind !== "tower") continue;
    for (let y = d.ty; y < d.ty + d.h; y++) for (let x = d.tx; x < d.tx + d.w; x++) underTower.add(`${x},${y}`);
  }
  const wallTiles = new Map<string, { tx: number; ty: number }>();
  const addWall = (tx: number, ty: number) => {
    const key = `${tx},${ty}`;
    if (tiles[ty]?.[tx] === Tile.Wall && !underTower.has(key)) wallTiles.set(key, { tx, ty });
  };
  for (const t of castle?.tiles ?? []) addWall(t.tx, t.ty);
  for (const t of freed) addWall(t.tx, t.ty);
  for (const key of covered) {
    const [tx, ty] = key.split(",").map(Number);
    addWall(tx, ty);
  }
  if (wallTiles.size > 0) {
    // No courtyard outside the town: battlements on every open side.
    result.unshift({
      kind: "castleWall",
      tiles: [...wallTiles.values()],
      inner: castle?.inner ?? { x0: 0, y0: 0, x1: -1, y1: -1 },
      ...(castle?.innerShape ? { innerShape: castle.innerShape } : {}),
    });
  }
  return result;
}

/**
 * The layout grown or shrunk at the right and bottom edges. New tiles get the fill tile; mobs,
 * decor, spawn points and spawn areas that end up outside are dropped.
 */
export function resizeLayout<L extends DungeonLayout & { map: WorldMap }>(base: L, size: MapSize): L {
  const { width, height } = size;
  if (width === base.map.width && height === base.map.height) return base;
  const fill = MAP_PALETTE_BY_TYPE[size.fill]?.tile ?? Tile.Solid;
  const tiles = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => base.map.tiles[y]?.[x] ?? fill));
  const insidePx = (p: { x: number; y: number }) => p.x >= 0 && p.y >= 0 && p.x < width * TILE_SIZE && p.y <= height * TILE_SIZE;
  const insideTile = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < width && ty < height;
  const rotations = Object.fromEntries(
    Object.entries(base.rotations ?? {}).filter(([key]) => {
      const [x, y] = key.split(",").map(Number);
      return insideTile(x, y);
    }),
  );
  let spawn = base.map.spawn;
  if (!insidePx(spawn)) spawn = { x: Math.min(spawn.x, (width - 1) * TILE_SIZE), y: Math.min(spawn.y, height * TILE_SIZE) };
  return {
    ...base,
    map: { ...base.map, width, height, tiles, spawn },
    mobs: base.mobs.filter(insidePx),
    spawns: base.spawns?.filter(insidePx),
    decor: base.decor
      ?.filter((d) => !("tx" in d) || insideTile(d.tx, d.ty))
      .map((d) => (d.kind === "castleWall" || d.kind === "fence" ? { ...d, tiles: d.tiles.filter((t) => insideTile(t.tx, t.ty)) } : d)),
    spawnZones: base.spawnZones?.filter((z) => insideTile(z.tx, z.ty)),
    rotations,
  };
}
