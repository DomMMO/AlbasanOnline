import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import { createServer } from "node:http";
import { ZONES } from "../../shared/src";
import { config } from "./config";
import { runMigrations } from "./db/migrations";
import { waitForDatabase } from "./db/pool";
import { createAdminRouter } from "./http/admin";
import { createApiRouter } from "./http/api";
import { ZoneRoom } from "./rooms/ZoneRoom";

await waitForDatabase();
await runMigrations();

// One HTTP server: REST API under /api, Colyseus matchmaking + WebSockets on the same port.
const app = express();
app.set("trust proxy", "loopback");
app.use("/api/admin", createAdminRouter());
app.use("/api", createApiRouter());

const gameServer = new Server({ transport: new WebSocketTransport({ server: createServer(app) }) });
// Room names are zone ids: the world is joined, dungeons are created per entry.
for (const zone of Object.values(ZONES)) gameServer.define(zone.id, ZoneRoom, { zoneId: zone.id });

await gameServer.listen(config.port);
console.log(`[server] listening on http://localhost:${config.port}`);
