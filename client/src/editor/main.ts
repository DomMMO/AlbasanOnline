import {
  applyMapEdits,
  baseZoneLayout,
  decorFootprint,
  decorRef,
  EDITABLE_DECOR,
  isZoneId,
  MAP_EDIT_LIMITS,
  MAP_LAYERS,
  MAP_PALETTE,
  MAP_PALETTE_BY_TYPE,
  MAP_FILL_TYPES,
  MOBS,
  NPCS,
  resizeLayout,
  spawnableMobs,
  Tile,
  TILE_ART_BY_KEY,
  tileArtSizes,
  CASTLE_MERLON_H,
  CASTLE_TOWER_H,
  CASTLE_WALL_H,
  TILE_ART_SLOTS,
  TILE_COUNT,
  TILE_SIZE,
  ZONES,
  zoneSizeProblem,
  type Decor,
  type MapEdits,
  type MapLayer,
  type MapObject,
  type MapSize,
  type TileArtSlot,
  type ZoneId,
} from "../../../shared/src";
import { decorArt, loadImage, loadTileArt, tileArt, tileArtList, tileArtResolution, tileArtUrl, type TileArtInfo } from "../gfx/tileArt";
import { MapView } from "./view";
import { buildTileset, paintTileStrip, renderTiles, tileBase, tileCell } from "../gfx/tilePainter";
import { getToken } from "../net/api";

// GM map editor (editor.html). Security: this page only hides itself from non-GMs; what really
// protects the maps is the server, which checks the session token and the GM flag on every
// /api/admin/maps request and validates every object it is sent (server/src/http/maps.ts).
//
// The map is drawn the way the game will draw it: the generated map with the edits applied
// (applyMapEdits, the very function the server and the game use), built by the game's own code
// in a Phaser view (view.ts): tiles, the castle standing up, towers, buildings. The editor's
// marks (grid, selection, outlines) go on a transparent canvas over it. The edits are objects in three
// layers (ground, collider, spawn). Objects come from the palette by drag and drop (or by
// "painting" with a picked palette item), snap to the chosen grid, and can be selected,
// moved, rotated and deleted. Save sends the JSON (shared/src/mapEdits.ts) to the server.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("ed-canvas");
const ctx = canvas.getContext("2d")!;
const mainCtx = ctx;
const DRAG_TYPE = "application/x-map-object";

// ---- State -------------------------------------------------------------------------------

let zone: ZoneId = "town";
/** The zone's map as generated in code. */
let generated = baseZoneLayout(zone);
/** Resized map (null: generated size). */
let size: MapSize | null = null;
/** What the edits are laid on: the generated map, resized. */
let base = generated;
let objects: MapObject[] = [];
let artList: TileArtInfo[] = [];
/** The game's tileset (uploaded images included) and its pixels per tile: palette pictures. */
let tileset = buildTileset(tileArt, 1);
let tilesetPx = TILE_SIZE;
/** The map with the edits applied, and its tileset indexes; rebuilt after every change. */
let preview: ReturnType<typeof baseZoneLayout> | null = null;
let rendered: number[][] = [];
let selectedId: string | null = null;
/** Palette item picked for painting (click on a palette item). */
let armed: string | null = null;
/** Snap size in tiles. */
let grid = 1;
let dirty = false;
let nextId = 1;
const visible: Record<MapLayer, boolean> = { ground: true, collider: true, decor: true, spawn: true };
const locked: Record<MapLayer, boolean> = { ground: false, collider: false, decor: false, spawn: false };
/** A piece of the map's own decor picked on the map (to move or remove), by its decorRef. */
let selectedBase: string | null = null;
/** Camera: screen = world * scale + offset (world in pixels). */
const view = { scale: 2, x: 20, y: 20 };
const undoStack: string[] = [];
let hoverCell: { x: number; y: number } | null = null;
/** The mouse on the canvas (for the part of a tile a small blocker goes on). */
let hoverPoint = { x: 0, y: 0 };
/** Ghost while a palette item is dragged over the canvas. */
let dropGhost: { type: string; x: number; y: number } | null = null;
/** Palette item being dragged (dataTransfer is only readable on drop). */
let lastDragged: string | null = null;
/** Size shown while a map edge is being dragged. */
let resizePreview: { width: number; height: number } | null = null;
/** The Phaser view of the map (made once the page is shown). */
let mapView: MapView | null = null;
/** Art slot whose uses are lit up on the map (mouse over its row). */
let highlightKey: string | null = null;
/** Hatch every tile that blocks movement. */
let showBlocking = false;

