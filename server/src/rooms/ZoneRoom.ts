import { Client, Room, ServerError } from "@colyseus/core";
import {
  CLOSE_LOGGED_IN_ELSEWHERE,
  distance,
  HOME_ZONE,
  isZoneId,
  loginZone,
  MAX_PARTY_SIZE,
  PORTAL_RANGE,
  ZONES,
  type TransferEvent,
  type UsePortalMessage,
  type UseTownPortalMessage,
  type SkillRankMessage,
  type ZoneDef,
  isAxis,
  Msg,
  TICK_MS,
  type InputMessage,
  EQUIP_SLOTS,
  type BuyMessage,
  type EquipSlot,
  type JoinOptions,
  type MoveItemMessage,
  type PickupLootMessage,
  type SellMessage,
  type SetTargetMessage,
  type SlotRef,
  type UnequipMessage,
  type UpgradeMessage,
  type UseItemMessage,
  type UseSkillMessage,
  type StallBrowseMessage,
  type StallBuyMessage,
  type StallOpenMessage,
  type QuestMessage,
} from "../../../shared/src";
import { config } from "../config";
import { accountForToken, type Account } from "../db/accounts";
import { loadCharacter, saveCharacters, type CharacterSave } from "../db/characters";
import { respawn, setTarget, useSkill } from "../game/combat";
import { Game } from "../game/Game";
import { buy, moveItem, pickupLoot, sell, unequip, useItem } from "../game/items";
import { upgradeItem } from "../game/upgrade";
import { browseStall, buyFromStall, closeStall, openStall, stallLocked } from "../game/market";
import { abandonQuest, acceptQuest, turnInQuest } from "../game/quests";
import { handleChat } from "../game/chat";
import { notice, sendInventory } from "../game/items";
import { forgetInstance, instanceFor, refreshFor, registerInstance, respond, sameParty } from "../game/party";
import { claimCharacter } from "../game/presence";
import { consumeTicket, issueTicket } from "../game/tickets";
import { onlineCharacters } from "../game/registry";
import { TownPortal, WorldState } from "./schema/WorldState";
import { changeRank, resetRanks } from "../game/talents";
import { readFortune } from "../game/fortune";
import {
  closeTownPortal,
  isPortalRoom,
  onTownPortalsChanged,
  openTownPortal,
  portalsIn,
  roomHasPortal,
  townPortalOf,
} from "../game/townPortal";

/** A town portal survives a logout this long (the player may just be changing zones). */
const TOWN_PORTAL_LOGOUT_GRACE_MS = 20_000;

// One room = one running zone: the shared open world, or a private dungeon instance.
// The room is only the network boundary: it authenticates, validates incoming
// messages, forwards them to the Game and persists characters. Never trust anything a client sends.

interface AuthData {
  account: Account;
  characterId: number;
  /** From the portal ticket: where to appear in this zone. */
  arriveAt?: { x: number; y: number };
}

export class ZoneRoom extends Room<WorldState> {
  maxClients = 100;
  state = new WorldState();

  private game!: Game;
  private zone!: ZoneDef;
  /** sessionId -> releases the character claim after the final save. */
  private releases = new Map<string, () => void>();
  private saveQueue: Promise<void> = Promise.resolve();
  private stopPortalSync: (() => void) | null = null;
  /** Instances: kept alive (autoDispose off) because a town portal leads here. */
  private keptForPortal = false;

