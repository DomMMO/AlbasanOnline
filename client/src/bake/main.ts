import Phaser from "phaser";
import * as shared from "../../../shared/src";
import { AFFIXES, isBlockingTile, ITEMS, NODES, RARITY_COLORS, SKILLS, Tile, TILE_COUNT, TILE_SIZE, ZONE_FILES, ZONES, HORSE_BREEDS, zoneLayout, type DungeonLayout, type ZoneId } from "../../../shared/src";
import { buildGround } from "../gfx/ground";
import { preloadDecorArt } from "../gfx/decorArt";
import { loadTileArt, tileArt, tileArtResolution } from "../gfx/tileArt";
import { loadZoneEdits } from "../net/mapEdits";
import { glowsOf, lightsOf } from "../fx/nightLights";
import { iconUrl, itemIconUrl } from "../gfx/icons";
import { auraIconUrl, skillIconUrl } from "../gfx/skillIcons";
import { ensureItemTexture, weaponGripFor } from "../gfx/weapons";
import { nodeTexture } from "../gfx/nodeTextures";
import { CROWN_KEY, ensureCrown } from "../gfx/overhead";
import { ensureHorse, horseIconUrl } from "../gfx/horse";
import { cursor, type CursorKind } from "../gfx/cursors";
import {
  buildTileset,
  CLIFF_TILES,
  FALL_TILES,
  FRINGE_VARIANTS,
  paintGrassFringe,
  paintStoneFringe,
  renderTiles,
  tileBase,
  tileBaseColor,
  tileCell,
  TOWN_WALL_FACE_TILE,
  WALL_FACE_TILE,
  WOOD_WALL_FACE_TILE,
  RENDER_TILE_COUNT,
  TILESET_COLUMNS,
} from "../gfx/tilePainter";
import { itemImage } from "../gfx/itemImages";
import { loadTitleFont } from "../gfx/fonts";
import { installGlobeFrame } from "../ui/globeFrame";

// The Godot bake. Runs the game's own Phaser drawing code headless (tools/godot/bake.mjs) and
// sends the result to the Godot project, so the Godot client shows exactly the same pixels:
//   data/shared.json        every plain-data export of shared/src (items, mobs, skills, zones...)
//   data/zones/<id>.json    map tiles + blocking (client prediction), decor objects, lights
//   art/zones/<id>/g_*.png  the ground (tiles, fringes, ground decor) in 1024 px chunks
//   art/decor/<hash>.png    every standing decor piece (y-sorted against characters in Godot)
//   art/items, art/held, art/skills, art/nodes, art/horses, art/cursors, art/ui
// For moving a zone into a Godot map scene (tools/migrate_map.gd), zones kept as files (version 1):
//   data/zones/<id>.decor.json   every piece of every decor (ground-level ones too) and its lights,
//                                by decor index
//   data/zones/<id>.ground.json  the tileset index of every cell and the grass/cobble edges
//   art/ui/tileset_1x.png, fringe_*.png, data/tileset_meta.json  the ground pictures
// Zones made in Godot (version 2) are not baked: Godot draws their map scene itself.

const CHUNK = 1024;
const logEl = document.getElementById("log")!;

function log(message: string) {
  logEl.textContent += `${message}\n`;
  void fetch("/__bake/log", { method: "POST", body: message });
}

async function put(path: string, body: Blob | string) {
  const response = await fetch("/__bake/write", { method: "POST", headers: { "x-path": path }, body });
  if (!response.ok) throw new Error(`write failed: ${path}`);
}

const json = (value: unknown) => JSON.stringify(value);

async function dataUrlBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/png"));
}

function imageOf(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image load"));
    image.src = src;
  });
}

async function sha1(bytes: Uint8ClampedArray, w: number, h: number): Promise<string> {
  const head = new Uint8Array([w & 255, w >> 8, h & 255, h >> 8]);
  const all = new Uint8Array(head.length + bytes.length);
  all.set(head);
  all.set(bytes, head.length);
  const digest = await crypto.subtle.digest("SHA-1", all);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 20);
}

