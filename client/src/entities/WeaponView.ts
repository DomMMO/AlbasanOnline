import Phaser from "phaser";
import { Direction, glowTier, ITEMS } from "../../../shared/src";
import { ensureItemTexture, ensureSparkTexture, HAND, isWeaponMirrored, SPARK_KEY, weaponGrip } from "../gfx/weapons";

// The weapon in a character's hand: placement by facing, swing animation and
// the +7..+10 purple glow.

const GLOW_COLOR = 0xa64dff;

interface GlowStyle {
  strength: number;
  /** Pulse between strength and this value; undefined = steady. */
  pulseTo?: number;
  pulseMs?: number;
  /** Sparkle every N ms; undefined = none. */
  sparkleMs?: number;
}

const GLOW: Record<7 | 8 | 9 | 10, GlowStyle> = {
  7: { strength: 1.2 },
  8: { strength: 2.5, pulseTo: 4, pulseMs: 900 },
  9: { strength: 3.5, pulseTo: 6, pulseMs: 600, sparkleMs: 120 },
  10: { strength: 5, pulseTo: 8, pulseMs: 450, sparkleMs: 60 },
};

export class WeaponView {
  private sprite: Phaser.GameObjects.Sprite;
  private grip: { x: number; y: number };
  private pulse?: Phaser.Tweens.Tween;
  private sparkles?: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Extra rotation in degrees while swinging (positive = forward). */
  private swing = { angle: 0 };
  private swingTween?: Phaser.Tweens.Tween | Phaser.Tweens.TweenChain;

  constructor(
    private scene: Phaser.Scene,
    defId: string,
    enhance: number,
  ) {
    const def = ITEMS[defId];
    this.sprite = scene.add.sprite(0, 0, ensureItemTexture(scene, def), 0);
    this.grip = weaponGrip(def.icon.shape);
    this.applyGlow(glowTier(enhance));
  }

  private applyGlow(tier: 0 | 7 | 8 | 9 | 10) {
    if (tier === 0) return;
    const style = GLOW[tier];
    // preFX needs WebGL; on the canvas renderer the weapon just doesn't glow.
    const fx = this.sprite.preFX;
    if (fx) {
      fx.padding = 6;
      const glow = fx.addGlow(GLOW_COLOR, style.strength, 0, false, 0.1, 8);
      if (style.pulseTo !== undefined) {
        this.pulse = this.scene.tweens.add({
          targets: glow,
          outerStrength: style.pulseTo,
          duration: style.pulseMs,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
    if (style.sparkleMs !== undefined) {
      ensureSparkTexture(this.scene);
      this.sparkles = this.scene.add.particles(0, 0, SPARK_KEY, {
        lifespan: 650,
        speed: { min: 2, max: 9 },
        angle: { min: 230, max: 310 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xffffff, 0xe3c2ff, 0xb066ff],
        blendMode: "ADD",
        frequency: style.sparkleMs,
        emitZone: { type: "random", source: new Phaser.Geom.Rectangle(-8, -11, 16, 11), quantity: 1 },
      });
      this.sparkles.startFollow(this.sprite);
    }
  }

  /** Places the weapon in the hand for the given feet position and facing. */
  layout(px: number, py: number, facing: Direction) {
    const hand = HAND[facing];
    const mirrored = isWeaponMirrored(facing);
    this.sprite.setFrame(mirrored ? 1 : 0);
    this.sprite.setOrigin(mirrored ? 1 - this.grip.x : this.grip.x, this.grip.y);
    this.sprite.setPosition(px + hand.x, py + hand.y);
    this.sprite.setAngle(mirrored ? -this.swing.angle : this.swing.angle);
    // Seen from behind (facing up) the weapon is behind the body.
    const depth = facing === Direction.Up ? py - 0.5 : py + 0.5;
    this.sprite.setDepth(depth);
    this.sparkles?.setDepth(depth + 0.1);
  }

  /** Wind back, chop forward, recover. */
  swingOnce(heavy: boolean) {
    this.swingTween?.stop();
    this.swing.angle = 0;
    this.swingTween = this.scene.tweens.chain({
      targets: this.swing,
      tweens: [
        { angle: -35, duration: 70, ease: "Quad.easeOut" },
        { angle: heavy ? 125 : 100, duration: heavy ? 120 : 100, ease: "Quad.easeIn" },
        { angle: 0, duration: 160, ease: "Quad.easeOut" },
      ],
    });
  }

  /** Two full turns (Whirlwind). */
  spin() {
    this.swingTween?.stop();
    this.swing.angle = 0;
    this.swingTween = this.scene.tweens.add({
      targets: this.swing,
      angle: 720,
      duration: 420,
      ease: "Sine.easeInOut",
      onComplete: () => (this.swing.angle = 0),
    });
  }

  setVisible(visible: boolean) {
    this.sprite.setVisible(visible);
    this.sparkles?.setVisible(visible);
  }

  setAlpha(alpha: number) {
    this.sprite.setAlpha(alpha);
  }

  destroy() {
    this.swingTween?.stop();
    this.pulse?.stop();
    this.sparkles?.destroy();
    this.sprite.destroy();
  }
}
