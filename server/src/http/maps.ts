import express, { type NextFunction, type Request, type Response } from "express";
import { baseZoneLayout, isZoneId, setZoneEdits, validateMapEdits, zoneSizeProblem, ZONES, type MapEdits, type ZoneId } from "../../../shared/src";
import { pool } from "../db/pool";
import { zoneMapChanged } from "../game/liveMaps";
import { requireAdmin } from "./admin";
import { fail, requireAuth, type AuthedRequest } from "./api";

// Map editor API.
//   /api/admin/maps  - GM only (session token + admin flag checked on every request, so hiding
//                      the editor page is not what protects it): list, load, save, reset.
//   /api/maps/:zone  - anyone: the edits of a zone, which every client lays over the generated
//                      map when entering it (players see the map anyway).
// Saved edits apply to rooms created from then on; a room already running keeps its map, so
// players inside never disagree with the server about walls.

interface MapRow {
  zone: string;
  data: MapEdits;
  updated_at: string;
  updated_by: string | null;
}

/** Loads every saved map at startup (re-validated, in case the rules changed since). */
export async function loadMapEdits() {
  const { rows } = await pool.query<MapRow>("SELECT zone, data FROM map_edits");
  for (const row of rows) {
    if (!isZoneId(row.zone)) continue;
    const checked = checkEdits(row.data, row.zone);
    if (checked.ok) setZoneEdits(row.zone, checked.edits);
    else console.warn(`[maps] ${row.zone}: saved edits ignored (${checked.error})`);
  }
  if (rows.length > 0) console.log(`[maps] loaded edits for ${rows.map((r) => r.zone).join(", ")}`);
}

const zoneParam = (req: Request): ZoneId | null => (isZoneId(req.params.zone) ? req.params.zone : null);

/** validateMapEdits plus the zone's own rule: a resize must keep its NPCs and portals inside. */
function checkEdits(input: unknown, zone: ZoneId) {
  const { map } = baseZoneLayout(zone);
  const checked = validateMapEdits(input, zone, map.width, map.height);
  if (!checked.ok || !checked.edits.size) return checked;
  const problem = zoneSizeProblem(zone, checked.edits.size.width, checked.edits.size.height);
  return problem ? ({ ok: false, error: problem } as const) : checked;
}

export function createMapsAdminRouter() {
  const router = express.Router();
  // Maps are bigger than other admin requests.
  router.use(express.json({ limit: "2mb" }));
  router.use(requireAuth, requireAdmin);

  router.get("/", async (_req, res) => {
    const { rows } = await pool.query<{ zone: string; updated_at: string; updated_by: string | null; count: number; size: { width: number; height: number } | null }>(
      `SELECT m.zone, m.updated_at, a.username AS updated_by, jsonb_array_length(m.data->'objects') AS count, m.data->'size' AS size
       FROM map_edits m LEFT JOIN accounts a ON a.id = m.updated_by`,
    );
    const saved = new Map(rows.map((r) => [r.zone, r]));
    res.json(
      Object.values(ZONES).map((zone) => {
        const row = saved.get(zone.id);
        const size = row?.size ?? baseZoneLayout(zone.id).map;
        return { zone: zone.id, name: zone.name, width: size.width, height: size.height, objects: row?.count ?? 0, updatedAt: row?.updated_at ?? null, updatedBy: row?.updated_by ?? null };
      }),
    );
  });

  router.get("/:zone", async (req, res) => {
    const zone = zoneParam(req);
    if (!zone) return fail(res, 404, "Böyle bir bölge yok");
    const { rows } = await pool.query<MapRow>(
      `SELECT m.data, m.updated_at, a.username AS updated_by FROM map_edits m LEFT JOIN accounts a ON a.id = m.updated_by WHERE m.zone = $1`,
      [zone],
    );
    res.json({ zone, edits: rows[0]?.data ?? null, updatedAt: rows[0]?.updated_at ?? null, updatedBy: rows[0]?.updated_by ?? null });
  });

  router.put("/:zone", async (req, res) => {
    const zone = zoneParam(req);
    if (!zone) return fail(res, 404, "Böyle bir bölge yok");
    const checked = checkEdits(req.body, zone);
    if (!checked.ok) return fail(res, 400, checked.error);
    const account = (req as unknown as AuthedRequest).account;
    await pool.query(
      `INSERT INTO map_edits (zone, data, updated_by) VALUES ($1, $2, $3)
       ON CONFLICT (zone) DO UPDATE SET data = EXCLUDED.data, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [zone, JSON.stringify(checked.edits), account.id],
    );
    setZoneEdits(zone, checked.edits);
    zoneMapChanged(zone);
    console.log(`[maps] ${account.username} saved ${zone} (${checked.edits.objects.length} objects)`);
    res.json({ ok: true, objects: checked.edits.objects.length });
  });

  /** Back to the map as generated in code. */
  router.delete("/:zone", async (req, res) => {
    const zone = zoneParam(req);
    if (!zone) return fail(res, 404, "Böyle bir bölge yok");
    await pool.query("DELETE FROM map_edits WHERE zone = $1", [zone]);
    setZoneEdits(zone, null);
    zoneMapChanged(zone);
    console.log(`[maps] ${(req as unknown as AuthedRequest).account.username} reset ${zone}`);
    res.json({ ok: true });
  });

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[maps]", error);
    fail(res, 500, "Sunucu hatası");
  });
  return router;
}

/** Read-only, for every client entering a zone. */
export function createMapsPublicRouter() {
  const router = express.Router();
  router.get("/:zone", async (req, res, next) => {
    try {
      const zone = zoneParam(req);
      if (!zone) return fail(res, 404, "Böyle bir bölge yok");
      const { rows } = await pool.query<{ data: MapEdits }>("SELECT data FROM map_edits WHERE zone = $1", [zone]);
      res.json({ zone, edits: rows[0]?.data ?? null });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