// ---- API (Bearer token; the server answers 401/403 to anyone else) -------------------------

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken() ?? ""}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!response) throw new Error("Sunucuya bağlanılamadı");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Hata (${response.status})`);
  return data as T;
}

function status(text: string, error = false) {
  const el = $("ed-status");
  el.textContent = text;
  el.title = text;
  el.classList.toggle("bad", error);
}

/** The map as the game will show it (visible layers only). */
function currentPreview() {
  if (!preview) {
    preview = applyMapEdits(base, { version: 1, zone, grid: grid * TILE_SIZE, objects: objects.filter((o) => visible[o.layer]) });
    rendered = renderTiles(preview.map.tiles);
    mapView?.show(preview);
  }
  return preview;
}

function setDirty(value: boolean) {
  preview = null;
  dirty = value;
  $("ed-save").classList.toggle("dirty", dirty);
  if (dirty) status("Kaydedilmemiş değişiklikler var");
}

// ---- Objects -------------------------------------------------------------------------------

function newId() {
  let id: string;
  do id = `o${nextId++}`;
  while (objects.some((o) => o.id === id));
  return id;
}

function rebuildBase() {
  base = size ? resizeLayout(generated, size) : generated;
  preview = null;
}

function snapshot() {
  undoStack.push(JSON.stringify({ objects, size }));
  if (undoStack.length > 100) undoStack.shift();
}

function undo() {
  const previous = undoStack.pop();
  if (!previous) return;
  ({ objects, size } = JSON.parse(previous) as { objects: MapObject[]; size: MapSize | null });
  rebuildBase();
  if (!objects.some((o) => o.id === selectedId)) selectedId = null;
  setDirty(true);
  refresh();
}

const selected = () => objects.find((o) => o.id === selectedId) ?? null;

function clampToMap(o: Pick<MapObject, "x" | "y" | "w" | "h">) {
  o.x = Math.max(0, Math.min(base.map.width - o.w, o.x));
  o.y = Math.max(0, Math.min(base.map.height - o.h, o.y));
}

function topZ(layer: MapLayer) {
  return objects.filter((o) => o.layer === layer).reduce((z, o) => Math.max(z, o.z), 0);
}

const isTileObject = (o: MapObject) => MAP_PALETTE_BY_TYPE[o.type]?.tile !== undefined;
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const within = (inner: Rect, outer: Rect) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
type Rect = Pick<MapObject, "x" | "y" | "w" | "h">;
const LAYER_RANK: Record<MapLayer, number> = { ground: 0, collider: 1, decor: 2, spawn: 3 };

/** A palette item's size in tiles: its decor's footprint, a fixed size, or the grid. */
function paletteSize(type: string): { w: number; h: number } {
  const item = MAP_PALETTE_BY_TYPE[type];
  if (item?.decor) {
    const f = decorFootprint({ ...item.decor, tx: 0, ty: 0 } as Decor)!;
    return { w: f.w, h: f.h };
  }
  const n = item?.fixedSize ?? grid;
  return { w: n, h: n };
}

/** The map's own decor that can be edited, without what the edits took away. */
function baseDecor(): Decor[] {
  const hidden = new Set(objects.filter((o) => o.type === "hide_decor").map((o) => o.ref));
  return (base.decor ?? []).filter((d) => EDITABLE_DECOR.has(d.kind) && !hidden.has(decorRef(d) ?? ""));
}

/** The smallest piece of the map's own decor standing on a cell. */
function baseDecorAt(cellX: number, cellY: number): Decor | null {
  if (!visible.decor || locked.decor) return null;
  let best: Decor | null = null;
  let area = Infinity;
  for (const d of baseDecor()) {
    const f = decorFootprint(d)!;
    if (cellX < f.tx || cellY < f.ty || cellX >= f.tx + f.w || cellY >= f.ty + f.h) continue;
    if (f.w * f.h < area) {
      area = f.w * f.h;
      best = d;
    }
  }
  return best;
}

/** Takes a piece of the map's own decor away (an Engel-free "Kaldırılan süs" object). */
function hideBase(ref: string) {
  objects.push({ id: newId(), type: "hide_decor", layer: "decor", x: 0, y: 0, z: topZ("decor") + 1, w: 1, h: 1, rotation: 0, ref });
}

/** The map's own decor becomes an editor object (hidden where it was, a copy to move about). */
function adoptBase(d: Decor): MapObject {
  hideBase(decorRef(d)!);
  const f = decorFootprint(d)!;
  const copy: MapObject = { id: newId(), type: "decor", layer: "decor", x: f.tx, y: f.ty, z: topZ("decor") + 1, w: f.w, h: f.h, rotation: 0, decor: structuredClone(d) };
  objects.push(copy);
  return copy;
}

/**
 * Puts a palette item at a cell (snapped). A tile replaces the tile objects it fully covers,
 * so the last thing painted is what shows; painting what is already on top does nothing.
 */
function place(type: string, cellX: number, cellY: number, record = true, quarter = 0, toggle = false): MapObject | null {
  const item = MAP_PALETTE_BY_TYPE[type];
  if (!item) return null;
  // A click (not a drag) on one of this tool's own marks (blockers, Süs Kaldır, spawns...)
  // takes it away again.
  if (toggle && item.tile === undefined && !locked[item.layer]) {
    const here = objects.find(
      (o) => o.type === type && cellX >= o.x && cellX < o.x + o.w && cellY >= o.y && cellY < o.y + o.h && (!SPLIT_BLOCKERS.has(type) || o.q === quarter),
    );
    if (here) {
      if (record) snapshot();
      objects = objects.filter((o) => o !== here);
      if (selectedId === here.id) selectedId = null;
      setDirty(true);
      status(`${item.name} kaldırıldı`);
      return null;
    }
  }
  const layerName = MAP_LAYERS.find((l) => l.id === item.layer)!.name;
  if (locked[item.layer]) {
    status(`${layerName} katmanı kilitli; sağdaki 🔒 işaretini kaldır`, true);
    return null;
  }
  if (objects.length >= MAP_EDIT_LIMITS.objects) {
    status(`En fazla ${MAP_EDIT_LIMITS.objects} obje`, true);
    return null;
  }
  // Painting on a hidden layer would show nothing: show it.
  if (!visible[item.layer]) {
    visible[item.layer] = true;
    status(`${layerName} katmanı gizliydi, gösterildi`);
  }
  const { w: n, h: nh } = paletteSize(type);
  // A small blocker goes on the very tile under the mouse, whatever the grid.
  const exact = SPLIT_BLOCKERS.has(type);
  const object: MapObject = { id: "", type, layer: item.layer, x: exact ? cellX : snap(cellX), y: exact ? cellY : snap(cellY), z: 0, w: n, h: nh, rotation: 0 };
  clampToMap(object);
  if (item.decor) object.decor = { ...item.decor, tx: object.x, ty: object.y } as Decor;
  if (item.tile !== undefined) {
    const top = objects
      .filter((o) => isTileObject(o) && overlaps(o, object))
      .sort((a, b) => LAYER_RANK[b.layer] - LAYER_RANK[a.layer] || b.z - a.z)[0];
    if (top && top.type === type && top.x === object.x && top.y === object.y && top.w === object.w && top.h === object.h) return null;
    if (record) snapshot();
    objects = objects.filter((o) => !(isTileObject(o) && within(o, object)));
    // A ground tile under a bigger wall/tree object stays hidden under it.
    const over = objects.find((o) => isTileObject(o) && LAYER_RANK[o.layer] > LAYER_RANK[item.layer] && overlaps(o, object));
    if (over) status(`Bu kare bir ${MAP_PALETTE_BY_TYPE[over.type].name} objesinin altında kalıyor; görünmesi için önce onu seçip sil`, true);
  } else if (type === "unblock") {
    // Blockers painted here go; an Engel Kaldır object is only added if something invisible
    // (from the generated map, or a bigger blocker) still blocks.
    const removed = objects.filter((o) => (o.type === "blocker" || SPLIT_BLOCKERS.has(o.type)) && within(o, object));
    const rest = objects.filter((o) => !removed.includes(o));
    const after = applyMapEdits(base, { version: 1, zone, grid: TILE_SIZE, objects: rest });
    let needed = false;
    for (let y = object.y; y < object.y + object.h; y++) {
      for (let x = object.x; x < object.x + object.w; x++) {
        const mask = after.map.blockMask?.get(y * base.map.width + x);
        if ((after.map.tiles[y][x] === Tile.Solid && mask !== 0) || (mask !== undefined && mask !== 0)) needed = true;
      }
    }
    if (removed.length === 0 && !needed) return null;
    if (record) snapshot();
    objects = rest;
    if (!needed) {
      setDirty(true);
      return null;
    }
  } else if (SPLIT_BLOCKERS.has(type)) {
    if (objects.some((o) => o.type === type && o.x === object.x && o.y === object.y && o.q === quarter)) return null;
    if (record) snapshot();
    object.q = quarter;
  } else {
    if (objects.some((o) => o.type === type && o.x === object.x && o.y === object.y)) return null;
    if (record) snapshot();
  }
  // One player spawn per map: placing a new one moves it.
  if (type === "player_spawn") objects = objects.filter((o) => o.type !== "player_spawn");
  object.id = newId();
  object.z = topZ(item.layer) + 1;
  if (type === "mob_spawn") object.props = { mob: "slime", count: 3, radius: 3 };
  objects.push(object);
  setDirty(true);
  return object;
}

function removeSelected() {
  if (selectedBase) {
    if (locked.decor) return;
    snapshot();
    hideBase(selectedBase);
    selectedBase = null;
    setDirty(true);
    refresh();
    return;
  }
  if (!selectedId) return;
  const o = selected();
  if (!o || locked[o.layer]) return;
  snapshot();
  objects = objects.filter((x) => x.id !== selectedId);
  selectedId = null;
  setDirty(true);
  refresh();
}

function rotateSelected(step: 1 | -1) {
  const o = selected();
  if (!o || locked[o.layer]) return;
  snapshot();
  if (SPLIT_BLOCKERS.has(o.type)) {
    // Clockwise: top, right, bottom, left (halves); top-left, top-right, bottom-right, bottom-left (quarters).
    const ring = o.type === "blocker_half" ? [0, 3, 1, 2] : [0, 1, 3, 2];
    o.q = ring[(ring.indexOf(o.q ?? 0) + step + 4) % 4];
    setDirty(true);
    refresh();
    return;
  }
  o.rotation = (((o.rotation + step * 90) % 360) + 360) % 360 as MapObject["rotation"];
  // A non-square object turns around its corner: swap its sides.
  if (o.w !== o.h) [o.w, o.h] = [o.h, o.w];
  clampToMap(o);
  setDirty(true);
  refresh();
}

function duplicateSelected() {
  const o = selected();
  if (!o || locked[o.layer] || o.type === "player_spawn") return;
  snapshot();
  const copy: MapObject = { ...structuredClone(o), id: newId(), x: o.x + o.w, z: topZ(o.layer) + 1 };
  clampToMap(copy);
  objects.push(copy);
  selectedId = copy.id;
  setDirty(true);
  refresh();
}

function nudgeSelected(dx: number, dy: number) {
  const o = selected();
  if (!o || locked[o.layer]) return;
  snapshot();
  o.x += dx * grid;
  o.y += dy * grid;
  clampToMap(o);
  setDirty(true);
  refresh();
}

function snap(cell: number) {
  return Math.floor(cell / grid) * grid;
}

/** Topmost object under a cell, from visible and unlocked layers (spawns first, then colliders, then ground). */
function objectAt(cellX: number, cellY: number): MapObject | null {
  const order: MapLayer[] = ["spawn", "decor", "collider", "ground"];
  for (const layer of order) {
    if (!visible[layer] || locked[layer]) continue;
    const hits = objects.filter((o) => o.layer === layer && o.type !== "hide_decor" && cellX >= o.x && cellX < o.x + o.w && cellY >= o.y && cellY < o.y + o.h);
    if (hits.length > 0) return hits.sort((a, b) => b.z - a.z)[0];
  }
  return null;
}

// ---- Drawing -------------------------------------------------------------------------------

function resize() {
  const rect = canvas.parentElement!.getBoundingClientRect();
  canvas.width = Math.floor(rect.width);
  canvas.height = Math.floor(rect.height);
  mapView?.resize(canvas.width, canvas.height);
  draw();
}

const toScreen = (wx: number, wy: number) => ({ x: wx * view.scale + view.x, y: wy * view.scale + view.y });
const toCell = (sx: number, sy: number) => ({ x: Math.floor((sx - view.x) / view.scale / TILE_SIZE), y: Math.floor((sy - view.y) / view.scale / TILE_SIZE) });

/** Draws a tileset tile (the game's own pixels, or the uploaded image) at a screen rect. */
function drawTileIndex(index: number, x: number, y: number, size: number, c: CanvasRenderingContext2D = ctx) {
  c.imageSmoothingEnabled = false;
  const { col, row } = tileCell(index);
  c.drawImage(tileset, col * tilesetPx, row * tilesetPx, tilesetPx, tilesetPx, x, y, size, size);
}

/** A red cross: an invisible blocker. */
function drawBlockerMark(x: number, y: number, size: number, c: CanvasRenderingContext2D = ctx, color = "#ff878799") {
  c.strokeStyle = color;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x + 1, y + 1);
  c.lineTo(x + size - 1, y + size - 1);
  c.moveTo(x + size - 1, y + 1);
  c.lineTo(x + 1, y + size - 1);
  c.stroke();
}

/** A tower seen from above: stone deck, battlements all round, a flag in the middle. */
function drawTower(x: number, y: number, w: number, h: number, c: CanvasRenderingContext2D = ctx) {
  const m = Math.max(2, Math.min(w, h) * 0.08);
  c.fillStyle = "#5e584f";
  c.fillRect(x, y, w, h);
  c.fillStyle = "#9a9384";
  c.fillRect(x + 1, y + 1, w - 2, h - 2);
  c.fillStyle = "#847d6f";
  c.fillRect(x + m * 2, y + m * 2, w - m * 4, h - m * 4);
  c.fillStyle = "#c4bdb0";
  const step = Math.max(m * 2.5, 4);
  for (let i = m; i + m <= w - m; i += step) {
    c.fillRect(x + i, y, m, m);
    c.fillRect(x + i, y + h - m, m, m);
  }
  for (let i = m; i + m <= h - m; i += step) {
    c.fillRect(x, y + i, m, m);
    c.fillRect(x + w - m, y + i, m, m);
  }
  c.fillStyle = "#3b2414";
  c.fillRect(x + w / 2 - 1, y + h / 2 - h * 0.25, 2, h * 0.3);
  c.fillStyle = "#9c2a2a";
  c.fillRect(x + w / 2 + 1, y + h / 2 - h * 0.25, w * 0.18, h * 0.12);
}

/** A palette item's little picture. */
function drawSwatch(c: CanvasRenderingContext2D, type: string, size: number) {
  const item = MAP_PALETTE_BY_TYPE[type];
  c.clearRect(0, 0, size, size);
  if (type === "tower") return drawTower(0, 0, size, size, c);
  if (item.tile !== undefined) {
    drawTileIndex(item.tile, 0, 0, size, c);
    if (item.tile === Tile.Solid) drawBlockerMark(0, 0, size, c, "#ff8787");
    return;
  }
  if (SPLIT_BLOCKERS.has(type)) {
    drawTileIndex(Tile.Grass, 0, 0, size, c);
    const r = partRect(type, 3);
    c.fillStyle = "#ff3b3b";
    c.fillRect(r.x * size, r.y * size, r.w * size, r.h * size);
    c.strokeStyle = "#ffffff88";
    c.strokeRect(0.5, 0.5, size - 1, size - 1);
    return;
  }
  if (type === "remove_decor") {
    drawTileIndex(Tile.Grass, 0, 0, size, c);
    drawRemovalArea(0, 0, size, size, c);
    return;
  }
  if (type === "unblock") {
    drawTileIndex(Tile.Grass, 0, 0, size, c);
    drawBlockerMark(0, 0, size, c, "#ff8787");
    c.strokeStyle = "#4cd964";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(size / 2, size / 2, size / 2.6, 0, Math.PI * 2);
    c.moveTo(size * 0.25, size * 0.75);
    c.lineTo(size * 0.75, size * 0.25);
    c.stroke();
    c.lineWidth = 1;
    return;
  }
  c.fillStyle = type === "player_spawn" ? "#ffd43b" : "#ff6b6b";
  c.beginPath();
  c.arc(size / 2, size / 2, size / 3, 0, Math.PI * 2);
  c.fill();
}

const DECOR_NAMES: Partial<Record<Decor["kind"], string>> = {
  building: "Bina",
  fountain: "Çeşme",
  keep: "İç Kale",
  tent: "Çadır",
  gateArch: "Kapı Kemeri",
  drawbridge: "Asma Köprü",
  bridge: "Köprü",
  prop: "Eşya",
  lamp: "Fener",
  anvil: "Örs",
  banner: "Sancak",
  torch: "Meşale",
  grave: "Mezar",
  campfire: "Kamp Ateşi",
  signboard: "Tabela",
  pier: "İskele",
  ship: "Gemi",
  lighthouse: "Deniz Feneri",
  tower: "Kule",
  bigTree: "Ağaç",
  bush: "Çalı",
  plant: "Bitki",
  horse: "At",
  trough: "Yalak",
};

/** Outlines (with names) of the decor standing on the map: painting over one removes it. */
function drawDecorOverlay(decor: Decor[]) {
  const tp = TILE_SIZE * view.scale;
  for (const d of decor) {
    // Trees and bushes are everywhere; outlining them all would hide the map.
    if (d.kind === "bigTree" || d.kind === "bush" || d.kind === "plant") continue;
    const f = decorFootprint(d);
    if (!f) continue;
    const s = toScreen(f.tx * TILE_SIZE, f.ty * TILE_SIZE);
    ctx.strokeStyle = "#ffe08a99";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(s.x + 0.5, s.y + 0.5, f.w * tp - 1, f.h * tp - 1);
    ctx.setLineDash([]);
    const name = DECOR_NAMES[d.kind];
    if (name && f.w * tp >= 40) {
      ctx.font = `${Math.min(13, Math.max(10, tp * 0.45))}px serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#000a";
      ctx.fillText(name, s.x + (f.w * tp) / 2 + 1, s.y + f.h * tp - 4 + 1);
      ctx.fillStyle = "#ffe08a";
      ctx.fillText(name, s.x + (f.w * tp) / 2, s.y + f.h * tp - 4);
    }
  }
}

