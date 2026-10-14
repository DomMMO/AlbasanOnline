// Builds every zone and checks it is playable: everything reachable on foot from the spawn,
// nothing standing in a wall, every id that loot / adds / looks refer to defined.
import { ZONES, zoneLayout, isZoneId, type ZoneId } from "../../shared/src/zones";
import { isBlockedTile } from "../../shared/src/map";
import { MOBS } from "../../shared/src/data/mobs";
import { ITEMS } from "../../shared/src/data/items";
import { NPCS } from "../../shared/src/data/npcs";
import { TILE_SIZE } from "../../shared/src/constants";

const problems: string[] = [];
const only = process.argv[2];

for (const id of Object.keys(ZONES) as ZoneId[]) {
  if (only && !id.includes(only)) continue;
  const def = ZONES[id];
  const layout = zoneLayout(id);
  const { map } = layout;
  const tileOf = (p: { x: number; y: number }) => ({ tx: Math.floor(p.x / TILE_SIZE), ty: Math.floor((p.y - 1) / TILE_SIZE) });
  // Flood fill from the spawn.
  const seen = new Uint8Array(map.width * map.height);
  const start = tileOf(map.spawn);
  if (isBlockedTile(map, start.tx, start.ty)) problems.push(`${id}: spawn is blocked`);
  const queue = [[start.tx, start.ty]];
  seen[start.ty * map.width + start.tx] = 1;
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height || seen[ny * map.width + nx] || isBlockedTile(map, nx, ny)) continue;
      seen[ny * map.width + nx] = 1;
      queue.push([nx, ny]);
    }
  }
  const reachable = (p: { x: number; y: number }, what: string, standOn = true) => {
    const { tx, ty } = tileOf(p);
    if (standOn && isBlockedTile(map, tx, ty)) {
      problems.push(`${id}: ${what} stands on a blocked tile (${tx},${ty})`);
      return;
    }
    // A portal or NPC may stand on a blocker; then one of its neighbours must be reachable.
    const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0, 2]].some(([dx, dy]) => seen[(ty + dy) * map.width + tx + dx]);
    if (!near) problems.push(`${id}: ${what} at (${tx},${ty}) cannot be reached from the spawn`);
  };
  for (const portal of def.portals) {
    reachable(portal, `portal ${portal.id}`, false);
    if (!isZoneId(portal.to)) problems.push(`${id}: portal ${portal.id} leads to unknown zone ${portal.to}`);
    if (portal.returnTo) {
      // returnTo is in this zone (where you stand after coming back).
      reachable(portal.returnTo, `return spot of ${portal.id}`);
    }
    if (portal.arriveAt) {
      const dest = zoneLayout(portal.to).map;
      const { tx, ty } = tileOf(portal.arriveAt);
      if (isBlockedTile(dest, tx, ty)) problems.push(`${id}: portal ${portal.id} drops you on a blocked tile in ${portal.to} (${tx},${ty})`);
    }
  }
  for (const npcId of def.npcs) {
    const npc = NPCS[npcId];
    if (!npc) problems.push(`${id}: unknown NPC ${npcId}`);
    else reachable(npc, `NPC ${npcId}`, false);
  }
  for (const mob of layout.mobs) {
    if (!MOBS[mob.mob]) problems.push(`${id}: unknown mob ${mob.mob}`);
    reachable(mob, `mob ${mob.mob}`);
  }
  for (const zone of layout.spawnZones ?? []) {
    if (!MOBS[zone.mob]) problems.push(`${id}: unknown spawn mob ${zone.mob}`);
    // Mobs appear anywhere in the area: some of it has to be reachable ground.
    let open = 0;
    for (let ty = zone.ty - zone.radius; ty <= zone.ty + zone.radius; ty++) {
      for (let tx = zone.tx - zone.radius; tx <= zone.tx + zone.radius; tx++) if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height && seen[ty * map.width + tx]) open++;
    }
    if (open < zone.count) problems.push(`${id}: spawn area of ${zone.mob} has only ${open} reachable tiles for ${zone.count} mobs`);
  }
  console.log(`${id.padEnd(22)} ${map.width}x${map.height}  mobs ${String(layout.mobs.length).padStart(3)}  decor ${String(layout.decor?.length ?? 0).padStart(3)}  portals ${def.portals.length}`);
}

for (const mob of Object.values(MOBS)) {
  for (const drop of mob.loot.drops) if (!ITEMS[drop.item]) problems.push(`mob ${mob.id}: drops unknown item ${drop.item}`);
  if (mob.boss?.addMob && !MOBS[mob.boss.addMob]) problems.push(`mob ${mob.id}: unknown add ${mob.boss.addMob}`);
  const a = mob.appearance;
  if (a.type === "humanoid") for (const item of Object.values(a.gear ?? {})) if (item && !ITEMS[item]) problems.push(`mob ${mob.id}: wears unknown item ${item}`);
}
for (const npc of Object.values(NPCS)) for (const item of npc.shop) {
  if (!ITEMS[item]) problems.push(`npc ${npc.id}: sells unknown item ${item}`);
  else if (!ITEMS[item].buyPrice) problems.push(`npc ${npc.id}: sells ${item}, which has no buy price`);
}

console.log(problems.length ? `\n${problems.length} PROBLEMS:\n${problems.join("\n")}` : "\nall good");
process.exit(problems.length ? 1 : 0);