  onCreate(options: { zoneId?: string }) {
    if (!isZoneId(options.zoneId)) throw new Error(`unknown zone ${options.zoneId}`);
    this.zone = ZONES[options.zoneId];
    // Instances belong to one party.
    this.maxClients = this.zone.instanced ? MAX_PARTY_SIZE : 100;
    this.game = new Game(
      this.state,
      {
        broadcast: (type, message) => this.broadcast(type, message),
        send: (sessionId, type, message) => this.clients.getById(sessionId)?.send(type, message),
        persist: (sessionIds) => void this.save(...sessionIds),
        transfer: (sessionId, zone, arriveAt) => {
          const runtime = this.game.playerRuntime.get(sessionId);
          const client = this.clients.getById(sessionId);
          if (!runtime || !client) return;
          closeStall(this.game, sessionId);
          client.send(Msg.Transfer, { zone, ticket: issueTicket(runtime.characterId, zone, arriveAt) } satisfies TransferEvent);
        },
      },
      this.zone,
    );

    this.onMessage(Msg.Input, (client, message) => {
      if (isValidInput(message)) this.game.queueInput(client.sessionId, message);
    });
    this.onMessage(Msg.SetTarget, (client, message: Partial<SetTargetMessage>) => {
      const targetId = typeof message?.targetId === "string" ? message.targetId : null;
      setTarget(this.game, client.sessionId, targetId, message?.attack === true);
    });
    this.onMessage(Msg.UseSkill, (client, message: Partial<UseSkillMessage>) => {
      if (typeof message?.skillId === "string") useSkill(this.game, client.sessionId, message.skillId);
    });
    this.onMessage(Msg.Respawn, (client) => respawn(this.game, client.sessionId));

    this.onMessage(Msg.MoveItem, (client, message: Partial<MoveItemMessage>) => {
      if (stallLocked(this.game, client.sessionId)) return;
      const from = parseSlotRef(message?.from);
      const to = parseSlotRef(message?.to);
      if (from && to) moveItem(this.game, client.sessionId, from, to);
    });
    this.onMessage(Msg.UseItem, (client, message: Partial<UseItemMessage>) => {
      if (stallLocked(this.game, client.sessionId)) return;
      const index = typeof message?.index === "number" ? message.index : undefined;
      const defId = typeof message?.defId === "string" ? message.defId : undefined;
      useItem(this.game, client.sessionId, index, defId);
    });
    this.onMessage(Msg.Unequip, (client, message: Partial<UnequipMessage>) => {
      if (stallLocked(this.game, client.sessionId)) return;
      if (EQUIP_SLOTS.includes(message?.slot as EquipSlot)) unequip(this.game, client.sessionId, message.slot!);
    });
    this.onMessage(Msg.PickupLoot, (client, message: Partial<PickupLootMessage>) => {
      if (stallLocked(this.game, client.sessionId)) return;
      if (typeof message?.lootId === "string") pickupLoot(this.game, client.sessionId, message.lootId);
    });
    this.onMessage(Msg.Buy, (client, message: Partial<BuyMessage>) => {
      if (stallLocked(this.game, client.sessionId)) return;
      if (typeof message?.npcId === "string" && typeof message.itemId === "string") {
        buy(this.game, client.sessionId, message.npcId, message.itemId, Number(message.qty));
      }
    });
    this.onMessage(Msg.Sell, (client, message: Partial<SellMessage>) => {
      if (stallLocked(this.game, client.sessionId)) return;
      if (typeof message?.npcId === "string" && typeof message.index === "number") {
        sell(this.game, client.sessionId, message.npcId, message.index);
      }
    });
    this.onMessage(Msg.Upgrade, (client, message: Partial<UpgradeMessage>) => {
      if (stallLocked(this.game, client.sessionId)) return;
      if (typeof message?.npcId === "string" && typeof message.uid === "string") {
        upgradeItem(this.game, client.sessionId, message.npcId, message.uid, message.protect === true);
      }
    });
    this.onMessage(Msg.Ping, (client, sentAt) => client.send(Msg.Pong, sentAt));
    this.onMessage(Msg.Chat, (client, message: { text?: unknown }) => handleChat(this.game, client.sessionId, message?.text));
    this.onMessage(Msg.RequestInventory, (client) => sendInventory(this.game, client.sessionId));
    this.onMessage(Msg.PartyRespond, (client, message: { accept?: unknown }) => {
      const runtime = this.game.playerRuntime.get(client.sessionId);
      if (runtime) respond(runtime.characterId, message?.accept === true);
    });
    this.onMessage(Msg.StallOpen, (client, message: Partial<StallOpenMessage>) =>
      openStall(this.game, client.sessionId, message?.title, message?.items),
    );
    this.onMessage(Msg.StallClose, (client) => closeStall(this.game, client.sessionId, "Pazar kapandı"));
    this.onMessage(Msg.StallBrowse, (client, message: Partial<StallBrowseMessage>) => {
      if (typeof message?.sellerId === "string") browseStall(this.game, client.sessionId, message.sellerId);
    });
    this.onMessage(Msg.StallBuy, (client, message: Partial<StallBuyMessage>) => {
      if (typeof message?.sellerId === "string" && typeof message.uid === "string") {
        buyFromStall(this.game, client.sessionId, message.sellerId, message.uid, message.qty, message.price);
      }
    });
    this.onMessage(Msg.QuestAccept, (client, message: Partial<QuestMessage>) => {
      if (typeof message?.questId === "string") acceptQuest(this.game, client.sessionId, message.questId, message.npcId);
    });
    this.onMessage(Msg.QuestTurnIn, (client, message: Partial<QuestMessage>) => {
      if (stallLocked(this.game, client.sessionId)) return;
      if (typeof message?.questId === "string") turnInQuest(this.game, client.sessionId, message.questId, message.npcId);
    });
    this.onMessage(Msg.QuestAbandon, (client, message: Partial<QuestMessage>) => {
      if (typeof message?.questId === "string") abandonQuest(this.game, client.sessionId, message.questId);
    });
    this.onMessage(Msg.UsePortal, (client, message: Partial<UsePortalMessage>) => {
      if (typeof message?.portalId === "string") this.usePortal(client, message.portalId);
    });
    this.onMessage(Msg.OpenTownPortal, (client) => this.openTownPortal(client));
    this.onMessage(Msg.SkillRank, (client, message: Partial<SkillRankMessage>) => {
      if (typeof message?.id === "string" && (message.delta === 1 || message.delta === -1)) changeRank(this.game, client.sessionId, message.id, message.delta);
    });
    this.onMessage(Msg.SkillReset, (client) => resetRanks(this.game, client.sessionId));
    this.onMessage(Msg.ReadFortune, (client, message: { npcId?: unknown }) => {
      if (typeof message?.npcId === "string") readFortune(this.game, client.sessionId, message.npcId);
    });
    this.onMessage(Msg.UseTownPortal, (client, message: Partial<UseTownPortalMessage>) => {
      if (typeof message?.portalId === "string") this.useTownPortal(client, message.portalId);
    });
    this.stopPortalSync = onTownPortalsChanged(() => this.syncTownPortals());
    this.syncTownPortals();

    // Fixed-step simulation driven by real elapsed time. Timers fire late (on Windows a
    // 50 ms interval runs every ~60 ms), so run as many ticks as time has passed;
    // otherwise game time drifts behind the clients, which also tick at real 20 Hz.
    let pending = 0;
    this.setSimulationInterval((deltaMs) => {
      pending = Math.min(pending + deltaMs, TICK_MS * 5);
      while (pending >= TICK_MS) {
        this.game.tick();
        pending -= TICK_MS;
      }
    }, TICK_MS / 2);
    this.clock.setInterval(() => this.saveAll(), config.autosaveIntervalMs);
  }

