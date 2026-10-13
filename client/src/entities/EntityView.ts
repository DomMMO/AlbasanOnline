import Phaser from "phaser";
import { Direction, directionToward, glowTier, ITEMS, type Appearance, type HumanoidGear } from "../../../shared/src";
import { ringEffect, slashEffect } from "../fx/slash";
import { ensureSpriteSet, HumanoidFrame, type SpriteSet } from "../gfx/textures";
import { BODY_PART_Y, ensureItemTexture } from "../gfx/weapons";
import { hasImageAnim, IMAGE_SPRITES, withFallback } from "../gfx/imageSprites";
import { ensureHorse, HORSE_RIDER_LIFT, HorseFrame } from "../gfx/horse";
import { decodeHorseLook } from "../../../shared/src";
import { CROWN_KEY, ensureCrown } from "../gfx/overhead";
import { DOT_KEY, ensureDot } from "../gfx/decor";
import { WeaponView } from "./WeaponView";

const HP_BAR_WIDTH = 16;

export type SwingKind = "normal" | "heavy" | "spin";

const SLASH_COLORS: Record<SwingKind, number> = { normal: 0xe8e8f0, heavy: 0xff7a3d, spin: 0xffc04d };

/**
 * Draws one player or mob: sprite, optional name, health bar, held weapon.
 * Holds no game logic; it only shows what it is told.
 */
/** Sitting: rows of the legs hidden under the seat, and how far the body drops. */
const SEAT_CROP = 3;
const SEAT_DROP = 1;

export class EntityView {
  readonly sprite: Phaser.GameObjects.Sprite;
  private set: SpriteSet;
  private label?: Phaser.GameObjects.Text;
  private hpBar: Phaser.GameObjects.Graphics;
  private hpBarVisible = false;
  /** Unrounded position; the sprite itself is drawn snapped to whole pixels. */
  private rawX: number;
  private rawY: number;
  private facing = Direction.Down;
  /** Temporary visual displacement (attack lunge); not part of the real position. */
  private offset = { x: 0, y: 0 };
  private weapon?: WeaponView;
  private weaponKey = "";

  /** Integer draw scale (bosses are bigger). */
  private scale: number;

  constructor(scene: Phaser.Scene, x: number, y: number, appearance: Appearance, name?: string, nameColor = "#ffffff", scale = 1) {
    // Art that isn't on this machine (assets/licensed/) is drawn as a look-alike instead.
    appearance = withFallback(appearance);
    this.set = ensureSpriteSet(scene, appearance);
    this.rawX = x;
    this.rawY = y;
    this.scale = scale;
    this.sprite = scene.add.sprite(x, y, this.set.key, 0).setOrigin(0.5, 1).setScale(scale);
    if (appearance.type === "portal" && appearance.style !== "cave") this.sprite.anims.play(`${this.set.key}-idle`);
    if (appearance.type === "image") {
      const meta = IMAGE_SPRITES[appearance.key].meta;
      this.sprite.setOrigin(meta.originX, meta.originY);
      this.sprite.anims.play(`${this.set.key}-idle`);
      // Recoloured variants (a fiery golem from the earth one).
      if (appearance.tint !== undefined) this.setBaseTint(appearance.tint);
    }
    if (appearance.type === "slime") this.sprite.anims.play(`${this.set.key}-idle`);

    if (name) {
      // Small and fine: the camera zooms the world 2-4x, so the text is drawn at a high
      // resolution to stay sharp.
      this.label = scene.add
        .text(x, y, name, {
          fontFamily: '"Cloister Black TR", serif',
          fontSize: "5px",
          color: nameColor,
          stroke: "#000000",
          strokeThickness: 1,
        })
        .setOrigin(0.5, 1)
        .setResolution(10);
    }
    this.hpBar = scene.add.graphics().setVisible(false);
    this.setPosition(x, y);
  }

  get x() {
    return this.rawX;
  }

  get y() {
    return this.rawY;
  }

  setNameColor(color: string) {
    this.label?.setColor(color);
  }

  /** Top of the sprite, for floating text. */
  get headY() {
    return this.rawY - this.lift() - this.set.height * this.scale;
  }

  // ---- Riding ----
  private horse?: Phaser.GameObjects.Sprite;
  private moving = false;

