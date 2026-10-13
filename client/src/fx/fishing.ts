import Phaser from "phaser";
import { DOT_KEY, ensureDot } from "../gfx/decor";

// Fishing visuals: a rod in the hand, the line sagging down to a red and white float that
// bobs on the water, and a splash when something bites.

interface Line {
  rod: Phaser.GameObjects.Graphics;
  float: Phaser.GameObjects.Graphics;
}

export class FishingLines {
  private lines = new Map<string, Line>();

  constructor(private scene: Phaser.Scene) {
    ensureDot(scene);
  }

  /** Call every frame for every player; `fishing` false removes their line. */
  update(id: string, at: { x: number; y: number }, fishing: boolean, float: { x: number; y: number }) {
    let line = this.lines.get(id);
    if (!fishing) {
      if (line) this.remove(id);
      return;
    }
    if (!line) {
      line = { rod: this.scene.add.graphics(), float: this.scene.add.graphics() };
      this.lines.set(id, line);
    }
    const t = this.scene.time.now;
    const bob = Math.sin(t / 280 + id.length) * 1.2;
    const hand = { x: at.x + (float.x >= at.x ? 4 : -4), y: at.y - 8 };
    // The rod points from the hand towards the float, tip raised.
    const angle = Math.atan2(float.y - hand.y, float.x - hand.x);
    const tip = { x: hand.x + Math.cos(angle) * 11, y: hand.y + Math.sin(angle) * 11 - 9 };
    const end = { x: float.x, y: float.y + bob - 1 };

    line.rod.clear().setDepth(Math.max(at.y, float.y) + 0.5);
    line.rod.lineStyle(2, 0x6b4423, 1).lineBetween(hand.x, hand.y, tip.x, tip.y);
    line.rod.lineStyle(1, 0x3b2414, 1).lineBetween(hand.x, hand.y, hand.x + Math.cos(angle) * 3, hand.y + Math.sin(angle) * 3 - 2.5);
    // The line: a gentle curve sagging between the rod tip and the float.
    const mid = { x: (tip.x + end.x) / 2, y: Math.max(tip.y, end.y) + 4 };
    const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(tip.x, tip.y), new Phaser.Math.Vector2(mid.x, mid.y), new Phaser.Math.Vector2(end.x, end.y));
    line.rod.lineStyle(1, 0xe8f1f5, 0.75);
    curve.draw(line.rod, 12);

    line.float.clear().setDepth(float.y);
    line.float.fillStyle(0xbfe3ff, 0.45).fillEllipse(float.x, float.y + 1.5, 9 + bob, 3);
    line.float.fillStyle(0xffffff).fillCircle(end.x, end.y + 0.5, 2);
    line.float.fillStyle(0xd93b3b).fillCircle(end.x, end.y - 1, 2);
    line.float.fillStyle(0x1a1a1a).fillRect(end.x - 0.5, end.y - 4.5, 1, 2);
  }

  /** Lines of players who are gone. */
  prune(present: Set<string>) {
    for (const id of [...this.lines.keys()]) if (!present.has(id)) this.remove(id);
  }

  private remove(id: string) {
    const line = this.lines.get(id);
    line?.rod.destroy();
    line?.float.destroy();
    this.lines.delete(id);
  }
}

/** Water bursting up around the float when a fish bites. */
export function fishSplash(scene: Phaser.Scene, x: number, y: number) {
  ensureDot(scene);
  const emitter = scene.add
    .particles(x, y, DOT_KEY, {
      angle: { min: 220, max: 320 },
      speed: { min: 18, max: 42 },
      gravityY: 90,
      scale: { start: 1.1, end: 0.4 },
      alpha: { start: 1, end: 0 },
      tint: [0xffffff, 0xbfe3ff, 0x7fb8ff],
      lifespan: 520,
      emitting: false,
    })
    .setDepth(y + 1);
  emitter.explode(14);
  const ring = scene.add.ellipse(x, y + 1, 6, 2).setStrokeStyle(1, 0xe8f6ff, 0.9).setDepth(y + 0.5);
  scene.tweens.add({ targets: ring, scaleX: 3, scaleY: 3, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
  scene.time.delayedCall(800, () => emitter.destroy());
}
