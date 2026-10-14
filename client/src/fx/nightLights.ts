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
  /** A lamp or torch (burns only when the lamps are lit); otherwise a fire that always burns. */
  lamp: boolean;
}

/** Something that shows a lamp's glow (a halo, a flame, a lit window): its alpha follows the lamps. */
interface Glow {
  object: Phaser.GameObjects.GameObject & { setAlpha(alpha: number): unknown };
  base: number;
  flicker: number;
}

interface Lamps {
  /** Where the lamps are heading (from the clock) and where they are now (eased towards it). */
  target: number;
  current: number;
  /** How dark it is (0..1), for how much light falls on characters. */
  darkness: number;
}

const lights = new WeakMap<Phaser.Scene, Light[]>();
const glows = new WeakMap<Phaser.Scene, Glow[]>();
const lamps = new WeakMap<Phaser.Scene, Lamps>();

const lampsOf = (scene: Phaser.Scene) => {
  let l = lamps.get(scene);
  if (!l) lamps.set(scene, (l = { target: 1, current: 1, darkness: 0 }));
  return l;
};

/** A fresh zone: forget the previous zone's lights. */
export function resetLights(scene: Phaser.Scene) {
  lights.set(scene, []);
  glows.set(scene, []);
}

/** The lights and glows decor registered in a scene (the Godot bake exports them). */
export const lightsOf = (scene: Phaser.Scene): readonly Light[] => lights.get(scene) ?? [];
export const glowsOf = (scene: Phaser.Scene): readonly Glow[] => glows.get(scene) ?? [];

/** Called by decor: a light source at (x, y) in world pixels; `lamp` ones go out by day. */
export function addLight(scene: Phaser.Scene, x: number, y: number, radius: number, color = 0xffc070, flicker = 0.06, lamp = true) {
  let list = lights.get(scene);
  if (!list) lights.set(scene, (list = []));
  list.push({ x, y, radius, color, flicker, lamp });
}

/** Called by decor: an object that glows while the lamps burn, at `base` alpha when fully lit. */
export function addGlow(scene: Phaser.Scene, object: Glow["object"], base: number, flicker = 0.12) {
  let list = glows.get(scene);
  if (!list) glows.set(scene, (list = []));
  list.push({ object, base, flicker });
  object.setAlpha(base * lampsOf(scene).current);
}

/** How lit the lamps should be (0..1); `instant` skips the fade (a scene's first frame). */
export function setLampLevel(scene: Phaser.Scene, level: number, instant = false) {
  const l = lampsOf(scene);
  l.target = level;
  if (instant) l.current = level;
}

/**
 * The lamp light falling on a point at night: 0 (none) .. 1 (right under a lamp), and the
 * direction it falls in (a unit vector from the light, which way a shadow stretches).
 */
export function lightAt(scene: Phaser.Scene, x: number, y: number): { amount: number; dx: number; dy: number } {
  const l = lampsOf(scene);
  const list = lights.get(scene);
  const strength = l.darkness * l.current;
  if (!list || strength <= 0.02) return { amount: 0, dx: 0, dy: 0 };
  let amount = 0;
  let dx = 0;
  let dy = 0;
  for (const light of list) {
    const r = light.radius * 1.1;
    const ox = x - light.x;
    const oy = y - light.y;
    if (Math.abs(ox) > r || Math.abs(oy) > r) continue;
    const d = Math.hypot(ox, oy);
    if (d >= r) continue;
    const w = (1 - d / r) ** 2 * (light.lamp ? 1 : 1 / Math.max(0.01, l.current));
    amount += w;
    if (d > 0.5) {
      dx += (ox / d) * w;
      dy += (oy / d) * w;
    }
  }
  const len = Math.hypot(dx, dy);
  return { amount: Math.min(1, amount * strength), dx: len ? dx / len : 0, dy: len ? dy / len : 0 };
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
    lampsOf(this.scene).darkness = value;
  }

  private lastTime = 0;

  /** Call at the end of the scene's update, after the camera has moved. */
  update(time: number) {
    // The lamps fade towards where the clock wants them, smoothly, and their glows follow.
    const l = lampsOf(this.scene);
    const dt = this.lastTime ? Math.min(0.25, (time - this.lastTime) / 1000) : 0;
    this.lastTime = time;
    l.current += (l.target - l.current) * Math.min(1, dt * 1.5);
    if (Math.abs(l.target - l.current) < 0.002) l.current = l.target;
    for (const [i, glow] of (glows.get(this.scene) ?? []).entries()) {
      if (!glow.object.active) continue;
      const flicker = 1 - glow.flicker + glow.flicker * Math.sin(time / 140 + i * 1.7);
      glow.object.setAlpha(glow.base * l.current * flicker);
    }

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
      const on = light.lamp ? l.current : 1;
      if (on <= 0.01) continue;
      const flicker = 1 + Math.sin(time / 90 + light.x * 0.37) * light.flicker;
      const r = light.radius * flicker * (0.6 + 0.4 * on);
      if (light.x + r < view.x || light.x - r > view.right || light.y + r < view.y || light.y - r > view.bottom) continue;
      const scale = (r * 2) / GRADIENT_SIZE;
      const lx = light.x - view.x;
      const ly = light.y - view.y;
      // Cut the darkness away, then lay a warm tint over the lit pool.
      this.stamp.setScale(scale).setTint(0xffffff).setAlpha(Math.min(1, d * 1.1) * on);
      rt.erase(this.stamp, lx, ly);
      this.stamp.setScale(scale * 0.8).setTint(light.color).setAlpha(0.55 * d * on);
      rt.draw(this.stamp, lx, ly);
    }
  }
}
