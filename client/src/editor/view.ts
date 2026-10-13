import Phaser from "phaser";
import type { DungeonLayout } from "../../../shared/src";
import { paintCastlePiece } from "../gfx/decor";
import { buildGround, destroyGround, type Ground } from "../gfx/ground";
import { TILESET_KEY } from "../gfx/textures";
import { setLampLevel } from "../fx/nightLights";
import type { Decor } from "../../../shared/src";
import { barrelSprite, bushSprite, crateSprite, dummySprite, haySprite, houseSprite, plantSprite, sackSprite, treeSprite, wellSprite, type SpriteInfo } from "../gfx/sprites";

// The editor's map view: a Phaser canvas that builds the map with the game's own code
// (gfx/ground.ts: tiles plus castle, towers, buildings...), so the editor shows exactly what the
// game will. The editor draws its own marks on a transparent canvas laid over this one.

class ViewScene extends Phaser.Scene {
  ground: Ground | null = null;
  onReady!: () => void;

  constructor() {
    super("editor-view");
  }

  create() {
    this.onReady();
  }
}

export class MapView {
  private game: Phaser.Game;
  private ready: Promise<ViewScene>;
  private pending: DungeonLayout | null = null;
  private frame = 0;
  private dropTileset = false;

  constructor(parent: HTMLElement) {
    const scene = new ViewScene();
    this.ready = new Promise((resolve) => (scene.onReady = () => resolve(scene)));
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: Math.max(1, parent.clientWidth),
      height: Math.max(1, parent.clientHeight),
      pixelArt: true,
      backgroundColor: "#0b0805",
      banner: false,
      // The editor's overlay canvas takes the mouse and the keyboard.
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      audio: { noAudio: true },
      scale: { mode: Phaser.Scale.NONE },
      scene,
    });
  }

  resize(width: number, height: number) {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    this.game.scale.resize(w, h);
    // The camera keeps the size it was made with unless told.
    void this.ready.then((scene) => scene.cameras.main.setSize(w, h));
  }

  /** Camera: screen = world * scale + (x, y). */
  setCamera(scale: number, x: number, y: number) {
    void this.ready.then((scene) => {
      // Phaser zooms (and culls tiles) around the camera's centre: screen = (world - scroll -
      // w/2) * zoom + w/2, so pick the scroll that puts world (0, 0) at (x, y).
      const camera = scene.cameras.main;
      camera.setZoom(scale);
      camera.setScroll((camera.width / 2 - x) / scale - camera.width / 2, (camera.height / 2 - y) / scale - camera.height / 2);
    });
  }

  /** Shows a layout (rebuilt at most once a frame, however often it is called). */
  show(layout: DungeonLayout) {
    this.pending = layout;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      void this.ready.then((scene) => this.rebuild(scene));
    });
  }

  /** Uploaded art changed: the tileset is built again on the next show(). */
  artChanged(layout: DungeonLayout) {
    this.dropTileset = true;
    this.show(layout);
  }

  private rebuild(scene: ViewScene) {
    const layout = this.pending;
    if (!layout) return;
    this.pending = null;
    if (scene.ground) destroyGround(scene, scene.ground);
    scene.ground = null;
    // A sky zone's decor paints the backdrop blue; anything else gets the editor's dark one.
    scene.cameras.main.setBackgroundColor("#0b0805");
    if (this.dropTileset) {
      this.dropTileset = false;
      if (scene.textures.exists(TILESET_KEY)) scene.textures.remove(TILESET_KEY);
    }
    // The editor shows the map by day: lamps and lit windows off.
    setLampLevel(scene, 0, true);
    scene.ground = buildGround(scene, layout);
  }

  /** The picture of a piece of decor (for the palette), or null for decor drawn another way. */
  async decorImage(decor: Decor): Promise<CanvasImageSource | null> {
    const scene = await this.ready;
    let sprite: SpriteInfo | null = null;
    if (decor.kind === "building") sprite = houseSprite(scene, { w: decor.w, h: decor.h, roof: decor.roof, ridge: decor.ridge ?? "h", chimney: !!decor.chimney, sign: false, seed: 1 });
    else if (decor.kind === "bigTree") sprite = treeSprite(scene, decor.variant);
    else if (decor.kind === "bush") sprite = bushSprite(scene, decor.variant);
    else if (decor.kind === "plant") sprite = plantSprite(scene, decor.variant);
    else if (decor.kind === "prop") {
      const painters: Partial<Record<string, (s: Phaser.Scene) => SpriteInfo>> = { barrel: barrelSprite, crate: crateSprite, hay: haySprite, well: wellSprite, dummy: dummySprite, sack: sackSprite };
      sprite = painters[decor.prop]?.(scene) ?? null;
    }
    return sprite ? (scene.textures.get(sprite.key).getSourceImage() as CanvasImageSource) : null;
  }

  /** A castle piece as the game draws it (no upload), `width` x `height` pixels. */
  async paintOriginal(key: string, width: number, height: number): Promise<HTMLCanvasElement> {
    const scene = await this.ready;
    const g = scene.make.graphics({}, false);
    paintCastlePiece(g, key);
    const texture = scene.make.renderTexture({ width, height }, false);
    texture.draw(g, 0, 0);
    return new Promise((resolve) => {
      texture.snapshot((image) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(image as HTMLImageElement, 0, 0);
        g.destroy();
        texture.destroy();
        resolve(canvas);
      });
    });
  }
}
