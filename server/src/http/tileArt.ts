import express, { type NextFunction, type Request, type Response } from "express";
import { TILE_ART_BY_KEY, TILE_ART_MAX_BYTES, tileArtSizes } from "../../../shared/src";
import { pool } from "../db/pool";
import { requireAdmin } from "./admin";
import { fail, requireAuth, type AuthedRequest } from "./api";

// Tile art (map editor, "Kare görselleri").
//   /api/admin/tiles/:key  - GM only: PUT a PNG (raw body, image/png) or DELETE it; every
//                            replaced image is kept in tile_art_history (last HISTORY_KEEP per
//                            slot), listed by GET :key/history, restored by POST :key/restore/:id.
//   /api/tiles             - anyone: the list of uploaded slots, and each image.
// Uploads are checked as real PNGs of one of the slot's sizes before they are stored, and are
// always served back as image/png, never sniffed.

const HISTORY_KEEP = 20;

/** Moves a slot's current image (if any) into its history, keeping the latest HISTORY_KEEP. */
async function archive(key: string) {
  await pool.query(
    `INSERT INTO tile_art_history (key, png, size, uploaded_by, uploaded_at)
     SELECT key, png, size, updated_by, updated_at FROM tile_art WHERE key = $1`,
    [key],
  );
  await pool.query(
    `DELETE FROM tile_art_history WHERE key = $1 AND id NOT IN
       (SELECT id FROM tile_art_history WHERE key = $1 ORDER BY replaced_at DESC, id DESC LIMIT $2)`,
    [key, HISTORY_KEEP],
  );
}

async function store(key: string, png: Buffer, size: number, accountId: number) {
  await archive(key);
  await pool.query(
    `INSERT INTO tile_art (key, png, size, updated_by) VALUES ($1, $2, $3, $4)
     ON CONFLICT (key) DO UPDATE SET png = EXCLUDED.png, size = EXCLUDED.size, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, png, size, accountId],
  );
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width and height from a PNG's header, or null if it is not a PNG. */
function pngSize(data: Buffer): { width: number; height: number } | null {
  if (data.length < 33 || !data.subarray(0, 8).equals(PNG_SIGNATURE) || data.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

const slotParam = (req: Request) => {
  const key = String(req.params.key);
  return Object.hasOwn(TILE_ART_BY_KEY, key) ? TILE_ART_BY_KEY[key] : null;
};

const errors = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if ((error as { type?: string }).type === "entity.too.large") return fail(res, 413, `Görsel en fazla ${TILE_ART_MAX_BYTES / 1024} KB olabilir`);
  console.error("[tiles]", error);
  fail(res, 500, "Sunucu hatası");
};

export function createTileArtAdminRouter() {
  const router = express.Router();
  router.use(requireAuth, requireAdmin);

  router.put("/:key", express.raw({ type: "image/png", limit: TILE_ART_MAX_BYTES }), async (req, res) => {
    const slot = slotParam(req);
    if (!slot) return fail(res, 404, "Böyle bir kare yok");
    const data = req.body;
    const size = Buffer.isBuffer(data) ? pngSize(data) : null;
    if (!size) return fail(res, 400, "Dosya PNG olmalı");
    const sizes = tileArtSizes(slot);
    if (!sizes.some((s) => s.w === size.width && s.h === size.height)) {
      return fail(res, 400, `${slot.name}: görsel ${sizes.map((s) => `${s.w}×${s.h}`).join(", ")} olmalı (bu ${size.width}×${size.height})`);
    }
    const account = (req as unknown as AuthedRequest).account;
    await store(slot.key, data, size.width, account.id);
    console.log(`[tiles] ${account.username} uploaded ${slot.key} (${size.width}px)`);
    res.json({ ok: true, size: size.width });
  });

  router.delete("/:key", async (req, res) => {
    const slot = slotParam(req);
    if (!slot) return fail(res, 404, "Böyle bir kare yok");
    await archive(slot.key);
    await pool.query("DELETE FROM tile_art WHERE key = $1", [slot.key]);
    console.log(`[tiles] ${(req as unknown as AuthedRequest).account.username} removed ${slot.key}`);
    res.json({ ok: true });
  });

  /** Earlier versions of a slot, newest first. */
  router.get("/:key/history", async (req, res) => {
    const slot = slotParam(req);
    if (!slot) return fail(res, 404, "Böyle bir kare yok");
    const { rows } = await pool.query<{ id: number; size: number; uploaded_at: string; replaced_at: string; uploaded_by: string | null }>(
      `SELECT h.id, h.size, h.uploaded_at, h.replaced_at, a.username AS uploaded_by
       FROM tile_art_history h LEFT JOIN accounts a ON a.id = h.uploaded_by
       WHERE h.key = $1 ORDER BY h.replaced_at DESC, h.id DESC`,
      [slot.key],
    );
    res.json(rows.map((r) => ({ id: r.id, size: r.size, uploadedAt: r.uploaded_at, replacedAt: r.replaced_at, uploadedBy: r.uploaded_by })));
  });

  router.get("/history/:id.png", async (req, res) => {
    const { rows } = await pool.query<{ png: Buffer }>("SELECT png FROM tile_art_history WHERE id = $1", [Number(req.params.id) || 0]);
    if (!rows[0]) return fail(res, 404, "Böyle bir sürüm yok");
    res.set({ "Content-Type": "image/png", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=31536000, immutable" });
    res.send(rows[0].png);
  });

  /** Makes an earlier version current again (the current one goes into the history). */
  router.post("/:key/restore/:id", async (req, res) => {
    const slot = slotParam(req);
    if (!slot) return fail(res, 404, "Böyle bir kare yok");
    const { rows } = await pool.query<{ png: Buffer; size: number }>("SELECT png, size FROM tile_art_history WHERE id = $1 AND key = $2", [
      Number(req.params.id) || 0,
      slot.key,
    ]);
    if (!rows[0]) return fail(res, 404, "Böyle bir sürüm yok");
    const account = (req as unknown as AuthedRequest).account;
    await store(slot.key, rows[0].png, rows[0].size, account.id);
    console.log(`[tiles] ${account.username} restored ${slot.key} to version ${req.params.id}`);
    res.json({ ok: true, size: rows[0].size });
  });

  router.use(errors);
  return router;
}

export function createTileArtPublicRouter() {
  const router = express.Router();

  /** Uploaded slots; `v` changes with every upload, so image URLs can be cached for good. */
  router.get("/", async (_req, res, next) => {
    try {
      const { rows } = await pool.query<{ key: string; size: number; v: string }>(
        "SELECT key, size, (extract(epoch FROM updated_at) * 1000)::bigint AS v FROM tile_art",
      );
      res.json(rows.filter((r) => TILE_ART_BY_KEY[r.key]).map((r) => ({ key: r.key, size: r.size, v: Number(r.v) })));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:key.png", async (req, res, next) => {
    try {
      const slot = slotParam(req);
      if (!slot) return fail(res, 404, "Böyle bir kare yok");
      const { rows } = await pool.query<{ png: Buffer }>("SELECT png FROM tile_art WHERE key = $1", [slot.key]);
      if (!rows[0]) return fail(res, 404, "Görsel yok");
      res.set({ "Content-Type": "image/png", "X-Content-Type-Options": "nosniff", "Cache-Control": req.query.v ? "public, max-age=31536000, immutable" : "no-cache" });
      res.send(rows[0].png);
    } catch (error) {
      next(error);
    }
  });

  router.use(errors);
  return router;
}
