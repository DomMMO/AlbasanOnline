import Phaser from "phaser";

// Spell effects. All drawn with Graphics so they scale with the camera zoom.

type Point = { x: number; y: number };

const CHEST = 7; // effects fly at chest height, not at the feet

/** A glowing ball travelling from caster to target; `onArrive` fires on impact. */
export function projectile(scene: Phaser.Scene, from: Point, to: Point, color: number, size: number, onArrive?: () => void) {
  const g = scene.add.graphics().setDepth(100000);
  g.fillStyle(color, 0.35).fillCircle(0, 0, size + 2);
  g.fillStyle(color, 1).fillCircle(0, 0, size);
  g.fillStyle(0xffffff, 0.9).fillCircle(-size / 3, -size / 3, Math.max(1, size / 2.5));
  g.setPosition(from.x, from.y - CHEST);
  const distance = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
  scene.tweens.add({
    targets: g,
    x: to.x,
    y: to.y - CHEST,
    duration: Math.max(120, distance * 2.2),
    ease: "Quad.easeIn",
    onComplete: () => {
      g.destroy();
      burst(scene, to, color);
      onArrive?.();
    },
  });
}

/** Small flash where something hits. */
export function burst(scene: Phaser.Scene, at: Point, color: number, radius = 7) {
  const g = scene.add.graphics().setDepth(100000).setPosition(at.x, at.y - CHEST);
  g.fillStyle(color, 0.8).fillCircle(0, 0, radius);
  g.fillStyle(0xffffff, 0.9).fillCircle(0, 0, radius / 2);
  scene.tweens.add({ targets: g, scale: 1.8, alpha: 0, duration: 260, onComplete: () => g.destroy() });
}

/** Jagged bolt from the sky onto the target. */
export function lightning(scene: Phaser.Scene, at: Point) {
  const g = scene.add.graphics().setDepth(100000);
  const points: Point[] = [{ x: at.x + 6, y: at.y - 90 }];
  for (let i = 1; i < 7; i++) points.push({ x: at.x + Phaser.Math.Between(-6, 6), y: at.y - 90 + i * 13 });
  points.push({ x: at.x, y: at.y - CHEST });
  const draw = (width: number, color: number, alpha: number) => {
    g.lineStyle(width, color, alpha);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) g.lineTo(p.x, p.y);
    g.strokePath();
  };
  draw(4, 0xffd43b, 0.6);
  draw(2, 0xffffff, 1);
  scene.tweens.add({ targets: g, alpha: 0, delay: 80, duration: 220, onComplete: () => g.destroy() });
  burst(scene, at, 0xffd43b, 9);
}

/** Column of light on the target (Smite). */
export function holyBeam(scene: Phaser.Scene, at: Point) {
  const g = scene.add.graphics().setDepth(100000).setPosition(at.x, at.y);
  g.fillStyle(0xffe066, 0.35).fillRect(-6, -70, 12, 70);
  g.fillStyle(0xfff3bf, 0.8).fillRect(-2, -70, 4, 70);
  scene.tweens.add({ targets: g, alpha: 0, scaleX: 0.2, duration: 450, onComplete: () => g.destroy() });
  burst(scene, at, 0xffe066, 8);
}

/** Green sparkles rising around the healed character. */
export function healSparkles(scene: Phaser.Scene, at: Point) {
  for (let i = 0; i < 8; i++) {
    const g = scene.add.graphics().setDepth(100000);
    g.fillStyle(i % 2 ? 0x8ce99a : 0xffffff, 1).fillRect(-1, -1, 2, 2);
    g.setPosition(at.x + Phaser.Math.Between(-8, 8), at.y - Phaser.Math.Between(0, 10));
    scene.tweens.add({ targets: g, y: g.y - 18, alpha: 0, delay: i * 40, duration: 600, onComplete: () => g.destroy() });
  }
}

/** Icy ring expanding over the ground (Frost Nova). */
export function frostRing(scene: Phaser.Scene, at: Point, radius: number) {
  const g = scene.add.graphics().setDepth(at.y + 20).setPosition(at.x, at.y - 2);
  g.fillStyle(0xa5d8ff, 0.25).fillEllipse(0, 0, radius * 2, radius);
  g.lineStyle(3, 0x74c0fc, 0.9).strokeEllipse(0, 0, radius * 2, radius);
  g.lineStyle(1, 0xffffff, 1).strokeEllipse(0, 0, radius * 2 - 4, radius - 2);
  g.setScale(0.2);
  scene.tweens.add({ targets: g, scale: 1, duration: 260, ease: "Cubic.easeOut" });
  scene.tweens.add({ targets: g, alpha: 0, delay: 300, duration: 300, onComplete: () => g.destroy() });
}

/** Shards of bone flying out in a ring (Kemik Patlaması), also used when a skeleton crumbles. */
export function boneBurst(scene: Phaser.Scene, at: Point, radius: number) {
  const count = 12;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const g = scene.add.graphics().setDepth(100000);
    g.fillStyle(i % 3 ? 0xf1f3f5 : 0xced4da, 1).fillRect(-2, -1, 4, 2);
    g.setPosition(at.x, at.y - CHEST).setRotation(angle);
    scene.tweens.add({
      targets: g,
      x: at.x + Math.cos(angle) * radius,
      y: at.y - CHEST + Math.sin(angle) * radius * 0.5,
      alpha: 0,
      duration: 380,
      ease: "Cubic.easeOut",
      onComplete: () => g.destroy(),
    });
  }
  const ring = scene.add.graphics().setDepth(at.y + 20).setPosition(at.x, at.y - 2);
  ring.lineStyle(2, 0xdee2e6, 0.8).strokeEllipse(0, 0, radius * 2, radius);
  ring.setScale(0.2);
  scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
}

/** Little stars circling over a stunned head. */
export function stunStars(scene: Phaser.Scene, at: { x: number; y: number }) {
  for (let i = 0; i < 3; i++) {
    const g = scene.add.graphics().setDepth(100000);
    g.fillStyle(0xffe066, 1).fillRect(-1, -1, 3, 3);
    const angle = (i / 3) * Math.PI * 2;
    const state = { a: angle };
    scene.tweens.add({
      targets: state,
      a: angle + Math.PI * 4,
      duration: 1400,
      onUpdate: () => g.setPosition(at.x + Math.cos(state.a) * 6, at.y - 20 + Math.sin(state.a) * 2),
      onComplete: () => g.destroy(),
    });
  }
}

/** Ring that pulses under a caster while a spell is being cast; call the returned function to remove it. */
export function castingGlow(scene: Phaser.Scene, follow: () => Point, color: number): () => void {
  const g = scene.add.graphics().setDepth(0.6);
  g.lineStyle(1, color, 1).strokeEllipse(0, 0, 18, 7);
  g.fillStyle(color, 0.2).fillEllipse(0, 0, 18, 7);
  const tween = scene.tweens.add({ targets: g, scale: 1.25, yoyo: true, repeat: -1, duration: 300 });
  const update = () => {
    const p = follow();
    g.setPosition(Math.round(p.x), Math.round(p.y) - 1);
  };
  update();
  scene.events.on(Phaser.Scenes.Events.UPDATE, update);
  return () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, update);
    tween.stop();
    g.destroy();
  };
}
