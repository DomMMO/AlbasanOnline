import type { ZoneFile } from "./zoneFile";
import khan_barrowMap from "../maps/khan_barrow.json";
import ash_templeMap from "../maps/ash_temple.json";
import magma_forgesMap from "../maps/magma_forges.json";
import frost_citadelMap from "../maps/frost_citadel.json";
import frost_cavernMap from "../maps/frost_cavern.json";
import buried_caravanseraiMap from "../maps/buried_caravanserai.json";
import red_cavesMap from "../maps/red_caves.json";
import dragon_lairMap from "../maps/dragon_lair.json";
import orc_fortressMap from "../maps/orc_fortress.json";
import bone_cryptMap from "../maps/bone_crypt.json";
import sunken_templeMap from "../maps/sunken_temple.json";
import abandoned_mineMap from "../maps/abandoned_mine.json";
import jack_lairMap from "../maps/jack_lair.json";
import goblin_caveMap from "../maps/goblin_cave.json";
import pvp_arenaMap from "../maps/pvp_arena.json";
import keep_hallMap from "../maps/keep_hall.json";
import kurganMap from "../maps/kurgan.json";
import volcanoMap from "../maps/volcano.json";
import frostMap from "../maps/frost.json";
import canyonMap from "../maps/canyon.json";
import forestMap from "../maps/forest.json";
import worldMap from "../maps/world.json";
import townMap from "../maps/town.json";

// Zones whose map is a file (shared/maps/<zone>.json, made in the Godot map editor) instead of
// code. tools/godot/import-zone.mts adds a line here when it moves a zone over.

export const ZONE_FILES: Partial<Record<string, ZoneFile>> = {
  khan_barrow: khan_barrowMap as unknown as ZoneFile,
  ash_temple: ash_templeMap as unknown as ZoneFile,
  magma_forges: magma_forgesMap as unknown as ZoneFile,
  frost_citadel: frost_citadelMap as unknown as ZoneFile,
  frost_cavern: frost_cavernMap as unknown as ZoneFile,
  buried_caravanserai: buried_caravanseraiMap as unknown as ZoneFile,
  red_caves: red_cavesMap as unknown as ZoneFile,
  dragon_lair: dragon_lairMap as unknown as ZoneFile,
  orc_fortress: orc_fortressMap as unknown as ZoneFile,
  bone_crypt: bone_cryptMap as unknown as ZoneFile,
  sunken_temple: sunken_templeMap as unknown as ZoneFile,
  abandoned_mine: abandoned_mineMap as unknown as ZoneFile,
  jack_lair: jack_lairMap as unknown as ZoneFile,
  goblin_cave: goblin_caveMap as unknown as ZoneFile,
  pvp_arena: pvp_arenaMap as unknown as ZoneFile,
  keep_hall: keep_hallMap as unknown as ZoneFile,
  kurgan: kurganMap as unknown as ZoneFile,
  volcano: volcanoMap as unknown as ZoneFile,
  frost: frostMap as unknown as ZoneFile,
  canyon: canyonMap as unknown as ZoneFile,
  forest: forestMap as unknown as ZoneFile,
  world: worldMap as unknown as ZoneFile,
  town: townMap as unknown as ZoneFile,
};