// ---- Shared data -----------------------------------------------------------------------

/** A JSON-safe copy (Maps become objects, Sets arrays, functions are dropped). */
function plain(value: unknown, depth = 0): unknown {
  if (depth > 40) return undefined;
  if (value === null || typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "function" || typeof value === "undefined" || typeof value === "symbol" || typeof value === "bigint") return undefined;
  if (value instanceof Map) return Object.fromEntries([...value].map(([k, v]) => [String(k), plain(v, depth + 1)]));
  if (value instanceof Set) return [...value].map((v) => plain(v, depth + 1));
  if (Array.isArray(value)) return value.map((v) => plain(v, depth + 1) ?? null);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as object)) {
    const p = plain(v, depth + 1);
    if (p !== undefined) out[k] = p;
  }
  return out;
}

async function bakeSharedData() {
  const data: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(shared)) {
    if (name === "BIG_DUNGEONS") {
      // Their layouts are exported per zone; keep only the descriptions here.
      data[name] = Object.fromEntries(Object.entries(value as Record<string, { layout: unknown }>).map(([id, d]) => [id, plain({ ...d, layout: undefined })]));
      continue;
    }
    const p = plain(value);
    if (p !== undefined) data[name] = p;
  }
  // What the client draws but shared/ doesn't know: minimap colours and weapon grip points.
  data.TILE_BASE_COLORS = Array.from({ length: TILE_COUNT }, (_, t) => tileBaseColor(t));
  // Affix tooltip lines are functions in shared/: keep them as templates ("{v}" = the value).
  data.AFFIX_LABELS = Object.fromEntries(Object.entries(AFFIXES).map(([id, def]) => [id, def.label(7654321).replace("7654321", "{v}")]));
  data.BLOCKING_TILES = Array.from({ length: TILE_COUNT }, (_, t) => t).filter((t) => isBlockingTile(t));
  data.WEAPON_GRIPS = Object.fromEntries(Object.values(ITEMS).filter((d) => d.slot === "weapon").map((d) => [d.id, weaponGripFor(d)]));
  await put("data/shared.json", json(data));
  log(`shared.json: ${Object.keys(data).length} exports`);
}

// ---- Zones -------------------------------------------------------------------------------