  async onAuth(_client: Client, options: Partial<JoinOptions>): Promise<AuthData> {
    const token = typeof options?.token === "string" ? options.token : "";
    const characterId = Number(options?.characterId);
    const account = token ? await accountForToken(token) : null;
    if (!account) throw new ServerError(401, "Oturum geçersiz, tekrar giriş yap");
    if (!Number.isSafeInteger(characterId)) throw new ServerError(400, "Karakter seçilmedi");
    // Ownership check up front so a bad request never enters the room. onJoin loads it again after the claim.
    const character = await loadCharacter(characterId, account.id);
    if (!character) throw new ServerError(404, "Karakter bulunamadı");
    // Logging in puts you in town or back in the persistent zone you left; anything else needs a portal ticket.
    const ticket = typeof options.ticket === "string" ? consumeTicket(options.ticket, characterId, this.zone.id) : null;
    if (!ticket && this.zone.id !== HOME_ZONE && this.zone.id !== loginZone(character.zone)) {
      throw new ServerError(403, "Buraya ancak giriş kapısından girilebilir");
    }
    // A dungeon instance someone is already in only admits their party members.
    if (this.zone.instanced) {
      const inside = [...this.game.playerRuntime.values()].map((r) => r.characterId);
      if (inside.length > 0 && !inside.some((id) => sameParty(id, characterId))) {
        throw new ServerError(403, "Bu zindan başka bir gruba ait");
      }
    }
    return { account, characterId, arriveAt: ticket?.arriveAt };
  }

