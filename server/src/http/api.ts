import express, { type NextFunction, type Request, type Response } from "express";
import {
  sanitizeLook,
  TUNIC_COLORS,
  MAX_CHARACTERS_PER_ACCOUNT,
  validateCharacterName,
  validatePassword,
  validateUsername,
  type AuthResponse,
  type CharacterSummary,
  type LeaderboardEntry,
} from "../../../shared/src";
import { accountForToken, createAccount, createSession, deleteSession, verifyLogin, type Account } from "../db/accounts";
import { countCharacters, createCharacter, deleteCharacter, listCharacters, pvpLeaderboard } from "../db/characters";
import { onlineCharacters } from "../game/registry";

export type AuthedRequest = Request & { account: Account; token: string };

export function createApiRouter() {
  const router = express.Router();
  router.use(express.json({ limit: "10kb" }));

  const authLimiter = rateLimit(20, 10 * 60 * 1000);

  router.post("/register", authLimiter, async (req, res) => {
    const { username, password } = credentials(req);
    const invalid = validateUsername(username) ?? validatePassword(password);
    if (invalid) return fail(res, 400, invalid);
    const account = await createAccount(username, password);
    if (!account) return fail(res, 409, "Bu kullanıcı adı alınmış");
    res.json({ token: await createSession(account.id), username: account.username } satisfies AuthResponse);
  });

  router.post("/login", authLimiter, async (req, res) => {
    const { username, password } = credentials(req);
    const account = await verifyLogin(username, password);
    if (!account) return fail(res, 401, "Kullanıcı adı veya şifre hatalı");
    res.json({ token: await createSession(account.id), username: account.username } satisfies AuthResponse);
  });

  router.post("/logout", requireAuth, async (req, res) => {
    await deleteSession((req as AuthedRequest).token);
    res.json({ ok: true });
  });

  router.get("/me", requireAuth, (req, res) => {
    const { account } = req as AuthedRequest;
    res.json({ username: account.username, isAdmin: account.isAdmin });
  });

  router.get("/leaderboard", async (_req, res) => {
    const LIMIT = 20;
    const byId = new Map<number, LeaderboardEntry>();
    for (const { id, ...row } of await pvpLeaderboard(LIMIT * 2)) byId.set(id, { ...row, online: false });
    // Online players' latest numbers live in the game until their next save.
    for (const [id, entry] of onlineCharacters.entries()) {
      const player = entry.game.state.players.get(entry.sessionId);
      if (!player || player.pvpKills + player.pvpDeaths === 0) continue;
      byId.set(id, {
        name: player.name,
        class: player.cls,
        level: player.level,
        rating: player.pvpRating,
        kills: player.pvpKills,
        deaths: player.pvpDeaths,
        online: true,
      });
    }
    const entries = [...byId.values()].sort((a, b) => b.rating - a.rating || b.kills - a.kills).slice(0, LIMIT);
    res.json(entries);
  });

  router.get("/characters", requireAuth, async (req, res) => {
    res.json((await listCharacters((req as AuthedRequest).account.id)) satisfies CharacterSummary[]);
  });

  router.post("/characters", requireAuth, async (req, res) => {
    const { account } = req as AuthedRequest;
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const invalid = validateCharacterName(name);
    if (invalid) return fail(res, 400, invalid);
    if ((await countCharacters(account.id)) >= MAX_CHARACTERS_PER_ACCOUNT) {
      return fail(res, 400, `En fazla ${MAX_CHARACTERS_PER_ACCOUNT} karakterin olabilir`);
    }
    const color = TUNIC_COLORS.includes(req.body?.color) ? (req.body.color as number) : TUNIC_COLORS[0];
    // Everyone starts as a novice; the class is chosen in game, from a master in the keep.
    const id = await createCharacter(account.id, name, color, "novice", sanitizeLook(req.body?.look));
    if (id === null) return fail(res, 409, "Bu karakter adı alınmış");
    const character = (await listCharacters(account.id)).find((c) => c.id === id)!;
    res.status(201).json(character satisfies CharacterSummary);
  });

  router.delete("/characters/:id", requireAuth, async (req, res) => {
    const { account } = req as AuthedRequest;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id)) return fail(res, 400, "Geçersiz karakter");
    // A character in the world would be written back by its next save: they must log out first.
    if (onlineCharacters.get(id)) return fail(res, 409, "Bu karakter şu an oyunda");
    const name = typeof req.body?.name === "string" ? req.body.name : "";
    const character = (await listCharacters(account.id)).find((c) => c.id === id);
    if (!character) return fail(res, 404, "Karakter bulunamadı");
    if (name.toLocaleLowerCase("tr-TR") !== character.name.toLocaleLowerCase("tr-TR")) return fail(res, 400, "Silmek için karakterin adını doğru yaz");
    await deleteCharacter(account.id, id);
    res.json({ ok: true });
  });

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[api]", error);
    fail(res, 500, "Sunucu hatası");
  });

  return router;
}

function credentials(req: Request) {
  const body = req.body ?? {};
  return {
    username: typeof body.username === "string" ? body.username.trim() : "",
    password: typeof body.password === "string" ? body.password : "",
  };
}

export function fail(res: Response, status: number, error: string) {
  res.status(status).json({ error });
}

export function bearerToken(header: string | undefined): string | null {
  const match = header?.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req.headers.authorization);
  const account = token ? await accountForToken(token) : null;
  if (!token || !account) return fail(res, 401, "Oturum geçersiz, tekrar giriş yap");
  Object.assign(req, { account, token });
  next();
}

/** Minimal fixed-window limiter per IP. Good enough until we sit behind a real proxy. */
function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (++entry.count > max) return fail(res, 429, "Çok fazla deneme, biraz bekle");
    next();
  };
}