type Obj = Phaser.GameObjects.GameObject & {
  depth: number;
  alpha?: number;
  visible?: boolean;
  blendMode?: number | string;
  x?: number;
  y?: number;
  setAlpha?(a: number): unknown;
  setBlendMode?(b: number): unknown;
};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bounds of a Graphics from its drawing commands (in world space), or null if it can't be told. */
function graphicsBounds(g: Phaser.GameObjects.Graphics): Rect | null {
  const buf = g.commandBuffer as number[];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let line = 0;
  let pad = 0;
  const add = (x: number, y: number, r = 0) => {
    minX = Math.min(minX, x - r);
    minY = Math.min(minY, y - r);
    maxX = Math.max(maxX, x + r);
    maxY = Math.max(maxY, y + r);
  };
  for (let i = 0; i < buf.length; ) {
    const cmd = buf[i++];
    switch (cmd) {
      case 0: // ARC x y r start end anticlockwise overshoot
        add(buf[i], buf[i + 1], buf[i + 2] + line);
        i += 7;
        break;
      case 1:
      case 2:
      case 8:
      case 9:
      case 14:
      case 15:
        break;
      case 3: // FILL_RECT
        add(buf[i], buf[i + 1]);
        add(buf[i] + buf[i + 2], buf[i + 1] + buf[i + 3]);
        i += 4;
        break;
      case 4: // LINE_TO
      case 5: // MOVE_TO
        add(buf[i], buf[i + 1], line);
        i += 2;
        break;
      case 6: // LINE_STYLE width color alpha
        line = buf[i];
        pad = Math.max(pad, line);
        i += 3;
        break;
      case 7: // FILL_STYLE
        i += 2;
        break;
      case 10: // FILL_TRIANGLE
      case 11: // STROKE_TRIANGLE
        for (let k = 0; k < 3; k++) add(buf[i + k * 2], buf[i + k * 2 + 1], cmd === 11 ? line : 0);
        i += 6;
        break;
      case 21: // GRADIENT_FILL_STYLE
        i += 8;
        break;
      case 22: // GRADIENT_LINE_STYLE
        line = buf[i];
        pad = Math.max(pad, line);
        i += 6;
        break;
      default:
        // TRANSLATE / SCALE / ROTATE: not used by decor; let the caller fall back to a wide window.
        return null;
    }
  }
  if (!Number.isFinite(minX)) return { x: g.x, y: g.y, w: 0, h: 0 };
  const m = g.getWorldTransformMatrix();
  const corners = [
    m.transformPoint(minX, minY),
    m.transformPoint(maxX, minY),
    m.transformPoint(minX, maxY),
    m.transformPoint(maxX, maxY),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const x0 = Math.min(...xs) - pad - 2;
  const y0 = Math.min(...ys) - pad - 2;
  return { x: x0, y: y0, w: Math.max(...xs) + pad + 2 - x0, h: Math.max(...ys) + pad + 2 - y0 };
}

function boundsOf(obj: Obj): Rect | null {
  if (obj instanceof Phaser.GameObjects.Graphics) {
    return graphicsBounds(obj) ?? { x: (obj.x ?? 0) - 600, y: (obj.y ?? 0) - 900, w: 1200, h: 1200 };
  }
  const withBounds = obj as unknown as { getBounds?: () => Phaser.Geom.Rectangle };
  if (typeof withBounds.getBounds === "function") {
    const b = withBounds.getBounds();
    return { x: b.x - 2, y: b.y - 2, w: b.width + 4, h: b.height + 4 };
  }
  return null;
}

/** Draws objects into a dynamic texture through its camera at (sx, sy) and returns the pixels. */
async function render(scene: Phaser.Scene, objects: Obj[], sx: number, sy: number, w: number, h: number): Promise<HTMLCanvasElement> {
  const key = `bake-${w}x${h}`;
  let dt = scene.textures.get(key) as unknown as Phaser.Textures.DynamicTexture;
  if (!scene.textures.exists(key)) {
    dt = scene.textures.addDynamicTexture(key, w, h)!;
    dt.isSpriteTexture = true;
  }
  dt.clear();
  dt.camera.setScroll(sx, sy);
  dt.draw(objects);
  const image = await new Promise<HTMLImageElement>((resolve) =>
    dt.snapshotArea(0, 0, w, h, (snap) => resolve(snap as HTMLImageElement)),
  );
  if (!image.complete) await new Promise((r) => (image.onload = r));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(image, 0, 0);
  return canvas;
}

/** The smallest box round the non-transparent pixels, or null when there are none. */
function alphaBox(canvas: HTMLCanvasElement): Rect | null {
  const { width, height } = canvas;
  const data = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function crop(canvas: HTMLCanvasElement, box: Rect): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = box.w;
  out.height = box.h;
  out.getContext("2d")!.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return out;
}

/** Decor pictures already written (by hash), across zones. */
const writtenDecor = new Set<string>();

async function saveDecor(canvas: HTMLCanvasElement): Promise<string> {
  const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
  const hash = await sha1(data, canvas.width, canvas.height);
  if (!writtenDecor.has(hash)) {
    writtenDecor.add(hash);
    await put(`art/decor/${hash}.png`, await canvasBlob(canvas));
  }
  return hash;
}

const isEmitter = (o: unknown) => o instanceof Phaser.GameObjects.Particles.ParticleEmitter;

/** One decor object as a picture (written to art/decor) and its placement, or null when it draws nothing. */
async function bakePiece(scene: Phaser.Scene, obj: Obj, glows: Map<unknown, { base: number; flicker: number }>): Promise<Record<string, unknown> | null> {
  if (obj.visible === false) return null;
  const glow = glows.get(obj);
  const alpha = obj.alpha ?? 1;
  if (alpha <= 0.001 && !glow) return null;
  const bounds = boundsOf(obj);
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return null;
  const bx = Math.floor(bounds.x);
  const by = Math.floor(bounds.y);
  const w = Math.min(4096, Math.ceil(bounds.x + bounds.w) - bx);
  const h = Math.min(4096, Math.ceil(bounds.y + bounds.h) - by);
  const blend = obj.blendMode;
  const additive = blend === Phaser.BlendModes.ADD || blend === "ADD";
  // Drawn at full strength with normal blending; Godot applies the alpha and blend itself.
  obj.setAlpha?.(1);
  if (additive) obj.setBlendMode?.(Phaser.BlendModes.NORMAL);
  const size = Math.max(64, 2 ** Math.ceil(Math.log2(Math.max(w, h))));
  const canvas = await render(scene, [obj], bx, by, size, size);
  obj.setAlpha?.(alpha);
  if (additive) obj.setBlendMode?.(Phaser.BlendModes.ADD);
  const box = alphaBox(crop(canvas, { x: 0, y: 0, w, h }));
  if (!box) return null;
  const hash = await saveDecor(crop(canvas, box));
  const entry: Record<string, unknown> = { t: hash, x: bx + box.x, y: by + box.y, d: Math.round(obj.depth * 1000) / 1000 };
  if (alpha !== 1 && !glow) entry.a = Math.round(alpha * 1000) / 1000;
  if (additive) entry.b = "add";
  if (glow) entry.g = [glow.base, glow.flicker];
  if (obj.depth < -1.5) entry.u = 1;
  return entry;
}

function teardown(scene: Phaser.Scene, ground: ReturnType<typeof buildGround>) {
  for (const obj of ground.objects) scene.tweens.killTweensOf(obj);
  ground.layer.tilemap.destroy();
  for (const timer of ground.timers) timer.remove(false);
  for (const obj of ground.objects) obj.destroy();
  for (const obj of [...scene.children.list]) if (isEmitter(obj)) obj.destroy();
}

const GREEN = new Set<number>([Tile.Grass, Tile.GrassAlt, Tile.Flower, Tile.DarkGrass]);
const HARD = new Set<number>([Tile.Cobble, Tile.Plaza, Tile.Path, Tile.Market]);
const SIDES: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/**
 * What the ground of a zone shows, cell by cell, for moving it into a Godot TileMap: the
 * tileset index of every cell (-1 = nothing, open sky) and the edges grass and cobbles spill
 * over (ground.ts grassFringe): per cell a bit mask of sides (1 n, 2 e, 4 s, 8 w) and the
 * cell's variant, for grass and for stones.
 */
function groundCells(layout: DungeonLayout) {
  const tiles = layout.map.tiles;
  const grass: [number, number, number, number][] = [];
  const stones: [number, number, number, number][] = [];
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const tile = tiles[y][x];
      if (!HARD.has(tile)) continue;
      let g = 0;
      let s = 0;
      SIDES.forEach(([dx, dy], side) => {
        const next = tiles[y + dy]?.[x + dx];
        if (GREEN.has(next)) g |= 1 << side;
        else if (tile === Tile.Plaza && next === Tile.Cobble) s |= 1 << side;
      });
      const variant = (x * 7 + y * 13) % FRINGE_VARIANTS;
      if (g) grass.push([x, y, g, variant]);
      if (s) stones.push([x, y, s, variant]);
    }
  }
  return { render: renderTiles(tiles), rotations: layout.rotations ?? {}, grass, stones };
}

