import Phaser from "phaser";
import { classOf, CLASSES, Direction, MAX_CHARACTERS_PER_ACCOUNT, TILE_SIZE, zoneLayout, type Appearance, type CharacterSummary, type ClassId, type CharacterLook } from "../../../shared/src";
import { EntityView } from "../entities/EntityView";
import { drawDecor } from "../gfx/decor";
import { createTileset, renderTiles, TILESET_KEY } from "../gfx/textures";

// The login / character select / character creation backdrop: the keep's forecourt in Ana
// Merkez, drawn with the real town map. The DOM panels (ui/lobby.ts) sit on top; this scene
// only shows the characters standing in front of the keep, Metin2 style, and the big
// rotating preview while a new character is being made.

/** Where the characters stand (tile coordinates), left to right: the keep's forecourt, between the lamps. */
const SLOTS = [
  { tx: 28, ty: 20.5 },
  { tx: 32.5, ty: 20.5 },
  { tx: 37, ty: 20.5 },
];
const PREVIEW = { tx: 32.5, ty: 20.8 };
const TURN_ORDER = [Direction.Down, Direction.Left, Direction.Up, Direction.Right];
const TURN_MS = 1800;

/** A character's appearance as the lobby draws it (look + gear + class headwear). */
export function summaryAppearance(c: Pick<CharacterSummary, "class" | "color" | "look"> & { gear?: CharacterSummary["gear"] }): Appearance {
  return {
    type: "humanoid",
    tunic: c.color,
    gender: c.look.gender,
    hairStyle: c.look.hairStyle,
    hair: c.look.hairColor,
    skin: c.look.skin,
    headwear: classOf(c.class).headwear,
    gear: {
      head: c.gear?.head || undefined,
      chest: c.gear?.chest || undefined,
      legs: c.gear?.legs || undefined,
      feet: c.gear?.feet || undefined,
    },
  };
}

interface Standing {
  view: EntityView;
  id: number | null;
}

export interface LobbyCallbacks {
  select(id: number): void;
  /** An empty slot was clicked. */
  create(): void;
}

export class LobbyScene extends Phaser.Scene {
  private standing: Standing[] = [];
  private ring!: Phaser.GameObjects.Graphics;
  private preview: EntityView | null = null;
  private previewKey = "";
  private facing = 0;
  private selectedId: number | null = null;
  private callbacks: LobbyCallbacks = { select: () => {}, create: () => {} };
  private mode: "select" | "create" | "idle" = "idle";
  /** Work asked for before create() ran. */
  private pending: (() => void)[] = [];
  private ready = false;

  constructor() {
    super("lobby");
  }

  create() {
    createTileset(this);
    const layout = zoneLayout("town");
    const tilemap = this.make.tilemap({ data: renderTiles(layout.map.tiles), tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    tilemap.createLayer(0, tilemap.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0)!, 0, 0)!.setDepth(-1);
    if (layout.decor) drawDecor(this, layout.decor);
    // Dusk over the castle: a warm-to-dark wash so the characters stand out.
    const dusk = this.add.graphics().setScrollFactor(0).setDepth(200000);
    const paintDusk = () => {
      dusk.clear();
      dusk.fillGradientStyle(0x1a0e06, 0x1a0e06, 0x000000, 0x000000, 0.35, 0.35, 0.05, 0.05);
      dusk.fillRect(0, 0, this.scale.width, this.scale.height * 0.5);
      dusk.fillStyle(0x000000, 0.18).fillRect(0, 0, this.scale.width, this.scale.height);
    };
    paintDusk();
    this.ring = this.add.graphics().setVisible(false);
    this.layoutCamera();
    const onResize = () => {
      paintDusk();
      this.layoutCamera();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
    this.time.addEvent({ delay: TURN_MS, loop: true, callback: () => this.turn() });
    this.ready = true;
    for (const fn of this.pending.splice(0)) fn();
  }

  private later(fn: () => void) {
    if (this.ready) fn();
    else this.pending.push(fn);
  }

  /** About 16 tiles of height on screen: the keep behind, the characters in front. */
  private zoom() {
    return Math.max(2, Math.floor(this.scale.height / 260));
  }

  private layoutCamera() {
    const camera = this.cameras.main;
    camera.setZoom(this.zoom());
    camera.setRoundPixels(true);
    const target = this.mode === "create" ? PREVIEW : SLOTS[1];
    // Panels cover the left part of the screen: push the scene right so the characters show.
    const panel = this.scale.width > 900 ? 360 : 0;
    // The characters stand in the lower half, the keep rises behind them.
    camera.centerOn((target.tx + 0.5) * TILE_SIZE - panel / 2 / camera.zoom, (target.ty - 3.2) * TILE_SIZE);
  }

  setCallbacks(callbacks: LobbyCallbacks) {
    this.callbacks = callbacks;
  }

  /** Character select: everyone standing in a row; empty slots invite a new character. */
  showCharacters(characters: CharacterSummary[], selectedId: number | null) {
    this.later(() => {
      this.mode = "select";
      this.clear();
      this.layoutCamera();
      SLOTS.forEach((slot, i) => {
        const character = characters[i];
        const x = slot.tx * TILE_SIZE;
        const y = slot.ty * TILE_SIZE;
        if (!character) {
          if (i >= MAX_CHARACTERS_PER_ACCOUNT) return;
          const ghost = new EntityView(this, x, y, { type: "humanoid", tunic: 0x444444, hair: 0x333333, skin: 0x555555 }, "Boş", "#9a8a70", 3);
          ghost.sprite.setAlpha(0.28).setTint(0x111111);
          ghost.sprite.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.callbacks.create());
          this.standing.push({ view: ghost, id: null });
          return;
        }
        const view = new EntityView(this, x, y, summaryAppearance(character), character.name, "#ffffff", 3);
        view.setWeapon(character.gear.weapon, character.gear.weaponPlus);
        view.setAnimation(Direction.Down, false);
        view.sprite.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.callbacks.select(character.id));
        this.standing.push({ view, id: character.id });
      });
      this.select(selectedId);
    });
  }