  /** Rider's feet above the ground while on horseback; sitting drops a little. */
  private lift() {
    return this.horse ? HORSE_RIDER_LIFT : this.seated ? -SEAT_DROP : 0;
  }

  private seated = false;

  /** Sits on a stool: the lower legs are cut off and the body drops onto the seat. */
  setSeated(on: boolean) {
    if (on === this.seated) return;
    this.seated = on;
    if (on) this.sprite.setCrop(0, 0, this.sprite.frame.width, this.sprite.frame.height - SEAT_CROP);
    else this.sprite.setCrop();
    this.setPosition(this.rawX, this.rawY);
  }

  /** Texture key of the horse being ridden (its look). */
  private horseKey = "";

  /** Puts the character on a horse of this look (encodeHorseLook; "" = the village horse), or takes them off. */
  setMounted(mounted: boolean, look = "") {
    const scene = this.sprite.scene;
    const key = mounted ? ensureHorse(scene, look ? decodeHorseLook(look) : undefined) : "";
    if (key === this.horseKey && mounted === !!this.horse) return;
    // Getting off, or a different horse (bought or restyled at the stable while riding).
    this.setGallop(false);
    this.horse?.destroy();
    this.horse = undefined;
    this.horseKey = key;
    if (mounted) {
      this.horse = scene.add.sprite(this.rawX, this.rawY, key, HorseFrame.Side).setOrigin(0.5, 1);
      this.horse.setAlpha(this.sprite.alpha);
    }
    this.setAnimation(this.facing, this.moving);
  }

  get mounted() {
    return !!this.horse;
  }

  private gallopDust?: Phaser.GameObjects.Particles.ParticleEmitter;

  /** Galloping: the horse's legs go faster and dust kicks up behind it. */
  setGallop(on: boolean) {
    on &&= !!this.horse;
    if (on === !!this.gallopDust) return;
    if (this.horse) this.horse.anims.timeScale = on ? 1.8 : 1;
    if (!on) {
      const dust = this.gallopDust!;
      this.gallopDust = undefined;
      dust.stop();
      this.sprite.scene.time.delayedCall(600, () => dust.destroy());
      return;
    }
    const scene = this.sprite.scene;
    ensureDot(scene);
    this.gallopDust = scene.add.particles(0, 0, DOT_KEY, {
      follow: this.horse,
      followOffset: { x: 0, y: -2 },
      x: { min: -6, max: 6 },
      speedY: { min: -14, max: -4 },
      speedX: { min: -10, max: 10 },
      scale: { start: 1.6, end: 3.2 },
      alpha: { start: 0.45, end: 0 },
      tint: [0xc8b490, 0xa89070, 0xe0d0b0],
      lifespan: 420,
      frequency: 50,
    });
  }

  // ---- Above the name: the arena champion's crown, the GM tag ----
  private crown?: { image: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Arc; sparkles: Phaser.GameObjects.Particles.ParticleEmitter; tweens: Phaser.Tweens.Tween[] };
  private gmTag?: { text: Phaser.GameObjects.Text; bounce: { y: number }; tween: Phaser.Tweens.Tween };