/**
 * The ground pictures for moving maps into Godot: the whole tileset at 1x, which Tile each of
 * its slots is (variants, wall faces, the cliff under the sky island), and the edge pieces.
 */
async function bakeGroundArt() {
  await put("art/ui/tileset_1x.png", await canvasBlob(buildTileset(tileArt, 1)));
  const base = Array.from({ length: RENDER_TILE_COUNT }, (_, i) => tileBase(i));
  base[WALL_FACE_TILE] = Tile.CaveWall;
  base[TOWN_WALL_FACE_TILE] = Tile.Wall;
  base[WOOD_WALL_FACE_TILE] = Tile.WoodWall;
  for (const i of [...CLIFF_TILES, ...FALL_TILES]) base[i] = Tile.Sky;
  await put("data/tileset_meta.json", json({ columns: TILESET_COLUMNS, count: RENDER_TILE_COUNT, base, blocking: base.map((t) => isBlockingTile(t)) }));
  await put("art/ui/fringe_grass.png", await canvasBlob(paintGrassFringe()));
  await put("art/ui/fringe_stone.png", await canvasBlob(paintStoneFringe()));
}

async function bakeZone(scene: Phaser.Scene, zone: ZoneId) {
  await loadZoneEdits(zone);
  const layout = zoneLayout(zone);
  const map = layout.map;
  const camera = scene.cameras.main;
  camera.setBackgroundColor(0x000000);
  const ground = buildGround(scene, layout);
  const background = camera.backgroundColor;
  const glows = new Map(glowsOf(scene).map((g) => [g.object as unknown, g]));
  const lights = lightsOf(scene).map((l) => ({ x: l.x, y: l.y, r: l.radius, c: l.color, f: l.flicker, lamp: l.lamp }));

  // Let tweens and timers settle on their first frame.
  await new Promise((r) => setTimeout(r, 60));

  const all = [ground.layer as unknown as Obj, ...(ground.objects as Obj[])];
  const order = new Map(scene.children.list.map((o, i) => [o, i]));
  const byDepth = (a: Obj, b: Obj) => a.depth - b.depth || (order.get(a) ?? 0) - (order.get(b) ?? 0);
  const groundObjs = all.filter((o) => o.depth >= -1.5 && o.depth < 0 && !isEmitter(o)).sort(byDepth);
  const standing = all.filter((o) => (o.depth >= 0 || o.depth < -1.5) && o !== (ground.layer as unknown)).sort(byDepth);

  // Ground chunks.
  const widthPx = map.width * TILE_SIZE;
  const heightPx = map.height * TILE_SIZE;
  const chunks: { x: number; y: number; file: string }[] = [];
  for (let cy = 0; cy < heightPx; cy += CHUNK) {
    for (let cx = 0; cx < widthPx; cx += CHUNK) {
      const w = Math.min(CHUNK, widthPx - cx);
      const h = Math.min(CHUNK, heightPx - cy);
      const canvas = await render(scene, groundObjs, cx, cy, CHUNK, CHUNK);
      const piece = crop(canvas, { x: 0, y: 0, w, h });
      if (!alphaBox(piece)) continue;
      const file = `art/zones/${zone}/g_${cx / CHUNK}_${cy / CHUNK}.png`;
      await put(file, await canvasBlob(piece));
      chunks.push({ x: cx, y: cy, file });
    }
  }

  // Standing decor: one picture per piece, placed and y-sorted by its Phaser depth.
  const objects: Record<string, unknown>[] = [];
  const effects: Record<string, unknown>[] = [];
  const baked = new Map<Obj, Record<string, unknown> | null>();
  for (const obj of standing) {
    if (isEmitter(obj)) {
      effects.push({ kind: "particles", x: Math.round(obj.x ?? 0), y: Math.round(obj.y ?? 0), d: obj.depth });
      continue;
    }
    const entry = await bakePiece(scene, obj, glows);
    baked.set(obj, entry);
    if (entry) objects.push(entry);
  }

  // The map editor's view of the decor: each piece's pictures, ground-level ones included.
  if (ZONE_FILES[zone]) {
    const pieces: Record<string, unknown>[] = [];
    for (const obj of all) {
      const index = ground.owners.get(obj);
      if (index === undefined || isEmitter(obj)) continue;
      const entry = baked.has(obj) ? baked.get(obj) : await bakePiece(scene, obj, glows);
      if (entry) pieces.push({ i: index, ...entry });
    }
    const decorLights = lights.map((l, k) => ({ i: ground.lightOwners[k] ?? -1, ...l }));
    await put(`data/zones/${zone}.decor.json`, json({ zone, count: layout.decor?.length ?? 0, pieces, lights: decorLights }));
    await put(`data/zones/${zone}.ground.json`, json(groundCells(layout)));
  }

  const blockMask = map.blockMask ? [...map.blockMask.entries()] : [];
  const zoneData = {
    id: zone,
    width: map.width,
    height: map.height,
    tiles: map.tiles.flat(),
    blockMask,
    ...(map.shapes?.length ? { rects: map.shapes.map((r) => [r.x, r.y, r.w, r.h]) } : {}),
    spawn: map.spawn,
    background: background.alpha > 0 ? background.color : null,
    chunk: CHUNK,
    ground: chunks,
    objects,
    effects,
    lights,
  };
  await put(`data/zones/${zone}.json`, json(zoneData));
  log(`${zone}: ${map.width}x${map.height}, ${chunks.length} chunks, ${objects.length} objects, ${lights.length} lights`);

  // Tear down for the next zone.
  teardown(scene, ground);
}

