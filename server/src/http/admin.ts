import express, { type NextFunction, type Request, type Response } from "express";
import {
  addGold,
  getCharacter,
  giveItem,
  GmError,
  logAdminAction,
  recentAdminLog,
  removeItem,
  searchCharacters,
  setLevel,
} from "../game/gm";
import { fail, requireAuth, type AuthedRequest } from "./api";

// GM tools. Every route requires an admin account; every change is written to admin_log.

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!(req as AuthedRequest).account.isAdmin) return fail(res, 403, "Bu işlem için GM yetkisi gerekli");
  next();
}

const characterId = (req: Request) => Number(req.params.id);

export function createAdminRouter() {
  const router = express.Router();
  router.use(express.json({ limit: "10kb" }));
  router.use(requireAuth, requireAdmin);

  router.get("/characters", async (req, res) => {
    res.json(await searchCharacters(typeof req.query.q === "string" ? req.query.q : ""));
  });

  router.get("/characters/:id", async (req, res) => {
    const id = characterId(req);
    res.json({ ...(await getCharacter(id)), log: await recentAdminLog(id) });
  });

  const action =
    (name: string, run: (id: number, body: Record<string, unknown>) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      const id = characterId(req);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await run(id, body);
      await logAdminAction((req as AuthedRequest).account.id, id, name, { ...body, result });
      res.json({ ok: true, result, character: await getCharacter(id) });
    };

  router.post(
    "/characters/:id/give",
    action("give", (id, body) => giveItem(id, String(body.itemId), Number(body.qty), Number(body.enhance))),
  );
  router.post(
    "/characters/:id/remove",
    action("remove", (id, body) => removeItem(id, String(body.uid))),
  );
  router.post(
    "/characters/:id/gold",
    action("gold", (id, body) => addGold(id, Number(body.amount))),
  );
  router.post(
    "/characters/:id/level",
    action("level", (id, body) => setLevel(id, Number(body.level))),
  );

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof GmError) return fail(res, error.status, error.message);
    console.error("[admin]", error);
    fail(res, 500, "Sunucu hatası");
  });
  return router;
}
