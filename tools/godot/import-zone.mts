// First step of moving a zone from code into a Godot map scene (then tools/migrate_map.gd):
//   npx tsx tools/godot/import-zone.mts town [--api https://albasanonline.com | --edits edits.json] [--force]
// Writes shared/maps/<zone>.json from the map generated in code with the web editor's changes
// (fetched from --api, or read from an --edits file: a map_edits row's data) laid over it, and registers it in shared/src/zoneFiles.ts. From then on
// the server, the bake and the game read the file. An existing file is kept unless --force.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyMapEdits,
  collides,
  hasLineOfSight,
  validateMapEdits,
  codeZoneLayout,
  fileFromLayout,
  formatZoneFile,
  isZoneId,
  layoutFromFile,
  NPCS,
  ZONES,
  type MapEdits,
} from "../../shared/src";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const zone = args.find((a) => !a.startsWith("--"));
const apiAt = args.indexOf("--api");
const api = apiAt >= 0 ? args[apiAt + 1] : "https://albasanonline.com";
if (!zone || !isZoneId(zone)) throw new Error(`usage: import-zone.mts <zone> [--api URL] [--force]; zones: ${Object.keys(ZONES).join(", ")}`);

const out = join(ROOT, "shared/maps", `${zone}.json`);
if (existsSync(out) && !args.includes("--force")) throw new Error(`${out} already exists (--force to write it again from code)`);

let edits: MapEdits | null = null;
const editsAt = args.indexOf("--edits");
if (editsAt >= 0) {
  edits = JSON.parse(readFileSync(args[editsAt + 1], "utf8")) as MapEdits;
  console.log(`[import] ${zone}: ${edits.objects.length} web editor changes from ${args[editsAt + 1]}`);
} else {
  const response = await fetch(`${api}/api/maps/${zone}`);
  if (response.ok) edits = ((await response.json()) as { edits: MapEdits | null }).edits;
  else console.warn(`[import] ${api}: ${response.status}, no web editor changes`);
  console.log(`[import] ${zone}: ${edits?.objects.length ?? 0} web editor changes from ${api}`);
}

if (edits) {
  // As the server loads them: checked against the map in code.
  const base = codeZoneLayout(zone).map;
  const checked = validateMapEdits(edits, zone, base.width, base.height);
  if (!checked.ok) throw new Error(`web editor changes rejected: ${checked.error}`);
  edits = checked.edits;
}
const layout = applyMapEdits(codeZoneLayout(zone), edits);
const def = ZONES[zone];
const npcs = Object.fromEntries(def.npcs.filter((id) => NPCS[id]).map((id) => [id, { x: NPCS[id].x, y: NPCS[id].y }]));
const portals = Object.fromEntries(def.portals.map((p) => [p.id, { x: p.x, y: p.y }]));
const file = fileFromLayout(zone, layout, npcs, portals);

// The file must give back the same map: walking and sight blocked in the very same places.
const back = layoutFromFile(JSON.parse(formatZoneFile(file)));
let walkDiff = 0;
for (let y = 0; y < layout.map.height * 16; y += 2) for (let x = 0; x < layout.map.width * 16; x += 2) if (collides(back.map, x, y) !== collides(layout.map, x, y)) walkDiff++;
let sightDiff = 0;
for (let i = 0; i < 4000; i++) {
  const a = { x: ((i * 7919) % (layout.map.width * 16)), y: ((i * 104729) % (layout.map.height * 16)) };
  const b = { x: ((i * 15485863) % (layout.map.width * 16)), y: ((i * 32452843) % (layout.map.height * 16)) };
  if (hasLineOfSight(back.map, a, b) !== hasLineOfSight(layout.map, a, b)) sightDiff++;
}
if (walkDiff || sightDiff) console.warn(`[import] after the round trip ${walkDiff} spots walk and ${sightDiff} lines see differently`);

writeFileSync(out, formatZoneFile(file));
console.log(`[import] wrote ${out}: ${file.width}x${file.height}, ${file.decor.length} decor, ${file.mobs.length} mobs, ${Object.keys(npcs).length} npcs`);

const registry = join(ROOT, "shared/src/zoneFiles.ts");
let source = readFileSync(registry, "utf8");
const name = `${zone.replace(/[^a-z0-9]/gi, "_")}Map`;
if (!source.includes(`"../maps/${zone}.json"`)) {
  source = source.replace(/(import type \{ ZoneFile \} from "\.\/zoneFile";\n)/, `$1import ${name} from "../maps/${zone}.json";\n`);
  source = source.replace(/(export const ZONE_FILES[^{]*\{\n)/, `$1  ${zone}: ${name} as unknown as ZoneFile,\n`);
  writeFileSync(registry, source);
  console.log(`[import] registered in shared/src/zoneFiles.ts`);
}