// ---- Icons and small textures ---------------------------------------------------------------

async function bakeTextureCanvas(scene: Phaser.Scene, key: string, path: string) {
  const source = scene.textures.get(key).getSourceImage() as HTMLCanvasElement | HTMLImageElement;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext("2d")!.drawImage(source, 0, 0);
  await put(path, await canvasBlob(canvas));
}

async function bakeIcons(scene: Phaser.Scene) {
  const rarities = Object.keys(RARITY_COLORS) as (keyof typeof RARITY_COLORS)[];
  for (const def of Object.values(ITEMS)) {
    await put(`art/items/${def.id}.png`, await dataUrlBlob(itemIconUrl(def)));
    if (def.jewel) {
      for (const rarity of rarities) {
        const color = Number.parseInt(RARITY_COLORS[rarity].slice(1), 16);
        await put(`art/items/${def.id}@${rarity}.png`, await dataUrlBlob(iconUrl(def.icon.shape, color)));
      }
    }
    if (def.slot) await bakeTextureCanvas(scene, ensureItemTexture(scene, def), `art/held/${def.id}.png`);
  }
  log(`items: ${Object.keys(ITEMS).length}`);
  for (const skill of Object.values(SKILLS)) await put(`art/skills/${skill.id}.png`, await dataUrlBlob(skillIconUrl(skill)));
  for (const aura of ["aura_stun", "aura_protect", "aura_fortune"]) await put(`art/skills/${aura}.png`, await dataUrlBlob(auraIconUrl(aura)));
  log(`skills: ${Object.keys(SKILLS).length}`);
  for (const def of Object.values(NODES)) await bakeTextureCanvas(scene, nodeTexture(scene, def), `art/nodes/${def.id}.png`);
  ensureCrown(scene);
  await bakeTextureCanvas(scene, CROWN_KEY, "art/ui/crown.png");
  for (const [id, breed] of Object.entries(HORSE_BREEDS)) {
    await bakeTextureCanvas(scene, ensureHorse(scene, breed.look), `art/horses/${id}.png`);
    await put(`art/horses/${id}_icon.png`, await dataUrlBlob(horseIconUrl(2, breed.look)));
  }
  const cursors: Record<string, [number, number]> = {};
  for (const kind of ["default", "pointer", "attack", "loot", "talk", "portal", "trade", "mine", "gather"] as CursorKind[]) {
    const match = /^url\((.+)\) (\d+) (\d+), /.exec(cursor(kind));
    if (!match) continue;
    await put(`art/cursors/${kind}.png`, await dataUrlBlob(match[1]));
    cursors[kind] = [Number(match[2]), Number(match[3])];
  }
  await put("data/cursors.json", json(cursors));
  // The whole tileset (one tile per cell, TILESET_COLUMNS wide) for tools in the editor.
  const res = tileArtResolution();
  await put("art/ui/tileset.png", await canvasBlob(buildTileset(tileArt, res)));
  await put("data/tileset.json", json({ columns: TILESET_COLUMNS, count: RENDER_TILE_COUNT, size: TILE_SIZE * res }));
  // Licensed item pictures (when this machine has them).
  for (const def of Object.values(ITEMS)) {
    const picture = itemImage(def.image);
    if (picture) await put(`art/items/${def.id}.png`, await (await fetch(picture.icon)).blob());
  }
}