  select(id: number | null) {
    this.later(() => {
      this.selectedId = id;
      this.facing = 0;
      for (const { view, id: cid } of this.standing) {
        if (cid === null) continue;
        const chosen = cid === id;
        view.setNameColor(chosen ? "#ffd34d" : "#cfc6b4");
        // The others step back into the shade.
        view.setBaseTint(!chosen && id !== null ? 0x8a8478 : null);
        view.setAnimation(Direction.Down, false);
      }
      const chosen = this.standing.find((s) => s.id === id && id !== null);
      this.ring.clear().setVisible(!!chosen);
      if (chosen) {
        this.ring
          .lineStyle(1, 0xffd34d, 0.95)
          .strokeEllipse(0, 0, 44, 14)
          .lineStyle(1, 0xffd34d, 0.4)
          .strokeEllipse(0, 0, 52, 18)
          .setPosition(Math.round(chosen.view.x), Math.round(chosen.view.y) - 1)
          .setDepth(chosen.view.y - 1);
      }
    });
  }

  /** Character creation: one big character in the middle that turns around. */
  showPreview(classId: ClassId, color: number, look: CharacterLook) {
    this.later(() => {
      if (this.mode !== "create") {
        this.mode = "create";
        this.clear();
        this.layoutCamera();
        this.facing = 0;
      }
      const appearance = summaryAppearance({ class: classId, color, look });
      const key = JSON.stringify(appearance);
      const weapon = CLASSES[classId].starterEquipment.weapon ?? "";
      if (!this.preview) {
        this.preview = new EntityView(this, PREVIEW.tx * TILE_SIZE, PREVIEW.ty * TILE_SIZE, appearance, undefined, "#ffffff", 4);
        this.ring
          .clear()
          .lineStyle(1, 0xffd34d, 0.9)
          .strokeEllipse(0, 0, 58, 18)
          .setPosition(Math.round(this.preview.x), Math.round(this.preview.y) - 1)
          .setDepth(this.preview.y - 1)
          .setVisible(true);
      } else if (key !== this.previewKey) {
        this.preview.setLook(appearance);
      }
      this.previewKey = key;
      this.preview.setWeapon(weapon, 0);
      this.preview.setAnimation(TURN_ORDER[this.facing], false);
    });
  }

  /** Turn the preview by hand (⟲ ⟳). */
  rotatePreview(step: 1 | -1) {
    this.facing = (this.facing + step + TURN_ORDER.length) % TURN_ORDER.length;
    this.preview?.setAnimation(TURN_ORDER[this.facing], false);
  }

  /** Just the backdrop (login screen). */
  showEmpty() {
    this.later(() => {
      this.mode = "idle";
      this.clear();
      this.layoutCamera();
    });
  }

  private turn() {
    this.facing = (this.facing + 1) % TURN_ORDER.length;
    if (this.mode === "create") this.preview?.setAnimation(TURN_ORDER[this.facing], false);
    else if (this.mode === "select") this.standing.find((s) => s.id === this.selectedId && s.id !== null)?.view.setAnimation(TURN_ORDER[this.facing], false);
  }

  private clear() {
    for (const { view } of this.standing) view.destroy();
    this.standing = [];
    this.preview?.destroy();
    this.preview = null;
    this.previewKey = "";
    this.ring?.setVisible(false);
  }
}

/** The lobby scene, started if it isn't running. */
export function lobbyScene(game: Phaser.Game): LobbyScene {
  const existing = game.scene.getScene("lobby") as LobbyScene | null;
  if (existing) return existing;
  const scene = new LobbyScene();
  game.scene.add("lobby", scene, true);
  return scene;
}

export function stopLobbyScene(game: Phaser.Game) {
  if (game.scene.getScene("lobby")) game.scene.remove("lobby");
}
