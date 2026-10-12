import { classOf, Direction, EQUIP_SLOTS, glowTier, ITEMS, type Appearance, type EquipSlot, type ItemView } from "../../../shared/src";
import { iconUrl, paintIcon } from "../gfx/icons";
import { frameSize, HumanoidFrame, paintFrame } from "../gfx/textures";
import { BODY_PART_Y, HAND, isWeaponMirrored, weaponGrip } from "../gfx/weapons";

// Character preview in the inventory ("paper doll"): the player's sprite with
// everything they wear, drawn big. Click it (or ⟳) to turn the character around.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const dollEl = $("doll");
const bodyCanvas = $<HTMLCanvasElement>("doll-body");
const weaponCanvas = $<HTMLCanvasElement>("doll-weapon");
const bodyCtx = bodyCanvas.getContext("2d")!;
const weaponCtx = weaponCanvas.getContext("2d")!;

/** Canvas is SIZE x SIZE world pixels; the character stands with its feet at FEET. */
const SIZE = bodyCanvas.width;
const FEET = { x: Math.floor(SIZE / 2), y: SIZE - 3 };
const TURN_ORDER = [Direction.Down, Direction.Left, Direction.Up, Direction.Right];

let tunic = 0xffffff;
let cls = "warrior";
let facing = Direction.Down;
let equipment: Partial<Record<EquipSlot, ItemView>> = {};
let initialised = false;

$("doll-rotate").addEventListener("click", (event) => {
  event.stopPropagation();
  turn();
});
dollEl.addEventListener("click", turn);

function turn() {
  facing = TURN_ORDER[(TURN_ORDER.indexOf(facing) + 1) % TURN_ORDER.length];
  render();
}

/** The player's tunic colour and class (class decides the headwear). */
export function setDollLook(color: number, classId: string) {
  tunic = color;
  cls = classId;
  render();
}

/** Call with every inventory snapshot; animates pieces being taken off or put on. */
export function updateDoll(next: Partial<Record<EquipSlot, ItemView>>) {
  if (initialised) {
    let putOn = false;
    for (const slot of EQUIP_SLOTS) {
      const before = equipment[slot];
      const after = next[slot];
      if (before && before.uid !== after?.uid) dropPiece(before, slot);
      if (after && before?.uid !== after.uid) putOn = true;
    }
    if (putOn) flash();
  }
  initialised = true;
  equipment = next;
  render();
}

function appearance(): Appearance {
  return {
    type: "humanoid",
    tunic,
    headwear: classOf(cls).headwear,
    gear: {
      head: equipment.head?.defId,
      chest: equipment.chest?.defId,
      legs: equipment.legs?.defId,
      feet: equipment.feet?.defId,
    },
  };
}

function render() {
  const look = appearance();
  const { width, height } = frameSize(look);
  const frame = facing === Direction.Up ? HumanoidFrame.Up : facing === Direction.Down ? HumanoidFrame.Down : HumanoidFrame.Side;
  const left = FEET.x - width / 2;
  const top = FEET.y - height;

  bodyCtx.clearRect(0, 0, SIZE, SIZE);
  bodyCtx.save();
  if (facing === Direction.Left) {
    // Side frames face right; mirror the whole canvas for left.
    bodyCtx.translate(SIZE, 0);
    bodyCtx.scale(-1, 1);
  }
  paintFrame(bodyCtx, look, frame, facing === Direction.Left ? SIZE - left - width : left, top);
  bodyCtx.restore();

  weaponCtx.clearRect(0, 0, SIZE, SIZE);
  const weapon = equipment.weapon;
  const def = weapon && ITEMS[weapon.defId];
  weaponCanvas.className = "";
  if (weapon && def) {
    const mirrored = isWeaponMirrored(facing);
    const hand = HAND[facing];
    const grip = weaponGrip(def.icon.shape);
    const gripX = (mirrored ? 1 - grip.x : grip.x) * 12;
    const gripY = grip.y * 12;
    paintIcon(weaponCtx, def.icon.shape, def.icon.color, Math.round(FEET.x + hand.x - gripX), mirrored, Math.round(FEET.y + hand.y - gripY));
    const tier = glowTier(weapon.enhance);
    if (tier) weaponCanvas.classList.add(`glow-${tier}`);
    // Seen from behind, the weapon is behind the body.
    if (facing === Direction.Up) weaponCanvas.classList.add("behind");
  }
}

/** The removed piece's icon pops off the body and falls out of the frame. */
function dropPiece(item: ItemView, slot: EquipSlot) {
  const def = ITEMS[item.defId];
  if (!def) return;
  const scale = dollEl.clientWidth / SIZE;
  const img = document.createElement("img");
  img.className = "doll-drop";
  img.src = iconUrl(def.icon.shape, def.icon.color);
  img.style.left = `${FEET.x * scale}px`;
  img.style.top = `${(FEET.y + BODY_PART_Y[slot]) * scale}px`;
  img.style.setProperty("--spin", `${Math.random() < 0.5 ? -1 : 1}`);
  img.addEventListener("animationend", () => img.remove());
  dollEl.append(img);
}

function flash() {
  dollEl.classList.remove("equip-flash");
  void dollEl.offsetWidth; // restart the animation
  dollEl.classList.add("equip-flash");
}