  async onJoin(client: Client, _options: unknown, auth: AuthData) {
    const release = await claimCharacter(auth.characterId, () =>
      client.leave(CLOSE_LOGGED_IN_ELSEWHERE, "Bu karaktere başka bir yerden giriş yapıldı"),
    );
    try {
      // Loaded after the claim, so a kicked previous session has already saved.
      const character = await loadCharacter(auth.characterId, auth.account.id);
      if (!character) throw new ServerError(404, "Karakter bulunamadı");
      this.game.addPlayer(client.sessionId, character, auth.arriveAt);
      // Entering any map other than town or the portal's own closes the town portal.
      const portal = townPortalOf(character.id);
      if (portal && this.zone.id !== HOME_ZONE && !isPortalRoom(portal, this.zone.id, this.roomId, this.zone.instanced)) {
        closeTownPortal(character.id);
      }
      onlineCharacters.set(character.id, { characterId: character.id, game: this.game, sessionId: client.sessionId, name: character.name });
      if (this.zone.instanced) registerInstance(character.id, this.zone.id, this.roomId);
      refreshFor(character.id);
      this.game.playerRuntime.get(client.sessionId)!.isAdmin = auth.account.isAdmin;
      this.releases.set(client.sessionId, release);
      console.log(`[${this.zone.id}] ${character.name} (${auth.account.username}) joined (${this.state.players.size} online)`);
    } catch (error) {
      release();
      throw error;
    }
  }

  async onLeave(client: Client) {
    const name = this.state.players.get(client.sessionId)?.name;
    const characterId = this.game.progressOf(client.sessionId)?.characterId;
    try {
      await this.save(client.sessionId);
    } finally {
      // Unregistered only after the final save, so a GM change can't slip between the two.
      if (characterId !== undefined) onlineCharacters.delete(characterId, client.sessionId);
      // Logged out (rather than changing zones): the town portal goes too.
      if (characterId !== undefined && townPortalOf(characterId)) {
        setTimeout(() => {
          if (!onlineCharacters.get(characterId)) closeTownPortal(characterId);
        }, TOWN_PORTAL_LOGOUT_GRACE_MS);
      }
      this.game.removePlayer(client.sessionId);
      this.releases.get(client.sessionId)?.();
      this.releases.delete(client.sessionId);
      console.log(`[${this.zone.id}] ${name} left (${this.state.players.size} online)`);
    }
  }

  /** Validates a portal use and hands the client a ticket for the destination zone. */
  private usePortal(client: Client, portalId: string) {
    const player = this.state.players.get(client.sessionId);
    const entry = this.game.progressOf(client.sessionId);
    const portal = this.zone.portals.find((p) => p.id === portalId);
    if (!player || !entry || !portal || player.dead) return;
    if (distance(player, portal) > PORTAL_RANGE) return notice(this.game, client.sessionId, "Çok uzak");
    if (portal.requiresClear && !this.state.cleared) return notice(this.game, client.sessionId, "Portal henüz kapalı");
    if (portal.minLevel && player.level < portal.minLevel) {
      return notice(this.game, client.sessionId, `${portal.label} için seviye ${portal.minLevel} gerekli`);
    }
    // Coming back out of the dungeon puts the player just in front of this portal.
    if (portal.returnTo) {
      player.x = portal.returnTo.x;
      player.y = portal.returnTo.y;
    }
    // Party already inside this dungeon: join their instance instead of opening a new one.
    const roomId = ZONES[portal.to].instanced ? instanceFor(entry.characterId, portal.to) : undefined;
    closeStall(this.game, client.sessionId);
    const ticket = issueTicket(entry.characterId, portal.to, portal.arriveAt);
    client.send(Msg.Transfer, { zone: portal.to, ticket, roomId } satisfies TransferEvent);
  }

  onDispose() {
    this.stopPortalSync?.();
    forgetInstance(this.roomId);
  }

  /** T: a portal to town right where the player stands (replacing their previous one). */
  private openTownPortal(client: Client) {
    const player = this.state.players.get(client.sessionId);
    const runtime = this.game.playerRuntime.get(client.sessionId);
    if (!player || !runtime || player.dead) return;
    if (this.zone.id === HOME_ZONE) return notice(this.game, client.sessionId, "Zaten Ana Merkez'desin");
    openTownPortal({ characterId: runtime.characterId, owner: player.name, zone: this.zone.id, roomId: this.roomId, x: player.x, y: player.y });
    notice(this.game, client.sessionId, "Şehir portalı açıldı", "#74c0fc");
  }

