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
  type GatherMessage,
  type MapPingMessage,
  type ZoneDef,
  isAxis,
  Msg,
  TICK_MS,
  type InputMessage,
  type FriendRemoveMessage,
  type FriendRequestMessage,
  type FriendRespondMessage,
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
  type StorageGoldMessage,
  type StorageQuickMessage,
  type TradeOfferMessage,
  type DungeonInviteEvent,
  type DungeonRespondMessage,
  type PortalDef,
  DUNGEON_INVITE_MS,
  DUNGEON_INVITE_RANGE,
} from "../../../shared/src";
import { config } from "../config";
import { accountForToken, type Account } from "../db/accounts";
import { loadCharacter, saveCharacters, type CharacterSave } from "../db/characters";
import { respawn, setTarget, useSkill } from "../game/combat";
import { Game } from "../game/Game";
import { buy, moveItem, pickupLoot, sell, unequip, useItem } from "../game/items";
import { upgradeItem } from "../game/upgrade";
import { browseStall, buyFromStall, closeStall, openStall, stallLocked } from "../game/market";
import { abandonQuest, acceptQuest, talkForQuest, turnInQuest } from "../game/quests";
import { handleChat } from "../game/chat";
import { respondDuel } from "../game/duel";
import { notice, sendInventory } from "../game/items";
import { chooseClass, resetClass } from "../game/classPath";
import { buyHorse, selectHorse, styleHorse } from "../game/stable";
import { sitOnBench } from "../game/benches";
import { friendJoined, friendLeft, removeFriend, requestFriend, respondFriend } from "../game/friends";
import { forgetInstance, instanceFor, refreshFor, registerInstance, respond, sameParty } from "../game/party";
import { claimCharacter } from "../game/presence";
import { consumeTicket, issueTicket } from "../game/tickets";
import { onlineCharacters } from "../game/registry";
import { TownPortal, WorldState } from "./schema/WorldState";
import { changeRank } from "../game/talents";
import { startGather } from "../game/gathering";
import { isPingKind, sendPing } from "../game/pings";
import { sortBags } from "../game/items";
import { readFortune } from "../game/fortune";
import { quickStorage, storageGold } from "../game/storage";
import { stopFishing, toggleFishing } from "../game/fishing";
import { dismount, toggleMount } from "../game/mount";
import { cancelTrade, confirmTrade, lockOffer, respondTrade, setOffer, tradeLocked } from "../game/trade";
import {
  closeTownPortal,
  isPortalRoom,
  onTownPortalsChanged,
  openTownPortal,
  portalsIn,
  roomHasPortal,
  townPortalOf,
} from "../game/townPortal";

