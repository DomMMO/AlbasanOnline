import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { ZONES } from "../../shared/src";
import { config } from "./config";
import { runMigrations } from "./db/migrations";
import { waitForDatabase } from "./db/pool";
import { createAdminRouter } from "./http/admin";
import { createApiRouter } from "./http/api";
import { createMapsAdminRouter, createMapsPublicRouter, loadMapEdits } from "./http/maps";
import { createTileArtAdminRouter, createTileArtPublicRouter } from "./http/tileArt";
import { ZoneRoom } from "./rooms/ZoneRoom";
import { loadWorldClock } from "./game/worldClock";

const CLIENT_DIST = fileURLToPath(new URL("../../client/dist", import.meta.url));

await waitForDatabase();
await runMigrations();
await loadWorldClock();
await loadMapEdits();

// One HTTP server: REST API under /api, Colyseus matchmaking + WebSockets on the same port.
const app = express();
app.set("trust proxy", config.trustProxy);
// Map editor routes first: they take bigger (or binary) request bodies than the rest of the admin API.
app.use("/api/admin/maps", createMapsAdminRouter());
app.use("/api/maps", createMapsPublicRouter());
app.use("/api/admin/tiles", createTileArtAdminRouter());
app.use("/api/tiles", createTileArtPublicRouter());
app.use("/api/admin", createAdminRouter());
app.use("/api", createApiRouter());
// In production the built client (game + GM panel) is served from the same origin.
if (existsSync(CLIENT_DIST)) app.use(express.static(CLIENT_DIST));

const gameServer = new Server({ transport: new WebSocketTransport({ server: createServer(app) }) });
// Room names are zone ids: the world is joined, dungeons are created per entry.
for (const zone of Object.values(ZONES)) gameServer.define(zone.id, ZoneRoom, { zoneId: zone.id });

await gameServer.listen(config.port);
console.log(`[server] listening on http://localhost:${config.port}`);
