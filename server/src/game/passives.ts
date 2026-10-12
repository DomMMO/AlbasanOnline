import { fitsBigSocket, INVENTORY_SIZE, isGreaterSocket, ITEMS, MINOR_SOCKETS, PASSIVE_SOCKETS, socketUnlockLevel, unlockedSockets } from "../../../shared/src";
import type { Game } from "./Game";
import type { ItemStack, PassiveSocket } from "./inventory";
import { notice, refreshStats, sendInventory } from "./items";

// Socketing jewels into the passive tree (see shared/src/data/passives.ts for the rules).
// Jewels move between the bags and the tree freely; the tree's stats apply right away.

function context(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  return player && runtime && !player.dead ? { player, inv: runtime.inventory } : null;
}

function changed(game: Game, sessionId: string) {
  refreshStats(game, sessionId);
  sendInventory(game, sessionId);
}

const validSocket = (socket: unknown): socket is number => Number.isInteger(socket) && (socket as number) >= 0 && (socket as number) < PASSIVE_SOCKETS;
const validMinor = (minor: unknown): minor is number => Number.isInteger(minor) && (minor as number) >= 0 && (minor as number) < MINOR_SOCKETS;

/** Why a jewel can't go there, or null if it can. */
function socketProblem(level: number, socket: PassiveSocket, socketIndex: number, minor: number | null, stack: ItemStack): string | null {
  const kind = ITEMS[stack.defId]?.jewel;
  if (!kind) return "Pasif ağaca sadece mücevher takılır";
  if (level < socketUnlockLevel(socketIndex)) return `Bu slot seviye ${socketUnlockLevel(socketIndex)}'de açılır`;
  if (minor === null) {
    if (fitsBigSocket(kind, socketIndex)) return null;
    return kind === "greater" ? "Kadim Mücevher sadece Kadim Yuvalara (1, 6, 11 ve 16. yuvalar) takılır" : "Büyük slota Büyük ya da Kadim Mücevher takılır";
  }
  if (kind !== "minor") return "Küçük slota Küçük Mücevher takılır";
  if (!socket.major) return "Önce bu slota bir Büyük Mücevher tak";
  return null;
}

/** Bags -> tree. An occupied socket swaps its jewel back into the bag slot. */
export function socketJewel(game: Game, sessionId: string, index: number, socketIndex: number, minor: number | null) {
  const ctx = context(game, sessionId);
  if (!ctx || !Number.isInteger(index) || index < 0 || index >= INVENTORY_SIZE || !validSocket(socketIndex)) return;
  if (minor !== null && !validMinor(minor)) return;
  const stack = ctx.inv.slots[index];
  if (!stack) return;
  const socket = ctx.inv.passives[socketIndex];
  const problem = socketProblem(ctx.player.level, socket, socketIndex, minor, stack);
  if (problem) return notice(game, sessionId, problem);
  if (minor === null) {
    ctx.inv.slots[index] = socket.major;
    socket.major = stack;
  } else {
    ctx.inv.slots[index] = socket.minors[minor];
    socket.minors[minor] = stack;
  }
  changed(game, sessionId);
}

/** Right-click on a jewel in the bags: the first free socket it fits. */
export function autoSocket(game: Game, sessionId: string, index: number) {
  const ctx = context(game, sessionId);
  const stack = ctx?.inv.slots[index];
  const kind = stack && ITEMS[stack.defId]?.jewel;
  if (!ctx || !kind) return;
  const open = unlockedSockets(ctx.player.level);
  if (open === 0) return notice(game, sessionId, `Pasif ağacın ilk slotu seviye ${socketUnlockLevel(0)}'de açılır`);
  // Major jewels fill the plain sockets first and leave the greater ones for greater jewels.
  const order = [...Array(open).keys()].sort((a, b) => Number(isGreaterSocket(a)) - Number(isGreaterSocket(b)));
  for (const s of order) {
    const socket = ctx.inv.passives[s];
    if (kind !== "minor" && !socket.major && fitsBigSocket(kind, s)) return socketJewel(game, sessionId, index, s, null);
    if (kind === "minor" && socket.major) {
      const minor = socket.minors.indexOf(null);
      if (minor !== -1) return socketJewel(game, sessionId, index, s, minor);
    }
  }
  notice(
    game,
    sessionId,
    kind === "minor" ? "Boş küçük slot yok (önce büyük mücevher tak)" : kind === "greater" ? "Açık ve boş Kadim Yuva yok" : "Boş büyük slot yok",
  );
}

/** Tree -> bags (to a given slot, or the first free one). */
export function unsocketJewel(game: Game, sessionId: string, socketIndex: number, minor: number | null, toIndex?: number) {
  const ctx = context(game, sessionId);
  if (!ctx || !validSocket(socketIndex) || (minor !== null && !validMinor(minor))) return;
  const socket = ctx.inv.passives[socketIndex];
  const stack = minor === null ? socket.major : socket.minors[minor];
  if (!stack) return;
  if (minor === null && socket.minors.some((s) => s)) return notice(game, sessionId, "Önce bu slotun küçük mücevherlerini çıkar");
  const target = toIndex !== undefined && Number.isInteger(toIndex) && ctx.inv.slots[toIndex] === null ? toIndex : ctx.inv.slots.indexOf(null);
  if (target === -1 || target === undefined) return notice(game, sessionId, "Envanter dolu");
  ctx.inv.slots[target] = stack;
  if (minor === null) socket.major = null;
  else socket.minors[minor] = null;
  changed(game, sessionId);
}
