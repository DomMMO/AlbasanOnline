import Phaser from "phaser";

// Night darkness drawn inside the game instead of a page overlay, so lamps, torches and
// campfires can cut warm pools of light out of it. Decor registers its lights while it is
// drawn; every frame the visible part of the dark layer is refilled and the lights in view
// are erased out of it and tinted warm.

const GRADIENT_KEY = "night-light";
const GRADIENT_SIZE = 128;
/** Colour the scene is multiplied by at full darkness (deep blue night). */
const NIGHT_COLOR = { r: 0x1c, g: 0x22, b: 0x52 };

interface Light {
  x: number;
  y: number;
  radius: number;
  color: number;
  flicker: number;
}

const lights = new WeakMap<Phaser.Scene, Light[]>();

/** A fresh zone: forget the previous zone's lights. */
export function resetLights(scene: Phaser.Scene) {
  lights.set(scene, []);
}

/** Called by decor: a light source at (x, y) in world pixels. */
export function addLight(scene: Phaser.Scene, x: number, y: number, radius: number, color = 0xffc070, flicker = 0.06) {
  let list = lights.get(scene);
  if (!list) lights.set(scene, (list = []));
  list.push({ x, y, radius, color, flicker });
}

function ensureGradient(scene: Phaser.Scene) {
  if (scene.textures.exists(GRADIENT_KEY)) return;
  const texture = scene.textures.createCanvas(GRADIENT_KEY, GRADIENT_SIZE, GRADIENT_SIZE)!;
  const ctx = texture.context;
  const half = GRADIENT_SIZE / 2;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.85)");
  g.addColorStop(0.7, "rgba(255,255,255,0.3)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GRADIENT_SIZE, GRADIENT_SIZE);
  texture.refresh();
}

/**
 * The part of the world the camera will show this frame. Camera.worldView is only refreshed
 * when the camera renders, so read in update() it still describes the previous frame: the
 * layer would trail one frame behind a moving camera and leave an unlit strip at the edge.
 * This repeats Phaser's own calculation (Camera.preRender) from the current scroll.
 */
function viewNow(camera: Phaser.Cameras.Scene2D.Camera) {
  let sx = camera.scrollX;
  let sy = camera.scrollY;
  if (camera.roundPixels) {
    sx = Math.floor(sx);
    sy = Math.floor(sy);
  }
  if (camera.useBounds) {
    sx = camera.clampX(sx);
    sy = camera.clampY(sy);
  }
  const width = Math.floor(camera.width / camera.zoomX + 0.5);
  const height = Math.floor(camera.height / camera.zoomY + 0.5);
  const x = Math.floor(sx + camera.width * 0.5 - width / 2 + 0.5);
  const y = Math.floor(sy + camera.height * 0.5 - height / 2 + 0.5);
  return { x, y, width, height, right: x + width, bottom: y + height };
}

export class NightLayer {
  /**
   * Made at the size of the view and made again when that changes (zoom, window size).
   * Never resized: a RenderTexture that has been resized still takes fill(), but everything
   * drawn or erased on it afterwards is lost (Phaser 3.90), which is what kept the light
   * pools from ever showing.
   */
  private rt: Phaser.GameObjects.RenderTexture | null = null;
  private readonly stamp: Phaser.GameObjects.Image;
  private darkness = 0;

  constructor(private readonly scene: Phaser.Scene) {
    ensureGradient(scene);
    this.stamp = scene.make.image({ key: GRADIENT_KEY, add: false });
  }

  /** 0 (day, layer hidden) .. 1 (deep night). */
  setDarkness(value: number) {
    this.darkness = value;
  }

  /** Call at the end of the scene's update, after the camera has moved. */
  update(time: number) {
    const d = this.darkness;
    if (d <= 0.01) {
      this.rt?.setVisible(false);
      return;
    }
    const view = viewNow(this.scene.cameras.main);
    if (view.width <= 0 || view.height <= 0) return;
    // Textures are kept at even sizes; one pixel too big is fine.
    const w = view.width + (view.width % 2);
    const h = view.height + (view.height % 2);
    if (!this.rt || this.rt.width !== w || this.rt.height !== h) {
      this.rt?.destroy();
      this.rt = this.scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(1e7).setBlendMode(Phaser.BlendModes.MULTIPLY);
    }
    const rt = this.rt.setVisible(true).setPosition(view.x, view.y);

    const strength = d * 0.72;
    const mix = (c: number) => Math.round(255 + (c - 255) * strength);
    rt.clear().fill(Phaser.Display.Color.GetColor(mix(NIGHT_COLOR.r), mix(NIGHT_COLOR.g), mix(NIGHT_COLOR.b)), 1);

    const list = lights.get(this.scene);
    if (!list) return;
    for (const light of list) {
      const flicker = 1 + Math.sin(time / 90 + light.x * 0.37) * light.flicker;
      const r = light.radius * flicker;
      if (light.x + r < view.x || light.x - r > view.right || light.y + r < view.y || light.y - r > view.bottom) continue;
      const scale = (r * 2) / GRADIENT_SIZE;
      const lx = light.x - view.x;
      const ly = light.y - view.y;
      // Cut the darkness away, then lay a warm tint over the lit pool.
      this.stamp.setScale(scale).setTint(0xffffff).setAlpha(Math.min(1, d * 1.1));
      rt.erase(this.stamp, lx, ly);
      this.stamp.setScale(scale * 0.8).setTint(light.color).setAlpha(0.55 * d);
      rt.draw(this.stamp, lx, ly);
    }
  }
}
