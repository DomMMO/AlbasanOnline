import Phaser from "phaser";

// Short-lived combat effects drawn with Graphics, so they scale with the camera
// zoom and stay chunky like the rest of the pixel art.

const HOLD_MS = 90;
const FADE_MS = 200;

function drawCrescent(g: Phaser.GameObjects.Graphics, angle: number, color: number, radius: number) {
  const spread = 1.15;
  g.lineStyle(4, color, 0.85);
  g.beginPath();
  g.arc(0, 0, radius, angle - spread, angle + spread);
  g.strokePath();
  // Bright core makes it read as a blade trail rather than a smudge.
  g.lineStyle(2, 0xffffff, 1);
  g.beginPath();
  g.arc(0, 0, radius - 1, angle - spread * 0.75, angle + spread * 0.75);
  g.strokePath();
}

/** Crescent "swish" in front of the attacker, pointing at `angle` (radians). Heavy hits get a second, crossing slash. */
export function slashEffect(scene: Phaser.Scene, x: number, y: number, angle: number, color: number, radius = 12, heavy = false) {
  const g = scene.add.graphics().setDepth(y + 20);
  drawCrescent(g, angle, color, radius);
  if (heavy) drawCrescent(g, angle + Math.PI * 0.15, color, radius - 4);
  g.setPosition(Math.round(x), Math.round(y));
  g.setScale(0.7);

  scene.tweens.add({ targets: g, scale: 1.1, duration: HOLD_MS + FADE_MS, ease: "Quad.easeOut" });
  scene.tweens.add({
    targets: g,
    alpha: 0,
    delay: HOLD_MS,
    duration: FADE_MS,
    onComplete: () => g.destroy(),
  });
}

/** Expanding ring around the attacker (Whirlwind), flattened because the ground is seen at an angle. */
export function ringEffect(scene: Phaser.Scene, x: number, y: number, color: number, radius: number) {
  const g = scene.add.graphics().setDepth(y + 20);
  g.lineStyle(4, color, 0.85).strokeCircle(0, 0, radius);
  g.lineStyle(2, 0xffffff, 1).strokeCircle(0, 0, radius - 2);
  g.setPosition(Math.round(x), Math.round(y));
  g.setScale(0.3, 0.15);

  scene.tweens.add({ targets: g, scaleX: 1, scaleY: 0.5, duration: 320, ease: "Cubic.easeOut" });
  scene.tweens.add({
    targets: g,
    alpha: 0,
    delay: 200,
    duration: 260,
    onComplete: () => g.destroy(),
  });
}
