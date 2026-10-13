import Phaser from "phaser";
import { DOT_KEY, ensureDot } from "../gfx/decor";

/** A puff of dust at someone's feet (getting on or off a horse). */
export function dustPuff(scene: Phaser.Scene, x: number, y: number) {
  ensureDot(scene);
  const emitter = scene.add
    .particles(x, y - 2, DOT_KEY, {
      angle: { min: 180, max: 360 },
      speed: { min: 8, max: 26 },
      scale: { start: 2.2, end: 4 },
      alpha: { start: 0.55, end: 0 },
      tint: [0xc8b490, 0xa89070, 0xe0d0b0],
      lifespan: 520,
      emitting: false,
    })
    .setDepth(y + 1);
  emitter.explode(14);
  scene.time.delayedCall(700, () => emitter.destroy());
}
