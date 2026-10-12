import Phaser from "phaser";
import { DOT_KEY, ensureDot } from "../gfx/decor";

// Teleport gate effects: the gate's idle shimmer, the column of light that takes
// you away and the one you arrive in on the other side.

type Point = { x: number; y: number };

const FLASH = { r: 215, g: 235, b: 255 };
const COLORS = [0x6f5bd9, 0xc8f0ff, 0x9d8cff];

/** Motes of light drifting up around a teleport gate. */
export function gateAura(scene: Phaser.Scene, at: Point) {
  ensureDot(scene);
  scene.add
    .particles(at.x, at.y - 8, DOT_KEY, {
      x: { min: -7, max: 7 },
      y: { min: -10, max: 6 },
      speedY: { min: -18, max: -8 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: COLORS,
      lifespan: 1300,
      frequency: 90,
      blendMode: Phaser.BlendModes.ADD,
    })
    .setDepth(at.y + 0.5);
}

function beam(scene: Phaser.Scene, at: Point, grow: boolean, durationMs: number) {
  const g = scene.add.graphics().setDepth(at.y + 1).setPosition(at.x, at.y).setBlendMode(Phaser.BlendModes.ADD);
  g.fillStyle(0x9d8cff, 0.35).fillRect(-7, -120, 14, 120);
  g.fillStyle(0xc8f0ff, 0.6).fillRect(-3, -120, 6, 120);
  g.fillStyle(0xffffff, 0.9).fillRect(-1, -120, 2, 120);
  g.fillStyle(0xc8f0ff, 0.5).fillEllipse(0, 0, 26, 8);
  g.setScale(grow ? 0.1 : 1, 1);
  scene.tweens.add({
    targets: g,
    scaleX: grow ? 1.2 : 0,
    alpha: grow ? 1 : 0,
    duration: durationMs,
    ease: grow ? "Quad.easeOut" : "Quad.easeIn",
    onComplete: () => (grow ? scene.tweens.add({ targets: g, alpha: 0, duration: 200, onComplete: () => g.destroy() }) : g.destroy()),
  });
  // Sparks spiralling up the column.
  for (let i = 0; i < 14; i++) {
    const spark = scene.add
      .rectangle(at.x + Phaser.Math.Between(-8, 8), at.y - Phaser.Math.Between(0, 12), 1, 1, COLORS[i % COLORS.length])
      .setDepth(at.y + 1.1);
    scene.tweens.add({
      targets: spark,
      y: spark.y - Phaser.Math.Between(25, 60),
      x: at.x + Phaser.Math.Between(-3, 3),
      alpha: 0,
      delay: i * 20,
      duration: durationMs,
      ease: "Sine.easeIn",
      onComplete: () => spark.destroy(),
    });
  }
}

/** Light takes the player away; `onDone` fires once the screen has faded out. */
export function teleportOut(scene: Phaser.Scene, at: Point, sprite: Phaser.GameObjects.Sprite | undefined, onDone: () => void) {
  beam(scene, at, true, 450);
  if (sprite) scene.tweens.add({ targets: sprite, scaleX: 0.2, scaleY: 1.4, alpha: 0, duration: 450, ease: "Quad.easeIn" });
  const camera = scene.cameras.main;
  camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, onDone);
  camera.fadeOut(500, FLASH.r, FLASH.g, FLASH.b);
}

/** Arrival on the other side: fade in from white inside a fading column of light. */
export function teleportIn(scene: Phaser.Scene, at: Point) {
  scene.cameras.main.fadeIn(600, FLASH.r, FLASH.g, FLASH.b);
  beam(scene, at, false, 700);
}