const BLOCKING = new Set<Tile>([Tile.Water, Tile.Tree, Tile.CaveWall, Tile.Wall, Tile.Solid]);

/** Hatches the tiles that block movement (what the server collides with). */
function drawBlocking(shown: ReturnType<typeof baseZoneLayout>, first: { x: number; y: number }, last: { x: number; y: number }) {
  const tp = TILE_SIZE * view.scale;
  ctx.strokeStyle = "#ff6b6bb0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = Math.max(0, first.y); y <= Math.min(base.map.height - 1, last.y); y++) {
    for (let x = Math.max(0, first.x); x <= Math.min(base.map.width - 1, last.x); x++) {
      const s = toScreen(x * TILE_SIZE, y * TILE_SIZE);
      const mask = shown.map.blockMask?.get(y * base.map.width + x);
      if (mask !== undefined && mask !== 15) {
        // Split tile: its blocked quarters filled; a blocker taken away shows green.
        for (let q = 0; q < 4; q++) {
          if (!(mask & (1 << q))) continue;
          ctx.fillStyle = "#ff6b6b70";
          ctx.fillRect(s.x + (q & 1) * (tp / 2), s.y + (q >> 1) * (tp / 2), tp / 2, tp / 2);
        }
        if (mask === 0 && shown.map.tiles[y][x] === Tile.Solid) {
          ctx.fillStyle = "#4cd96430";
          ctx.fillRect(s.x, s.y, tp, tp);
        }
        continue;
      }
      if (!BLOCKING.has(shown.map.tiles[y][x])) continue;
      ctx.moveTo(s.x, s.y + tp);
      ctx.lineTo(s.x + tp, s.y);
      ctx.moveTo(s.x, s.y + tp / 2);
      ctx.lineTo(s.x + tp / 2, s.y);
      ctx.moveTo(s.x + tp / 2, s.y + tp);
      ctx.lineTo(s.x + tp, s.y + tp / 2);
    }
  }
  ctx.stroke();
}

/**
 * Where the hovered art slot shows on the map, in world pixels: the tiles that use it, or for
 * castle pieces the area each piece is drawn on (lifted, as the game draws it).
 */
function artUses(key: string, shown: ReturnType<typeof baseZoneLayout>): { x: number; y: number; w: number; h: number }[] {
  const slot = TILE_ART_BY_KEY[key];
  const decor = shown.decor ?? [];
  const castle = decor.find((d): d is Extract<Decor, { kind: "castleWall" }> => d.kind === "castleWall");
  const towers = decor.filter((d): d is Extract<Decor, { kind: "tower" }> => d.kind === "tower");
  const hidden = new Set(castle?.tiles.map((t) => `${t.tx},${t.ty}`));
  for (const t of towers) for (let y = t.ty; y < t.ty + t.h; y++) for (let x = t.tx; x < t.tx + t.w; x++) hidden.add(`${x},${y}`);
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  if (slot.index !== undefined) {
    for (let y = 0; y < base.map.height; y++) {
      for (let x = 0; x < base.map.width; x++) {
        if (tileBase(rendered[y][x]) === slot.index && !hidden.has(`${x},${y}`)) rects.push({ x: x * TILE_SIZE, y: y * TILE_SIZE, w: TILE_SIZE, h: TILE_SIZE });
      }
    }
  } else if (key === "castle_top" || key === "castle_face") {
    const keys = new Set(castle?.tiles.map((t) => `${t.tx},${t.ty}`));
    for (const t of castle?.tiles ?? []) {
      const bottom = (t.ty + 1) * TILE_SIZE;
      if (key === "castle_top") rects.push({ x: t.tx * TILE_SIZE, y: bottom - TILE_SIZE - CASTLE_WALL_H, w: TILE_SIZE, h: TILE_SIZE });
      else if (!keys.has(`${t.tx},${t.ty + 1}`)) rects.push({ x: t.tx * TILE_SIZE, y: bottom - CASTLE_WALL_H, w: TILE_SIZE, h: CASTLE_WALL_H });
    }
  } else if (key === "tower") {
    for (const t of towers) {
      const bottom = (t.ty + t.h) * TILE_SIZE;
      const h = CASTLE_MERLON_H + t.h * TILE_SIZE + CASTLE_TOWER_H;
      rects.push({ x: t.tx * TILE_SIZE, y: bottom - h, w: t.w * TILE_SIZE, h });
    }
  }
  return rects;
}

function drawArtHighlight(shown: ReturnType<typeof baseZoneLayout>) {
  if (!highlightKey) return;
  const rects = artUses(highlightKey, shown);
  ctx.fillStyle = "#ffd43b55";
  ctx.strokeStyle = "#ffd43b";
  ctx.lineWidth = 1;
  for (const r of rects) {
    const s = toScreen(r.x, r.y);
    ctx.fillRect(s.x, s.y, r.w * view.scale, r.h * view.scale);
    ctx.strokeRect(s.x + 0.5, s.y + 0.5, r.w * view.scale - 1, r.h * view.scale - 1);
  }
  const slot = TILE_ART_BY_KEY[highlightKey];
  ctx.font = "14px serif";
  ctx.textAlign = "left";
  const text = rects.length > 0 ? `${slot.name}: haritada ${rects.length} yerde` : `${slot.name}: bu haritada kullanılmıyor`;
  ctx.fillStyle = "#000c";
  ctx.fillRect(8, 34, ctx.measureText(text).width + 16, 22);
  ctx.fillStyle = "#ffd43b";
  ctx.fillText(text, 16, 50);
}

function drawObject(o: MapObject, ghost = false) {
  const item = MAP_PALETTE_BY_TYPE[o.type];
  const tilePx = TILE_SIZE * view.scale;
  const { x, y } = toScreen(o.x * TILE_SIZE, o.y * TILE_SIZE);
  ctx.globalAlpha = ghost ? 0.55 : 1;
  if (o.layer === "decor") {
    // Decor is drawn by the map view; the ghost shows where it would stand.
    if (ghost && item) {
      ctx.fillStyle = "#74c0fc33";
      ctx.fillRect(x, y, o.w * tilePx, o.h * tilePx);
      ctx.strokeStyle = "#74c0fc";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, o.w * tilePx - 1, o.h * tilePx - 1);
      ctx.fillStyle = "#fff";
      ctx.font = "12px serif";
      ctx.textAlign = "left";
      ctx.fillText(item.name, x + 2, y - 3);
    }
  } else if (o.type === "blocker" || SPLIT_BLOCKERS.has(o.type) || o.type === "unblock") {
    // Invisible in the game: always marked here.
    drawBlockerObject(o, x, y, tilePx);
  } else if (o.type === "remove_decor") {
    drawRemovalArea(x, y, o.w * tilePx, o.h * tilePx);
  } else if (item.tile !== undefined) {
    // Placed tiles are already in the preview; only the ghost under the mouse paints itself.
    if (ghost && o.type === "tower") drawTower(x, y, o.w * tilePx, o.h * tilePx);
    else if (ghost) for (let ty = 0; ty < o.h; ty++) for (let tx = 0; tx < o.w; tx++) drawTileIndex(item.tile, x + tx * tilePx, y + ty * tilePx, tilePx);
    // Rotation marker: a small arrow pointing where "up" now faces.
    if (!ghost && o.rotation && tilePx >= 10) {
      const cx = x + (o.w * tilePx) / 2;
      const cy = y + (o.h * tilePx) / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((o.rotation * Math.PI) / 180);
      ctx.fillStyle = "#ffd43bcc";
      ctx.beginPath();
      ctx.moveTo(0, -tilePx * 0.3);
      ctx.lineTo(tilePx * 0.15, 0);
      ctx.lineTo(-tilePx * 0.15, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else if (o.type === "player_spawn") {
    star(x + tilePx / 2, y + tilePx / 2, tilePx * 0.45, "#ffd43b");
  } else if (o.type === "mob_spawn" && o.props) {
    const cx = x + tilePx / 2;
    const cy = y + tilePx / 2;
    ctx.strokeStyle = "#ff6b6b";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, o.props.radius * tilePx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ff6b6b";
    ctx.beginPath();
    ctx.arc(cx, cy, tilePx * 0.35, 0, Math.PI * 2);
    ctx.fill();
    if (view.scale >= 1.5) {
      ctx.fillStyle = "#fff";
      ctx.font = `${Math.max(10, tilePx * 0.5)}px serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${MOBS[o.props.mob]?.name ?? o.props.mob} ×${o.props.count}`, cx, cy - tilePx * 0.6);
    }
  }
  ctx.globalAlpha = 1;
}

/** A "Süs Kaldır" area: the decor it touches is gone from the map. */
function drawRemovalArea(x: number, y: number, w: number, h: number, c: CanvasRenderingContext2D = ctx) {
  c.fillStyle = "#ff922b33";
  c.fillRect(x, y, w, h);
  c.strokeStyle = "#ff922b";
  c.lineWidth = 2;
  c.setLineDash([4, 3]);
  c.strokeRect(x + 1, y + 1, w - 2, h - 2);
  c.setLineDash([]);
  c.beginPath();
  c.moveTo(x + w * 0.3, y + h * 0.3);
  c.lineTo(x + w * 0.7, y + h * 0.7);
  c.moveTo(x + w * 0.7, y + h * 0.3);
  c.lineTo(x + w * 0.3, y + h * 0.7);
  c.stroke();
  c.lineWidth = 1;
}

/** Small blockers: the part of the tile `q` stands for. */
const SPLIT_BLOCKERS = new Set(["blocker_half", "blocker_quarter"]);
const PART_NAMES: Record<string, string[]> = {
  blocker_half: ["Üst yarı", "Alt yarı", "Sol yarı", "Sağ yarı"],
  blocker_quarter: ["Sol üst", "Sağ üst", "Sol alt", "Sağ alt"],
};

/** The part of a tile (fractions of it) a small blocker covers. */
function partRect(type: string, q: number) {
  if (type === "blocker_half") return [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }, { x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }][q];
  return { x: (q & 1) * 0.5, y: (q >> 1) * 0.5, w: 0.5, h: 0.5 };
}

