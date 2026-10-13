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

export class NightLayer {
  private readonly rt: Phaser.GameObjects.RenderTexture;
  private readonly stamp: Phaser.GameObjects.Image;
  private darkness = 0;

  constructor(private readonly scene: Phaser.Scene) {
    ensureGradient(scene);
    const camera = scene.cameras.main;
    this.rt = scene.add
      .renderTexture(0, 0, Math.ceil(camera.worldView.width) || 1, Math.ceil(camera.worldView.height) || 1)
      .setOrigin(0, 0)
      .setDepth(1e7)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setVisible(false);
    this.stamp = scene.make.image({ key: GRADIENT_KEY, add: false });
  }

  /** 0 (day, layer hidden) .. 1 (deep night). */
  setDarkness(value: number) {
    this.darkness = value;
  }

  update(time: number) {
    const d = this.darkness;
    this.rt.setVisible(d > 0.01);
    if (d <= 0.01) return;
    const view = this.scene.cameras.main.worldView;
    const w = Math.ceil(view.width);
    const h = Math.ceil(view.height);
    if (this.rt.width !== w || this.rt.height !== h) this.rt.resize(w, h);
    this.rt.setPosition(view.x, view.y);

    const strength = d * 0.72;
    const mix = (c: number) => Math.round(255 + (c - 255) * strength);
    const dark = Phaser.Display.Color.GetColor(mix(NIGHT_COLOR.r), mix(NIGHT_COLOR.g), mix(NIGHT_COLOR.b));
    this.rt.clear().fill(dark, 1);

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
      this.rt.erase(this.stamp, lx, ly);
      this.stamp.setScale(scale * 0.8).setTint(light.color).setAlpha(0.55 * d);
      this.rt.draw(this.stamp, lx, ly);
    }
  }
}
