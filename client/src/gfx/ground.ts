import type Phaser from "phaser";
import { Tile, TILE_SIZE, type DungeonLayout } from "../../../shared/src";
import { lightsOf, resetLights } from "../fx/nightLights";
import { drawDecor } from "./decor";
import { createGroundLayer, renderTiles } from "./textures";
import { FRINGE_SIDES, FRINGE_VARIANTS, paintGrassFringe, paintStoneFringe } from "./tilePainter";

const FRINGE_KEY = "grass-fringe";
const STONE_FRINGE_KEY = "stone-fringe";
const GREEN = new Set<Tile>([Tile.Grass, Tile.GrassAlt, Tile.Flower, Tile.DarkGrass]);
/** Floors grass grows over at the edges. */
const HARD = new Set<Tile>([Tile.Cobble, Tile.Plaza, Tile.Path, Tile.Market]);
const SIDES: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];

/** A fringe texture with one frame per side and variant ("n0" ... "w3"). */
function ensureFringe(scene: Phaser.Scene, key: string, paint: () => HTMLCanvasElement) {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.addCanvas(key, paint())!;
  FRINGE_SIDES.forEach((side, row) => {
    for (let v = 0; v < FRINGE_VARIANTS; v++) texture.add(`${side}${v}`, 0, v * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  });
}

/**
 * Grass spilling over the edges of stone and earth floors, the way it grows: on every floor
 * tile, a ragged fringe along each side that has grass next to it (all in one blitter).
 */
function grassFringe(scene: Phaser.Scene, tiles: Tile[][]) {
  ensureFringe(scene, FRINGE_KEY, paintGrassFringe);
  ensureFringe(scene, STONE_FRINGE_KEY, paintStoneFringe);
  // Cobbles straying onto the paving first, grass over everything.
  const stones = scene.add.blitter(0, 0, STONE_FRINGE_KEY).setDepth(-0.96);
  const blitter = scene.add.blitter(0, 0, FRINGE_KEY).setDepth(-0.95);
  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const tile = tiles[y][x];
      if (!HARD.has(tile)) continue;
      SIDES.forEach(([dx, dy], side) => {
        const next = tiles[y + dy]?.[x + dx];
        const variant = (x * 7 + y * 13 + side * 5) % FRINGE_VARIANTS;
        if (GREEN.has(next)) blitter.create(x * TILE_SIZE, y * TILE_SIZE, `${FRINGE_SIDES[side]}${variant}`);
        else if (tile === Tile.Plaza && next === Tile.Cobble) stones.create(x * TILE_SIZE, y * TILE_SIZE, `${FRINGE_SIDES[side]}${variant}`);
      });
    }
  }
}

// A zone's ground (tiles) and the decor standing on it, as one piece that can be torn down and
// built again: the game rebuilds it when the map editor saves the zone, the editor after every
// change.

export interface Ground {
  layer: Phaser.Tilemaps.TilemapLayer;
  objects: Phaser.GameObjects.GameObject[];
  timers: Phaser.Time.TimerEvent[];
  /** Which piece of layout.decor (its index) drew each decor object. */
  owners: Map<Phaser.GameObjects.GameObject, number>;
  /** Which piece of layout.decor added each light (lightsOf(scene) order). */
  lightOwners: number[];
}

export function destroyGround(scene: Phaser.Scene, ground: Ground) {
  ground.layer.tilemap.destroy();
  for (const timer of ground.timers) timer.remove(false);
  for (const object of ground.objects) {
    scene.tweens.killTweensOf(object);
    object.destroy();
  }
}

export function buildGround(scene: Phaser.Scene, layout: DungeonLayout): Ground {
  const before = new Set(scene.children.list);
  const layer = createGroundLayer(scene, renderTiles(layout.map.tiles));
  grassFringe(scene, layout.map.tiles);
  // Tiles the map editor turned.
  for (const [key, degrees] of Object.entries(layout.rotations ?? {})) {
    const [x, y] = key.split(",").map(Number);
    const tile = layer.getTileAt(x, y);
    if (tile) tile.rotation = (degrees * Math.PI) / 180;
  }
  // Decor animates on timers (fountain ripples, sparks...): note them so a rebuild stops them.
  const timers: Phaser.Time.TimerEvent[] = [];
  const owners = new Map<Phaser.GameObjects.GameObject, number>();
  const lightOwners: number[] = [];
  const addEvent = scene.time.addEvent;
  scene.time.addEvent = (config) => {
    const timer = addEvent.call(scene.time, config);
    timers.push(timer);
    return timer;
  };
  try {
    // Decor registers its lights for the night layer: start the list again with it.
    resetLights(scene);
    let current = -1;
    let seen = new Set(scene.children.list);
    const note = () => {
      for (const o of scene.children.list) if (!seen.has(o) && current >= 0) owners.set(o, current);
      seen = new Set(scene.children.list);
      while (lightOwners.length < lightsOf(scene).length) lightOwners.push(current);
    };
    if (layout.decor) {
      drawDecor(scene, layout.decor, (index) => {
        note();
        current = index;
      });
      note();
    }
  } finally {
    scene.time.addEvent = addEvent;
  }
  return { layer, objects: scene.children.list.filter((o) => !before.has(o) && o !== layer), timers, owners, lightOwners };
}
