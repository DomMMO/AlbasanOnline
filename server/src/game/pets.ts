import {
  directionToward,
  distance,
  Msg,
  NPC_RANGE,
  NPCS,
  PET_COLLECT_RANGE,
  PET_FOLLOW_DISTANCE,
  PET_LEASH,
  PET_PICKUP_RANGE,
  PET_SPEED,
  PETS,
  TICK_MS,
  type ChatEvent,
  type PetStateEvent,
} from "../../../shared/src";
import { Pet } from "../rooms/schema/WorldState";
import type { Game } from "./Game";
import { collectLoot, mayLoot, notice, sendInventory } from "./items";

// Pets (shared/src/data/pets.ts): Petçi Nuri sells them; the one that is out follows its owner
// and fetches the loot the owner may take. It walks through walls and water (it hops), so it
// never gets stuck; the server moves it and the clients only draw it.

const PET_COLOR = "#8ce99a";

export function sendPetState(game: Game, sessionId: string) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime) return;
  game.io.send(sessionId, Msg.PetState, { ...runtime.pets } satisfies PetStateEvent);
}

/** Puts the active pet in the world next to its owner, or takes it away. */
export function syncPet(game: Game, sessionId: string) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  const kind = runtime?.pets.active ?? "";
  const current = game.state.pets.get(sessionId);
  if (current && current.kind === kind) return;
  if (current) game.state.pets.delete(sessionId);
  if (!player || !runtime || !kind) return;
  runtime.petTarget = null;
  const pet = new Pet();
  pet.kind = kind;
  pet.ownerId = sessionId;
  pet.x = player.x - PET_FOLLOW_DISTANCE / 2;
  pet.y = player.y;
  game.state.pets.set(sessionId, pet);
}

export function removePet(game: Game, sessionId: string) {
  game.state.pets.delete(sessionId);
}

function changed(game: Game, sessionId: string, line: string) {
  syncPet(game, sessionId);
  sendPetState(game, sessionId);
  notice(game, sessionId, line, PET_COLOR);
  game.io.send(sessionId, Msg.ChatMessage, { channel: "system", text: line } satisfies ChatEvent);
  game.io.persist([sessionId]);
}

export function buyPet(game: Game, sessionId: string, npcId: unknown, petId: unknown) {
  const player = game.state.players.get(sessionId);
  const runtime = game.playerRuntime.get(sessionId);
  const def = typeof petId === "string" ? PETS[petId] : undefined;
  const npc = typeof npcId === "string" ? NPCS[npcId] : undefined;
  if (!player || !runtime || !def || player.dead || !npc || npc.role !== "pet" || !game.zone.npcs.includes(npc.id)) return;
  if (distance(player, npc) > NPC_RANGE + 8) return notice(game, sessionId, "Çok uzak");
  if (runtime.pets.owned.includes(def.id)) return notice(game, sessionId, `${def.name} zaten senin`);
  const inv = runtime.inventory;
  if (inv.gold < def.price) return notice(game, sessionId, `${def.price.toLocaleString("tr-TR")} altın gerekli`);
  inv.gold -= def.price;
  runtime.pets = { owned: [...runtime.pets.owned, def.id], active: def.id };
  sendInventory(game, sessionId);
  changed(game, sessionId, `${def.name} artık senin! Peşine takıldı; kestiğin yaratıkların ganimetini toplayacak.`);
}

/** Calls an owned pet out (anywhere), or sends the one that is out home (petId ""). */
export function summonPet(game: Game, sessionId: string, petId: unknown) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime || typeof petId !== "string") return;
  if (petId === "") {
    if (!runtime.pets.active) return;
    const name = PETS[runtime.pets.active].name;
    runtime.pets = { ...runtime.pets, active: "" };
    return changed(game, sessionId, `${name} eve gönderildi.`);
  }
  if (!runtime.pets.owned.includes(petId) || runtime.pets.active === petId) return;
  runtime.pets = { ...runtime.pets, active: petId };
  changed(game, sessionId, `${PETS[petId].name} yanına geldi.`);
}

/** The /pet chat command: sends the pet that is out home, or calls the first one owned. */
export function togglePet(game: Game, sessionId: string) {
  const runtime = game.playerRuntime.get(sessionId);
  if (!runtime) return;
  if (runtime.pets.owned.length === 0) return notice(game, sessionId, "Henüz petin yok. Petçi Nuri, şehirde at çiftliğinin kapısında.");
  summonPet(game, sessionId, runtime.pets.active ? "" : runtime.pets.owned[0]);
}

export function updatePets(game: Game) {
  game.state.pets.forEach((pet, ownerId) => {
    const owner = game.state.players.get(ownerId);
    const runtime = game.playerRuntime.get(ownerId);
    if (!owner || !runtime) return game.state.pets.delete(ownerId);
    if (distance(pet, owner) > PET_LEASH) {
      pet.x = owner.x;
      pet.y = owner.y;
      runtime.petTarget = null;
    }
    const target = owner.dead ? null : lootToFetch(game, ownerId, pet);
    if (target) {
      const loot = game.state.loot.get(target)!;
      if (distance(pet, loot) <= PET_PICKUP_RANGE) {
        pet.moving = false;
        runtime.petTarget = null;
        // Bags full: leave the rest lying there instead of coming back for it every tick.
        if (!collectLoot(game, ownerId, target)) runtime.petSkips.add(target);
      } else {
        step(pet, loot, PET_SPEED);
      }
      return;
    }
    const gap = distance(pet, owner);
    if (gap > PET_FOLLOW_DISTANCE) step(pet, owner, gap > PET_FOLLOW_DISTANCE * 4 ? PET_SPEED * 2 : PET_SPEED);
    else pet.moving = false;
  });
}

/** The pile it is after (kept until gone), else the nearest one round the owner it may take. */
function lootToFetch(game: Game, ownerId: string, pet: Pet): string | null {
  const runtime = game.playerRuntime.get(ownerId)!;
  const owner = game.state.players.get(ownerId)!;
  const fetchable = (lootId: string) => {
    const loot = game.state.loot.get(lootId);
    const contents = game.lootContents.get(lootId);
    return !!loot && !!contents && !contents.dropped && !runtime.petSkips.has(lootId) && mayLoot(game, ownerId, loot) && distance(owner, loot) <= PET_COLLECT_RANGE;
  };
  if (runtime.petTarget && fetchable(runtime.petTarget)) return runtime.petTarget;
  for (const id of runtime.petSkips) if (!game.state.loot.has(id)) runtime.petSkips.delete(id);
  let best: string | null = null;
  let bestDist = Infinity;
  game.state.loot.forEach((loot, lootId) => {
    const d = distance(pet, loot);
    if (d < bestDist && fetchable(lootId)) {
      best = lootId;
      bestDist = d;
    }
  });
  runtime.petTarget = best;
  return best;
}

function step(pet: Pet, to: { x: number; y: number }, speed: number) {
  const dx = to.x - pet.x;
  const dy = to.y - pet.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return;
  const move = Math.min(speed * (TICK_MS / 1000), dist);
  pet.x += (dx / dist) * move;
  pet.y += (dy / dist) * move;
  pet.moving = true;
  pet.dir = directionToward(dx, dy, pet.dir);
}