  private useTownPortal(client: Client, portalId: string) {
    const player = this.state.players.get(client.sessionId);
    const runtime = this.game.playerRuntime.get(client.sessionId);
    const view = this.state.townPortals.get(portalId);
    const entry = runtime ? townPortalOf(runtime.characterId) : undefined;
    if (!player || !runtime || !view || player.dead) return;
    if (!entry || !portalId.startsWith(`${runtime.characterId}:`)) return notice(this.game, client.sessionId, "Bu portal senin değil");
    if (distance(player, view) > PORTAL_RANGE) return notice(this.game, client.sessionId, "Çok uzak");
    closeStall(this.game, client.sessionId);
    const transfer: TransferEvent = view.back
      ? {
          zone: entry.zone,
          ticket: issueTicket(runtime.characterId, entry.zone, { x: entry.x, y: entry.y }),
          roomId: ZONES[entry.zone].instanced ? entry.roomId : undefined,
        }
      : { zone: HOME_ZONE, ticket: issueTicket(runtime.characterId, HOME_ZONE, entry.townSpot) };
    client.send(Msg.Transfer, transfer);
  }

  /** Mirrors the town portals that stand in this room into the synced state. */
  private syncTownPortals() {
    const placed = portalsIn(this.zone.id, this.roomId, this.zone.instanced);
    const keys = new Set(placed.map((p) => p.key));
    for (const key of [...this.state.townPortals.keys()]) if (!keys.has(key)) this.state.townPortals.delete(key);
    for (const p of placed) {
      const current = this.state.townPortals.get(p.key);
      if (current && current.x === p.x && current.y === p.y) continue;
      const portal = new TownPortal();
      portal.owner = p.entry.owner;
      portal.x = p.x;
      portal.y = p.y;
      portal.to = p.back ? p.entry.zone : HOME_ZONE;
      portal.back = p.back;
      this.state.townPortals.set(p.key, portal);
    }
    // An instance with a portal into it stays open while its players are away.
    if (this.zone.instanced) {
      const keep = roomHasPortal(this.roomId);
      this.autoDispose = !keep;
      // Kept open only for a portal that has now closed: nobody is coming back.
      if (!keep && this.keptForPortal && this.clients.length === 0) void this.disconnect();
      this.keptForPortal = keep;
    }
  }

  /**
   * Saves the given players together in one transaction. Saves run one after another:
   * two overlapping saves of the same character (autosave + trade) would fight over its item rows.
   */
  private save(...sessionIds: string[]): Promise<void> {
    // Snapshot now; the queue keeps snapshots in order, so a later save is never overwritten by an older one.
    const entries = sessionIds.map((id) => this.game.progressOf(id)).filter((e): e is CharacterSave => e !== null);
    if (entries.length === 0) return this.saveQueue;
    this.saveQueue = this.saveQueue.then(() =>
      saveCharacters(entries).catch((error) =>
        console.error(`[${this.zone.id}] failed to save characters ${entries.map((e) => e.characterId).join(", ")}:`, error),
      ),
    );
    return this.saveQueue;
  }

  private async saveAll() {
    await Promise.all([...this.state.players.keys()].map((sessionId) => this.save(sessionId)));
  }
}

function parseSlotRef(value: unknown): SlotRef | null {
  if (typeof value !== "object" || value === null) return null;
  const ref = value as Record<string, unknown>;
  if (ref.area === "inv" && typeof ref.index === "number") return { area: "inv", index: ref.index };
  if (ref.area === "equip" && EQUIP_SLOTS.includes(ref.slot as EquipSlot)) return { area: "equip", slot: ref.slot as EquipSlot };
  if (ref.area === "passive" && typeof ref.socket === "number" && (ref.minor === null || typeof ref.minor === "number")) {
    return { area: "passive", socket: ref.socket, minor: ref.minor };
  }
  return null;
}

function isValidInput(message: unknown): message is InputMessage {
  if (typeof message !== "object" || message === null) return false;
  const m = message as Record<string, unknown>;
  return (
    Number.isSafeInteger(m.seq) &&
    (m.seq as number) > 0 &&
    isAxis(m.dx) &&
    isAxis(m.dy) &&
    (m.dx !== 0 || m.dy !== 0)
  );
}