/** The mark of an invisible blocker, a small (half or quarter) one, or an Engel Kaldır area. */
function drawBlockerObject(o: MapObject, x: number, y: number, tp: number) {
  const w = o.w * tp;
  const h = o.h * tp;
  if (SPLIT_BLOCKERS.has(o.type)) {
    const r = partRect(o.type, o.q ?? 0);
    const px = x + r.x * tp;
    const py = y + r.y * tp;
    ctx.fillStyle = "#ff3b3b99";
    ctx.fillRect(px, py, r.w * tp, r.h * tp);
    ctx.strokeStyle = "#ff8787";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, r.w * tp - 1, r.h * tp - 1);
  } else if (o.type === "blocker") {
    ctx.fillStyle = "#ff3b3b40";
    ctx.fillRect(x, y, w, h);
    drawBlockerMark(x, y, Math.min(w, h), ctx, "#ff8787");
  } else {
    ctx.fillStyle = "#4cd96433";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#4cd964";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.setLineDash([]);
  }
}

function star(cx: number, cy: number, r: number, color: string) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#1a1009";
  ctx.stroke();
}

function draw() {
  const tilePx = TILE_SIZE * view.scale;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  // The map itself is the Phaser view underneath (built from the preview, the game's way).
  const shown = currentPreview();
  mapView?.setCamera(view.scale, view.x, view.y);
  const first = toCell(0, 0);
  const last = toCell(canvas.width, canvas.height);
  drawDecorOverlay(shown.decor ?? []);
  if (showBlocking && tilePx >= 4) drawBlocking(shown, first, last);
  drawArtHighlight(shown);

  // Edit markers (spawns, rotations), layer by layer.
  for (const layer of ["ground", "collider", "spawn"] as MapLayer[]) {
    if (!visible[layer]) continue;
    for (const o of objects.filter((x) => x.layer === layer).sort((a, b) => a.z - b.z)) drawObject(o);
  }

  // Grid: faint per tile, stronger per snap cell.
  if (tilePx >= 6) {
    ctx.lineWidth = 1;
    for (let x = Math.max(0, first.x); x <= Math.min(base.map.width, last.x + 1); x++) {
      const s = toScreen(x * TILE_SIZE, 0);
      ctx.strokeStyle = x % grid === 0 ? "#ffffff2e" : "#ffffff10";
      ctx.beginPath();
      ctx.moveTo(Math.round(s.x) + 0.5, toScreen(0, 0).y);
      ctx.lineTo(Math.round(s.x) + 0.5, toScreen(0, base.map.height * TILE_SIZE).y);
      ctx.stroke();
    }
    for (let y = Math.max(0, first.y); y <= Math.min(base.map.height, last.y + 1); y++) {
      const s = toScreen(0, y * TILE_SIZE);
      ctx.strokeStyle = y % grid === 0 ? "#ffffff2e" : "#ffffff10";
      ctx.beginPath();
      ctx.moveTo(toScreen(0, 0).x, Math.round(s.y) + 0.5);
      ctx.lineTo(toScreen(base.map.width * TILE_SIZE, 0).x, Math.round(s.y) + 0.5);
      ctx.stroke();
    }
  }

  // Reference marks (not editable): the generated spawn point, NPCs, portals, built-in mob areas.
  const spawnScreen = toScreen(base.map.spawn.x, base.map.spawn.y);
  ctx.strokeStyle = "#ffd43b88";
  ctx.strokeRect(spawnScreen.x - 4, spawnScreen.y - 4, 8, 8);
  for (const npcId of ZONES[zone].npcs) {
    const npc = NPCS[npcId];
    if (!npc) continue;
    const s = toScreen(npc.x, npc.y);
    ctx.fillStyle = "#74c0fc";
    ctx.beginPath();
    ctx.arc(s.x, s.y - 4, Math.max(3, view.scale * 3), 0, Math.PI * 2);
    ctx.fill();
  }
  for (const portal of ZONES[zone].portals) {
    const s = toScreen(portal.x, portal.y);
    ctx.fillStyle = "#c084fc";
    ctx.fillRect(s.x - 4, s.y - 8, 8, 8);
  }
  for (const area of base.spawnZones ?? []) {
    const s = toScreen((area.tx + 0.5) * TILE_SIZE, (area.ty + 0.5) * TILE_SIZE);
    ctx.strokeStyle = "#ff6b6b33";
    ctx.beginPath();
    ctx.arc(s.x, s.y, area.radius * tilePx, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Drop ghost, paint hover, selection.
  if (dropGhost) {
    const size = paletteSize(dropGhost.type).w;
    const exact = SPLIT_BLOCKERS.has(dropGhost.type);
    const x = exact ? dropGhost.x : snap(dropGhost.x);
    const y = exact ? dropGhost.y : snap(dropGhost.y);
    drawObject({ id: "", type: dropGhost.type, layer: MAP_PALETTE_BY_TYPE[dropGhost.type].layer, x, y, z: 0, w: size, h: size, rotation: 0, q: partAt(dropGhost.type, hoverPoint) }, true);
  } else if (armed && hoverCell) {
    const { w: size, h: sizeH } = paletteSize(armed);
    const x = SPLIT_BLOCKERS.has(armed) ? hoverCell.x : snap(hoverCell.x);
    const y = SPLIT_BLOCKERS.has(armed) ? hoverCell.y : snap(hoverCell.y);
    drawObject({ id: "", type: armed, layer: MAP_PALETTE_BY_TYPE[armed].layer, x, y, z: 0, w: size, h: sizeH, rotation: 0, q: partAt(armed, hoverPoint) }, true);
  }
  if (selectedBase) {
    const d = baseDecor().find((b) => decorRef(b) === selectedBase);
    const f = d && decorFootprint(d);
    if (f) {
      const s = toScreen(f.tx * TILE_SIZE, f.ty * TILE_SIZE);
      ctx.strokeStyle = "#74c0fc";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(s.x + 1, s.y + 1, f.w * tilePx - 2, f.h * tilePx - 2);
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
    }
  }
  const sel = selected();
  if (sel) {
    const s = toScreen(sel.x * TILE_SIZE, sel.y * TILE_SIZE);
    ctx.strokeStyle = "#ffd43b";
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x + 1, s.y + 1, sel.w * tilePx - 2, sel.h * tilePx - 2);
    ctx.lineWidth = 1;
  }

  // Map edge: drag the right or bottom edge (or the corner) to resize.
  const edge = resizePreview ?? { width: base.map.width, height: base.map.height };
  const corner = toScreen(edge.width * TILE_SIZE, edge.height * TILE_SIZE);
  const origin = toScreen(0, 0);
  ctx.strokeStyle = resizePreview ? "#ffd43b" : "#e0b04f88";
  ctx.lineWidth = 2;
  ctx.setLineDash(resizePreview ? [6, 4] : []);
  ctx.strokeRect(origin.x, origin.y, corner.x - origin.x, corner.y - origin.y);
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  ctx.fillStyle = "#e0b04f";
  ctx.fillRect(corner.x - 5, corner.y - 5, 10, 10);
  if (resizePreview) {
    ctx.fillStyle = "#fff";
    ctx.font = "14px serif";
    ctx.textAlign = "left";
    ctx.fillText(`${edge.width} × ${edge.height}`, corner.x + 10, corner.y + 4);
  }
}

// ---- Side panels -------------------------------------------------------------------------------

function renderPalette() {
  const container = $("ed-palette");
  container.replaceChildren(
    ...MAP_LAYERS.flatMap(({ id, name }) => {
      const title = Object.assign(document.createElement("h3"), { textContent: name });
      const items = MAP_PALETTE.filter((p) => p.layer === id && !p.hidden).map((item) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = `ed-item${armed === item.type ? " armed" : ""}`;
        el.dataset.type = item.type;
        el.draggable = true;
        const swatch = document.createElement("canvas");
        swatch.width = swatch.height = 24;
        if (item.decor) {
          const sctx = swatch.getContext("2d")!;
          sctx.fillStyle = "#3a5a2a";
          sctx.fillRect(0, 0, 24, 24);
          void mapView?.decorImage({ ...item.decor, tx: 0, ty: 0 } as Decor).then((image) => {
            if (!image) return decorIcon(sctx, item.decor!.kind);
            const w = (image as HTMLCanvasElement).width;
            const h = (image as HTMLCanvasElement).height;
            const k = Math.min(24 / w, 24 / h);
            sctx.imageSmoothingEnabled = false;
            sctx.drawImage(image, (24 - w * k) / 2, 24 - h * k, w * k, h * k);
          });
          if (!mapView) decorIcon(sctx, item.decor.kind);
        } else drawSwatch(swatch.getContext("2d")!, item.type, 24);
        el.append(swatch, Object.assign(document.createElement("span"), { textContent: item.name }));
        el.addEventListener("dragstart", (event) => {
          event.dataTransfer!.setData(DRAG_TYPE, item.type);
          event.dataTransfer!.effectAllowed = "copy";
          lastDragged = item.type;
        });
        el.addEventListener("click", () => {
          armed = armed === item.type ? null : item.type;
          renderPalette();
          draw();
        });
        if (locked[item.layer]) el.disabled = true;
        return el;
      });
      return [title, ...items];
    }),
  );
}