/** A player sent out of a dungeon (left the party) who hasn't gone after this long is disconnected. */
const EVICT_GRACE_MS = 8000;
/** How long someone accepting a party dungeon invite waits for the party's copy to open. */
const INSTANCE_WAIT_MS = 5000;

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
  /** sessionId -> a party member's "come along into the dungeon" waiting for an answer. */
  private dungeonInvites = new Map<string, { portalId: string; expiresAt: number }>();

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
        evict: (sessionId, zone) => {
          this.game.io.transfer(sessionId, zone);
          this.clock.setTimeout(() => this.clients.getById(sessionId)?.leave(), EVICT_GRACE_MS);
        },
      },
      this.zone,
    );

    this.onMessage(Msg.Input, (client, message) => {
      if (isValidInput(message)) this.game.queueInput(client.sessionId, message);
    });
    this.onMessage(Msg.SetTarget, (client, message: Partial<SetTargetMessage>) => {
      const targetId = typeof message?.targetId === "string" ? message.targetId : null;
      if (message?.attack === true) {
        stopFishing(this.game, client.sessionId, "Oltayı topladın");
        dismount(this.game, client.sessionId);
      }
      setTarget(this.game, client.sessionId, targetId, message?.attack === true);
    });
    this.onMessage(Msg.UseSkill, (client, message: Partial<UseSkillMessage>) => {
      if (typeof message?.skillId !== "string") return;
      stopFishing(this.game, client.sessionId, "Oltayı topladın");
      dismount(this.game, client.sessionId);
      const aim = message.aim;
      const validAim = aim && Number.isFinite(aim.x) && Number.isFinite(aim.y) ? { x: Number(aim.x), y: Number(aim.y) } : undefined;
      useSkill(this.game, client.sessionId, message.skillId, validAim);
    });
    this.onMessage(Msg.Respawn, (client) => respawn(this.game, client.sessionId));

    this.onMessage(Msg.MoveItem, (client, message: Partial<MoveItemMessage>) => {
      if (this.itemsLocked(client.sessionId)) return;
      const from = parseSlotRef(message?.from);
      const to = parseSlotRef(message?.to);
      if (from && to) moveItem(this.game, client.sessionId, from, to);
    });
    this.onMessage(Msg.UseItem, (client, message: Partial<UseItemMessage>) => {
      if (this.itemsLocked(client.sessionId)) return;
      const index = typeof message?.index === "number" ? message.index : undefined;
      const defId = typeof message?.defId === "string" ? message.defId : undefined;
      useItem(this.game, client.sessionId, index, defId);
    });
    this.onMessage(Msg.Unequip, (client, message: Partial<UnequipMessage>) => {
      if (this.itemsLocked(client.sessionId)) return;
      if (EQUIP_SLOTS.includes(message?.slot as EquipSlot)) unequip(this.game, client.sessionId, message.slot!);
    });
    this.onMessage(Msg.PickupLoot, (client, message: Partial<PickupLootMessage>) => {
      if (this.itemsLocked(client.sessionId)) return;
      if (typeof message?.lootId === "string") pickupLoot(this.game, client.sessionId, message.lootId);
    });
    this.onMessage(Msg.Buy, (client, message: Partial<BuyMessage>) => {
      if (this.itemsLocked(client.sessionId)) return;
      if (typeof message?.npcId === "string" && typeof message.itemId === "string") {
        buy(this.game, client.sessionId, message.npcId, message.itemId, Number(message.qty));
      }
    });
    this.onMessage(Msg.Sell, (client, message: Partial<SellMessage>) => {
      if (this.itemsLocked(client.sessionId)) return;
      if (typeof message?.npcId === "string" && typeof message.index === "number") {
        sell(this.game, client.sessionId, message.npcId, message.index);
      }
    });
    this.onMessage(Msg.Upgrade, (client, message: Partial<UpgradeMessage>) => {
      if (this.itemsLocked(client.sessionId)) return;
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
    this.onMessage(Msg.FriendRequest, (client, message: Partial<FriendRequestMessage>) => {
      const runtime = this.game.playerRuntime.get(client.sessionId);
      if (runtime && typeof message?.name === "string" && message.name.length <= 32) requestFriend(runtime.characterId, message.name);
    });
    this.onMessage(Msg.FriendRespond, (client, message: Partial<FriendRespondMessage>) => {
      const runtime = this.game.playerRuntime.get(client.sessionId);
      if (runtime && Number.isSafeInteger(message?.characterId)) respondFriend(runtime.characterId, message!.characterId!, message!.accept === true);
    });
    this.onMessage(Msg.FriendRemove, (client, message: Partial<FriendRemoveMessage>) => {
      const runtime = this.game.playerRuntime.get(client.sessionId);
      if (runtime && Number.isSafeInteger(message?.characterId)) removeFriend(runtime.characterId, message!.characterId!);
    });
    this.onMessage(Msg.DuelRespond, (client, message: { accept?: unknown }) => respondDuel(this.game, client.sessionId, message?.accept === true));
    this.onMessage(Msg.StallOpen, (client, message: Partial<StallOpenMessage>) => {
      if (!tradeLocked(this.game, client.sessionId)) openStall(this.game, client.sessionId, message?.title, message?.items);
    });
    this.onMessage(Msg.StallClose, (client) => closeStall(this.game, client.sessionId, "Pazar kapandı"));
    this.onMessage(Msg.StallBrowse, (client, message: Partial<StallBrowseMessage>) => {
      if (typeof message?.sellerId === "string") browseStall(this.game, client.sessionId, message.sellerId);
    });
    this.onMessage(Msg.StallBuy, (client, message: Partial<StallBuyMessage>) => {
      if (tradeLocked(this.game, client.sessionId)) return;
      if (typeof message?.sellerId === "string" && typeof message.uid === "string") {
        buyFromStall(this.game, client.sessionId, message.sellerId, message.uid, message.qty, message.price);
      }
    });
    this.onMessage(Msg.QuestAccept, (client, message: Partial<QuestMessage>) => {
      if (typeof message?.questId === "string") acceptQuest(this.game, client.sessionId, message.questId, message.npcId);
    });
    this.onMessage(Msg.QuestTurnIn, (client, message: Partial<QuestMessage>) => {
      if (this.itemsLocked(client.sessionId)) return;
      if (typeof message?.questId === "string") turnInQuest(this.game, client.sessionId, message.questId, message.npcId, message.answer);
    });
    this.onMessage(Msg.QuestTalk, (client, message: Partial<QuestMessage>) => {
      if (typeof message?.questId === "string") talkForQuest(this.game, client.sessionId, message.questId, message.npcId);
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
    this.onMessage(Msg.Gather, (client, message: Partial<GatherMessage>) => {
      if (stallLocked(this.game, client.sessionId)) return;
      if (typeof message?.nodeId === "string") startGather(this.game, client.sessionId, message.nodeId);
    });
    this.onMessage(Msg.SortInventory, (client) => {
      if (stallLocked(this.game, client.sessionId)) return;
      sortBags(this.game, client.sessionId);
    });
    this.onMessage(Msg.MapPing, (client, message: Partial<MapPingMessage>) => {
      if (!isPingKind(message?.kind) || !Number.isFinite(message.x) || !Number.isFinite(message.y)) return;
      sendPing(this.game, client.sessionId, message.kind, Number(message.x), Number(message.y), typeof message.targetId === "string" ? message.targetId : undefined);
    });
    this.onMessage(Msg.ReadFortune, (client, message: { npcId?: unknown }) => {
      if (typeof message?.npcId === "string") readFortune(this.game, client.sessionId, message.npcId);
    });
    this.onMessage(Msg.HorseBuy, (client, message: { npcId?: unknown; breed?: unknown }) => {
      if (!this.itemsLocked(client.sessionId)) buyHorse(this.game, client.sessionId, message?.npcId, message?.breed);
    });
    this.onMessage(Msg.HorseSelect, (client, message: { npcId?: unknown; breed?: unknown }) => selectHorse(this.game, client.sessionId, message?.npcId, message?.breed));
    this.onMessage(Msg.HorseStyle, (client, message: { npcId?: unknown; look?: unknown }) => {
      if (!this.itemsLocked(client.sessionId)) styleHorse(this.game, client.sessionId, message?.npcId, message?.look);
    });
    this.onMessage(Msg.ChooseClass, (client, message: { npcId?: unknown }) => chooseClass(this.game, client.sessionId, message?.npcId));
    this.onMessage(Msg.ResetClass, (client, message: { npcId?: unknown }) => {
      if (!this.itemsLocked(client.sessionId)) resetClass(this.game, client.sessionId, message?.npcId);
    });
    this.onMessage(Msg.StorageGold, (client, message: Partial<StorageGoldMessage>) => {
      if (this.itemsLocked(client.sessionId)) return;
      if (typeof message?.npcId === "string") storageGold(this.game, client.sessionId, message.npcId, message.amount);
    });
    this.onMessage(Msg.StorageQuick, (client, message: Partial<StorageQuickMessage>) => {
      if (this.itemsLocked(client.sessionId)) return;
      const from = message?.from;
      if (typeof message?.npcId !== "string" || (from?.area !== "inv" && from?.area !== "storage") || typeof from.index !== "number") return;
      quickStorage(this.game, client.sessionId, message.npcId, { area: from.area, index: from.index });
    });
    this.onMessage(Msg.DungeonRespond, (client, message: Partial<DungeonRespondMessage>) => {
      const invite = this.dungeonInvites.get(client.sessionId);
      this.dungeonInvites.delete(client.sessionId);
      if (message?.accept !== true) return;
      if (!invite || invite.expiresAt < Date.now()) return notice(this.game, client.sessionId, "Davetin süresi doldu");
      this.usePortal(client, invite.portalId, true);
    });
    this.onMessage(Msg.Fish, (client) => toggleFishing(this.game, client.sessionId));
    this.onMessage(Msg.Mount, (client) => toggleMount(this.game, client.sessionId));
    this.onMessage(Msg.Sit, (client, message: { bench?: unknown }) => sitOnBench(this.game, client.sessionId, message?.bench));
    this.onMessage(Msg.TradeRespond, (client, message: { accept?: unknown }) => respondTrade(this.game, client.sessionId, message?.accept === true));
    this.onMessage(Msg.TradeOffer, (client, message: Partial<TradeOfferMessage>) => setOffer(this.game, client.sessionId, message?.items, message?.gold));
    this.onMessage(Msg.TradeLock, (client) => lockOffer(this.game, client.sessionId));
    this.onMessage(Msg.TradeConfirm, (client) => confirmTrade(this.game, client.sessionId));
    this.onMessage(Msg.TradeCancel, (client) => cancelTrade(this.game, client.sessionId, "Takas iptal edildi"));
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
      onlineCharacters.set(character.id, {
        characterId: character.id,
        game: this.game,
        sessionId: client.sessionId,
        name: character.name,
        roomId: this.roomId,
      });
      if (this.zone.instanced) registerInstance(character.id, this.zone.id, this.roomId);
      refreshFor(character.id);
      friendJoined(character.id, character.name);
      this.game.playerRuntime.get(client.sessionId)!.isAdmin = auth.account.isAdmin;
      this.state.players.get(client.sessionId)!.gm = auth.account.isAdmin;
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
      if (characterId !== undefined && name) friendLeft(characterId, name);
      // Logged out (rather than changing zones): the town portal goes too.
      if (characterId !== undefined && townPortalOf(characterId)) {
        setTimeout(() => {
          if (!onlineCharacters.get(characterId)) closeTownPortal(characterId);
        }, TOWN_PORTAL_LOGOUT_GRACE_MS);
      }
      this.game.removePlayer(client.sessionId);
      this.dungeonInvites.delete(client.sessionId);
      this.releases.get(client.sessionId)?.();
      this.releases.delete(client.sessionId);
      console.log(`[${this.zone.id}] ${name} left (${this.state.players.size} online)`);
    }
  }

  /** An open market stall or trade freezes the inventory. Returns true (and tells the player) if so. */
  private itemsLocked(sessionId: string): boolean {
    return stallLocked(this.game, sessionId) || tradeLocked(this.game, sessionId);
  }

  /**
   * Validates a portal use and hands the client a ticket for the destination zone.
   * `invited`: a party member accepted "come along" and needn't walk up to the portal.
   */
  private usePortal(client: Client, portalId: string, invited = false) {
    const player = this.state.players.get(client.sessionId);
    const entry = this.game.progressOf(client.sessionId);
    const portal = this.zone.portals.find((p) => p.id === portalId);
    if (!player || !entry || !portal || player.dead) return;
    if (distance(player, portal) > (invited ? DUNGEON_INVITE_RANGE : PORTAL_RANGE)) return notice(this.game, client.sessionId, "Çok uzak");
    if (portal.requiresClear && !this.state.cleared) return notice(this.game, client.sessionId, "Portal henüz kapalı");
    if (portal.minLevel && player.level < portal.minLevel) {
      return notice(this.game, client.sessionId, `${portal.label} için seviye ${portal.minLevel} gerekli`);
    }
    // Coming back out of the dungeon puts the player just in front of this portal.
    if (portal.returnTo) {
      player.x = portal.returnTo.x;
      player.y = portal.returnTo.y;
    }
    closeStall(this.game, client.sessionId);
    const instanced = ZONES[portal.to].instanced;
    const go = () => {
      if (!this.clients.getById(client.sessionId)) return;
      // Party already inside this dungeon: join their instance instead of opening a new one.
      const roomId = instanced ? instanceFor(entry.characterId, portal.to) : undefined;
      const ticket = issueTicket(entry.characterId, portal.to, portal.arriveAt);
      client.send(Msg.Transfer, { zone: portal.to, ticket, roomId } satisfies TransferEvent);
    };
    if (!invited || !instanced) go();
    else {
      // Whoever went in first may still be loading: wait for the party's copy to open.
      const started = Date.now();
      const tryJoin = () => {
        if (instanceFor(entry.characterId, portal.to) || Date.now() - started > INSTANCE_WAIT_MS) go();
        else this.clock.setTimeout(tryJoin, 200);
      };
      tryJoin();
    }
    if (instanced && !invited) this.inviteParty(client.sessionId, portal);
  }

  /** Someone went into a dungeon: ask their party members standing nearby to come along. */
  private inviteParty(sessionId: string, portal: PortalDef) {
    const player = this.state.players.get(sessionId);
    const characterId = this.game.playerRuntime.get(sessionId)?.characterId;
    if (!player || characterId === undefined) return;
    for (const [otherId, other] of this.state.players) {
      const otherCharacter = this.game.playerRuntime.get(otherId)?.characterId;
      if (otherId === sessionId || otherCharacter === undefined || !sameParty(characterId, otherCharacter)) continue;
      if (other.dead || distance(other, portal) > DUNGEON_INVITE_RANGE) continue;
      if (portal.minLevel && other.level < portal.minLevel) {
        notice(this.game, otherId, `${player.name} zindana girdi: ${portal.label} (seviye ${portal.minLevel} gerekli)`, "#74c0fc");
        continue;
      }
      this.dungeonInvites.set(otherId, { portalId: portal.id, expiresAt: Date.now() + DUNGEON_INVITE_MS });
      this.game.io.send(otherId, Msg.DungeonInvite, { from: player.name, dungeon: ZONES[portal.to].name } satisfies DungeonInviteEvent);
    }
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
  if (ref.area === "storage" && typeof ref.index === "number") return { area: "storage", index: ref.index };
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
    (m.dx !== 0 || m.dy !== 0) &&
    (m.sprint === undefined || typeof m.sprint === "boolean")
  );
}