  /** The glowing crown of the best PvP player in the arena. */
  setCrown(on: boolean) {
    if (on === !!this.crown) return;
    if (!on) {
      this.crown!.tweens.forEach((t) => t.stop());
      this.crown!.image.destroy();
      this.crown!.glow.destroy();
      this.crown!.sparkles.destroy();
      this.crown = undefined;
      return;
    }
    const scene = this.sprite.scene;
    ensureCrown(scene);
    ensureDot(scene);
    const image = scene.add.image(0, 0, CROWN_KEY).setOrigin(0.5, 1);
    // WebGL: a real glow around the crown; the halo and sparkles work on any renderer.
    image.preFX?.addGlow(0xffd34d, 2, 0, false, 0.1, 10);
    const glow = scene.add.circle(0, 0, 9, 0xffd34d, 0.28).setBlendMode(Phaser.BlendModes.ADD);
    const sparkles = scene.add.particles(0, 0, DOT_KEY, {
      x: { min: -7, max: 7 },
      y: { min: -8, max: 0 },
      speedY: { min: -10, max: -4 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffffff, 0xfff3b0, 0xffd34d],
      lifespan: 700,
      frequency: 140,
      blendMode: Phaser.BlendModes.ADD,
    });
    const tweens = [
      scene.tweens.add({ targets: glow, alpha: 0.1, scale: 1.35, duration: 750, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }),
      scene.tweens.add({ targets: image, angle: { from: -6, to: 6 }, duration: 1300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" }),
    ];
    this.crown = { image, glow, sparkles, tweens };
    this.setPosition(this.rawX, this.rawY);
  }

  /** A bouncing "GM" over game masters' names. */
  setGmTag(on: boolean) {
    if (on === !!this.gmTag) return;
    if (!on) {
      this.gmTag!.tween.stop();
      this.gmTag!.text.destroy();
      this.gmTag = undefined;
      return;
    }
    const scene = this.sprite.scene;
    const text = scene.add
      .text(0, 0, "GM", {
        fontFamily: '"Cloister Black TR", serif',
        fontSize: "6px",
        color: "#e6c46a",
        stroke: "#3a1a0a",
        strokeThickness: 1,
      })
      .setOrigin(0.5, 1)
      .setResolution(10);
    // A steady little bounce, never far from the name.
    const bounce = { y: 0 };
    const tween = scene.tweens.add({
      targets: bounce,
      y: -2,
      duration: 320,
      yoyo: true,
      repeat: -1,
      ease: "Quad.easeOut",
      onUpdate: () => this.setPosition(this.rawX, this.rawY),
    });
    this.gmTag = { text, bounce, tween };
    this.setPosition(this.rawX, this.rawY);
  }

  /** Stacks the crown and the GM tag above the name (or the head when there's no name). */
  private layoutOverhead(px: number, py: number, top: number) {
    if (!this.crown && !this.gmTag) return;
    let y = this.label ? this.label.y - this.label.displayHeight + 1 : top - 2;
    const depth = 100000 + py + 0.2;
    if (this.crown) {
      this.crown.image.setPosition(px, y).setDepth(depth + 0.1);
      this.crown.glow.setPosition(px, y - 4).setDepth(depth);
      this.crown.sparkles.setPosition(px, y).setDepth(depth + 0.2);
      y -= 10;
    }
    // Snug on top of the name.
    if (this.gmTag) this.gmTag.text.setPosition(px, y + 2 + this.gmTag.bounce.y).setDepth(depth + 0.3);
  }

  setPosition(x: number, y: number) {
    this.rawX = x;
    this.rawY = y;
    // Snap to whole world pixels; at 3-4x zoom, fractional positions show up as jitter.
    const px = Math.round(x + this.offset.x);
    const py = Math.round(y + this.offset.y);
    const lift = this.lift();
    this.sprite.setPosition(px, py - lift);
    // Y-sort: things lower on screen draw in front.
    this.sprite.setDepth(py);
    if (this.horse) {
      // Seen from the front the horse's head is in front of the rider's legs.
      this.horse.setPosition(px, py).setDepth(this.facing === Direction.Down ? py + 0.3 : py - 0.2);
      this.gallopDust?.setDepth(py - 0.3);
    }
    const top = py - lift - this.set.height * this.scale;
    this.hpBar.setPosition(px - HP_BAR_WIDTH / 2, top - 4).setDepth(100000 + py);
    this.label?.setPosition(px, this.hpBarVisible ? top - 5 : top - 1).setDepth(100000 + py);
    this.layoutOverhead(px, py, top);
    this.weapon?.layout(px, py - lift, this.facing);
  }

  /**
   * Switches to a new look (e.g. armour put on or taken off). Pieces that were
   * removed visibly drop off the body; putting something on flashes the character.
   */
  setLook(appearance: Appearance) {
    const next = ensureSpriteSet(this.sprite.scene, appearance);
    if (next.key === this.set.key) return;
    const before: HumanoidGear | undefined = this.set.appearance.type === "humanoid" ? this.set.appearance.gear : undefined;
    const after: HumanoidGear | undefined = appearance.type === "humanoid" ? appearance.gear : undefined;
    this.set = next;
    this.sprite.anims.stop();
    this.sprite.setTexture(next.key, 0);

    if (!before || !after) return;
    let putOn = false;
    for (const part of ["head", "chest", "legs", "feet"] as const) {
      if (before[part] && before[part] !== after[part]) this.dropPiece(before[part]!, part);
      if (after[part] && before[part] !== after[part]) putOn = true;
    }
    if (putOn) this.flash();
  }

  /** An equipment icon pops off the body and tumbles to the ground. */
  private dropPiece(defId: string, part: keyof typeof BODY_PART_Y) {
    const def = ITEMS[defId];
    if (!def) return;
    const scene = this.sprite.scene;
    const piece = scene.add
      .sprite(Math.round(this.rawX), Math.round(this.rawY + BODY_PART_Y[part]), ensureItemTexture(scene, def), 0)
      .setScale(0.75)
      .setDepth(this.rawY + 30);
    const side = Math.random() < 0.5 ? -1 : 1;
    scene.tweens.chain({
      targets: piece,
      tweens: [
        { y: piece.y - 6, x: piece.x + side * 3, duration: 120, ease: "Quad.easeOut" },
        { y: piece.y + 10, x: piece.x + side * 8, angle: side * 140, alpha: 0, duration: 420, ease: "Quad.easeIn" },
      ],
      onComplete: () => piece.destroy(),
    });
  }

  /** Shows the equipped weapon (humanoids only). Rebuilt only when the item or glow tier changes. */
  private weaponHidden = false;

  setWeapon(defId: string, enhance: number) {
    const key = defId ? `${defId}:${glowTier(enhance)}` : "";
    if (key === this.weaponKey) return;
    const previous = this.weaponKey.split(":")[0];
    if (previous && previous !== defId) this.dropPiece(previous, "weapon");
    this.weaponKey = key;
    this.weapon?.destroy();
    this.weapon = defId ? new WeaponView(this.sprite.scene, defId, enhance) : undefined;
    this.weapon?.setAlpha(this.sprite.alpha);
    this.weapon?.setVisible(!this.weaponHidden);
    this.setPosition(this.rawX, this.rawY);
  }

  /** Puts the weapon away for a while (fishing: the hands hold the rod). */
  setWeaponHidden(hidden: boolean) {
    if (hidden === this.weaponHidden) return;
    this.weaponHidden = hidden;
    this.weapon?.setVisible(!hidden);
  }

  /** Attack animation; with a target it also turns to face it and draws a slash towards it. */
  playAttack(kind: SwingKind, target?: { x: number; y: number }) {
    const scene = this.sprite.scene;
    const color = SLASH_COLORS[kind];
    if (kind === "spin") {
      this.weapon?.spin();
      ringEffect(scene, this.rawX, this.rawY - 3, color, 30);
      return;
    }
    if (!target) return;
    const dx = target.x - this.rawX;
    const dy = target.y - this.rawY;
    const angle = Math.atan2(dy, dx);
    if (this.set.appearance.type === "humanoid") this.facing = directionToward(dx, dy, this.facing);

    if (this.weapon) {
      this.weapon.swingOnce(kind === "heavy");
    } else if (this.set.appearance.type === "image" && hasImageAnim(this.set.appearance.key, "attack")) {
      // Art sheets swing their own weapon; face the target first.
      if (dx !== 0) this.setAnimation(dx < 0 ? Direction.Left : Direction.Right, false);
      this.playAction("attack", 520);
    } else {
      this.lunge(dx, dy);
    }
    // Slash appears a little in front of the attacker, at chest height.
    const reach = 7;
    const len = Math.hypot(dx, dy) || 1;
    const heavy = kind === "heavy";
    slashEffect(scene, this.rawX + (dx / len) * reach, this.rawY - 6 + (dy / len) * reach, angle, color, heavy ? 16 : 12, heavy);
  }

  /** Quick hop towards the target and back (mobs and unarmed attackers). */
  lunge(dx: number, dy: number) {
    const len = Math.hypot(dx, dy) || 1;
    this.sprite.scene.tweens.add({
      targets: this.offset,
      x: (dx / len) * 4,
      y: (dy / len) * 4,
      duration: 70,
      yoyo: true,
      ease: "Quad.easeOut",
      onUpdate: () => this.setPosition(this.rawX, this.rawY),
    });
  }

  /** Image sprites: an action animation (jump, slide…) that overrides walk/idle until it ends. */
  private actionUntil = 0;

  playAction(name: string, durationMs: number) {
    if (this.set.appearance.type !== "image" || !hasImageAnim(this.set.appearance.key, name)) return;
    this.sprite.anims.play(`${this.set.key}-${name}`);
    this.actionUntil = this.sprite.scene.time.now + durationMs;
  }

  /** Vertical hop (art-asset bosses jumping): rise and hang until land() is called. */
  rise(height: number, durationMs: number) {
    this.sprite.scene.tweens.add({
      targets: this.offset,
      y: -height,
      duration: durationMs,
      ease: "Quad.easeOut",
      onUpdate: () => this.setPosition(this.rawX, this.rawY),
    });
  }

  land() {
    this.sprite.scene.tweens.killTweensOf(this.offset);
    this.sprite.scene.tweens.add({
      targets: this.offset,
      y: 0,
      duration: 130,
      ease: "Quad.easeIn",
      onUpdate: () => this.setPosition(this.rawX, this.rawY),
    });
  }

  setAnimation(dir: Direction, moving: boolean) {
    const { appearance, key } = this.set;
    this.facing = dir;
    if (appearance.type === "image") {
      // Sheets face right; flipping also mirrors the feet anchor.
      const meta = IMAGE_SPRITES[appearance.key].meta;
      if (dir === Direction.Left) this.sprite.setFlipX(true);
      else if (dir === Direction.Right) this.sprite.setFlipX(false);
      this.sprite.setOrigin(this.sprite.flipX ? 1 - meta.originX : meta.originX, meta.originY);
      if (this.sprite.scene.time.now < this.actionUntil) return;
      this.sprite.anims.play(`${key}-${moving ? "walk" : "idle"}`, true);
      return;
    }
    if (appearance.type === "chest" || appearance.type === "portal") return;
    if (appearance.type === "slime") {
      this.sprite.anims.timeScale = moving ? 2.5 : 1;
      return;
    }
    if (dir === Direction.Left) this.sprite.setFlipX(true);
    else if (dir === Direction.Right) this.sprite.setFlipX(false);

    if (appearance.type === "wolf") {
      if (moving) this.sprite.anims.play(`${key}-side`, true);
      else this.sprite.anims.stop();
      if (!moving) this.sprite.setFrame(0);
      return;
    }

    const name = dir === Direction.Up ? "up" : dir === Direction.Down ? "down" : "side";
    if (dir === Direction.Up || dir === Direction.Down) this.sprite.setFlipX(false);
    this.moving = moving;
    if (this.horse) {
      // The horse walks; the rider just sits.
      this.horse.setFlipX(dir === Direction.Left);
      if (moving) this.horse.anims.play(`${this.horseKey}-${name}`, true);
      else {
        this.horse.anims.stop();
        this.horse.setFrame(name === "up" ? HorseFrame.Up : name === "down" ? HorseFrame.Down : HorseFrame.Side);
      }
      moving = false;
    }
    if (moving) {
      this.sprite.anims.play(`${key}-${name}`, true);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(name === "up" ? HumanoidFrame.Up : name === "down" ? HumanoidFrame.Down : HumanoidFrame.Side);
    }
    this.setPosition(this.rawX, this.rawY);
  }

  setHealth(hp: number, maxHp: number, visible: boolean) {
    this.hpBarVisible = visible;
    this.hpBar.setVisible(visible);
    if (visible) {
      const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
      this.hpBar.clear();
      this.hpBar.fillStyle(0x000000, 0.8).fillRect(-1, -1, HP_BAR_WIDTH + 2, 4);
      this.hpBar.fillStyle(0x5a1a1a).fillRect(0, 0, HP_BAR_WIDTH, 2);
      this.hpBar.fillStyle(ratio > 0.3 ? 0x4cd964 : 0xe74c3c).fillRect(0, 0, Math.ceil(HP_BAR_WIDTH * ratio), 2);
    }
    this.setPosition(this.rawX, this.rawY);
  }

  private baseTint: number | null = null;
  /** Warm lamp light falling on it at night (a tint), and the shadow that light casts. */
  private lightTint: number | null = null;
  private lightShadow?: Phaser.GameObjects.Ellipse;

  /**
   * Night lighting: how much lamp light falls on it (0..1) and the way it falls (unit vector
   * from the light): the more light, the warmer it looks and the longer its shadow, cast away
   * from the lamp along the ground.
   */
  setLighting(amount: number, dx: number, dy: number) {
    const lit = amount > 0.03;
    const k = Math.min(1, amount);
    const tint = lit ? mixColor(0xffffff, 0xffbe78, Math.min(1, k * 1.1)) : null;
    if (tint !== this.lightTint) {
      this.lightTint = tint;
      this.restoreTint();
    }
    if (!lit || (dx === 0 && dy === 0)) {
      this.lightShadow?.setVisible(false);
      return;
    }
    const scene = this.sprite.scene;
    this.lightShadow ??= scene.add.ellipse(0, 0, 14, 5, 0x000000, 1);
    const len = 9 + 13 * k;
    const feetX = Math.round(this.rawX);
    const feetY = Math.round(this.rawY);
    this.lightShadow
      .setVisible(this.sprite.visible)
      .setPosition(feetX + dx * len * 0.5, feetY - 1 + dy * len * 0.3)
      .setSize(len, 5)
      .setRotation(Math.atan2(dy * 0.6, dx))
      .setAlpha(0.45 * k)
      .setDepth(feetY - 0.05);
  }

  /** Persistent colour tint (e.g. an enraged boss), restored after hit flashes. */
  setBaseTint(tint: number | null) {
    this.baseTint = tint;
    this.restoreTint();
  }

  private restoreTint() {
    if (!this.sprite.active) return;
    const tint = this.baseTint ?? this.lightTint;
    if (tint === null) this.sprite.clearTint();
    else this.sprite.setTint(tint);
  }

  /** Brief white flash when hit. */
  flash() {
    // Art sheets flinch (unless busy with an attack or the like).
    const { appearance } = this.set;
    if (appearance.type === "image" && hasImageAnim(appearance.key, "hurt") && this.sprite.scene.time.now >= this.actionUntil) this.playAction("hurt", 260);
    this.sprite.setTintFill(0xffffff);
    this.sprite.scene.time.delayedCall(70, () => this.restoreTint());
  }

  setVisible(visible: boolean) {
    this.sprite.setVisible(visible);
    this.horse?.setVisible(visible);
    this.crown?.image.setVisible(visible);
    this.crown?.glow.setVisible(visible);
    this.crown?.sparkles.setVisible(visible);
    this.gmTag?.text.setVisible(visible);
    this.label?.setVisible(visible);
    this.hpBar.setVisible(visible && this.hpBarVisible);
    this.weapon?.setVisible(visible && !this.weaponHidden);
  }

  private dimmed = false;
  private ghost = false;

  setDimmed(dimmed: boolean) {
    this.dimmed = dimmed;
    this.applyAlpha();
  }

  /** Half-transparent while protected (PvP spawn protection). */
  setGhost(ghost: boolean) {
    this.ghost = ghost;
    this.applyAlpha();
  }

  private applyAlpha() {
    const alpha = this.dimmed ? 0.4 : this.ghost ? 0.55 : 1;
    this.sprite.setAlpha(alpha);
    this.weapon?.setAlpha(alpha);
    this.horse?.setAlpha(alpha);
  }

  destroy(fade = false) {
    this.lightShadow?.destroy();
    this.gallopDust?.destroy();
    this.horse?.destroy();
    this.horse = undefined;
    this.setCrown(false);
    this.setGmTag(false);
    this.label?.destroy();
    this.hpBar.destroy();
    this.weapon?.destroy();
    if (fade && this.set.appearance.type === "image") {
      // Art-asset sprites play their death animation before fading out.
      const scene = this.sprite.scene;
      this.sprite.disableInteractive();
      this.actionUntil = Infinity;
      this.sprite.anims.play(`${this.set.key}-dead`);
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () =>
        scene.tweens.add({ targets: this.sprite, alpha: 0, delay: 1500, duration: 800, onComplete: () => this.sprite.destroy() }),
      );
      return;
    }
    if (!fade) {
      this.sprite.destroy();
      return;
    }
    this.sprite.disableInteractive();
    this.sprite.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      duration: 400,
      onComplete: () => this.sprite.destroy(),
    });
  }
}

/** a mixed towards b by t (0..1), per colour channel. */
function mixColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) + ((((b >> shift) & 255) - ((a >> shift) & 255)) * t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