/** A little picture for decor drawn without a sprite (lamps, torches, banners...). */
function decorIcon(c: CanvasRenderingContext2D, kind: Decor["kind"]) {
  c.fillStyle = "#3a5a2a";
  c.fillRect(0, 0, 24, 24);
  if (kind === "lamp") {
    c.fillStyle = "#2a2a30";
    c.fillRect(11, 6, 2, 16);
    c.fillStyle = "#ffd97a";
    c.fillRect(9, 3, 6, 5);
  } else if (kind === "torch") {
    c.fillStyle = "#4a2e16";
    c.fillRect(11, 10, 2, 12);
    c.fillStyle = "#ff8c1a";
    c.fillRect(9, 4, 6, 6);
    c.fillStyle = "#ffd43b";
    c.fillRect(10, 5, 4, 3);
  } else if (kind === "banner") {
    c.fillStyle = "#4a2e16";
    c.fillRect(11, 2, 2, 20);
    c.fillStyle = "#9c2a2a";
    c.fillRect(13, 4, 8, 10);
  } else if (kind === "anvil") {
    c.fillStyle = "#3d4048";
    c.fillRect(5, 10, 14, 4);
    c.fillRect(9, 14, 6, 6);
  } else if (kind === "campfire") {
    c.fillStyle = "#6b4423";
    c.fillRect(5, 17, 14, 3);
    c.fillStyle = "#ff8c1a";
    c.fillRect(8, 8, 8, 9);
    c.fillStyle = "#ffd43b";
    c.fillRect(10, 11, 4, 5);
  } else {
    c.fillStyle = "#c4a46a";
    c.fillRect(6, 8, 12, 12);
  }
}

function renderLayers() {
  $("ed-layers").replaceChildren(
    ...MAP_LAYERS.map(({ id, name }) => {
      const row = document.createElement("div");
      row.className = "ed-layer";
      const count = objects.filter((o) => o.layer === id).length;
      row.innerHTML = `<span class="ed-layer-name"></span><label title="Göster"><input type="checkbox" class="vis" /> 👁</label><label title="Kilitle (seçilemez, değiştirilemez)"><input type="checkbox" class="lock" /> 🔒</label>`;
      row.querySelector(".ed-layer-name")!.textContent = `${name} (${count})`;
      const vis = row.querySelector<HTMLInputElement>(".vis")!;
      const lock = row.querySelector<HTMLInputElement>(".lock")!;
      vis.checked = visible[id];
      lock.checked = locked[id];
      vis.addEventListener("change", () => {
        visible[id] = vis.checked;
        preview = null;
        draw();
      });
      lock.addEventListener("change", () => {
        locked[id] = lock.checked;
        if (selected()?.layer === id) selectedId = null;
        refresh();
      });
      return row;
    }),
  );
}

function field(label: string, input: HTMLElement) {
  const row = document.createElement("label");
  row.className = "ed-field";
  row.append(Object.assign(document.createElement("span"), { textContent: label }), input);
  return row;
}

function numberInput(value: number, min: number, max: number, onChange: (v: number) => void) {
  const input = Object.assign(document.createElement("input"), { type: "number", value: String(value), min: String(min), max: String(max) });
  input.addEventListener("change", () => {
    const v = Math.max(min, Math.min(max, Math.floor(Number(input.value)) || min));
    snapshot();
    onChange(v);
    setDirty(true);
    refresh();
  });
  return input;
}

function renderInspector() {
  const box = $("ed-inspector");
  const o = selected();
  if (!o && selectedBase) {
    const d = baseDecor().find((b) => decorRef(b) === selectedBase);
    const title = Object.assign(document.createElement("div"), { className: "ed-insp-title", textContent: `${(d && DECOR_NAMES[d.kind]) ?? "Süs"} · haritanın kendi süsü` });
    const note = Object.assign(document.createElement("p"), { className: "muted small", textContent: "Sürükleyerek taşı (eski yeri boşalır), Delete ile kaldır. Geri almak için Ctrl+Z." });
    const remove = Object.assign(document.createElement("button"), { type: "button", textContent: "Kaldır", className: "danger" });
    remove.addEventListener("click", removeSelected);
    const buttons = Object.assign(document.createElement("div"), { className: "ed-insp-buttons" });
    buttons.append(remove);
    box.replaceChildren(title, note, buttons);
    return;
  }
  if (!o) {
    box.innerHTML = `<p class="muted">Bir obje seç.</p>`;
    return;
  }
  const item = MAP_PALETTE_BY_TYPE[o.type];
  const name = o.decor && o.type === "decor" ? (DECOR_NAMES[o.decor.kind] ?? item.name) : item.name;
  const title = Object.assign(document.createElement("div"), { className: "ed-insp-title", textContent: `${name} · ${MAP_LAYERS.find((l) => l.id === o.layer)!.name}` });
  const nodes: HTMLElement[] = [
    title,
    field("X", numberInput(o.x, 0, base.map.width - o.w, (v) => (o.x = v))),
    field("Y", numberInput(o.y, 0, base.map.height - o.h, (v) => (o.y = v))),
  ];
  if (o.decor) nodes.push(...decorFields(o));
  if (SPLIT_BLOCKERS.has(o.type)) {
    const quarter = document.createElement("select");
    PART_NAMES[o.type].forEach((name, q) => quarter.append(new Option(name, String(q), false, q === (o.q ?? 0))));
    quarter.addEventListener("change", () => {
      snapshot();
      o.q = Number(quarter.value);
      setDirty(true);
      refresh();
    });
    nodes.push(field(o.type === "blocker_half" ? "Yarı" : "Çeyrek", quarter));
  }
  if ((item.tile !== undefined || o.type === "unblock" || o.type === "remove_decor") && !item.fixedSize) {
    nodes.push(
      field("Genişlik", numberInput(o.w, 1, MAP_EDIT_LIMITS.size, (v) => ((o.w = v), clampToMap(o)))),
      field("Yükseklik", numberInput(o.h, 1, MAP_EDIT_LIMITS.size, (v) => ((o.h = v), clampToMap(o)))),
    );
  }
  nodes.push(field("Z (sıra)", numberInput(o.z, 0, 100_000, (v) => (o.z = v))));
  if (o.type === "mob_spawn" && o.props) {
    const props = o.props;
    const mob = document.createElement("select");
    for (const id of spawnableMobs()) mob.append(new Option(`${MOBS[id].name} (Sv ${MOBS[id].level})`, id, false, id === props.mob));
    mob.addEventListener("change", () => {
      snapshot();
      props.mob = mob.value;
      setDirty(true);
      refresh();
    });
    nodes.push(
      field("Yaratık", mob),
      field("Adet", numberInput(props.count, 1, MAP_EDIT_LIMITS.mobCount, (v) => (props.count = v))),
      field("Yarıçap (kare)", numberInput(props.radius, 1, MAP_EDIT_LIMITS.mobRadius, (v) => (props.radius = v))),
    );
  }
  const buttons = document.createElement("div");
  buttons.className = "ed-insp-buttons";
  const button = (text: string, fn: () => void, cls = "secondary") => {
    const b = Object.assign(document.createElement("button"), { type: "button", textContent: text, className: cls });
    b.addEventListener("click", fn);
    buttons.append(b);
  };
  button(`⟲ Döndür (${o.rotation}°)`, () => rotateSelected(-1));
  button("⟳", () => rotateSelected(1));
  button("Kopyala", duplicateSelected);
  button("Sil", removeSelected, "danger");
  nodes.push(buttons);
  box.replaceChildren(...nodes);
}

const ROOF_COLOURS: [string, number][] = [
  ["Kiremit kırmızısı", 0x9c3b2e],
  ["Toprak kahvesi", 0x8a5a3a],
  ["Arduvaz mavisi", 0x3a5a7a],
  ["Koyu mavi", 0x3b5f8a],
  ["Yosun yeşili", 0x4f6b4a],
  ["Mor", 0x6a4c93],
  ["Pembe", 0x9c3b5a],
  ["Saman sarısı", 0x8c6d1f],
  ["Kül grisi", 0x5a5a62],
];

/** Settings of an editor-placed piece of decor (roof, ridge, chimney, size; kind of plant...). */
function decorFields(o: MapObject): HTMLElement[] {
  const d = o.decor!;
  const change = (fn: () => void) => {
    snapshot();
    fn();
    const f = decorFootprint({ ...d, tx: o.x, ty: o.y } as Decor)!;
    o.w = f.w;
    o.h = f.h;
    clampToMap(o);
    setDirty(true);
    refresh();
  };
  const select = (options: [string, string][], value: string, onChange: (v: string) => void) => {
    const el = document.createElement("select");
    for (const [label, v] of options) el.append(new Option(label, v, false, v === value));
    el.addEventListener("change", () => change(() => onChange(el.value)));
    return el;
  };
  const nodes: HTMLElement[] = [];
  if (d.kind === "building") {
    const roofs = ROOF_COLOURS.some(([, c]) => c === d.roof) ? ROOF_COLOURS : [...ROOF_COLOURS, ["Özel", d.roof] as [string, number]];
    nodes.push(
      field("Çatı", select(roofs.map(([n, c]) => [n, String(c)]), String(d.roof), (v) => (d.roof = Number(v)))),
      field("Mahya", select([["Kendiliğinden", ""], ["Yatay", "h"], ["Önden arkaya", "v"]], d.ridge ?? "", (v) => (d.ridge = v === "h" || v === "v" ? v : undefined))),
      field("Baca", select([["Var", "1"], ["Yok", "0"]], d.chimney ? "1" : "0", (v) => (d.chimney = v === "1"))),
      field("Genişlik", numberInput(d.w, 2, 12, (v) => (d.w = v))),
      field("Derinlik", numberInput(d.h, 2, 10, (v) => (d.h = v))),
    );
  } else if (d.kind === "plant" || d.kind === "bush" || d.kind === "bigTree") {
    nodes.push(field("Çeşit", numberInput(d.variant, 0, 63, (v) => (d.variant = v))));
  } else if (d.kind === "banner") {
    const colours: [string, string][] = [["Kırmızı", "10234410"], ["Altın", "14723135"], ["Mavi", "3889371"], ["Yeşil", "2858564"]];
    nodes.push(field("Renk", select(colours, String(d.color), (v) => (d.color = Number(v)))));
  } else if (d.kind === "prop") {
    const props: [string, string][] = [["Fıçı", "barrel"], ["Sandık", "crate"], ["Çuval", "sack"], ["Saman", "hay"], ["Kuyu", "well"], ["Kukla", "dummy"], ["Araba", "cart"]];
    nodes.push(field("Eşya", select(props, d.prop, (v) => (d.prop = v as typeof d.prop))));
  }
  return nodes;
}