/** The ornate frames of the health and resource globes (ui/globeFrame.ts SVGs), at 2x. */
async function bakeGlobeFrames() {
  const sides: [string, "left" | "right", [string, string]][] = [
    ["hp", "left", ["#ff8787", "#7a0f0f"]],
    ["resource", "right", ["#a5d8ff", "#0b2f6b"]],
  ];
  for (const [name, side, gem] of sides) {
    const globe = document.createElement("div");
    globe.id = `${name}-globe`;
    globe.innerHTML = '<div class="globe-orb"></div>';
    installGlobeFrame(globe, side, gem);
    for (const layer of ["back", "front"]) {
      const svg = globe.querySelector(`.globe-frame.${layer}`)!;
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svg.setAttribute("width", "300");
      svg.setAttribute("height", "300");
      const image = await imageOf(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 300;
      canvas.getContext("2d")!.drawImage(image, 0, 0, 300, 300);
      await put(`art/ui/globe_${name}_${layer}.png`, await canvasBlob(canvas));
    }
  }
}

// ---- Run ------------------------------------------------------------------------------------

class BakeScene extends Phaser.Scene {
  constructor() {
    super("bake");
  }

  preload() {
    preloadDecorArt(this);
  }

  create() {
    void run(this);
  }
}

async function run(scene: Phaser.Scene) {
  const params = new URLSearchParams(location.search);
  const only = params.get("zones")?.split(",").filter(Boolean);
  const runId = params.get("run") ?? "";
  try {
    await Promise.all([loadTileArt(), loadTitleFont()]);
    await bakeSharedData();
    // quick: only the zones (the map editor's "Pişir"); icons and frames stay as they were.
    if (!params.has("quick")) {
      await bakeIcons(scene);
      await bakeGlobeFrames();
    }
    await bakeGroundArt();
    // Zones made in Godot (map scenes) are drawn by Godot itself.
    const zones = (Object.keys(ZONES) as ZoneId[]).filter((z) => (!only || only.includes(z)) && ZONE_FILES[z]?.version !== 2);
    for (const zone of zones) await bakeZone(scene, zone);
    await put("data/zones/index.json", json(Object.keys(ZONES)));
    await fetch("/__bake/done", { method: "POST", body: `${runId} ok` });
    log("done");
  } catch (error) {
    log(`FAILED: ${(error as Error).stack ?? error}`);
    await fetch("/__bake/done", { method: "POST", body: `${runId} error: ${(error as Error).message}` });
  }
}

new Phaser.Game({
  type: Phaser.WEBGL,
  parent: "game",
  width: 64,
  height: 64,
  pixelArt: true,
  transparent: true,
  scene: BakeScene,
});