function renderInfo() {
  const counts = MAP_LAYERS.map(({ id, name }) => `${name}: ${objects.filter((o) => o.layer === id).length}`).join(" · ");
  $("ed-info").innerHTML = "";
  $("ed-info").append(
    Object.assign(document.createElement("div"), { textContent: `${ZONES[zone].name} · ${base.map.width} × ${base.map.height} kare` }),
    Object.assign(document.createElement("div"), { textContent: `${objects.length} obje (${counts})` }),
    Object.assign(document.createElement("div"), {
      textContent:
        "Mavi nokta: NPC · mor kare: portal · sarı kare: kodda tanımlı doğuş · soluk kırmızı halka: kodda tanımlı yaratık alanı · kesikli çerçeve: bina/süs (boyamak silmez; Süs Kaldır (K) ile kalkar) · kırmızı çarpı: görünmez engel",
    }),
    Object.assign(document.createElement("div"), {
      textContent: "Kale Duvarı kareleri birleşir; köşe ve mazgallar komşularına göre kendiliğinden oluşur, köşelere Kule koyabilirsin.",
    }),
    Object.assign(document.createElement("div"), { textContent: "Kaydedince oyunda hemen güncellenir (yaratık alanları bölge yeniden açılınca)." }),
  );
}

function refresh() {
  renderSize();
  renderLayers();
  renderInspector();
  renderInfo();
  draw();
}

// ---- Map size ------------------------------------------------------------------------------

/** New area's default fill: whatever the generated map has in its bottom-right corner (its border). */
function defaultFill() {
  const corner = generated.map.tiles[generated.map.height - 1][generated.map.width - 1];
  return MAP_PALETTE.find((p) => p.tile === corner)?.type ?? "grass";
}

/** Resizes at the right and bottom edges; objects left outside are removed (after asking). */
function applySize(width: number, height: number, fill: string) {
  if (width === base.map.width && height === base.map.height && fill === (size?.fill ?? fill)) return draw();
  const problem = zoneSizeProblem(zone, width, height);
  if (problem) {
    status(`Bu kadar küçülemez: ${problem}`, true);
    return draw();
  }
  const outside = objects.filter((o) => o.x + o.w > width || o.y + o.h > height);
  if (outside.length > 0 && !confirm(`${outside.length} obje haritanın dışında kalacak ve silinecek. Devam edilsin mi?`)) return draw();
  snapshot();
  objects = objects.filter((o) => !outside.includes(o));
  if (!objects.some((o) => o.id === selectedId)) selectedId = null;
  const same = width === generated.map.width && height === generated.map.height;
  size = same ? null : { width, height, fill };
  rebuildBase();
  setDirty(true);
  refresh();
  status(`Harita ${width} × ${height} kare oldu`);
}

function renderSize() {
  const box = $("ed-size");
  const width = sizeInput(base.map.width);
  const height = sizeInput(base.map.height);
  const fill = document.createElement("select");
  for (const type of MAP_FILL_TYPES) fill.append(new Option(MAP_PALETTE_BY_TYPE[type].name, type, false, type === (size?.fill ?? defaultFill())));
  const apply = Object.assign(document.createElement("button"), { type: "button", textContent: "Uygula", className: "secondary" });
  apply.addEventListener("click", () => applySize(Number(width.value), Number(height.value), fill.value));
  const back = Object.assign(document.createElement("button"), { type: "button", textContent: "Koddaki boyut", className: "secondary" });
  back.addEventListener("click", () => applySize(generated.map.width, generated.map.height, fill.value));
  const buttons = Object.assign(document.createElement("div"), { className: "ed-insp-buttons" });
  buttons.append(apply, back);
  const note = Object.assign(document.createElement("p"), {
    className: "muted small",
    textContent: `Koddaki boyut ${generated.map.width} × ${generated.map.height}. Sağ ve alt kenardan büyür/küçülür (haritanın kenarını sürükleyerek de olur); yeni alan seçilen dolguyla dolar.`,
  });
  box.replaceChildren(field("Genişlik", width), field("Yükseklik", height), field("Yeni alan", fill), buttons, note);
}

function sizeInput(value: number) {
  const { mapMin, mapMax } = MAP_EDIT_LIMITS;
  return Object.assign(document.createElement("input"), { type: "number", value: String(value), min: String(mapMin), max: String(mapMax) });
}

// ---- Eyedropper (Q): pick the tile or object under the mouse in the palette ---------------

function pickUnderCursor() {
  if (!hoverCell) return;
  const { x, y } = hoverCell;
  let type: string | undefined;
  for (const layer of ["spawn", "collider", "ground"] as MapLayer[]) {
    if (!visible[layer]) continue;
    const hits = objects.filter((o) => o.layer === layer && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h);
    if (hits.length > 0) {
      type = hits.sort((a, b) => b.z - a.z)[0].type;
      break;
    }
  }
  if (!type) {
    const tile = base.map.tiles[y]?.[x];
    type = MAP_PALETTE.find((p) => p.tile === tile)?.type;
  }
  if (!type) return status("Burada seçilebilecek bir kare yok", true);
  armed = type;
  selectedId = null;
  renderPalette();
  document.querySelector(`.ed-item[data-type="${type}"]`)?.scrollIntoView({ block: "nearest" });
  status(`Seçildi: ${MAP_PALETTE_BY_TYPE[type].name} (boyamak için tıkla, Esc: bırak)`);
  refresh();
}

// ---- Tile art: GM uploaded PNGs in place of the code-drawn tiles ---------------------------

async function loadArt() {
  await loadTileArt();
  artList = tileArtList;
  const res = tileArtResolution();
  tileset = buildTileset(tileArt, res);
  tilesetPx = TILE_SIZE * res;
  mapView?.artChanged(currentPreview());
  renderArt();
  renderPalette();
  draw();
}

async function uploadArt(key: string, file: File) {
  const name = TILE_ART_BY_KEY[key].name;
  const url = URL.createObjectURL(file);
  const image = await loadImage(url);
  URL.revokeObjectURL(url);
  if (file.type !== "image/png" || !image) return status("Dosya PNG olmalı", true);
  const sizes = tileArtSizes(TILE_ART_BY_KEY[key]);
  if (!sizes.some((s) => s.w === image.naturalWidth && s.h === image.naturalHeight)) {
    return status(`${name}: görsel ${sizes.map((s) => `${s.w}×${s.h}`).join(", ")} olmalı (bu ${image.naturalWidth}×${image.naturalHeight})`, true);
  }
  status(`${name} yükleniyor…`);
  const response = await fetch(`/api/admin/tiles/${key}`, {
    method: "PUT",
    headers: { "Content-Type": "image/png", Authorization: `Bearer ${getToken() ?? ""}` },
    body: file,
  }).catch(() => null);
  const data = response ? await response.json().catch(() => ({})) : { error: "Sunucuya bağlanılamadı" };
  if (!response?.ok) return status(data.error ?? `Hata (${response?.status})`, true);
  await loadArt();
  status(`${name} görseli yüklendi; oyunda sayfa yenilenince görünür`);
}

async function removeArt(key: string) {
  const name = TILE_ART_BY_KEY[key].name;
  if (!confirm(`${name} görseli silinsin mi? Koddaki çizime döner.`)) return;
  try {
    await api("DELETE", `/admin/tiles/${key}`);
    await loadArt();
    status(`${name} görseli silindi`);
  } catch (error) {
    status((error as Error).message, true);
  }
}

function downloadBlob(blob: Blob, name: string) {
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const canvasBlob = (c: HTMLCanvasElement) => new Promise<Blob>((resolve) => c.toBlob((blob) => resolve(blob!), "image/png"));

/** A tile as drawn in code (before any upload), `px` pixels square. */
function originalTile(index: number, px: number) {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.drawImage(paintTileStrip(), index * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, 0, 0, px, px);
  return c;
}

/** A slot as the game draws it without an upload, `k` times its size (nearest-neighbour). */
async function originalArt(slot: TileArtSlot, k: number): Promise<HTMLCanvasElement> {
  if (slot.index !== undefined) return originalTile(slot.index, TILE_SIZE * k);
  const piece = await mapView!.paintOriginal(slot.key, slot.w, slot.h);
  if (k === 1) return piece;
  const c = document.createElement("canvas");
  c.width = slot.w * k;
  c.height = slot.h * k;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.drawImage(piece, 0, 0, c.width, c.height);
  return c;
}

/** Draws an image into a square preview canvas, whole and centred. */
function fitInto(c: HTMLCanvasElement, image: CanvasImageSource, w: number, h: number) {
  const g = c.getContext("2d")!;
  const k = Math.min(c.width / w, c.height / h);
  g.clearRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = false;
  g.drawImage(image, (c.width - w * k) / 2, (c.height - h * k) / 2, w * k, h * k);
}

/** The slot's image as the game uses it now: the upload, or the code-drawn original. */
async function downloadCurrent(slot: TileArtSlot) {
  const info = artList.find((a) => a.key === slot.key);
  if (info) downloadBlob(await fetch(tileArtUrl(info)).then((r) => r.blob()), `${slot.key}.png`);
  else downloadBlob(await canvasBlob(await originalArt(slot, 1)), `${slot.key}-orijinal.png`);
}

/** The whole tileset in one PNG (tiles side by side in game order). */
async function downloadTileset() {
  downloadBlob(await canvasBlob(tileset), `tileset-${tilesetPx}px.png`);
}

interface ArtVersion {
  id: number;
  size: number;
  uploadedAt: string;
  replacedAt: string;
  uploadedBy: string | null;
}

/** GM-only image (the history), fetched with the session token. */
async function authedBlob(path: string) {
  const response = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${getToken() ?? ""}` } });
  if (!response.ok) throw new Error(`Hata (${response.status})`);
  return response.blob();
}

/** The slot's versions: now, the original drawn in code, and earlier uploads to go back to. */
async function openHistory(slot: TileArtSlot) {
  const dialog = $<HTMLDialogElement>("ed-art-dialog");
  let versions: ArtVersion[] = [];
  try {
    versions = await api<ArtVersion[]>("GET", `/admin/tiles/${slot.key}/history`);
  } catch (error) {
    return status((error as Error).message, true);
  }
  const current = artList.find((a) => a.key === slot.key);
  const urls: string[] = [];
  const close = () => {
    dialog.close();
    urls.forEach((u) => URL.revokeObjectURL(u));
  };
  const button = (text: string, fn: () => void, cls = "secondary") => {
    const b = Object.assign(document.createElement("button"), { type: "button", textContent: text, className: cls });
    b.addEventListener("click", fn);
    return b;
  };
  const row = (picture: HTMLElement, title: string, detail: string, ...buttons: HTMLElement[]) => {
    const el = Object.assign(document.createElement("div"), { className: "ed-art-row" });
    const text = Object.assign(document.createElement("span"), { className: "ed-art-name" });
    text.append(title, Object.assign(document.createElement("small"), { textContent: detail }));
    el.append(picture, text, ...buttons);
    return el;
  };
  const img = (src: string) => Object.assign(document.createElement("img"), { src, width: 32, height: 32, className: "ed-art-img" });
  const date = (iso: string) => new Date(iso).toLocaleString("tr-TR");

  const rows: HTMLElement[] = [];
  if (current) rows.push(row(img(tileArtUrl(current)), "Şu an kullanılan", `${current.size}×${current.size} PNG`, button("İndir", () => void downloadCurrent(slot))));
  const original = Object.assign(document.createElement("canvas"), { width: 32, height: 32 });
  fitInto(original, await originalArt(slot, 1), slot.w, slot.h);
  rows.push(
    row(
      original,
      "Orijinal (kodla çizili)",
      current ? "Yüklenen görseli silince buna döner" : "Şu an kullanılan",
      button(`İndir ${slot.w}×${slot.h}`, async () => downloadBlob(await canvasBlob(await originalArt(slot, 1)), `${slot.key}-orijinal-${slot.w}x${slot.h}.png`)),
      button(`İndir ${slot.w * 4}×${slot.h * 4}`, async () =>
        downloadBlob(await canvasBlob(await originalArt(slot, 4)), `${slot.key}-orijinal-${slot.w * 4}x${slot.h * 4}.png`),
      ),
      ...(current
        ? [
            button("Buna dön", () => {
              close();
              void removeArt(slot.key);
            }),
          ]
        : []),
    ),
  );
  for (const version of versions) {
    let url = "";
    try {
      url = URL.createObjectURL(await authedBlob(`/admin/tiles/history/${version.id}.png`));
      urls.push(url);
    } catch {
      continue;
    }
    rows.push(
      row(
        img(url),
        `Eski sürüm · ${date(version.uploadedAt)}`,
        `${version.size}×${version.size} · ${version.uploadedBy ?? "?"} yükledi · ${date(version.replacedAt)} değiştirildi`,
        button("İndir", async () => downloadBlob(await authedBlob(`/admin/tiles/history/${version.id}.png`), `${slot.key}-${version.id}.png`)),
        button("Geri yükle", async () => {
          try {
            await api("POST", `/admin/tiles/${slot.key}/restore/${version.id}`);
            close();
            await loadArt();
            status(`${slot.name}: eski sürüm geri yüklendi`);
          } catch (error) {
            status((error as Error).message, true);
          }
        }),
      ),
    );
  }
  if (versions.length === 0) rows.push(Object.assign(document.createElement("p"), { className: "muted small", textContent: "Henüz eski sürüm yok. Her yeni yüklemede öncekisi burada saklanır." }));

  const head = Object.assign(document.createElement("div"), { className: "ed-dialog-head" });
  head.append(Object.assign(document.createElement("h2"), { textContent: `${slot.name} · sürümler` }), button("Kapat", close));
  const hint = Object.assign(document.createElement("p"), {
    className: "muted small",
    textContent: `${slot.hint} Boyut: ${tileArtSizes(slot).map((s) => `${s.w}×${s.h}`).join(", ")} PNG.`,
  });
  dialog.replaceChildren(head, hint, ...rows);
  dialog.onclose = () => urls.forEach((u) => URL.revokeObjectURL(u));
  dialog.showModal();
}

function renderArt() {
  const uploaded = new Map(artList.map((a) => [a.key, a]));
  $("ed-art").replaceChildren(
    ...TILE_ART_SLOTS.map((slot) => {
      const row = Object.assign(document.createElement("div"), { className: "ed-art-row" });
      const preview = document.createElement("canvas");
      preview.width = preview.height = 32;
      if (slot.index !== undefined) drawTileIndex(slot.index, 0, 0, 32, preview.getContext("2d")!);
      else {
        const image = decorArt.get(slot.key);
        if (image) fitInto(preview, image, slot.w, slot.h);
        else void originalArt(slot, 1).then((piece) => fitInto(preview, piece, slot.w, slot.h));
      }
      const info = uploaded.get(slot.key);
      const label = Object.assign(document.createElement("span"), { className: "ed-art-name" });
      const scale = info ? info.size / slot.w : 1;
      label.append(
        slot.name,
        Object.assign(document.createElement("small"), { textContent: `${slot.w * scale}×${slot.h * scale} · ${info ? "yüklendi" : "kodla çizili"}` }),
      );
      row.title = `${slot.hint}\nBoyut: ${tileArtSizes(slot).map((s) => `${s.w}×${s.h}`).join(", ")} PNG`;
      row.addEventListener("mouseenter", () => {
        highlightKey = slot.key;
        draw();
      });
      row.addEventListener("mouseleave", () => {
        highlightKey = null;
        draw();
      });
      const upload = Object.assign(document.createElement("label"), { className: "ed-file secondary", textContent: "Yükle", title: "PNG yükle" });
      const input = Object.assign(document.createElement("input"), { type: "file", accept: "image/png", hidden: true });
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (file) void uploadArt(slot.key, file);
        input.value = "";
      });
      upload.append(input);
      const download = Object.assign(document.createElement("button"), { type: "button", textContent: "⤓", className: "secondary", title: "Şu anki görseli indir" });
      download.addEventListener("click", () => void downloadCurrent(slot));
      const history = Object.assign(document.createElement("button"), { type: "button", textContent: "⟲", className: "secondary", title: "Orijinal ve eski sürümler" });
      history.addEventListener("click", () => void openHistory(slot));
      row.append(preview, label, upload, download, history);
      if (info) {
        const remove = Object.assign(document.createElement("button"), { type: "button", textContent: "✕", className: "danger", title: "Sil" });
        remove.addEventListener("click", () => void removeArt(slot.key));
        row.append(remove);
      }
      return row;
    }),
  );
}

// ---- Mouse and keyboard ------------------------------------------------------------------

type Drag =
  | { kind: "base"; decor: Decor; offsetX: number; offsetY: number; startX: number; startY: number }
  | { kind: "pan"; startX: number; startY: number; viewX: number; viewY: number }
  | { kind: "move"; id: string; offsetX: number; offsetY: number; moved: boolean }
  | { kind: "paint" }
  | { kind: "resize"; right: boolean; bottom: boolean };
let drag: Drag | null = null;

/**
 * The part of its tile a canvas point picks for a small blocker: the quarter it is in, or the
 * half on the side of the nearest edge (0 top, 1 bottom, 2 left, 3 right).
 */
function partAt(type: string | null, p: { x: number; y: number }) {
  const wx = (p.x - view.x) / view.scale / TILE_SIZE;
  const wy = (p.y - view.y) / view.scale / TILE_SIZE;
  const fx = wx - Math.floor(wx);
  const fy = wy - Math.floor(wy);
  if (type !== "blocker_half") return (fx >= 0.5 ? 1 : 0) + (fy >= 0.5 ? 2 : 0);
  const edges = [fy, 1 - fy, fx, 1 - fx];
  return edges.indexOf(Math.min(...edges));
}

function canvasPoint(event: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

canvas.addEventListener("mousedown", (event) => {
  const p = canvasPoint(event);
  const cell = toCell(p.x, p.y);
  if (event.button === 1 || event.button === 2) {
    drag = { kind: "pan", startX: p.x, startY: p.y, viewX: view.x, viewY: view.y };
    return;
  }
  // Grabbing the map's right or bottom edge resizes it.
  const edge = nearEdge(p);
  if ((edge.right || edge.bottom) && (!armed || (edge.right && edge.bottom))) {
    drag = { kind: "resize", ...edge };
    resizePreview = { width: base.map.width, height: base.map.height };
    draw();
    return;
  }
  if (armed) {
    snapshot();
    const placed = place(armed, cell.x, cell.y, false, partAt(armed, p), true);
    if (placed) selectedId = placed.id;
    drag = { kind: "paint" };
    refresh();
    return;
  }
  const hit = objectAt(cell.x, cell.y);
  selectedBase = null;
  if (hit) {
    selectedId = hit.id;
    snapshot();
    drag = { kind: "move", id: hit.id, offsetX: cell.x - hit.x, offsetY: cell.y - hit.y, moved: false };
  } else {
    selectedId = null;
    const own = baseDecorAt(cell.x, cell.y);
    if (own) {
      // The map's own decor: picked; dragging it moves a copy (the original is taken away).
      const f = decorFootprint(own)!;
      selectedBase = decorRef(own);
      drag = { kind: "base", decor: own, offsetX: cell.x - f.tx, offsetY: cell.y - f.ty, startX: cell.x, startY: cell.y };
    } else drag = { kind: "pan", startX: p.x, startY: p.y, viewX: view.x, viewY: view.y };
  }
  refresh();
});

window.addEventListener("mousemove", (event) => {
  const p = canvasPoint(event);
  const cell = toCell(p.x, p.y);
  const inside = cell.x >= 0 && cell.y >= 0 && cell.x < base.map.width && cell.y < base.map.height;
  hoverCell = inside ? cell : null;
  hoverPoint = p;
  $("ed-cursor").textContent = inside ? `x: ${cell.x}  y: ${cell.y}` : "";
  if (drag?.kind === "base" && (cell.x !== drag.startX || cell.y !== drag.startY) && !locked.decor) {
    snapshot();
    const copy = adoptBase(drag.decor);
    selectedBase = null;
    selectedId = copy.id;
    drag = { kind: "move", id: copy.id, offsetX: drag.offsetX, offsetY: drag.offsetY, moved: true };
    setDirty(true);
  }
  if (drag?.kind === "pan") {
    view.x = drag.viewX + (p.x - drag.startX);
    view.y = drag.viewY + (p.y - drag.startY);
  } else if (drag?.kind === "move") {
    const o = objects.find((x) => x.id === (drag as { id: string }).id);
    if (o) {
      const nx = snap(cell.x - drag.offsetX + Math.floor(grid / 2));
      const ny = snap(cell.y - drag.offsetY + Math.floor(grid / 2));
      if (nx !== o.x || ny !== o.y) {
        o.x = nx;
        o.y = ny;
        clampToMap(o);
        drag.moved = true;
        setDirty(true);
      }
    }
  } else if (drag?.kind === "resize" && resizePreview) {
    const { mapMin, mapMax } = MAP_EDIT_LIMITS;
    const clamp = (v: number) => Math.max(mapMin, Math.min(mapMax, v));
    if (drag.right) resizePreview.width = clamp(Math.round((p.x - view.x) / view.scale / TILE_SIZE));
    if (drag.bottom) resizePreview.height = clamp(Math.round((p.y - view.y) / view.scale / TILE_SIZE));
  } else if (drag?.kind === "paint" && armed && inside) {
    const placed = place(armed, cell.x, cell.y, false, partAt(armed, p));
    if (placed) selectedId = placed.id;
  }
  const edge = drag?.kind === "resize" ? drag : drag ? null : nearEdge(p);
  canvas.style.cursor = !edge || (!edge.right && !edge.bottom) ? "" : edge.right && edge.bottom ? "nwse-resize" : edge.right ? "ew-resize" : "ns-resize";
  if (drag || armed) draw();
});

/** Whether a canvas point is on the map's right or bottom edge. */
function nearEdge(p: { x: number; y: number }) {
  const corner = toScreen(base.map.width * TILE_SIZE, base.map.height * TILE_SIZE);
  const origin = toScreen(0, 0);
  return {
    right: Math.abs(p.x - corner.x) <= 6 && p.y >= origin.y - 6 && p.y <= corner.y + 6,
    bottom: Math.abs(p.y - corner.y) <= 6 && p.x >= origin.x - 6 && p.x <= corner.x + 6,
  };
}

window.addEventListener("mouseup", () => {
  if (drag?.kind === "resize" && resizePreview) {
    const target = resizePreview;
    resizePreview = null;
    drag = null;
    applySize(target.width, target.height, size?.fill ?? defaultFill());
    return;
  }
  if (drag?.kind === "move" && !drag.moved) undoStack.pop(); // a click, not a move
  if (drag && drag.kind !== "pan") refresh();
  drag = null;
});

canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const p = canvasPoint(event);
    const before = { x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale };
    view.scale = Math.max(0.25, Math.min(8, view.scale * (event.deltaY < 0 ? 1.2 : 1 / 1.2)));
    view.x = p.x - before.x * view.scale;
    view.y = p.y - before.y * view.scale;
    draw();
  },
  { passive: false },
);

// Drag and drop from the palette.
canvas.addEventListener("dragover", (event) => {
  const type = event.dataTransfer?.types.includes(DRAG_TYPE);
  if (!type) return;
  event.preventDefault();
  const p = canvasPoint(event);
  const cell = toCell(p.x, p.y);
  // The type itself is only readable on drop; keep the last one picked for the ghost.
  dropGhost = { type: lastDragged ?? "grass", x: cell.x, y: cell.y };
  draw();
});
canvas.addEventListener("dragleave", () => {
  dropGhost = null;
  draw();
});
canvas.addEventListener("drop", (event) => {
  event.preventDefault();
  dropGhost = null;
  const type = event.dataTransfer?.getData(DRAG_TYPE);
  if (!type || !MAP_PALETTE_BY_TYPE[type]) return draw();
  const p = canvasPoint(event);
  const cell = toCell(p.x, p.y);
  if (cell.x < 0 || cell.y < 0 || cell.x >= base.map.width || cell.y >= base.map.height) return draw();
  const placed = place(type, cell.x, cell.y, true, partAt(type, p));
  if (placed) selectedId = placed.id;
  refresh();
});

/** B / H / V / X / K: invisible blocker, half, quarter, Engel Kaldır, Süs Kaldır. */
const BLOCKER_KEYS: Record<string, string> = { b: "blocker", h: "blocker_half", v: "blocker_quarter", x: "unblock", k: "remove_decor" };

/** Picks a blocker brush (again: puts it down) and shows the blocking overlay with it. */
function armBlockerTool(type: string) {
  armed = armed === type ? null : type;
  selectedId = null;
  if (armed && !showBlocking) {
    showBlocking = true;
    $<HTMLInputElement>("ed-blocking").checked = true;
  }
  renderPalette();
  status(armed ? `${MAP_PALETTE_BY_TYPE[type].name} seçili: tıkla ya da sürükleyerek koy; koyduğunun üstüne tekrar tıkla: kaldır (Esc: bırak)` : "Fırça bırakıldı");
  refresh();
}

window.addEventListener("keydown", (event) => {
  const typing = event.target instanceof Element && event.target.closest("input, select, textarea");
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void save();
    return;
  }
  if (typing) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    undo();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
    event.preventDefault();
    duplicateSelected();
  } else if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    removeSelected();
  } else if (event.key.toLowerCase() === "q") {
    pickUnderCursor();
  } else if (!event.ctrlKey && !event.metaKey && BLOCKER_KEYS[event.key.toLowerCase()]) {
    armBlockerTool(BLOCKER_KEYS[event.key.toLowerCase()]);
  } else if (event.key.toLowerCase() === "r") {
    rotateSelected(event.shiftKey ? -1 : 1);
  } else if (event.key === "Escape" && selectedBase) {
    selectedBase = null;
    refresh();
  } else if (event.key === "Escape") {
    armed = null;
    selectedId = null;
    renderPalette();
    refresh();
  } else if (event.key.startsWith("Arrow")) {
    event.preventDefault();
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (d) nudgeSelected(d[0], d[1]);
  }
});

// ---- Load / save -------------------------------------------------------------------------

function fitView() {
  const scale = Math.min(canvas.width / (base.map.width * TILE_SIZE), canvas.height / (base.map.height * TILE_SIZE));
  view.scale = Math.max(0.25, Math.min(4, scale * 0.95));
  view.x = (canvas.width - base.map.width * TILE_SIZE * view.scale) / 2;
  view.y = (canvas.height - base.map.height * TILE_SIZE * view.scale) / 2;
}

function useEdits(edits: MapEdits | null) {
  objects = edits ? structuredClone(edits.objects) : [];
  size = edits?.size ?? null;
  rebuildBase();
  nextId = objects.reduce((n, o) => Math.max(n, Number(o.id.replace(/\D/g, "")) + 1 || n), 1);
  undoStack.length = 0;
  selectedId = null;
  setDirty(false);
}

async function load(target: ZoneId) {
  if (dirty && target === zone && !confirm("Kaydedilmemiş değişiklikler silinecek. Yeniden yüklensin mi?")) return;
  status("Yükleniyor…");
  try {
    const result = await api<{ edits: MapEdits | null; updatedAt: string | null; updatedBy: string | null }>("GET", `/admin/maps/${target}`);
    zone = target;
    generated = baseZoneLayout(zone);
    useEdits(result.edits);
    fitView();
    refresh();
    status(result.updatedAt ? `Yüklendi · son kayıt ${new Date(result.updatedAt).toLocaleString("tr-TR")} (${result.updatedBy ?? "?"})` : "Yüklendi · henüz düzenleme yok");
  } catch (error) {
    status((error as Error).message, true);
  }
}

async function save() {
  const edits = currentEdits();
  status("Kaydediliyor…");
  try {
    const result = await api<{ objects: number }>("PUT", `/admin/maps/${zone}`, edits);
    setDirty(false);
    status(`Kaydedildi · ${result.objects} obje`);
  } catch (error) {
    status((error as Error).message, true);
  }
}

function currentEdits(): MapEdits {
  return { version: 1, zone, grid: grid * TILE_SIZE, ...(size ? { size } : {}), objects };
}

async function reset() {
  if (!confirm(`${ZONES[zone].name} haritasındaki bütün düzenlemeler silinsin mi? Harita koddaki haline döner.`)) return;
  try {
    await api("DELETE", `/admin/maps/${zone}`);
    useEdits(null);
    fitView();
    refresh();
    status("Sıfırlandı");
  } catch (error) {
    status((error as Error).message, true);
  }
}

function exportJson() {
  const edits = currentEdits();
  const blob = new Blob([JSON.stringify(edits, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `harita-${zone}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importJson(file: File) {
  try {
    const data = JSON.parse(await file.text()) as MapEdits;
    if (data.version !== 1 || !Array.isArray(data.objects)) throw new Error("Bu bir harita dosyası değil");
    snapshot();
    objects = data.objects;
    size = data.size ?? null;
    rebuildBase();
    selectedId = null;
    setDirty(true);
    refresh();
    status(`${file.name} yüklendi; kaydetmeyi unutma (sunucu kaydederken doğrular)`);
  } catch (error) {
    status((error as Error).message, true);
  }
}

// ---- Start: GM check (the page hides itself; the server enforces) -------------------------

async function start() {
  const error = $("ed-error");
  if (!getToken()) {
    error.innerHTML = `Önce <a href="/">oyuna giriş yap</a>, sonra bu sayfayı yenile.`;
    error.hidden = false;
    return;
  }
  try {
    const me = await api<{ username: string; isAdmin: boolean }>("GET", "/me");
    if (!me.isAdmin) throw new Error(`${me.username} hesabının GM yetkisi yok.`);
    $("ed-user").textContent = `GM: ${me.username}`;
  } catch (e) {
    error.textContent = (e as Error).message;
    error.hidden = false;
    return;
  }
  $("ed-main").hidden = false;
  mapView = new MapView($("ed-phaser"));
  $<HTMLInputElement>("ed-blocking").addEventListener("change", (event) => {
    showBlocking = (event.target as HTMLInputElement).checked;
    draw();
  });

  const zoneSelect = $<HTMLSelectElement>("ed-zone");
  for (const z of Object.values(ZONES)) zoneSelect.append(new Option(z.name, z.id));
  const requested = new URLSearchParams(location.search).get("zone");
  const initial: ZoneId = requested && isZoneId(requested) ? requested : "town";
  zoneSelect.value = initial;
  zoneSelect.addEventListener("change", () => {
    if (dirty && !confirm("Kaydedilmemiş değişiklikler silinecek. Bölge değiştirilsin mi?")) {
      zoneSelect.value = zone;
      return;
    }
    void load(zoneSelect.value as ZoneId);
  });
  $<HTMLSelectElement>("ed-grid").addEventListener("change", (event) => {
    grid = Number((event.target as HTMLSelectElement).value) || 1;
    draw();
  });
  $("ed-load").addEventListener("click", () => void load(zone));
  $("ed-save").addEventListener("click", () => void save());
  $("ed-reset").addEventListener("click", () => void reset());
  $("ed-export").addEventListener("click", exportJson);
  $<HTMLInputElement>("ed-import").addEventListener("change", (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) void importJson(file);
    (event.target as HTMLInputElement).value = "";
  });
  window.addEventListener("beforeunload", (event) => {
    if (dirty) event.preventDefault();
  });
  // The stage changes size with the window and with the header: keep both canvases in step.
  new ResizeObserver(() => resize()).observe(canvas.parentElement!);

  renderPalette();
  resize();
  $("ed-art-tileset").addEventListener("click", () => void downloadTileset());
  await Promise.all([load(initial), loadArt()]);
}

void start();
