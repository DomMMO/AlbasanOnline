extends SceneTree

## Dresses the dungeons in the themed Pixel Crawler packs (assetpack/ANOKOLISA):
##   -- lava <theme>             builds the theme's lava sheet (assets/zindan/<theme>_lav.png): every
##                               shape a lava cell can have, put together from quarters of the pack's
##                               pieces, so thin streams and inner corners get their rims too
##                               (run --import after it, before tileset)
##   -- tileset <theme>          adds the theme's tiles to tilesets/zemin.tres: walls (top and face),
##                               floors, lava (animated) and floor decor (grates, runes, rubble)
##   -- scenes <theme>           the theme's props (props/<theme>/*.tscn)
##   -- map <theme> <zone> ...   repaints the zone's floor, walls and lava in the theme and swaps its
##                               old props for the theme's; what blocks and every tile id stay as
##                               they were (the shared/maps file only changes where props moved)
##   -- build <theme> <zone> ... lays the dungeon out anew from BUILDS (rooms in rows joined by
##                               straight corridors, each room dressed after its kind), with its
##                               mobs, bosses, portals and spawn, and writes its shared/maps file
##
## Tile ids: a theme tile carries the id of its role (wall, floor, lava); a cell whose old id was a
## different one of that role gets the tile's alternative 100 + id (same picture, same collision).
## Decor tiles (layers SusLav, Sus) have no id (-1) and no collision: the export skips them.

const TILESET := "res://tilesets/zemin.tres"
const PACK := "res://assetpack/ANOKOLISA/"
const STATIONS := "Pixel Crawler - Town/Environment/Structures/Stations/"
const CAVE_PROPS := "Pixel Crawler - Cave/Assets/Props.png"
const FORGE_SHEET := "Pixel Crawler - Forge/Assets/Tiles.png"
const HIDEOUT := "Pixel Crawler - Hideout/Assets/Tiles.png"
const GRAVES := "Pixel Crawler - Cemetery/Environment/Props/Graves.png"
const CEM_PROPS := "Pixel Crawler - Cemetery/Environment/Props/Props.png"
const DESERT_PROPS := "Pixel Crawler - Desert/Assets/Props.png"
const GARDEN := "Pixel Crawler - Garden Environment/Assets/Tiles.png"
const SEWER_PROPS := "Pixel Crawler - Sewer/Assets/Props.png"
const SEWER_TILES := "Pixel Crawler - Sewer/Assets/Tiles.png"
const TREES := "Pixel Crawler - Town/Environment/Props/Static/Trees/"
const ROCKS := "Pixel Crawler - Town/Environment/Props/Static/Rocks.png"
const VEGETATION := "Pixel Crawler - Town/Environment/Props/Static/Vegetation.png"
const FF_TREES := "Pixel Crawler - Fairy Forest 1.7/Assets/Tree.png"
const FF_PROPS := "Pixel Crawler - Fairy Forest 1.7/Assets/Props.png"
const CEM_TREES := "Pixel Crawler - Cemetery/Environment/Props/Tree.png"
const DESERT_GROUND := "Pixel Crawler - Desert/Assets/Ground.png"
const WALK := 1
const BOTH := 3
const ALT := 100
## The lava tiles' alternative drawn as decor (under a grate: walkable).
const LAVA_DECOR := 1
const DIRS := [Vector2i(0, -1), Vector2i(1, -1), Vector2i(1, 0), Vector2i(1, 1), Vector2i(0, 1), Vector2i(-1, 1), Vector2i(-1, 0), Vector2i(-1, -1)]

## Tile ids (shared/src/map.ts).
enum { GRASS = 0, GRASS_ALT = 1, PATH = 2, WATER_T = 3, TREE = 4, FLOWER = 5, CAVE_FLOOR = 6, CAVE_WALL = 7, COBBLE = 8, PLAZA = 9, MARKET = 10, WALL = 11, SOLID = 12, DARK_GRASS = 13, BRIDGE = 14, WOOD_FLOOR = 15, WOOD_WALL = 16, SKY = 17, SAND = 18, RED_ROCK = 19, SNOW = 20, ICE = 21, SNOW_TREE = 22, LAVA = 23, ASH = 24, BLIGHT = 25, DEAD_TREE = 26, BOG = 27 }
const WALL_IDS := [CAVE_WALL, WALL, SOLID, WOOD_WALL, RED_ROCK]
const FLOOR_IDS := [GRASS, GRASS_ALT, PATH, FLOWER, CAVE_FLOOR, COBBLE, PLAZA, MARKET, DARK_GRASS, BRIDGE, WOOD_FLOOR, SAND, SNOW, ICE, ASH, BLIGHT]

## A theme: its sheet, the source id it gets in the TileSet, and where its pieces are.
##   wall_top   the wall's top, by which sides border something else: n, w, e, ne/nw, fill
##   face       the wall's front, three rows (trim with the top's lower edge, brick, ledge), each
##              as [left end, middle, right end]; trim_w / trim_e under a top with that side's edge
##   floor      floor tiles, picked at random (the first one half the time)
##   lava       9-slice [tl, t, tr, l, c, r, bl, b, br] + inner corners [br, bl, tr, tl] (the lava
##              cell's one open diagonal), animated: frames below each other, frame_step rows apart;
##              the map uses the sheet built from them (source)
##   decor      floor decor tiles: 9-slices (grate, rune_lit, rune) and loose rubble
##   props      name -> {rect (on the sheet) | frames {sheet, size, count, cols, fps},
##              block (hitbox size at its foot), layers, shadow, light {at, radius, color, flicker}}
const THEMES := {
	"forge": {
		"sheet": "Pixel Crawler - Forge/Assets/Tiles.png",
		"source": 11,
		"wall_top": {"n": Vector2i(2, 0), "nw": Vector2i(0, 1), "ne": Vector2i(4, 1), "w": Vector2i(0, 2), "e": Vector2i(4, 2), "we": Vector2i(0, 0), "fill": Vector2i(2, 2), "in_nw": Vector2i(1, 1), "in_ne": Vector2i(3, 1)},
		"face": {"trim": [Vector2i(0, 3), Vector2i(2, 4), Vector2i(4, 3)], "brick": [Vector2i(0, 4), Vector2i(2, 5), Vector2i(4, 4)], "ledge": [Vector2i(0, 5), Vector2i(2, 6), Vector2i(4, 5)], "trim_w": Vector2i(1, 4), "trim_e": Vector2i(3, 4)},
		"floor": [Vector2i(0, 7), Vector2i(0, 8), Vector2i(2, 8), Vector2i(0, 9)],
		"lava": {"slice": [Vector2i(19, 13), Vector2i(20, 13), Vector2i(21, 13), Vector2i(19, 14), Vector2i(20, 14), Vector2i(21, 14), Vector2i(19, 15), Vector2i(20, 15), Vector2i(21, 15)], "inner": [Vector2i(22, 13), Vector2i(24, 13), Vector2i(22, 15), Vector2i(24, 15)], "frames": 4, "frame_step": 3, "duration": 0.18, "source": 12},
		"decor": {
			"grate": [Vector2i(8, 6), Vector2i(9, 6), Vector2i(10, 6), Vector2i(8, 7), Vector2i(9, 7), Vector2i(10, 7), Vector2i(8, 8), Vector2i(9, 8), Vector2i(10, 8)],
			"rune_lit": [Vector2i(7, 9), Vector2i(8, 9), Vector2i(9, 9), Vector2i(7, 10), Vector2i(8, 10), Vector2i(9, 10), Vector2i(7, 11), Vector2i(8, 11), Vector2i(9, 11)],
			"rune": [Vector2i(7, 12), Vector2i(8, 12), Vector2i(9, 12), Vector2i(7, 13), Vector2i(8, 13), Vector2i(9, 13), Vector2i(7, 14), Vector2i(8, 14), Vector2i(9, 14)],
			"rubble": [Vector2i(4, 6), Vector2i(5, 6), Vector2i(6, 6), Vector2i(7, 6), Vector2i(7, 7), Vector2i(7, 8)],
			"key": [Vector2i(6, 16)],
		},
		# Those that don't block also stand in for old decor one could walk through.
		"props": {
			"heykel": {"rect": Rect2i(194, 150, 28, 58), "block": Vector2(16, 16), "shadow": "golge_orta"},
			"heykel_kirik": {"rect": Rect2i(226, 164, 28, 44), "shadow": "golge_orta"},
			"sutun": {"rect": Rect2i(144, 0, 16, 73), "block": Vector2(16, 16)},
			"sutun_mesale": {"rect": Rect2i(144, 0, 16, 73), "block": Vector2(16, 16), "light": {"at": Vector2(0.5, -49), "radius": 62.0, "color": Color8(0xff, 0xa8, 0x50), "flicker": 0.08}},
			"sutun_sonuk": {"rect": Rect2i(160, 0, 16, 73)},
			"sancak": {"rect": Rect2i(282, 8, 22, 56)},
			"fici": {"rect": Rect2i(128, 250, 16, 22), "shadow": "golge_minik"},
			"fici_kurukafa": {"rect": Rect2i(112, 250, 16, 22), "shadow": "golge_minik"},
			# Against the walls: pillars, pipes, the arch over a doorway (no hitbox, the wall blocks).
			"duvar_sutunu": {"rect": Rect2i(144, 0, 16, 73), "light": {"at": Vector2(0.5, -49), "radius": 56.0, "color": Color8(0xff, 0xa8, 0x50), "flicker": 0.08}},
			"duvar_sutunu_sonuk": {"rect": Rect2i(160, 0, 16, 73)},
			"boru": {"rect": Rect2i(176, 0, 16, 64)},
			"kemer": {"rect": Rect2i(224, 0, 48, 77)},
			# In the rooms.
			"varil": {"rect": Rect2i(128, 250, 16, 22), "block": Vector2(12, 8), "layers": WALK, "shadow": "golge_minik"},
			"varil_2": {"rect": Rect2i(144, 249, 16, 23), "block": Vector2(12, 8), "layers": WALK, "shadow": "golge_minik"},
			"varil_su": {"rect": Rect2i(112, 282, 16, 22), "block": Vector2(12, 8), "layers": WALK, "shadow": "golge_minik"},
			"varil_kurukafa": {"rect": Rect2i(112, 250, 16, 22), "block": Vector2(12, 8), "layers": WALK, "shadow": "golge_minik"},
			"kasa": {"rect": Rect2i(160, 249, 48, 23), "block": Vector2(44, 10), "layers": WALK, "shadow": "golge_orta"},
			"sandik": {"rect": Rect2i(240, 88, 32, 24), "block": Vector2(28, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"sandik_acik": {"rect": Rect2i(240, 115, 32, 29), "block": Vector2(28, 10), "layers": WALK, "shadow": "golge_kucuk"},
			# Little posts along a lava pool's near edge.
			"korkuluk": {"rect": Rect2i(212, 243, 8, 13)},
			# The Town pack's forge stations: burning furnaces, an anvil with its hammer going.
			"ocak": {"frames": {"sheet": STATIONS + "Furnace/Bricks_02-Sheet.png", "size": Vector2i(48, 64), "count": 4, "cols": 2, "fps": 6.0}, "block": Vector2(32, 16), "light": {"at": Vector2(0, -16), "radius": 72.0, "color": Color8(0xff, 0x8a, 0x30), "flicker": 0.15}},
			"ocak_demir": {"frames": {"sheet": STATIONS + "Furnace/Iron_02-Sheet.png", "size": Vector2i(48, 64), "count": 4, "cols": 2, "fps": 6.0}, "block": Vector2(32, 16), "light": {"at": Vector2(0, -16), "radius": 72.0, "color": Color8(0xff, 0x8a, 0x30), "flicker": 0.15}},
			"ors": {"frames": {"sheet": STATIONS + "Anvil/Anvil_01-Sheet.png", "size": Vector2i(64, 80), "count": 35, "cols": 8, "fps": 10.0, "bottom": 78}, "block": Vector2(32, 12), "layers": WALK},
			"mangal": {"frames": {"sheet": STATIONS + "Cooking Station/Grill/Grill_04-Sheet.png", "size": Vector2i(80, 64), "count": 4, "cols": 4, "fps": 6.0, "bottom": 52}, "block": Vector2(56, 10), "layers": WALK, "light": {"at": Vector2(0, -14), "radius": 40.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.2}},
			"komur": {"sheet": "Pixel Crawler - Town/Environment/Props/Static/Resources.png", "rect": Rect2i(11, 20, 31, 18)},
			# Urns from the Garden and Desert packs.
			"vazo": {"sheet": "Pixel Crawler - Garden Environment/Assets/Tiles.png", "rect": Rect2i(400, 331, 16, 21), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"amfora": {"sheet": "Pixel Crawler - Garden Environment/Assets/Tiles.png", "rect": Rect2i(417, 328, 14, 24), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"vazo_kirik": {"sheet": "Pixel Crawler - Garden Environment/Assets/Tiles.png", "rect": Rect2i(400, 363, 16, 21), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"amfora_kirik": {"sheet": "Pixel Crawler - Garden Environment/Assets/Tiles.png", "rect": Rect2i(417, 360, 14, 24), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"kup": {"sheet": "Pixel Crawler - Desert/Assets/Props.png", "rect": Rect2i(115, 74, 10, 22), "block": Vector2(8, 6), "layers": WALK, "shadow": "golge_minik"},
			"kup_2": {"sheet": "Pixel Crawler - Desert/Assets/Props.png", "rect": Rect2i(97, 78, 14, 18), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
		},
		# Old props (by scene) -> the theme's, and how far it moves so its box stays where it was.
		"swap": {
			"dikilitas_01": ["heykel", Vector2(-8, 0)],
			"magma_forges/art_01": ["heykel_kirik", Vector2.ZERO],
			"dragon_lair/art_01": ["heykel_kirik", Vector2.ZERO],
			"ash_temple/sutun_01": ["sutun", Vector2.ZERO],
			"ash_temple/sutun_02": ["sutun_sonuk", Vector2.ZERO],
			"ash_temple/art_01": ["sutun_sonuk", Vector2.ZERO],
			"ash_temple/art_02": ["sancak", Vector2.ZERO],
			"ash_temple/art_03": ["sancak", Vector2.ZERO],
			"ash_temple/art_04": ["sancak", Vector2.ZERO],
			"ash_temple/art_05": ["fici_kurukafa", Vector2.ZERO],
			# The pack has no torches: the lit pillar carries the torch's light.
			"ash_temple/mesale_01": ["sutun_mesale", Vector2.ZERO],
		},
		"lava_light": Color8(0xff, 0x70, 0x20),
	},
	"cave": {
		"sheet": "Pixel Crawler - Cave/Assets/Tiles.png",
		"source": 18,
		# The dark of the rock with its rim, roots hanging down its front.
		"wall_top": {"n": Vector2i(2, 0), "nw": Vector2i(1, 0), "ne": Vector2i(4, 0), "w": Vector2i(0, 2), "e": Vector2i(5, 2), "we": Vector2i(0, 2), "fill": Vector2i(2, 2), "in_nw": Vector2i(2, 2), "in_ne": Vector2i(2, 2)},
		"face": {"trim": [Vector2i(0, 4), Vector2i(2, 4), Vector2i(5, 4)], "brick": [Vector2i(0, 5), Vector2i(2, 5), Vector2i(5, 5)], "ledge": [Vector2i(0, 6), Vector2i(2, 6), Vector2i(5, 6)], "trim_w": Vector2i(0, 4), "trim_e": Vector2i(5, 4),
			# The roots' ends, hanging over the floor under the wall's front.
			"tips": [Vector2i(1, 7), Vector2i(2, 7), Vector2i(4, 7)]},
		"floor": [Vector2i(8, 15), Vector2i(7, 14), Vector2i(8, 14), Vector2i(9, 14), Vector2i(7, 15), Vector2i(9, 15), Vector2i(7, 16), Vector2i(8, 16), Vector2i(9, 16)],
		"decor": {
			"rubble": [Vector2i(12, 3), Vector2i(13, 3), Vector2i(14, 4), Vector2i(15, 4), Vector2i(12, 6), Vector2i(13, 6), Vector2i(14, 6), Vector2i(15, 6), Vector2i(16, 4), Vector2i(16, 5)],
			# A patch of moss (5 x 5, its edges ragged).
			"moss": [Vector2i(11, 13), Vector2i(12, 13), Vector2i(13, 13), Vector2i(14, 13), Vector2i(15, 13), Vector2i(11, 14), Vector2i(12, 14), Vector2i(13, 14), Vector2i(14, 14), Vector2i(15, 14), Vector2i(11, 15), Vector2i(12, 15), Vector2i(13, 15), Vector2i(14, 15), Vector2i(15, 15), Vector2i(11, 16), Vector2i(12, 16), Vector2i(13, 16), Vector2i(14, 16), Vector2i(15, 16), Vector2i(11, 17), Vector2i(12, 17), Vector2i(13, 17), Vector2i(14, 17), Vector2i(15, 17)],
			"tips": [Vector2i(1, 7), Vector2i(2, 7), Vector2i(4, 7)],
		},
		"props": {
			# Mushrooms (each with an icy twin).
			"mantar_dev": {"sheet": CAVE_PROPS, "rect": Rect2i(3, 105, 72, 147), "block": Vector2(14, 8), "layers": WALK},
			"mantar_dev_buz": {"sheet": CAVE_PROPS, "rect": Rect2i(83, 105, 72, 147), "block": Vector2(14, 8), "layers": WALK},
			"mantar_buyuk": {"sheet": CAVE_PROPS, "rect": Rect2i(3, 3, 87, 88), "block": Vector2(16, 8), "layers": WALK},
			"mantar_buyuk_buz": {"sheet": CAVE_PROPS, "rect": Rect2i(99, 3, 87, 88), "block": Vector2(16, 8), "layers": WALK},
			"mantar_egik": {"sheet": CAVE_PROPS, "rect": Rect2i(162, 96, 60, 96), "block": Vector2(14, 8), "layers": WALK},
			"mantar_egik_buz": {"sheet": CAVE_PROPS, "rect": Rect2i(226, 96, 60, 96), "block": Vector2(14, 8), "layers": WALK},
			"mantar_orta": {"sheet": CAVE_PROPS, "rect": Rect2i(196, 1, 53, 45), "block": Vector2(12, 8), "layers": WALK},
			"mantar_orta_buz": {"sheet": CAVE_PROPS, "rect": Rect2i(196, 49, 53, 45), "block": Vector2(12, 8), "layers": WALK},
			"mantar_ince": {"sheet": CAVE_PROPS, "rect": Rect2i(256, 0, 32, 80), "block": Vector2(10, 6), "layers": WALK},
			"mantar_kucuk": {"sheet": CAVE_PROPS, "rect": Rect2i(291, 3, 27, 28)},
			"mantar_kucuk_2": {"sheet": CAVE_PROPS, "rect": Rect2i(322, 2, 27, 28)},
			"mantar_kucuk_3": {"sheet": CAVE_PROPS, "rect": Rect2i(358, 4, 20, 26)},
			"mantar_kucuk_buz": {"sheet": CAVE_PROPS, "rect": Rect2i(291, 35, 27, 28)},
			"mantar_kucuk_buz_2": {"sheet": CAVE_PROPS, "rect": Rect2i(322, 34, 27, 28)},
			# Red tube growths.
			"tup_buyuk": {"rect": Rect2i(97, 117, 46, 59), "block": Vector2(24, 10), "layers": WALK},
			"tup": {"rect": Rect2i(148, 114, 41, 44), "block": Vector2(20, 8), "layers": WALK},
			"tup_2": {"rect": Rect2i(193, 117, 46, 41), "block": Vector2(20, 8), "layers": WALK},
			"tup_kucuk": {"rect": Rect2i(149, 162, 23, 28)},
			"tup_kucuk_2": {"rect": Rect2i(180, 164, 19, 25)},
			"tup_kucuk_3": {"rect": Rect2i(214, 163, 23, 24)},
			"tup_yer": {"rect": Rect2i(100, 176, 42, 30)},
			# Rock: stalagmites, stones, a glowing sprout.
			"dikit": {"rect": Rect2i(192, 0, 16, 48), "block": Vector2(10, 6), "layers": WALK},
			"dikit_orta": {"rect": Rect2i(210, 16, 12, 32), "block": Vector2(8, 6), "layers": WALK},
			"dikit_kucuk": {"rect": Rect2i(226, 32, 12, 16)},
			"kaya": {"rect": Rect2i(209, 66, 13, 12), "block": Vector2(10, 6), "layers": WALK},
			"kaya_2": {"rect": Rect2i(194, 67, 12, 8)},
			"kaya_gri": {"rect": Rect2i(194, 83, 11, 9)},
			"filiz": {"rect": Rect2i(240, 0, 13, 32), "light": {"at": Vector2(1, -26), "radius": 34.0, "color": Color8(0x60, 0xe8, 0xd0), "flicker": 0.05}},
			# Against the back wall (the wall blocks).
			"duvar_dikit": {"rect": Rect2i(192, 0, 16, 48)},
			"duvar_dikit_orta": {"rect": Rect2i(210, 16, 12, 32)},
			"duvar_filiz": {"rect": Rect2i(240, 0, 13, 32), "light": {"at": Vector2(1, -26), "radius": 34.0, "color": Color8(0x60, 0xe8, 0xd0), "flicker": 0.05}},
			"duvar_mantar": {"sheet": CAVE_PROPS, "rect": Rect2i(291, 3, 27, 28)},
			# Camp and mine: barrels, crates and chests (Forge, Hideout), sacks, a fire pit, cobwebs, ore.
			"varil": {"sheet": FORGE_SHEET, "rect": Rect2i(128, 250, 16, 22), "block": Vector2(12, 8), "layers": WALK, "shadow": "golge_minik"},
			"varil_2": {"sheet": FORGE_SHEET, "rect": Rect2i(144, 249, 16, 23), "block": Vector2(12, 8), "layers": WALK, "shadow": "golge_minik"},
			"kasa": {"sheet": FORGE_SHEET, "rect": Rect2i(160, 249, 48, 23), "block": Vector2(44, 10), "layers": WALK, "shadow": "golge_orta"},
			"sandik": {"sheet": FORGE_SHEET, "rect": Rect2i(240, 88, 32, 24), "block": Vector2(28, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"sandik_acik": {"sheet": FORGE_SHEET, "rect": Rect2i(240, 115, 32, 29), "block": Vector2(28, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"fici": {"sheet": FORGE_SHEET, "rect": Rect2i(128, 250, 16, 22), "shadow": "golge_minik"},
			"fici_buyuk": {"sheet": HIDEOUT, "rect": Rect2i(182, 336, 52, 64), "block": Vector2(44, 12), "layers": WALK, "shadow": "golge_orta"},
			"fici_orta": {"sheet": HIDEOUT, "rect": Rect2i(247, 350, 34, 50), "block": Vector2(28, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"cuval": {"sheet": HIDEOUT, "rect": Rect2i(278, 57, 20, 34), "block": Vector2(14, 6), "layers": WALK, "shadow": "golge_minik"},
			"cuval_2": {"sheet": HIDEOUT, "rect": Rect2i(310, 57, 20, 34), "block": Vector2(14, 6), "layers": WALK, "shadow": "golge_minik"},
			"ates_cukuru": {"sheet": HIDEOUT, "rect": Rect2i(278, 166, 36, 36), "block": Vector2(30, 12), "layers": WALK, "light": {"at": Vector2(0, -16), "radius": 64.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.2}},
			"ag": {"sheet": HIDEOUT, "rect": Rect2i(96, 336, 80, 64)},
			"ag_kose": {"sheet": HIDEOUT, "rect": Rect2i(48, 336, 48, 64)},
			"mum": {"sheet": HIDEOUT, "rect": Rect2i(404, 8, 8, 16), "light": {"at": Vector2(0, -14), "radius": 30.0, "color": Color8(0xff, 0xc0, 0x70), "flicker": 0.15}},
			"komur": {"sheet": "Pixel Crawler - Town/Environment/Props/Static/Resources.png", "rect": Rect2i(11, 20, 31, 18)},
			"cevher": {"sheet": "Pixel Crawler - Town/Environment/Props/Static/Resources.png", "rect": Rect2i(68, 20, 7, 9), "light": {"at": Vector2(0, -6), "radius": 22.0, "color": Color8(0x70, 0xc8, 0xff), "flicker": 0.04}},
			"anahtar": {"sheet": "Pixel Crawler - Town/Environment/Props/Static/Resources.png", "rect": Rect2i(98, 52, 12, 7)},
			"mangal": {"frames": {"sheet": STATIONS + "Cooking Station/Grill/Grill_04-Sheet.png", "size": Vector2i(80, 64), "count": 4, "cols": 4, "fps": 6.0, "bottom": 52}, "block": Vector2(56, 10), "layers": WALK, "light": {"at": Vector2(0, -14), "radius": 40.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.2}},
			# Urns from the Garden and Desert packs.
			"vazo": {"sheet": "Pixel Crawler - Garden Environment/Assets/Tiles.png", "rect": Rect2i(400, 331, 16, 21), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"amfora": {"sheet": "Pixel Crawler - Garden Environment/Assets/Tiles.png", "rect": Rect2i(417, 328, 14, 24), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"vazo_kirik": {"sheet": "Pixel Crawler - Garden Environment/Assets/Tiles.png", "rect": Rect2i(400, 363, 16, 21), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"amfora_kirik": {"sheet": "Pixel Crawler - Garden Environment/Assets/Tiles.png", "rect": Rect2i(417, 360, 14, 24), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"kup": {"sheet": "Pixel Crawler - Desert/Assets/Props.png", "rect": Rect2i(115, 74, 10, 22), "block": Vector2(8, 6), "layers": WALK, "shadow": "golge_minik"},
			"kup_2": {"sheet": "Pixel Crawler - Desert/Assets/Props.png", "rect": Rect2i(97, 78, 14, 18), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
		},
		# What the rooms ask for by role.
		"roles": {
			"looks": ["mantarlik", "yosunlu", "dikitli", "tuplu", "kamp", "maden"],
			"entrance": ["kasa", "varil", "fici_orta"],
			"watch": "mantar_egik", "broken": "dikit", "lit": "mantar_dev",
			# Every room gets more of the cave's growth; pebbles lie thicker.
			"extra": "cave", "rubble_rate": 0.09,
			"center": "moss",
			"wall": ["duvar_dikit", "duvar_filiz", "duvar_dikit_orta", "duvar_mantar"],
			"jokes": ["mangal", "anahtar", "sohbet"],
			"pair": "mantar_kucuk",
			"urns": ["vazo", "amfora", "vazo_kirik", "amfora_kirik", "kup", "kup_2"],
		},
	},
	"crypt": {
		"sheet": "Pixel Crawler - Castle Environment 0.3/Assets/Tiles.png",
		"source": 19,
		# The Castle's stone: a dark mass in a stone frame, a battlement band over two courses of brick.
		"wall_top": {"n": Vector2i(2, 0), "nw": Vector2i(1, 0), "ne": Vector2i(3, 0), "w": Vector2i(0, 2), "e": Vector2i(4, 2), "we": Vector2i(2, 0), "fill": Vector2i(2, 2), "in_nw": Vector2i(1, 1), "in_ne": Vector2i(3, 1)},
		"face": {"trim": [Vector2i(1, 4), Vector2i(2, 4), Vector2i(3, 4)], "brick": [Vector2i(0, 5), Vector2i(2, 5), Vector2i(4, 5)], "ledge": [Vector2i(0, 6), Vector2i(2, 6), Vector2i(4, 6)], "trim_w": Vector2i(0, 3), "trim_e": Vector2i(4, 3)},
		"floor": [Vector2i(10, 18), Vector2i(9, 18), Vector2i(11, 18), Vector2i(9, 19), Vector2i(10, 19), Vector2i(11, 19), Vector2i(10, 20)],
		"decor": {
			# A red carpet (9-slice) before the altar and the boss.
			"carpet": [Vector2i(18, 17), Vector2i(19, 17), Vector2i(20, 17), Vector2i(18, 18), Vector2i(19, 18), Vector2i(20, 18), Vector2i(18, 20), Vector2i(19, 20), Vector2i(20, 20)],
			"rubble": [Vector2i(9, 21), Vector2i(10, 21)],
		},
		"props": {
			# Graves and tombs (Cemetery).
			"mezar_tasi": {"sheet": GRAVES, "rect": Rect2i(1, 10, 14, 22), "block": Vector2(12, 6), "layers": WALK},
			"mezar_hac": {"sheet": GRAVES, "rect": Rect2i(17, 6, 14, 26), "block": Vector2(12, 6), "layers": WALK},
			"hac": {"sheet": GRAVES, "rect": Rect2i(32, 11, 16, 21), "block": Vector2(8, 6), "layers": WALK},
			"hac_kucuk": {"sheet": GRAVES, "rect": Rect2i(49, 13, 14, 19)},
			"hac_buyuk": {"sheet": GRAVES, "rect": Rect2i(70, 11, 20, 53), "block": Vector2(12, 8), "layers": WALK},
			"hac_demir": {"sheet": GRAVES, "rect": Rect2i(96, 4, 32, 60), "block": Vector2(8, 6), "layers": WALK},
			"hac_demir_2": {"sheet": GRAVES, "rect": Rect2i(129, 8, 30, 56), "block": Vector2(8, 6), "layers": WALK},
			"lahit": {"sheet": GRAVES, "rect": Rect2i(100, 96, 24, 96), "block": Vector2(22, 40), "layers": WALK},
			"lahit_2": {"sheet": GRAVES, "rect": Rect2i(132, 114, 24, 78), "block": Vector2(22, 40), "layers": WALK},
			"lahit_tugla": {"sheet": GRAVES, "rect": Rect2i(37, 105, 22, 39), "block": Vector2(20, 16), "layers": WALK},
			"lahit_duz": {"sheet": GRAVES, "rect": Rect2i(69, 105, 22, 39), "block": Vector2(20, 16), "layers": WALK},
			"turbe": {"sheet": GRAVES, "rect": Rect2i(161, 92, 30, 100), "block": Vector2(28, 44), "layers": WALK},
			"turbe_kuru": {"sheet": GRAVES, "rect": Rect2i(193, 92, 30, 100), "block": Vector2(28, 44), "layers": WALK},
			"heykel_kukuleta": {"sheet": GRAVES, "rect": Rect2i(8, 200, 16, 34), "block": Vector2(12, 8), "layers": WALK, "shadow": "golge_kucuk"},
			"heykel_melek": {"sheet": GRAVES, "rect": Rect2i(32, 201, 32, 33), "block": Vector2(16, 8), "layers": WALK, "shadow": "golge_kucuk"},
			"heykel_azrail": {"sheet": GRAVES, "rect": Rect2i(65, 192, 30, 43), "block": Vector2(16, 8), "layers": WALK, "shadow": "golge_kucuk"},
			# Coffins, a dug grave and its shovel (Cemetery).
			"tabut": {"sheet": CEM_PROPS, "rect": Rect2i(118, 7, 20, 35), "block": Vector2(18, 20), "layers": WALK},
			"tabut_2": {"sheet": CEM_PROPS, "rect": Rect2i(150, 7, 20, 35), "block": Vector2(18, 20), "layers": WALK},
			"tabut_acik": {"sheet": CEM_PROPS, "rect": Rect2i(182, 7, 20, 31), "block": Vector2(18, 18), "layers": WALK},
			"toprak": {"sheet": CEM_PROPS, "rect": Rect2i(96, 64, 31, 16)},
			"toprak_kurek": {"sheet": CEM_PROPS, "rect": Rect2i(128, 48, 31, 32)},
			"kurek": {"sheet": CEM_PROPS, "rect": Rect2i(82, 49, 11, 31)},
			# The Castle's: busts and statues, banners, candles, windows, pots.
			"bust": {"rect": Rect2i(279, 123, 18, 32), "block": Vector2(14, 8), "layers": WALK, "shadow": "golge_minik"},
			"bust_2": {"rect": Rect2i(311, 123, 18, 32), "block": Vector2(14, 8), "layers": WALK, "shadow": "golge_minik"},
			"samdan": {"sheet": HIDEOUT, "rect": Rect2i(404, 40, 8, 16), "block": Vector2(8, 6), "layers": WALK, "light": {"at": Vector2(0, -14), "radius": 46.0, "color": Color8(0xff, 0xc0, 0x70), "flicker": 0.12}},
			"saksi_agac": {"rect": Rect2i(341, 208, 23, 64), "block": Vector2(14, 8), "layers": WALK, "shadow": "golge_kucuk"},
			# The great hall's: the fire in its middle, the throne, fireplaces, cupboards, tables.
			"ocak_merkez": {"frames": {"sheet": STATIONS + "Bonfire/Fire_01-Sheet.png", "size": Vector2i(32, 48), "count": 4, "cols": 4, "fps": 8.0, "bottom": 50}, "block": Vector2(28, 26), "layers": WALK, "light": {"at": Vector2(0, -30), "radius": 110.0, "color": Color8(0xff, 0x8c, 0x38), "flicker": 0.22}},
			"taht": {"rect": Rect2i(278, 13, 20, 51), "block": Vector2(18, 10), "layers": WALK},
			"ocak_cukuru": {"sheet": HIDEOUT, "rect": Rect2i(278, 166, 36, 36)},
			"somine": {"rect": Rect2i(144, 202, 33, 56), "block": Vector2(30, 14), "layers": WALK, "light": {"at": Vector2(0, -16), "radius": 80.0, "color": Color8(0xff, 0x80, 0x30), "flicker": 0.18}},
			"dolap": {"rect": Rect2i(368, 48, 32, 38), "block": Vector2(30, 10), "layers": WALK},
			"uzun_masa": {"rect": Rect2i(320, 44, 48, 20), "block": Vector2(46, 14), "layers": WALK, "shadow": "golge_orta"},
			"buyuk_masa": {"rect": Rect2i(368, 12, 48, 36), "block": Vector2(46, 16), "layers": WALK, "shadow": "golge_orta"},
			"sandalye": {"rect": Rect2i(304, 28, 16, 36), "block": Vector2(12, 8), "layers": WALK},
			# On the back wall (the wall blocks).
			"sancak": {"rect": Rect2i(278, 172, 36, 46)},
			"sancak_kucuk": {"rect": Rect2i(320, 172, 16, 30)},
			"pencere": {"rect": Rect2i(194, 133, 12, 22)},
			"mum_duvar": {"rect": Rect2i(339, 178, 10, 11), "light": {"at": Vector2(0, -8), "radius": 36.0, "color": Color8(0xff, 0xc0, 0x70), "flicker": 0.12}},
			# Store and cobwebs (Forge, Hideout).
			"varil": {"sheet": FORGE_SHEET, "rect": Rect2i(128, 250, 16, 22), "block": Vector2(12, 8), "layers": WALK, "shadow": "golge_minik"},
			"kasa": {"sheet": FORGE_SHEET, "rect": Rect2i(160, 249, 48, 23), "block": Vector2(44, 10), "layers": WALK, "shadow": "golge_orta"},
			"sandik": {"sheet": FORGE_SHEET, "rect": Rect2i(240, 88, 32, 24), "block": Vector2(28, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"sandik_acik": {"sheet": FORGE_SHEET, "rect": Rect2i(240, 115, 32, 29), "block": Vector2(28, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"ag": {"sheet": HIDEOUT, "rect": Rect2i(96, 336, 80, 64)},
			"ag_kose": {"sheet": HIDEOUT, "rect": Rect2i(48, 336, 48, 64)},
			"mum": {"sheet": HIDEOUT, "rect": Rect2i(404, 8, 8, 16), "light": {"at": Vector2(0, -14), "radius": 30.0, "color": Color8(0xff, 0xc0, 0x70), "flicker": 0.15}},
			"anahtar": {"sheet": "Pixel Crawler - Town/Environment/Props/Static/Resources.png", "rect": Rect2i(98, 52, 12, 7)},
			# Urns (Castle, Garden, Desert).
			"kup": {"rect": Rect2i(304, 219, 16, 21), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"amfora": {"rect": Rect2i(310, 242, 20, 30), "block": Vector2(12, 6), "layers": WALK, "shadow": "golge_minik"},
			"vazo": {"sheet": "Pixel Crawler - Garden Environment/Assets/Tiles.png", "rect": Rect2i(400, 331, 16, 21), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"vazo_kirik": {"sheet": "Pixel Crawler - Garden Environment/Assets/Tiles.png", "rect": Rect2i(400, 363, 16, 21), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"kup_2": {"sheet": "Pixel Crawler - Desert/Assets/Props.png", "rect": Rect2i(97, 78, 14, 18), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
		},
		"roles": {
			"looks": ["lahitler", "tabutluk", "mezarlik", "sapel", "turbe", "kript_depo"],
			"entrance": ["kasa", "varil", "samdan"],
			"watch": "heykel_melek", "broken": "heykel_kukuleta", "lit": "samdan",
			"center": "carpet",
			"wall": ["pencere", "sancak", "mum_duvar", "sancak_kucuk"],
			"jokes": ["kurek", "anahtar", "sohbet"],
			"pair": "heykel_kukuleta",
			"urns": ["kup", "amfora", "vazo", "vazo_kirik", "kup_2"],
			"extra": "crypt", "rubble_rate": 0.0,
		},
	},
	"desert": {
		"sheet": "Pixel Crawler - Desert/Assets/Ground.png",
		"source": 20,
		# Sandstone: the wall's top only a frame (the dark of the map's background inside it), a blue
		# band and two courses of brick down its front.
		"wall_top": {"n": Vector2i(2, 7), "nw": Vector2i(1, 7), "ne": Vector2i(4, 7), "w": Vector2i(0, 9), "e": Vector2i(5, 9), "we": Vector2i(0, 9), "fill": Vector2i(2, 9), "in_nw": Vector2i(2, 9), "in_ne": Vector2i(2, 9)},
		"face": {"trim": [Vector2i(0, 12), Vector2i(2, 12), Vector2i(5, 12)], "brick": [Vector2i(0, 13), Vector2i(2, 13), Vector2i(5, 13)], "ledge": [Vector2i(1, 14), Vector2i(2, 14), Vector2i(4, 14)], "trim_w": Vector2i(1, 12), "trim_e": Vector2i(4, 12)},
		"floor": [Vector2i(10, 9), Vector2i(11, 9), Vector2i(10, 10), Vector2i(11, 10), Vector2i(12, 9)],
		"background": Color8(52, 34, 24),
		"decor": {
			"rubble": [Vector2i(10, 11), Vector2i(11, 11), Vector2i(12, 11), Vector2i(13, 11), Vector2i(10, 12), Vector2i(11, 12), Vector2i(12, 12), Vector2i(13, 12), Vector2i(10, 5), Vector2i(11, 5), Vector2i(12, 5), Vector2i(13, 5), Vector2i(14, 5)],
			# A patch of darker sand (4 x 5).
			"moss": [Vector2i(10, 0), Vector2i(11, 0), Vector2i(12, 0), Vector2i(13, 0), Vector2i(10, 1), Vector2i(11, 1), Vector2i(12, 1), Vector2i(13, 1), Vector2i(10, 2), Vector2i(11, 2), Vector2i(12, 2), Vector2i(13, 2), Vector2i(10, 3), Vector2i(11, 3), Vector2i(12, 3), Vector2i(13, 3), Vector2i(10, 4), Vector2i(11, 4), Vector2i(12, 4), Vector2i(13, 4)],
		},
		"patch_w": 4,
		"props": {
			# Obelisks and sandstone towers, whole and broken.
			"dikilitas": {"sheet": DESERT_PROPS, "rect": Rect2i(0, 7, 32, 121), "block": Vector2(28, 14), "layers": WALK},
			"dikilitas_kirik": {"sheet": DESERT_PROPS, "rect": Rect2i(32, 40, 32, 88), "block": Vector2(28, 14), "layers": WALK},
			"dikilitas_kirik_2": {"sheet": DESERT_PROPS, "rect": Rect2i(64, 64, 32, 64), "block": Vector2(28, 14), "layers": WALK},
			"kule": {"sheet": DESERT_PROPS, "rect": Rect2i(0, 128, 32, 48), "block": Vector2(26, 12), "layers": WALK},
			"kule_kirik": {"sheet": DESERT_PROPS, "rect": Rect2i(35, 140, 26, 36), "block": Vector2(22, 10), "layers": WALK},
			"kule_kirik_2": {"sheet": DESERT_PROPS, "rect": Rect2i(67, 148, 26, 28), "block": Vector2(22, 10), "layers": WALK},
			# Chests and urns.
			"sandik": {"sheet": DESERT_PROPS, "rect": Rect2i(97, 9, 30, 23), "block": Vector2(26, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"sandik_2": {"sheet": DESERT_PROPS, "rect": Rect2i(129, 8, 30, 24), "block": Vector2(26, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"sandik_acik": {"sheet": DESERT_PROPS, "rect": Rect2i(97, 41, 30, 23), "block": Vector2(26, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"sandik_acik_2": {"sheet": DESERT_PROPS, "rect": Rect2i(129, 40, 30, 24), "block": Vector2(26, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"kup": {"sheet": DESERT_PROPS, "rect": Rect2i(115, 74, 10, 22), "block": Vector2(8, 6), "layers": WALK, "shadow": "golge_minik"},
			"kup_2": {"sheet": DESERT_PROPS, "rect": Rect2i(97, 78, 14, 18), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"kup_kirik": {"sheet": DESERT_PROPS, "rect": Rect2i(129, 83, 14, 13)},
			"kup_kirik_2": {"sheet": DESERT_PROPS, "rect": Rect2i(147, 83, 10, 13)},
			# Bones of something huge, dead trees.
			"kaburga": {"sheet": DESERT_PROPS, "rect": Rect2i(4, 178, 54, 71), "block": Vector2(20, 10), "layers": WALK},
			"boynuz": {"sheet": DESERT_PROPS, "rect": Rect2i(68, 176, 39, 48), "block": Vector2(16, 8), "layers": WALK},
			"boynuz_2": {"sheet": DESERT_PROPS, "rect": Rect2i(113, 178, 29, 46), "block": Vector2(14, 8), "layers": WALK},
			"kemik": {"sheet": DESERT_PROPS, "rect": Rect2i(132, 212, 9, 12)},
			"kuru_agac": {"sheet": DESERT_PROPS, "rect": Rect2i(0, 262, 64, 74), "block": Vector2(12, 8), "layers": WALK},
			"kuru_agac_kucuk": {"sheet": DESERT_PROPS, "rect": Rect2i(66, 256, 25, 29)},
			# The ground's: pillars, cacti, bushes, rocks.
			"sutun": {"rect": Rect2i(0, 240, 16, 64), "block": Vector2(14, 10), "layers": WALK},
			"sutun_2": {"rect": Rect2i(16, 240, 16, 64), "block": Vector2(14, 10), "layers": WALK},
			"sutun_kirik": {"rect": Rect2i(32, 248, 16, 56), "block": Vector2(14, 10), "layers": WALK},
			"sutun_kirik_2": {"rect": Rect2i(48, 264, 16, 40), "block": Vector2(14, 10), "layers": WALK},
			"kaktus": {"rect": Rect2i(160, 224, 16, 46), "block": Vector2(10, 6), "layers": WALK},
			"kaktus_dal": {"rect": Rect2i(184, 224, 32, 46), "block": Vector2(12, 6), "layers": WALK},
			"kaktus_kucuk": {"rect": Rect2i(128, 229, 16, 26)},
			"kaktus_ince": {"rect": Rect2i(146, 231, 12, 40), "block": Vector2(8, 6), "layers": WALK},
			"cali": {"rect": Rect2i(176, 272, 48, 32)},
			"kaya_buyuk": {"rect": Rect2i(160, 104, 50, 40), "block": Vector2(40, 12), "layers": WALK},
			"kaya": {"rect": Rect2i(208, 112, 32, 32), "block": Vector2(24, 10), "layers": WALK},
			# Against the back wall.
			"duvar_sutun": {"rect": Rect2i(0, 240, 16, 64)},
			"duvar_sutun_kirik": {"rect": Rect2i(32, 248, 16, 56)},
			"duvar_kule": {"sheet": DESERT_PROPS, "rect": Rect2i(35, 140, 26, 36)},
			# Caravan camp (Hideout, Town).
			"cuval": {"sheet": HIDEOUT, "rect": Rect2i(278, 57, 20, 34), "block": Vector2(14, 6), "layers": WALK, "shadow": "golge_minik"},
			"cuval_2": {"sheet": HIDEOUT, "rect": Rect2i(310, 57, 20, 34), "block": Vector2(14, 6), "layers": WALK, "shadow": "golge_minik"},
			"ates_cukuru": {"sheet": HIDEOUT, "rect": Rect2i(278, 166, 36, 36), "block": Vector2(30, 12), "layers": WALK, "light": {"at": Vector2(0, -16), "radius": 64.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.2}},
			"mangal": {"frames": {"sheet": STATIONS + "Cooking Station/Grill/Grill_04-Sheet.png", "size": Vector2i(80, 64), "count": 4, "cols": 4, "fps": 6.0, "bottom": 52}, "block": Vector2(56, 10), "layers": WALK, "light": {"at": Vector2(0, -14), "radius": 40.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.2}},
			"fici": {"sheet": FORGE_SHEET, "rect": Rect2i(128, 250, 16, 22), "shadow": "golge_minik"},
			"anahtar": {"sheet": "Pixel Crawler - Town/Environment/Props/Static/Resources.png", "rect": Rect2i(98, 52, 12, 7)},
		},
		"roles": {
			"looks": ["harabe", "kemikler", "kervan", "vaha", "hazine", "dikilitaslar"],
			"entrance": ["sandik", "kup", "cuval"],
			"watch": "dikilitas_kirik", "broken": "sutun_kirik", "lit": "ates_cukuru",
			"center": "moss",
			"wall": ["duvar_sutun", "duvar_kule", "duvar_sutun_kirik"],
			"jokes": ["mangal", "anahtar", "sohbet"],
			"pair": "kaktus",
			"urns": ["kup", "kup_2", "kup_kirik", "kup_kirik_2"],
			"extra": "desert", "rubble_rate": 0.06,
		},
	},
	"temple": {
		"sheet": "Pixel Crawler - Garden Environment/Assets/Tiles.png",
		"source": 21,
		# The Garden's own stone wall: a dark mass in a stone frame, a battlement band over two
		# courses of brick; the Garden's paving underfoot.
		"wall_top": {"n": Vector2i(13, 0), "nw": Vector2i(12, 0), "ne": Vector2i(14, 0), "w": Vector2i(11, 2), "e": Vector2i(15, 2), "we": Vector2i(13, 0), "fill": Vector2i(13, 2), "in_nw": Vector2i(12, 1), "in_ne": Vector2i(14, 1)},
		"face": {"trim": [Vector2i(12, 4), Vector2i(13, 4), Vector2i(14, 4)], "brick": [Vector2i(11, 5), Vector2i(13, 5), Vector2i(15, 5)], "ledge": [Vector2i(11, 6), Vector2i(13, 6), Vector2i(15, 6)], "trim_w": Vector2i(11, 3), "trim_e": Vector2i(15, 3)},
		"floor": [Vector2i(9, 1)],
		# The sunken water (the Sewer's, still and murky): drawn like the Forge's lava, but water.
		"lava": {"sheet": "Pixel Crawler - Sewer/Assets/Water.png", "slice": [Vector2i(0, 0), Vector2i(1, 0), Vector2i(2, 0), Vector2i(0, 1), Vector2i(1, 1), Vector2i(2, 1), Vector2i(0, 2), Vector2i(1, 2), Vector2i(2, 2)], "inner": [Vector2i(3, 0), Vector2i(5, 0), Vector2i(3, 2), Vector2i(5, 2)], "frames": 4, "frame_step": 3, "duration": 0.24, "source": 22, "tile": WATER_T},
		"decor": {
			# A stone causeway over the water (the paving), a flower bed before the boss.
			"grate": [Vector2i(9, 1), Vector2i(9, 1), Vector2i(9, 1), Vector2i(9, 1), Vector2i(9, 1), Vector2i(9, 1), Vector2i(9, 1), Vector2i(9, 1), Vector2i(9, 1)],
			"bed": [Vector2i(0, 25), Vector2i(1, 25), Vector2i(2, 25), Vector2i(0, 26), Vector2i(1, 26), Vector2i(2, 26), Vector2i(0, 27), Vector2i(1, 27), Vector2i(2, 27)],
			"moss": [Vector2i(0, 24), Vector2i(1, 24), Vector2i(2, 24), Vector2i(3, 24)],
			"rubble": [],
		},
		"patch_w": 4,
		"props": {
			# The Garden's statues, fountain and pedestals: what's left of the temple.
			"heykel_kaide": {"sheet": GARDEN, "rect": Rect2i(432, 96, 48, 80), "block": Vector2(36, 18), "layers": WALK},
			"heykel_2": {"sheet": GARDEN, "rect": Rect2i(436, 180, 44, 60), "block": Vector2(30, 14), "layers": WALK},
			"heykel": {"sheet": GARDEN, "rect": Rect2i(418, 420, 28, 54), "block": Vector2(20, 8), "layers": WALK, "shadow": "golge_kucuk"},
			"heykel_kucuk": {"sheet": GARDEN, "rect": Rect2i(453, 432, 25, 42), "block": Vector2(18, 8), "layers": WALK, "shadow": "golge_kucuk"},
			"cesme": {"sheet": GARDEN, "rect": Rect2i(400, 2, 80, 94), "block": Vector2(72, 40), "layers": WALK},
			"kaide": {"sheet": GARDEN, "rect": Rect2i(384, 448, 32, 24), "block": Vector2(28, 8), "layers": WALK},
			"servi": {"sheet": GARDEN, "rect": Rect2i(128, 320, 16, 30), "block": Vector2(8, 6), "layers": WALK},
			# The Sewer's: broken pillars, a chain, lamps, chests.
			"sutun": {"sheet": SEWER_TILES, "rect": Rect2i(192, 48, 16, 80), "block": Vector2(14, 12), "layers": WALK},
			"sutun_kirik": {"sheet": SEWER_TILES, "rect": Rect2i(208, 64, 16, 64), "block": Vector2(14, 12), "layers": WALK},
			"sutun_kirik_2": {"sheet": SEWER_TILES, "rect": Rect2i(224, 80, 16, 48), "block": Vector2(14, 12), "layers": WALK},
			"lamba": {"sheet": SEWER_PROPS, "rect": Rect2i(100, 5, 9, 20), "block": Vector2(8, 6), "layers": WALK, "light": {"at": Vector2(0, -16), "radius": 48.0, "color": Color8(0xb8, 0xff, 0x9a), "flicker": 0.1}},
			"zincir": {"sheet": SEWER_PROPS, "rect": Rect2i(163, 0, 10, 42)},
			"sandik": {"sheet": SEWER_PROPS, "rect": Rect2i(130, 4, 28, 28), "block": Vector2(26, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"sandik_acik": {"sheet": SEWER_PROPS, "rect": Rect2i(129, 40, 29, 42), "block": Vector2(26, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"iksir": {"sheet": SEWER_PROPS, "rect": Rect2i(99, 164, 10, 12)},
			"iksir_2": {"sheet": SEWER_PROPS, "rect": Rect2i(115, 164, 10, 12)},
			# On the back wall: the Garden's arched doorway, lamps, a chain, trimmed bushes.
			"duvar_kemer": {"rect": Rect2i(256, 80, 32, 48)},
			"duvar_servi": {"rect": Rect2i(128, 320, 16, 30)},
			"duvar_lamba": {"sheet": SEWER_PROPS, "rect": Rect2i(116, 5, 9, 20), "light": {"at": Vector2(0, -16), "radius": 44.0, "color": Color8(0xb8, 0xff, 0x9a), "flicker": 0.1}},
			"duvar_zincir": {"sheet": SEWER_PROPS, "rect": Rect2i(163, 0, 10, 42)},
			# Store (Forge), a grill for the joke.
			"varil": {"sheet": FORGE_SHEET, "rect": Rect2i(128, 250, 16, 22), "block": Vector2(12, 8), "layers": WALK, "shadow": "golge_minik"},
			"varil_2": {"sheet": FORGE_SHEET, "rect": Rect2i(144, 249, 16, 23), "block": Vector2(12, 8), "layers": WALK, "shadow": "golge_minik"},
			"kasa": {"sheet": FORGE_SHEET, "rect": Rect2i(160, 249, 48, 23), "block": Vector2(44, 10), "layers": WALK, "shadow": "golge_orta"},
			"fici": {"sheet": FORGE_SHEET, "rect": Rect2i(128, 250, 16, 22), "shadow": "golge_minik"},
			"mangal": {"frames": {"sheet": STATIONS + "Cooking Station/Grill/Grill_04-Sheet.png", "size": Vector2i(80, 64), "count": 4, "cols": 4, "fps": 6.0, "bottom": 52}, "block": Vector2(56, 10), "layers": WALK, "light": {"at": Vector2(0, -14), "radius": 40.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.2}},
			"anahtar": {"sheet": "Pixel Crawler - Town/Environment/Props/Static/Resources.png", "rect": Rect2i(98, 52, 12, 7)},
			# Urns (Garden, Desert).
			"vazo": {"sheet": GARDEN, "rect": Rect2i(400, 331, 16, 21), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"amfora": {"sheet": GARDEN, "rect": Rect2i(417, 328, 14, 24), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"vazo_kirik": {"sheet": GARDEN, "rect": Rect2i(400, 363, 16, 21), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"amfora_kirik": {"sheet": GARDEN, "rect": Rect2i(417, 360, 14, 24), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"kup": {"sheet": "Pixel Crawler - Desert/Assets/Props.png", "rect": Rect2i(115, 74, 10, 22), "block": Vector2(8, 6), "layers": WALK, "shadow": "golge_minik"},
		},
		"roles": {
			"looks": ["su_havuzu", "su_kanali", "heykeller", "sunak", "kanalizasyon", "tapinak_depo"],
			"entrance": ["sandik", "varil", "lamba"],
			"watch": "heykel_kaide", "broken": "sutun_kirik", "lit": "lamba",
			"center": "bed",
			"wall": ["duvar_lamba", "duvar_kemer", "duvar_servi", "duvar_zincir"],
			"jokes": ["mangal", "anahtar", "sohbet"],
			"pair": "heykel",
			"urns": ["vazo", "amfora", "vazo_kirik", "amfora_kirik", "kup"],
			"extra": "temple", "rubble_rate": 0.0,
		},
	},
	"hideout": {
		"sheet": "Pixel Crawler - Hideout/Assets/Tiles.png",
		"source": 23,
		# A wooden fortress: dark mass in a timber frame, a beam over stone courses down its front.
		"wall_top": {"n": Vector2i(2, 0), "nw": Vector2i(1, 0), "ne": Vector2i(3, 0), "w": Vector2i(0, 2), "e": Vector2i(4, 2), "we": Vector2i(0, 2), "fill": Vector2i(2, 2), "in_nw": Vector2i(1, 1), "in_ne": Vector2i(3, 1)},
		"face": {"trim": [Vector2i(0, 4), Vector2i(2, 4), Vector2i(4, 4)], "brick": [Vector2i(0, 5), Vector2i(2, 5), Vector2i(4, 5)], "ledge": [Vector2i(0, 6), Vector2i(2, 6), Vector2i(4, 6)], "trim_w": Vector2i(1, 4), "trim_e": Vector2i(3, 4)},
		"floor": [Vector2i(1, 12), Vector2i(0, 12), Vector2i(2, 12), Vector2i(0, 13), Vector2i(1, 13), Vector2i(2, 13)],
		"decor": {
			"rubble": [Vector2i(1, 19), Vector2i(0, 20), Vector2i(1, 20), Vector2i(0, 21), Vector2i(1, 21), Vector2i(0, 22), Vector2i(1, 22)],
			# Trodden dark earth (3 x 2).
			"moss": [Vector2i(3, 12), Vector2i(4, 12), Vector2i(5, 12), Vector2i(3, 13), Vector2i(4, 13), Vector2i(5, 13)],
		},
		"patch_w": 3,
		"props": {
			"yatak": {"rect": Rect2i(278, 57, 20, 34), "block": Vector2(16, 10), "layers": WALK},
			"yatak_2": {"rect": Rect2i(310, 57, 20, 34), "block": Vector2(16, 10), "layers": WALK},
			"masa": {"rect": Rect2i(356, 133, 40, 40), "block": Vector2(36, 14), "layers": WALK, "shadow": "golge_orta"},
			"raf": {"rect": Rect2i(290, 119, 44, 41), "block": Vector2(40, 10), "layers": WALK},
			"raf_ince": {"rect": Rect2i(320, 169, 16, 39), "block": Vector2(14, 8), "layers": WALK},
			"cali": {"rect": Rect2i(291, 245, 57, 42), "block": Vector2(40, 10), "layers": WALK},
			"cali_2": {"rect": Rect2i(353, 272, 45, 31), "block": Vector2(34, 8), "layers": WALK},
			"fici_buyuk": {"rect": Rect2i(182, 336, 52, 64), "block": Vector2(44, 12), "layers": WALK, "shadow": "golge_orta"},
			"fici_orta": {"rect": Rect2i(247, 350, 34, 50), "block": Vector2(28, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"fici_kucuk": {"rect": Rect2i(240, 310, 32, 26), "block": Vector2(28, 8), "layers": WALK, "shadow": "golge_kucuk"},
			"ates_cukuru": {"rect": Rect2i(278, 166, 36, 36), "block": Vector2(30, 12), "layers": WALK, "light": {"at": Vector2(0, -16), "radius": 64.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.2}},
			"ates": {"frames": {"sheet": STATIONS + "Bonfire/Bonfire_03-Sheet.png", "size": Vector2i(32, 32), "count": 4, "cols": 4, "fps": 8.0}, "block": Vector2(24, 10), "layers": WALK, "light": {"at": Vector2(0, -14), "radius": 70.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.22}},
			"ates_buyuk": {"frames": {"sheet": STATIONS + "Bonfire/Fire_01-Sheet.png", "size": Vector2i(32, 48), "count": 4, "cols": 4, "fps": 8.0}, "block": Vector2(24, 10), "layers": WALK, "light": {"at": Vector2(0, -20), "radius": 84.0, "color": Color8(0xff, 0x88, 0x30), "flicker": 0.25}},
			"ag": {"rect": Rect2i(96, 336, 80, 64)},
			"ag_kose": {"rect": Rect2i(48, 336, 48, 64)},
			"mum": {"rect": Rect2i(404, 8, 8, 16), "light": {"at": Vector2(0, -14), "radius": 30.0, "color": Color8(0xff, 0xc0, 0x70), "flicker": 0.15}},
			# On the back wall: skull banners, timber posts, a door.
			"sancak": {"rect": Rect2i(288, 336, 48, 59)},
			"duvar_kiris": {"rect": Rect2i(256, 16, 16, 64)},
			"kapi": {"rect": Rect2i(273, 0, 30, 34)},
			# Store (Forge), a grill, the key.
			"varil": {"sheet": FORGE_SHEET, "rect": Rect2i(128, 250, 16, 22), "block": Vector2(12, 8), "layers": WALK, "shadow": "golge_minik"},
			"kasa": {"sheet": FORGE_SHEET, "rect": Rect2i(160, 249, 48, 23), "block": Vector2(44, 10), "layers": WALK, "shadow": "golge_orta"},
			"sandik": {"sheet": FORGE_SHEET, "rect": Rect2i(240, 88, 32, 24), "block": Vector2(28, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"sandik_acik": {"sheet": FORGE_SHEET, "rect": Rect2i(240, 115, 32, 29), "block": Vector2(28, 10), "layers": WALK, "shadow": "golge_kucuk"},
			"fici": {"sheet": FORGE_SHEET, "rect": Rect2i(128, 250, 16, 22), "shadow": "golge_minik"},
			"mangal": {"frames": {"sheet": STATIONS + "Cooking Station/Grill/Grill_04-Sheet.png", "size": Vector2i(80, 64), "count": 4, "cols": 4, "fps": 6.0, "bottom": 52}, "block": Vector2(56, 10), "layers": WALK, "light": {"at": Vector2(0, -14), "radius": 40.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.2}},
			"anahtar": {"sheet": "Pixel Crawler - Town/Environment/Props/Static/Resources.png", "rect": Rect2i(98, 52, 12, 7)},
			# Urns (Garden, Desert).
			"vazo": {"sheet": GARDEN, "rect": Rect2i(400, 331, 16, 21), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"vazo_kirik": {"sheet": GARDEN, "rect": Rect2i(400, 363, 16, 21), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
			"kup": {"sheet": "Pixel Crawler - Desert/Assets/Props.png", "rect": Rect2i(115, 74, 10, 22), "block": Vector2(8, 6), "layers": WALK, "shadow": "golge_minik"},
			"kup_2": {"sheet": "Pixel Crawler - Desert/Assets/Props.png", "rect": Rect2i(97, 78, 14, 18), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_minik"},
		},
		"roles": {
			"looks": ["kisla", "ziyafet", "ork_depo", "ates_cemberi", "karargah"],
			"entrance": ["kasa", "varil", "ates"],
			"watch": "ates", "broken": "fici_orta", "lit": "ates_buyuk",
			"center": "moss",
			"wall": ["sancak", "duvar_kiris", "kapi", "duvar_kiris"],
			"jokes": ["mangal", "anahtar", "sohbet"],
			"pair": "yatak",
			"urns": ["vazo", "vazo_kirik", "kup", "kup_2"],
			"extra": "hideout", "rubble_rate": 0.05,
		},
	},
	"kar": {
		"sheet": "Pixel Crawler - Town/Environment/Tilesets/Wall_Tiles.png",
		"source": 24,
		# Grey rock: its pale top, dark courses down its front, the last one meeting the snow;
		# below it the snow drifts against the rock's foot.
		"wall_top": {"n": Vector2i(8, 0), "nw": Vector2i(7, 0), "ne": Vector2i(10, 0), "w": Vector2i(6, 2), "e": Vector2i(11, 2), "we": Vector2i(8, 0), "fill": Vector2i(8, 2), "in_nw": Vector2i(8, 2), "in_ne": Vector2i(8, 2)},
		"face": {"trim": [Vector2i(6, 5), Vector2i(8, 5), Vector2i(11, 5)], "brick": [Vector2i(6, 6), Vector2i(8, 6), Vector2i(11, 6)], "ledge": [Vector2i(7, 10), Vector2i(8, 10), Vector2i(10, 10)], "trim_w": Vector2i(6, 5), "trim_e": Vector2i(11, 5),
			"tips": [Vector2i(7, 11), Vector2i(8, 11), Vector2i(10, 11)]},
		# The snow (and the ice) underfoot are the Floors sheet's.
		# The rock's rounded edges are see-through: snow shows behind them.
		"background": Color8(226, 232, 244),
		"floor_sheet": "Pixel Crawler - Town/Environment/Tilesets/Floors_Tiles.png",
		"floor_source": 25,
		"floor": [Vector2i(1, 22), Vector2i(0, 22), Vector2i(2, 22), Vector2i(3, 22), Vector2i(4, 22), Vector2i(0, 23), Vector2i(1, 23), Vector2i(2, 23), Vector2i(3, 23), Vector2i(4, 23)],
		"floor_by_id": {ICE: [Vector2i(1, 24), Vector2i(2, 24), Vector2i(3, 24), Vector2i(1, 25), Vector2i(2, 25), Vector2i(3, 25)]},
		"decor": {
			"rubble": [],
			"tips": [Vector2i(7, 11), Vector2i(8, 11), Vector2i(10, 11)],
		},
		"props": {
			# Pines (teal and green), dead pines, icy dead oaks, stumps.
			"cam": {"sheet": TREES + "Model_02/Size_05.png", "rect": Rect2i(1, 3, 92, 157), "block": Vector2(12, 8), "layers": WALK},
			"cam_2": {"sheet": TREES + "Model_02/Size_05.png", "rect": Rect2i(97, 3, 92, 157), "block": Vector2(12, 8), "layers": WALK},
			"cam_3": {"sheet": TREES + "Model_02/Size_05.png", "rect": Rect2i(1, 163, 92, 157), "block": Vector2(12, 8), "layers": WALK},
			"cam_4": {"sheet": TREES + "Model_02/Size_05.png", "rect": Rect2i(97, 163, 92, 157), "block": Vector2(12, 8), "layers": WALK},
			"cam_kucuk": {"sheet": TREES + "Model_02/Size_04.png", "rect": Rect2i(4, 9, 54, 103), "block": Vector2(10, 6), "layers": WALK},
			"cam_kucuk_2": {"sheet": TREES + "Model_02/Size_04.png", "rect": Rect2i(68, 121, 54, 103), "block": Vector2(10, 6), "layers": WALK},
			"cam_kuru": {"sheet": TREES + "Model_02/Size_05.png", "rect": Rect2i(197, 8, 87, 152), "block": Vector2(10, 6), "layers": WALK},
			"mese_buz": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(337, 2, 100, 158), "block": Vector2(14, 8), "layers": WALK},
			"kutuk_kar": {"sheet": TREES + "Model_02/Size_05.png", "rect": Rect2i(229, 272, 19, 16), "block": Vector2(14, 6), "layers": WALK},
			"kutuk_buz": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(247, 326, 61, 42), "block": Vector2(30, 10), "layers": WALK},
			# Grey rocks, stones, ice crystals, twigs and leaves.
			"kaya_buyuk": {"sheet": ROCKS, "rect": Rect2i(98, 19, 28, 43), "block": Vector2(24, 12), "layers": WALK},
			"kaya": {"sheet": ROCKS, "rect": Rect2i(131, 19, 26, 27), "block": Vector2(22, 10), "layers": WALK},
			"tas": {"sheet": ROCKS, "rect": Rect2i(161, 19, 14, 11)},
			"tas_2": {"sheet": ROCKS, "rect": Rect2i(176, 17, 16, 14)},
			"tas_3": {"sheet": ROCKS, "rect": Rect2i(144, 51, 15, 10)},
			"kristal": {"sheet": ROCKS, "rect": Rect2i(146, 279, 12, 25), "block": Vector2(10, 6), "layers": WALK, "light": {"at": Vector2(0, -12), "radius": 34.0, "color": Color8(0x80, 0xc8, 0xff), "flicker": 0.04}},
			"kristal_2": {"sheet": ROCKS, "rect": Rect2i(179, 289, 10, 15)},
			"kristal_3": {"sheet": ROCKS, "rect": Rect2i(164, 289, 8, 15)},
			"dal": {"sheet": VEGETATION, "rect": Rect2i(290, 19, 13, 9)},
			"dal_2": {"sheet": VEGETATION, "rect": Rect2i(323, 20, 11, 10)},
			"dal_3": {"sheet": VEGETATION, "rect": Rect2i(260, 0, 9, 16)},
			"yaprak": {"sheet": VEGETATION, "rect": Rect2i(49, 338, 14, 14)},
			"yaprak_2": {"sheet": VEGETATION, "rect": Rect2i(68, 360, 28, 8)},
			# Frozen pools: the snow patch's soft edge filled with the Floors sheet's ice (flat).
			"buz_golu": {"png": "res://assets/kar/buz_golu_1.png", "rect": Rect2i(0, 0, 80, 80), "z": -1},
			"buz_golu_2": {"png": "res://assets/kar/buz_golu_2.png", "rect": Rect2i(0, 0, 80, 80), "z": -1},
			"ates": {"frames": {"sheet": STATIONS + "Bonfire/Bonfire_03-Sheet.png", "size": Vector2i(32, 32), "count": 4, "cols": 4, "fps": 8.0}, "block": Vector2(24, 10), "layers": WALK, "light": {"at": Vector2(0, -14), "radius": 80.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.22}},
		},
		# The open snowfield's lists (the open builder's).
		"field": {
			"auto_crown": true,
			"green": ["cam", "cam_2", "cam_3", "cam_4", "cam_kucuk", "cam_kucuk_2"],
			"purple": ["cam_kuru", "mese_buz", "cam", "cam_kucuk"],
			"teal": ["cam_3", "cam_4", "cam_kucuk_2"],
			"rare": ["kaya", "kaya_buyuk", "kutuk_buz", "kutuk_kar", "cam_kuru"],
			"glow": ["kristal"],
			"glow_near": ["kristal_2", "kristal_3", "tas", "kristal_2"],
			"bits": ["tas", "tas_2", "tas_3", "dal", "dal_2", "dal_3", "yaprak", "yaprak_2"],
			"patches": ["buz_golu", "buz_golu_2"],
			"camp": ["ates", "kutuk_kar"],
		},
	},
	"orman": {
		"sheet": "Pixel Crawler - Fairy Forest 1.7/Assets/Tiles.png",
		"source": 26,
		# The grass-topped plateau: its rim of stones, roots hanging down its front.
		"wall_top": {"n": Vector2i(2, 0), "nw": Vector2i(1, 0), "ne": Vector2i(4, 0), "w": Vector2i(0, 2), "e": Vector2i(5, 2), "we": Vector2i(2, 2), "fill": Vector2i(2, 2), "in_nw": Vector2i(2, 2), "in_ne": Vector2i(2, 2)},
		"face": {"trim": [Vector2i(0, 4), Vector2i(2, 4), Vector2i(5, 4)], "brick": [Vector2i(0, 5), Vector2i(2, 5), Vector2i(5, 5)], "ledge": [Vector2i(0, 6), Vector2i(2, 6), Vector2i(5, 6)], "trim_w": Vector2i(0, 4), "trim_e": Vector2i(5, 4),
			"tips": [Vector2i(1, 7), Vector2i(2, 7), Vector2i(4, 7)]},
		# Plain grass (the same green as the plateau's top); grass under the walls' see-through edges.
		"floor": [Vector2i(7, 18), Vector2i(7, 17), Vector2i(7, 19)],
		"underlay": true,
		"background": Color8(12, 60, 34),
		"decor": {
			"rubble": [],
			"tips": [Vector2i(1, 7), Vector2i(2, 7), Vector2i(4, 7)],
			# 3 x 3 patches in the grass: bare earth, darker grass.
			"moss": [Vector2i(0, 8), Vector2i(1, 8), Vector2i(2, 8), Vector2i(0, 9), Vector2i(1, 9), Vector2i(2, 9), Vector2i(0, 10), Vector2i(1, 10), Vector2i(2, 10)],
			"dark": [Vector2i(0, 14), Vector2i(1, 14), Vector2i(2, 14), Vector2i(0, 15), Vector2i(1, 15), Vector2i(2, 15), Vector2i(0, 16), Vector2i(1, 16), Vector2i(2, 16)],
		},
		"patch_w": 3,
		"props": {
			# Trees in all the forest's colours, four sizes ("foot": where the trunk stands in the picture).
			"agac": {"sheet": FF_TREES, "rect": Rect2i(2, 9, 186, 215), "foot": 116, "block": Vector2(30, 12), "layers": WALK},
			"agac_2": {"sheet": FF_TREES, "rect": Rect2i(2, 233, 186, 215), "foot": 116, "block": Vector2(30, 12), "layers": WALK},
			"agac_koyu": {"sheet": FF_TREES, "rect": Rect2i(2, 457, 186, 215), "foot": 116, "block": Vector2(30, 12), "layers": WALK},
			"agac_zeytin": {"sheet": FF_TREES, "rect": Rect2i(626, 9, 186, 215), "foot": 116, "block": Vector2(30, 12), "layers": WALK},
			"agac_mor": {"sheet": FF_TREES, "rect": Rect2i(2, 681, 186, 215), "foot": 116, "block": Vector2(30, 12), "layers": WALK},
			"agac_mor_2": {"sheet": FF_TREES, "rect": Rect2i(2, 905, 186, 215), "foot": 116, "block": Vector2(30, 12), "layers": WALK},
			"agac_teal": {"sheet": FF_TREES, "rect": Rect2i(626, 681, 186, 215), "foot": 116, "block": Vector2(30, 12), "layers": WALK},
			"agac_teal_2": {"sheet": FF_TREES, "rect": Rect2i(626, 905, 186, 215), "foot": 116, "block": Vector2(30, 12), "layers": WALK},
			"agac_orta": {"sheet": FF_TREES, "rect": Rect2i(198, 30, 133, 194), "foot": 61, "block": Vector2(24, 10), "layers": WALK},
			"agac_orta_2": {"sheet": FF_TREES, "rect": Rect2i(198, 254, 133, 194), "foot": 61, "block": Vector2(24, 10), "layers": WALK},
			"agac_orta_koyu": {"sheet": FF_TREES, "rect": Rect2i(198, 478, 133, 194), "foot": 61, "block": Vector2(24, 10), "layers": WALK},
			"agac_orta_zeytin": {"sheet": FF_TREES, "rect": Rect2i(822, 30, 133, 194), "foot": 61, "block": Vector2(24, 10), "layers": WALK},
			"agac_orta_mor": {"sheet": FF_TREES, "rect": Rect2i(198, 702, 133, 194), "foot": 61, "block": Vector2(24, 10), "layers": WALK},
			"agac_orta_teal": {"sheet": FF_TREES, "rect": Rect2i(822, 702, 133, 194), "foot": 61, "block": Vector2(24, 10), "layers": WALK},
			"agac_kucuk": {"sheet": FF_TREES, "rect": Rect2i(336, 78, 111, 146), "foot": 55, "block": Vector2(18, 8), "layers": WALK},
			"agac_kucuk_2": {"sheet": FF_TREES, "rect": Rect2i(336, 302, 111, 146), "foot": 55, "block": Vector2(18, 8), "layers": WALK},
			"agac_kucuk_zeytin": {"sheet": FF_TREES, "rect": Rect2i(960, 78, 111, 146), "foot": 55, "block": Vector2(18, 8), "layers": WALK},
			"agac_kucuk_mor": {"sheet": FF_TREES, "rect": Rect2i(336, 750, 111, 146), "foot": 55, "block": Vector2(18, 8), "layers": WALK},
			"agac_kucuk_teal": {"sheet": FF_TREES, "rect": Rect2i(960, 750, 111, 146), "foot": 55, "block": Vector2(18, 8), "layers": WALK},
			"fidan": {"sheet": FF_TREES, "rect": Rect2i(471, 134, 50, 90), "foot": 26, "block": Vector2(10, 6), "layers": WALK},
			"fidan_mor": {"sheet": FF_TREES, "rect": Rect2i(471, 806, 50, 90), "foot": 26, "block": Vector2(10, 6), "layers": WALK},
			"fidan_teal": {"sheet": FF_TREES, "rect": Rect2i(1095, 806, 50, 90), "foot": 26, "block": Vector2(10, 6), "layers": WALK},
			"kutuk_sarmasik": {"sheet": FF_TREES, "rect": Rect2i(14, 1360, 68, 96), "foot": 25, "block": Vector2(36, 12), "layers": WALK},
			"kutuk": {"sheet": FF_TREES, "rect": Rect2i(105, 1392, 54, 64), "block": Vector2(34, 12), "layers": WALK},
			"cali_agac": {"sheet": FF_TREES, "rect": Rect2i(244, 1346, 74, 74), "foot": 28, "block": Vector2(30, 10), "layers": WALK},
			"cali_agac_mor": {"sheet": FF_TREES, "rect": Rect2i(244, 1426, 74, 74), "foot": 28, "block": Vector2(30, 10), "layers": WALK},
			"cali_agac_teal": {"sheet": FF_TREES, "rect": Rect2i(244, 1586, 74, 74), "foot": 28, "block": Vector2(30, 10), "layers": WALK},
			# Bushes, the purple bell flowers, vines, mushrooms, plants, flowers.
			"cali_buyuk": {"sheet": FF_PROPS, "rect": Rect2i(1, 0, 63, 47), "block": Vector2(40, 10), "layers": WALK},
			"cali_buyuk_turuncu": {"sheet": FF_PROPS, "rect": Rect2i(1, 48, 63, 48), "block": Vector2(40, 10), "layers": WALK},
			"cali": {"sheet": FF_PROPS, "rect": Rect2i(65, 16, 47, 32)},
			"cali_turuncu": {"sheet": FF_PROPS, "rect": Rect2i(65, 64, 47, 32)},
			"cali_kucuk": {"sheet": FF_PROPS, "rect": Rect2i(117, 18, 40, 29)},
			"cali_kucuk_turuncu": {"sheet": FF_PROPS, "rect": Rect2i(117, 66, 40, 29)},
			"can_cicegi": {"sheet": FF_PROPS, "rect": Rect2i(293, 48, 38, 48), "block": Vector2(16, 8), "layers": WALK, "light": {"at": Vector2(0, -38), "radius": 30.0, "color": Color8(0xc0, 0x90, 0xff), "flicker": 0.05}},
			"can_cicegi_kucuk": {"sheet": FF_PROPS, "rect": Rect2i(338, 16, 28, 30)},
			"can_cicegi_egik": {"sheet": FF_PROPS, "rect": Rect2i(369, 20, 27, 26)},
			"sarmasik": {"sheet": FF_PROPS, "rect": Rect2i(289, 97, 45, 62)},
			"sarmasik_kucuk": {"sheet": FF_PROPS, "rect": Rect2i(341, 117, 22, 42)},
			"mantar": {"sheet": FF_PROPS, "rect": Rect2i(293, 163, 18, 29)},
			"mantar_2": {"sheet": FF_PROPS, "rect": Rect2i(321, 165, 15, 27)},
			"mantar_kucuk": {"sheet": FF_PROPS, "rect": Rect2i(337, 176, 13, 16)},
			"bitki": {"sheet": FF_PROPS, "rect": Rect2i(242, 96, 11, 32)},
			"bitki_2": {"sheet": FF_PROPS, "rect": Rect2i(226, 97, 11, 31)},
			"yaprak": {"sheet": FF_PROPS, "rect": Rect2i(224, 20, 15, 11)},
			"yaprak_2": {"sheet": FF_PROPS, "rect": Rect2i(257, 19, 14, 9)},
			"filiz": {"sheet": FF_PROPS, "rect": Rect2i(210, 21, 13, 10)},
			"filiz_2": {"sheet": FF_PROPS, "rect": Rect2i(226, 4, 13, 11)},
			"filiz_3": {"sheet": FF_PROPS, "rect": Rect2i(257, 5, 14, 7)},
			"filiz_4": {"sheet": FF_PROPS, "rect": Rect2i(211, 6, 11, 8)},
			"cicek": {"sheet": FF_PROPS, "rect": Rect2i(226, 130, 12, 12)},
			"cicek_2": {"sheet": FF_PROPS, "rect": Rect2i(195, 132, 11, 9)},
			"cicek_3": {"sheet": FF_PROPS, "rect": Rect2i(212, 132, 10, 9)},
			# Rocks: boulders (bare and mossy), grey stones, glowing rune stones, pebbles.
			"kaya": {"sheet": FF_PROPS, "rect": Rect2i(50, 226, 43, 45), "block": Vector2(34, 12), "layers": WALK},
			"kaya_buyuk": {"sheet": FF_PROPS, "rect": Rect2i(99, 226, 59, 44), "block": Vector2(50, 14), "layers": WALK},
			"kaya_yosun": {"sheet": FF_PROPS, "rect": Rect2i(50, 273, 43, 46), "block": Vector2(34, 12), "layers": WALK},
			"kaya_yosun_buyuk": {"sheet": FF_PROPS, "rect": Rect2i(99, 273, 59, 45), "block": Vector2(50, 14), "layers": WALK},
			"tas": {"sheet": FF_PROPS, "rect": Rect2i(179, 241, 28, 31), "block": Vector2(20, 8), "layers": WALK},
			"run_tasi": {"png": "res://assets/orman/run_tasi.png", "rect": Rect2i(0, 0, 28, 31), "block": Vector2(20, 8), "layers": WALK, "light": {"at": Vector2(0, -16), "radius": 56.0, "color": Color8(0x50, 0xe0, 0xff), "flicker": 0.05}},
			"run_tasi_buyuk": {"png": "res://assets/orman/run_tasi_buyuk.png", "rect": Rect2i(0, 0, 42, 40), "block": Vector2(32, 10), "layers": WALK, "light": {"at": Vector2(0, -20), "radius": 72.0, "color": Color8(0x50, 0xe0, 0xff), "flicker": 0.05}},
			"run_tasi_kucuk": {"png": "res://assets/orman/run_tasi_kucuk.png", "rect": Rect2i(0, 0, 15, 16), "light": {"at": Vector2(0, -8), "radius": 30.0, "color": Color8(0x50, 0xe0, 0xff), "flicker": 0.05}},
			"cakil": {"sheet": FF_PROPS, "rect": Rect2i(1, 323, 14, 9)},
			"cakil_2": {"sheet": FF_PROPS, "rect": Rect2i(81, 322, 14, 10)},
			"cakil_3": {"sheet": FF_PROPS, "rect": Rect2i(19, 325, 10, 7)},
			# Bare earth and darker grass in the grass (flat, under everyone).
			"toprak_yama": {"png": "res://assets/orman/toprak_yama.png", "rect": Rect2i(0, 0, 48, 48), "z": -1},
			"koyu_cim_yama": {"png": "res://assets/orman/koyu_cim_yama.png", "rect": Rect2i(0, 0, 48, 48), "z": -1},
			# The camp by the way in.
			"ates": {"frames": {"sheet": STATIONS + "Bonfire/Bonfire_03-Sheet.png", "size": Vector2i(32, 32), "count": 4, "cols": 4, "fps": 8.0}, "block": Vector2(24, 10), "layers": WALK, "light": {"at": Vector2(0, -14), "radius": 80.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.22}},
		},
		# What the open builder makes a field of: trees by colour (green most, purple and teal in
		# their own groves), the odd stump and boulder, rune stones, and the little things.
		"field": {
			"green": ["agac", "agac_2", "agac_koyu", "agac_zeytin", "agac_orta", "agac_orta_2", "agac_orta_koyu", "agac_orta_zeytin", "agac_kucuk", "agac_kucuk_2", "agac_kucuk_zeytin", "fidan", "cali_agac", "cali_buyuk"],
			"purple": ["agac_mor", "agac_mor_2", "agac_orta_mor", "agac_kucuk_mor", "fidan_mor", "cali_agac_mor", "cali_buyuk_turuncu"],
			"teal": ["agac_teal", "agac_teal_2", "agac_orta_teal", "agac_kucuk_teal", "fidan_teal", "cali_agac_teal"],
			"rare": ["kutuk_sarmasik", "kutuk", "kaya_yosun", "kaya_yosun_buyuk", "kaya", "kaya_buyuk", "tas"],
			"glow": ["run_tasi", "run_tasi_buyuk"],
			"glow_near": ["can_cicegi", "can_cicegi_kucuk", "can_cicegi_egik", "run_tasi_kucuk", "mantar", "mantar_2"],
			"bits": ["cali", "cali_turuncu", "cali_kucuk", "cali_kucuk_turuncu", "sarmasik", "sarmasik_kucuk", "mantar", "mantar_2", "mantar_kucuk", "bitki", "bitki_2", "yaprak", "yaprak_2", "cicek", "cicek_2", "cicek_3", "filiz", "filiz_2", "filiz_3", "filiz_4", "filiz", "filiz_2", "cakil", "cakil_2", "cakil_3"],
		},
	},
	"vadi": {
		"sheet": "Pixel Crawler - Town/Environment/Tilesets/Wall_Tiles.png",
		"source": 27,
		# The brown rock with grass at its foot; the Floors sheet's light grass (the town's).
		"wall_top": {"n": Vector2i(2, 0), "nw": Vector2i(1, 0), "ne": Vector2i(4, 0), "w": Vector2i(0, 2), "e": Vector2i(5, 2), "we": Vector2i(2, 0), "fill": Vector2i(2, 2), "in_nw": Vector2i(2, 2), "in_ne": Vector2i(2, 2)},
		"face": {"trim": [Vector2i(0, 5), Vector2i(2, 5), Vector2i(5, 5)], "brick": [Vector2i(0, 6), Vector2i(2, 6), Vector2i(5, 6)], "ledge": [Vector2i(1, 8), Vector2i(2, 8), Vector2i(4, 8)], "trim_w": Vector2i(0, 5), "trim_e": Vector2i(5, 5),
			"tips": [Vector2i(1, 9), Vector2i(2, 9), Vector2i(4, 9)]},
		"floor_sheet": "Pixel Crawler - Town/Environment/Tilesets/Floors_Tiles.png",
		"floor_source": 28,
		"floor": [Vector2i(2, 10), Vector2i(1, 10), Vector2i(3, 10)],
		"underlay": true,
		"background": Color8(40, 90, 10),
		"decor": {"rubble": [], "tips": [Vector2i(1, 9), Vector2i(2, 9), Vector2i(4, 9)]},
		"props": {
			"mese": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(1, 0, 106, 160), "foot": 47, "block": Vector2(23, 10), "layers": WALK},
			"mese_sari": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(113, 0, 106, 160), "foot": 47, "block": Vector2(23, 10), "layers": WALK},
			"mese_turuncu": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(1, 160, 106, 160), "foot": 47, "block": Vector2(23, 10), "layers": WALK},
			"mese_altin": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(113, 160, 106, 160), "foot": 47, "block": Vector2(23, 10), "layers": WALK},
			"mese_orta": {"sheet": TREES + "Model_01/Size_04.png", "rect": Rect2i(3, 2, 73, 126), "block": Vector2(16, 10), "layers": WALK},
			"mese_orta_sari": {"sheet": TREES + "Model_01/Size_04.png", "rect": Rect2i(83, 2, 73, 126), "block": Vector2(16, 10), "layers": WALK},
			"mese_orta_turuncu": {"sheet": TREES + "Model_01/Size_04.png", "rect": Rect2i(3, 130, 73, 126), "block": Vector2(16, 10), "layers": WALK},
			"mese_orta_altin": {"sheet": TREES + "Model_01/Size_04.png", "rect": Rect2i(83, 130, 73, 126), "block": Vector2(16, 10), "layers": WALK},
			"cam": {"sheet": TREES + "Model_02/Size_05.png", "rect": Rect2i(1, 3, 92, 157), "block": Vector2(20, 10), "layers": WALK},
			"cam_2": {"sheet": TREES + "Model_02/Size_05.png", "rect": Rect2i(97, 3, 92, 157), "block": Vector2(20, 10), "layers": WALK},
			"cam_kucuk": {"sheet": TREES + "Model_02/Size_04.png", "rect": Rect2i(4, 9, 54, 103), "block": Vector2(12, 10), "layers": WALK},
			"cam_kucuk_2": {"sheet": TREES + "Model_02/Size_04.png", "rect": Rect2i(68, 9, 54, 103), "block": Vector2(12, 10), "layers": WALK},
			"uzun_cam": {"sheet": TREES + "Model_03/Size_03.png", "rect": Rect2i(0, 1, 63, 143), "block": Vector2(14, 10), "layers": WALK},
			"uzun_cam_2": {"sheet": TREES + "Model_03/Size_03.png", "rect": Rect2i(64, 1, 63, 143), "block": Vector2(14, 10), "layers": WALK},
			"uzun_cam_kahve": {"sheet": TREES + "Model_03/Size_03.png", "rect": Rect2i(0, 145, 63, 143), "block": Vector2(14, 10), "layers": WALK},
			"uzun_cam_kizil": {"sheet": TREES + "Model_03/Size_03.png", "rect": Rect2i(64, 145, 63, 143), "block": Vector2(14, 10), "layers": WALK},
			"kutuk": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(23, 326, 61, 42), "foot": 25, "block": Vector2(36, 12), "layers": WALK},
			"kutuk_yosun": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(359, 326, 61, 42), "foot": 26, "block": Vector2(36, 12), "layers": WALK},
			"cali_buyuk": {"sheet": VEGETATION, "rect": Rect2i(2, 99, 43, 43), "block": Vector2(26, 10), "layers": WALK},
			"cali_buyuk_sari": {"sheet": VEGETATION, "rect": Rect2i(50, 99, 43, 43), "block": Vector2(26, 10), "layers": WALK},
			"cali_buyuk_turuncu": {"sheet": VEGETATION, "rect": Rect2i(146, 99, 43, 43), "block": Vector2(26, 10), "layers": WALK},
			"cali": {"sheet": VEGETATION, "rect": Rect2i(2, 5, 29, 27)},
			"cali_sari": {"sheet": VEGETATION, "rect": Rect2i(50, 5, 29, 27)},
			"cali_turuncu": {"sheet": VEGETATION, "rect": Rect2i(146, 5, 29, 27)},
			"egrelti": {"sheet": VEGETATION, "rect": Rect2i(80, 147, 31, 25)},
			"kamis": {"sheet": VEGETATION, "rect": Rect2i(112, 166, 32, 26)},
			"kamis_2": {"sheet": VEGETATION, "rect": Rect2i(145, 166, 15, 26)},
			"lavanta": {"sheet": VEGETATION, "rect": Rect2i(195, 161, 11, 31)},
			"lavanta_2": {"sheet": VEGETATION, "rect": Rect2i(212, 165, 9, 27)},
			"ot": {"sheet": VEGETATION, "rect": Rect2i(97, 177, 14, 15)},
			"ot_2": {"sheet": VEGETATION, "rect": Rect2i(64, 187, 16, 21)},
			"ot_3": {"sheet": VEGETATION, "rect": Rect2i(3, 178, 11, 13)},
			"ot_4": {"sheet": VEGETATION, "rect": Rect2i(20, 180, 9, 11)},
			"mantar": {"sheet": VEGETATION, "rect": Rect2i(49, 338, 14, 14)},
			"mantar_2": {"sheet": VEGETATION, "rect": Rect2i(3, 353, 11, 14)},
			"cicek": {"sheet": VEGETATION, "rect": Rect2i(53, 389, 7, 6)},
			"cicek_2": {"sheet": VEGETATION, "rect": Rect2i(69, 405, 6, 6)},
			"cicek_3": {"sheet": VEGETATION, "rect": Rect2i(100, 421, 8, 7)},
			"cicek_4": {"sheet": VEGETATION, "rect": Rect2i(117, 389, 7, 6)},
			"toprak_yama": {"png": "res://assets/alan/toprak_yama.png", "rect": Rect2i(0, 0, 79, 78), "z": -1},
			"cakil_yama": {"png": "res://assets/alan/cakil_yama.png", "rect": Rect2i(0, 0, 79, 78), "z": -1},
			"kaya_buyuk": {"sheet": ROCKS, "rect": Rect2i(2, 19, 28, 43), "block": Vector2(24, 12), "layers": WALK},
			"kaya": {"sheet": ROCKS, "rect": Rect2i(35, 19, 26, 27), "block": Vector2(22, 10), "layers": WALK},
			"tas": {"sheet": ROCKS, "rect": Rect2i(65, 19, 14, 11)},
			"tas_2": {"sheet": ROCKS, "rect": Rect2i(80, 17, 16, 14)},
			"tas_3": {"sheet": ROCKS, "rect": Rect2i(48, 51, 15, 10)},
			"kaya_gri_buyuk": {"sheet": ROCKS, "rect": Rect2i(98, 19, 28, 43), "block": Vector2(24, 12), "layers": WALK},
			"kaya_gri": {"sheet": ROCKS, "rect": Rect2i(131, 19, 26, 27), "block": Vector2(22, 10), "layers": WALK},
			"tas_gri": {"sheet": ROCKS, "rect": Rect2i(161, 19, 14, 11)},
			"tas_gri_2": {"sheet": ROCKS, "rect": Rect2i(176, 17, 16, 14)},
		},
		"field": {
			"auto_crown": true,
			"green": ["mese", "mese_orta", "mese_sari", "mese_orta_sari", "uzun_cam", "uzun_cam_2", "cali_buyuk", "cali_buyuk_sari"],
			"purple": ["mese_turuncu", "mese_altin", "mese_orta_turuncu", "mese_orta_altin", "uzun_cam_kahve", "uzun_cam_kizil", "cali_buyuk_turuncu"],
			"teal": ["cam", "cam_2", "cam_kucuk", "cam_kucuk_2", "uzun_cam"],
			"rare": ["kutuk", "kutuk_yosun", "kaya_buyuk", "kaya", "kaya_gri_buyuk", "kaya_gri"],
			"bits": ["cali", "cali_sari", "cali_turuncu", "egrelti", "kamis", "kamis_2", "lavanta", "lavanta_2", "ot", "ot_2", "ot_3", "ot_4", "ot", "ot_3", "mantar", "mantar_2", "cicek", "cicek_2", "cicek_3", "cicek_4", "cicek", "cicek_3", "tas", "tas_2", "tas_3", "tas_gri", "tas_gri_2"],
			"patches": ["toprak_yama", "cakil_yama"],
		},
	},
	"kurgan": {
		"sheet": "Pixel Crawler - Cemetery/Environment/TileSets/Tiles.png",
		"source": 29,
		# The Cemetery's dark rock: its flat top, its front meeting the mud.
		"wall_top": {"n": Vector2i(2, 0), "nw": Vector2i(1, 0), "ne": Vector2i(4, 0), "w": Vector2i(0, 2), "e": Vector2i(5, 2), "we": Vector2i(2, 0), "fill": Vector2i(2, 2), "in_nw": Vector2i(2, 2), "in_ne": Vector2i(2, 2)},
		"face": {"trim": [Vector2i(0, 5), Vector2i(2, 5), Vector2i(5, 5)], "brick": [Vector2i(0, 6), Vector2i(2, 6), Vector2i(5, 6)], "ledge": [Vector2i(1, 7), Vector2i(2, 7), Vector2i(4, 7)], "trim_w": Vector2i(0, 5), "trim_e": Vector2i(5, 5),
			"tips": [Vector2i(1, 8), Vector2i(2, 8), Vector2i(4, 8)]},
		"floor_sheet": "Pixel Crawler - Cemetery/Environment/TileSets/Floor.png",
		"floor_source": 30,
		"floor": [Vector2i(2, 10), Vector2i(1, 10), Vector2i(3, 10)],
		"underlay": true,
		"background": Color8(30, 30, 20),
		"decor": {"rubble": [], "tips": [Vector2i(1, 8), Vector2i(2, 8), Vector2i(4, 8)]},
		"props": {
			"koknar": {"sheet": CEM_TREES, "rect": Rect2i(0, 1, 96, 207), "foot": 53, "block": Vector2(21, 10), "layers": WALK},
			"koknar_orta": {"sheet": CEM_TREES, "rect": Rect2i(96, 50, 64, 157), "block": Vector2(14, 10), "layers": WALK},
			"koknar_kucuk": {"sheet": CEM_TREES, "rect": Rect2i(160, 104, 46, 103), "block": Vector2(10, 10), "layers": WALK},
			"koknar_fidan": {"sheet": CEM_TREES, "rect": Rect2i(208, 144, 32, 64), "block": Vector2(10, 10), "layers": WALK},
			"koknar_kahve": {"sheet": CEM_TREES, "rect": Rect2i(0, 209, 96, 207), "foot": 53, "block": Vector2(21, 10), "layers": WALK},
			"koknar_kahve_orta": {"sheet": CEM_TREES, "rect": Rect2i(96, 258, 64, 157), "block": Vector2(14, 10), "layers": WALK},
			"koknar_kahve_kucuk": {"sheet": CEM_TREES, "rect": Rect2i(160, 312, 46, 103), "block": Vector2(10, 10), "layers": WALK},
			"koknar_kahve_fidan": {"sheet": CEM_TREES, "rect": Rect2i(208, 352, 32, 64), "block": Vector2(10, 10), "layers": WALK},
			"mezar_tasi": {"sheet": GRAVES, "rect": Rect2i(1, 10, 14, 22), "block": Vector2(12, 6), "layers": WALK},
			"mezar_hac": {"sheet": GRAVES, "rect": Rect2i(17, 6, 14, 26), "block": Vector2(12, 6), "layers": WALK},
			"hac": {"sheet": GRAVES, "rect": Rect2i(32, 11, 16, 21), "block": Vector2(8, 6), "layers": WALK},
			"hac_kucuk": {"sheet": GRAVES, "rect": Rect2i(49, 13, 14, 19)},
			"hac_buyuk": {"sheet": GRAVES, "rect": Rect2i(70, 11, 20, 53), "block": Vector2(12, 8), "layers": WALK},
			"hac_demir": {"sheet": GRAVES, "rect": Rect2i(96, 4, 32, 60), "block": Vector2(8, 6), "layers": WALK},
			"lahit_tugla": {"sheet": GRAVES, "rect": Rect2i(37, 105, 22, 39), "block": Vector2(20, 16), "layers": WALK},
			"lahit_duz": {"sheet": GRAVES, "rect": Rect2i(69, 105, 22, 39), "block": Vector2(20, 16), "layers": WALK},
			"heykel_melek": {"sheet": GRAVES, "rect": Rect2i(32, 201, 32, 33), "block": Vector2(16, 8), "layers": WALK},
			"heykel_azrail": {"sheet": GRAVES, "rect": Rect2i(65, 192, 30, 43), "block": Vector2(16, 8), "layers": WALK},
			"heykel_kukuleta": {"sheet": GRAVES, "rect": Rect2i(8, 200, 16, 34), "block": Vector2(12, 8), "layers": WALK},
			"toprak_kurek": {"sheet": CEM_PROPS, "rect": Rect2i(128, 48, 31, 32)},
			"toprak": {"sheet": CEM_PROPS, "rect": Rect2i(96, 64, 31, 16)},
			"tabut_acik": {"sheet": CEM_PROPS, "rect": Rect2i(182, 7, 20, 31), "block": Vector2(18, 18), "layers": WALK},
			"kemik": {"sheet": DESERT_PROPS, "rect": Rect2i(132, 212, 9, 12)},
			"samdan": {"sheet": HIDEOUT, "rect": Rect2i(404, 40, 8, 16), "block": Vector2(8, 6), "layers": WALK, "light": {"at": Vector2(0, -14), "radius": 52.0, "color": Color8(0xff, 0xc0, 0x70), "flicker": 0.12}},
			"kamis_kuru": {"sheet": VEGETATION, "rect": Rect2i(112, 262, 32, 26)},
			"kamis_kuru_2": {"sheet": VEGETATION, "rect": Rect2i(145, 262, 15, 26)},
			"egrelti_kuru": {"sheet": VEGETATION, "rect": Rect2i(80, 243, 31, 25)},
			"ot_kuru": {"sheet": VEGETATION, "rect": Rect2i(97, 273, 14, 15)},
			"ot_kuru_2": {"sheet": VEGETATION, "rect": Rect2i(3, 274, 11, 13)},
			"tas_mezar": {"sheet": CEM_PROPS, "rect": Rect2i(115, 99, 11, 9)},
			"tas_mezar_2": {"sheet": CEM_PROPS, "rect": Rect2i(148, 84, 10, 8)},
			"kutuk": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(23, 326, 61, 42), "foot": 25, "block": Vector2(36, 12), "layers": WALK},
			"camur_yama": {"png": "res://assets/alan/camur_yama.png", "rect": Rect2i(0, 0, 74, 71), "z": -1},
			"camur_yama_2": {"png": "res://assets/alan/camur_yama_2.png", "rect": Rect2i(0, 0, 72, 69), "z": -1},
			"ates": {"frames": {"sheet": STATIONS + "Bonfire/Bonfire_03-Sheet.png", "size": Vector2i(32, 32), "count": 4, "cols": 4, "fps": 8.0}, "block": Vector2(24, 10), "layers": WALK, "light": {"at": Vector2(0, -14), "radius": 80.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.22}},
			"kuru_mese": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(225, 2, 100, 158), "block": Vector2(22, 10), "layers": WALK},
			"kuru_mese_2": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(225, 162, 100, 158), "block": Vector2(22, 10), "layers": WALK},
			"kuru_mese_orta": {"sheet": TREES + "Model_01/Size_04.png", "rect": Rect2i(166, 2, 69, 126), "block": Vector2(15, 10), "layers": WALK},
			"kuru_mese_orta_2": {"sheet": TREES + "Model_01/Size_04.png", "rect": Rect2i(166, 130, 69, 126), "block": Vector2(15, 10), "layers": WALK},
			"kuru_cali": {"sheet": VEGETATION, "rect": Rect2i(197, 65, 34, 31)},
			"kuru_cali_buyuk": {"sheet": VEGETATION, "rect": Rect2i(196, 98, 39, 46), "block": Vector2(14, 8), "layers": WALK},
			"kaya_koyu_buyuk": {"sheet": ROCKS, "rect": Rect2i(2, 115, 28, 43), "block": Vector2(24, 12), "layers": WALK},
			"kaya_koyu": {"sheet": ROCKS, "rect": Rect2i(35, 115, 26, 27), "block": Vector2(22, 10), "layers": WALK},
			"tas_koyu": {"sheet": ROCKS, "rect": Rect2i(65, 115, 14, 11)},
			"tas_koyu_2": {"sheet": ROCKS, "rect": Rect2i(80, 113, 16, 14)},
			"tas_koyu_3": {"sheet": ROCKS, "rect": Rect2i(48, 147, 15, 10)},
		},
		"field": {
			"auto_crown": true,
			"green": ["koknar", "koknar_orta", "koknar_kucuk", "koknar_fidan", "koknar_orta", "koknar_kucuk"],
			"purple": ["koknar_kahve", "koknar_kahve_orta", "koknar_kahve_kucuk", "koknar_kahve_fidan", "kuru_mese_orta"],
			"teal": ["kuru_mese", "kuru_mese_2", "kuru_mese_orta", "kuru_mese_orta_2", "kuru_cali_buyuk", "koknar_kucuk"],
			"rare": ["kutuk", "kaya_koyu_buyuk", "kaya_koyu", "lahit_tugla", "lahit_duz", "heykel_melek", "heykel_azrail", "hac_buyuk", "hac_demir", "toprak_kurek", "tabut_acik"],
			"glow": ["samdan"],
			"glow_near": ["mezar_tasi", "mezar_hac", "hac", "hac_kucuk", "mezar_tasi", "heykel_kukuleta", "toprak"],
			"bits": ["kamis_kuru", "kamis_kuru_2", "egrelti_kuru", "ot_kuru", "ot_kuru_2", "ot_kuru", "kuru_cali", "kemik", "tas_mezar", "tas_mezar_2", "tas_koyu", "tas_koyu_2", "tas_koyu_3"],
			"patches": ["camur_yama", "camur_yama_2"],
			"camp": ["ates", "kutuk"],
		},
	},
	"kanyon": {
		"sheet": "Pixel Crawler - Desert/Assets/Ground.png",
		"source": 31,
		# The Desert's mesa: sand on top, red rock down its front.
		"wall_top": {"n": Vector2i(2, 0), "nw": Vector2i(1, 0), "ne": Vector2i(4, 0), "w": Vector2i(0, 2), "e": Vector2i(5, 2), "we": Vector2i(2, 0), "fill": Vector2i(2, 2), "in_nw": Vector2i(2, 2), "in_ne": Vector2i(2, 2)},
		"face": {"trim": [Vector2i(0, 4), Vector2i(2, 4), Vector2i(5, 4)], "brick": [Vector2i(0, 5), Vector2i(2, 5), Vector2i(5, 5)], "ledge": [Vector2i(1, 6), Vector2i(2, 6), Vector2i(4, 6)], "trim_w": Vector2i(0, 4), "trim_e": Vector2i(5, 4)},
		"floor": [Vector2i(3, 2), Vector2i(7, 2), Vector2i(7, 3), Vector2i(3, 3)],
		"underlay": true,
		"background": Color8(120, 70, 40),
		"decor": {"rubble": []},
		"props": {
			"kaktus": {"sheet": DESERT_GROUND, "rect": Rect2i(160, 219, 16, 51), "block": Vector2(10, 6), "layers": WALK},
			"kaktus_dal": {"sheet": DESERT_GROUND, "rect": Rect2i(184, 219, 32, 51), "block": Vector2(12, 6), "layers": WALK},
			"kaktus_kucuk": {"sheet": DESERT_GROUND, "rect": Rect2i(128, 229, 16, 26)},
			"kaktus_ince": {"sheet": DESERT_GROUND, "rect": Rect2i(146, 231, 12, 40), "block": Vector2(8, 6), "layers": WALK},
			"kaya_kum_buyuk": {"sheet": DESERT_GROUND, "rect": Rect2i(160, 104, 50, 40), "block": Vector2(40, 12), "layers": WALK},
			"kaya_kum": {"sheet": DESERT_GROUND, "rect": Rect2i(208, 112, 32, 32), "block": Vector2(24, 10), "layers": WALK},
			"kuru_cali_kum": {"sheet": DESERT_GROUND, "rect": Rect2i(176, 272, 48, 32), "foot": 12},
			"ot_kum": {"sheet": DESERT_GROUND, "rect": Rect2i(161, 80, 14, 16)},
			"ot_kum_2": {"sheet": DESERT_GROUND, "rect": Rect2i(178, 83, 12, 11)},
			"tas_kum": {"sheet": DESERT_GROUND, "rect": Rect2i(162, 180, 13, 9)},
			"tas_kum_2": {"sheet": DESERT_GROUND, "rect": Rect2i(177, 178, 14, 14)},
			"kuru_agac": {"sheet": DESERT_PROPS, "rect": Rect2i(0, 262, 64, 74), "foot": 28, "block": Vector2(12, 8), "layers": WALK},
			"kuru_agac_kucuk": {"sheet": DESERT_PROPS, "rect": Rect2i(66, 256, 25, 29)},
			"kaburga": {"sheet": DESERT_PROPS, "rect": Rect2i(4, 178, 54, 71), "foot": 14, "block": Vector2(20, 10), "layers": WALK},
			"boynuz": {"sheet": DESERT_PROPS, "rect": Rect2i(68, 176, 39, 48), "foot": 10, "block": Vector2(16, 8), "layers": WALK},
			"boynuz_2": {"sheet": DESERT_PROPS, "rect": Rect2i(113, 178, 29, 46), "block": Vector2(14, 8), "layers": WALK},
			"kemik": {"sheet": DESERT_PROPS, "rect": Rect2i(132, 212, 9, 12)},
			"dikilitas_kirik": {"sheet": DESERT_PROPS, "rect": Rect2i(32, 40, 32, 88), "block": Vector2(28, 14), "layers": WALK},
			"kule_kirik": {"sheet": DESERT_PROPS, "rect": Rect2i(35, 140, 26, 36), "block": Vector2(22, 10), "layers": WALK},
			"kule_kirik_2": {"sheet": DESERT_PROPS, "rect": Rect2i(67, 148, 26, 28), "block": Vector2(22, 10), "layers": WALK},
			"kup_kirik": {"sheet": DESERT_PROPS, "rect": Rect2i(129, 83, 14, 13)},
			"kup": {"sheet": DESERT_PROPS, "rect": Rect2i(115, 74, 10, 22), "block": Vector2(8, 6), "layers": WALK},
			"sutun_kirik": {"sheet": DESERT_GROUND, "rect": Rect2i(32, 248, 16, 56), "block": Vector2(14, 10), "layers": WALK},
			"sutun_kirik_2": {"sheet": DESERT_GROUND, "rect": Rect2i(48, 264, 16, 40), "block": Vector2(14, 10), "layers": WALK},
			"cuval": {"sheet": HIDEOUT, "rect": Rect2i(278, 57, 20, 34), "block": Vector2(14, 6), "layers": WALK},
			"kum_yama": {"png": "res://assets/alan/kum_yama.png", "rect": Rect2i(0, 0, 80, 80), "z": -1},
			"toprak_yama": {"png": "res://assets/alan/toprak_yama.png", "rect": Rect2i(0, 0, 79, 78), "z": -1},
			"ates_cukuru": {"sheet": HIDEOUT, "rect": Rect2i(278, 166, 36, 36), "block": Vector2(30, 12), "layers": WALK, "light": {"at": Vector2(0, -16), "radius": 72.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.2}},
			"kuru_mese": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(225, 2, 100, 158), "block": Vector2(22, 10), "layers": WALK},
			"kuru_mese_2": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(225, 162, 100, 158), "block": Vector2(22, 10), "layers": WALK},
			"kuru_mese_orta": {"sheet": TREES + "Model_01/Size_04.png", "rect": Rect2i(166, 2, 69, 126), "block": Vector2(15, 10), "layers": WALK},
			"kuru_mese_orta_2": {"sheet": TREES + "Model_01/Size_04.png", "rect": Rect2i(166, 130, 69, 126), "block": Vector2(15, 10), "layers": WALK},
			"kuru_cali": {"sheet": VEGETATION, "rect": Rect2i(197, 65, 34, 31)},
			"kuru_cali_buyuk": {"sheet": VEGETATION, "rect": Rect2i(196, 98, 39, 46), "block": Vector2(14, 8), "layers": WALK},
			"kaya_buyuk": {"sheet": ROCKS, "rect": Rect2i(2, 19, 28, 43), "block": Vector2(24, 12), "layers": WALK},
			"kaya": {"sheet": ROCKS, "rect": Rect2i(35, 19, 26, 27), "block": Vector2(22, 10), "layers": WALK},
			"tas": {"sheet": ROCKS, "rect": Rect2i(65, 19, 14, 11)},
			"tas_2": {"sheet": ROCKS, "rect": Rect2i(80, 17, 16, 14)},
			"tas_3": {"sheet": ROCKS, "rect": Rect2i(48, 51, 15, 10)},
		},
		"field": {
			"auto_crown": true,
			"green": ["kaktus", "kaktus_dal", "kaktus_ince", "kaktus", "kuru_agac", "kaya_kum_buyuk", "kaya_kum"],
			"purple": ["kuru_mese", "kuru_mese_orta", "kuru_mese_2", "kuru_agac", "kuru_cali_buyuk"],
			"teal": ["kaya_kum_buyuk", "kaya_buyuk", "kaya", "kaya_kum", "kaktus_dal"],
			"rare": ["kaburga", "boynuz", "boynuz_2", "dikilitas_kirik", "kule_kirik", "kule_kirik_2", "sutun_kirik", "sutun_kirik_2", "kup"],
			"bits": ["kaktus_kucuk", "kuru_cali_kum", "kuru_cali", "kuru_agac_kucuk", "ot_kum", "ot_kum_2", "ot_kum", "tas_kum", "tas_kum_2", "kemik", "kup_kirik", "tas", "tas_2", "tas_3"],
			"patches": ["kum_yama", "toprak_yama"],
			"camp": ["ates_cukuru", "cuval"],
		},
	},
	"volkan": {
		"sheet": "Pixel Crawler - Town/Environment/Tilesets/Wall_Tiles.png",
		"source": 33,
		# The grey rock, bare at its foot; the Floors sheet's grey earth (tinted to ash); the Forge's lava.
		"wall_top": {"n": Vector2i(8, 0), "nw": Vector2i(7, 0), "ne": Vector2i(10, 0), "w": Vector2i(6, 2), "e": Vector2i(11, 2), "we": Vector2i(8, 0), "fill": Vector2i(8, 2), "in_nw": Vector2i(8, 2), "in_ne": Vector2i(8, 2)},
		"face": {"trim": [Vector2i(6, 5), Vector2i(8, 5), Vector2i(11, 5)], "brick": [Vector2i(6, 6), Vector2i(8, 6), Vector2i(11, 6)], "ledge": [Vector2i(7, 12), Vector2i(8, 12), Vector2i(10, 12)], "trim_w": Vector2i(6, 5), "trim_e": Vector2i(11, 5),
			"tips": [Vector2i(7, 13), Vector2i(8, 13), Vector2i(10, 13)]},
		"floor_sheet": "Pixel Crawler - Town/Environment/Tilesets/Floors_Tiles.png",
		"floor_source": 34,
		"floor": [Vector2i(7, 10), Vector2i(6, 10), Vector2i(8, 10)],
		"underlay": true,
		"lava": {"sheet": "Pixel Crawler - Forge/Assets/Tiles.png", "slice": [Vector2i(19, 13), Vector2i(20, 13), Vector2i(21, 13), Vector2i(19, 14), Vector2i(20, 14), Vector2i(21, 14), Vector2i(19, 15), Vector2i(20, 15), Vector2i(21, 15)], "inner": [Vector2i(22, 13), Vector2i(24, 13), Vector2i(22, 15), Vector2i(24, 15)], "frames": 4, "frame_step": 3, "duration": 0.18, "source": 35},
		"lava_light": Color8(0xff, 0x70, 0x20),
		"background": Color8(30, 18, 22),
		"decor": {"rubble": [], "tips": [Vector2i(7, 13), Vector2i(8, 13), Vector2i(10, 13)]},
		"props": {
			"kaburga": {"sheet": DESERT_PROPS, "rect": Rect2i(4, 178, 54, 71), "foot": 14, "block": Vector2(20, 10), "layers": WALK},
			"boynuz": {"sheet": DESERT_PROPS, "rect": Rect2i(68, 176, 39, 48), "foot": 10, "block": Vector2(16, 8), "layers": WALK},
			"kemik": {"sheet": DESERT_PROPS, "rect": Rect2i(132, 212, 9, 12)},
			"kuru_agac": {"sheet": DESERT_PROPS, "rect": Rect2i(0, 262, 64, 74), "foot": 28, "block": Vector2(12, 8), "layers": WALK},
			"kuru_agac_kucuk": {"sheet": DESERT_PROPS, "rect": Rect2i(66, 256, 25, 29)},
			"heykel_kirik": {"sheet": FORGE_SHEET, "rect": Rect2i(226, 164, 28, 44), "block": Vector2(16, 8), "layers": WALK},
			"heykel": {"sheet": FORGE_SHEET, "rect": Rect2i(194, 150, 28, 58), "block": Vector2(16, 10), "layers": WALK},
			"kutuk": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(23, 326, 61, 42), "foot": 25, "block": Vector2(36, 12), "layers": WALK},
			"kristal": {"sheet": ROCKS, "rect": Rect2i(146, 279, 12, 25), "block": Vector2(10, 6), "layers": WALK, "light": {"at": Vector2(0, -12), "radius": 40.0, "color": Color8(0xff, 0x80, 0x40), "flicker": 0.06}},
			"kul_yama": {"png": "res://assets/alan/kul_yama.png", "rect": Rect2i(0, 0, 79, 78), "z": -1},
			"cakil_yama": {"png": "res://assets/alan/cakil_yama.png", "rect": Rect2i(0, 0, 79, 78), "z": -1},
			"ates": {"frames": {"sheet": STATIONS + "Bonfire/Bonfire_03-Sheet.png", "size": Vector2i(32, 32), "count": 4, "cols": 4, "fps": 8.0}, "block": Vector2(24, 10), "layers": WALK, "light": {"at": Vector2(0, -14), "radius": 80.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.22}},
			"kuru_mese": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(225, 2, 100, 158), "block": Vector2(22, 10), "layers": WALK},
			"kuru_mese_2": {"sheet": TREES + "Model_01/Size_05.png", "rect": Rect2i(225, 162, 100, 158), "block": Vector2(22, 10), "layers": WALK},
			"kuru_mese_orta": {"sheet": TREES + "Model_01/Size_04.png", "rect": Rect2i(166, 2, 69, 126), "block": Vector2(15, 10), "layers": WALK},
			"kuru_mese_orta_2": {"sheet": TREES + "Model_01/Size_04.png", "rect": Rect2i(166, 130, 69, 126), "block": Vector2(15, 10), "layers": WALK},
			"kuru_cali": {"sheet": VEGETATION, "rect": Rect2i(197, 65, 34, 31)},
			"kuru_cali_buyuk": {"sheet": VEGETATION, "rect": Rect2i(196, 98, 39, 46), "block": Vector2(14, 8), "layers": WALK},
			"kaya_koyu_buyuk": {"sheet": ROCKS, "rect": Rect2i(2, 115, 28, 43), "block": Vector2(24, 12), "layers": WALK},
			"kaya_koyu": {"sheet": ROCKS, "rect": Rect2i(35, 115, 26, 27), "block": Vector2(22, 10), "layers": WALK},
			"tas_koyu": {"sheet": ROCKS, "rect": Rect2i(65, 115, 14, 11)},
			"tas_koyu_2": {"sheet": ROCKS, "rect": Rect2i(80, 113, 16, 14)},
			"tas_koyu_3": {"sheet": ROCKS, "rect": Rect2i(48, 147, 15, 10)},
			"kaya_gri_buyuk": {"sheet": ROCKS, "rect": Rect2i(98, 19, 28, 43), "block": Vector2(24, 12), "layers": WALK},
			"kaya_gri": {"sheet": ROCKS, "rect": Rect2i(131, 19, 26, 27), "block": Vector2(22, 10), "layers": WALK},
			"tas_gri": {"sheet": ROCKS, "rect": Rect2i(161, 19, 14, 11)},
			"tas_gri_2": {"sheet": ROCKS, "rect": Rect2i(176, 17, 16, 14)},
		},
		"field": {
			"auto_crown": true,
			"green": ["kuru_mese", "kuru_mese_2", "kuru_mese_orta", "kuru_mese_orta_2", "kaya_koyu_buyuk", "kaya_koyu"],
			"purple": ["kuru_agac", "kuru_cali_buyuk", "kaya_gri_buyuk", "kaya_koyu_buyuk"],
			"teal": ["kaya_koyu_buyuk", "kaya_gri_buyuk", "kaya_koyu", "kuru_mese_orta"],
			"rare": ["kaburga", "boynuz", "heykel_kirik", "heykel", "kutuk", "kaya_gri"],
			"glow": ["ates"],
			"glow_near": ["kemik", "tas_koyu", "kaya_koyu"],
			"bits": ["kuru_cali", "kuru_agac_kucuk", "kemik", "tas_koyu", "tas_koyu_2", "tas_koyu_3", "tas_gri", "tas_gri_2", "kemik"],
			"patches": ["kul_yama", "cakil_yama"],
		},
	},
}

## Dungeons laid out anew (build): ROOMS rooms of one size, entrance first, a boss in every fifth
## (the last one the final boss), packs in between in turn; COLS rooms a row.
const BUILDS := {
	"magma_forges": {
		"seed": 510, "wall": CAVE_WALL, "floor": ASH,
		"packs": [
			[["ember_smith", 3], ["slag_slime", 2]],
			[["magma_hound", 3], ["ember_smith", 2]],
			[["fire_djinn", 2], ["slag_slime", 3]],
			[["magma_hound", 4], ["fire_djinn", 1]],
			[["ember_smith", 3], ["fire_djinn", 2]],
			[["magma_hound", 3], ["slag_slime", 2]],
			[["fire_djinn", 3], ["ember_smith", 2]],
		],
		"bosses": [
			["master_smith_gurz", [["ember_smith", 2]]],
			["molten_golem", [["slag_slime", 2]]],
			["molten_golem", [["magma_hound", 2]]],
			["forge_king_tamgar", [["magma_hound", 2]]],
		],
	},
	"ash_temple": {
		"seed": 511, "wall": WALL, "floor": ASH,
		# A temple: halls of pillars and runes, no smithies.
		"looks": ["salon", "run", "havuz", "depo", "kanal", "salon", "run"],
		"packs": [
			[["ash_priest", 3], ["flame_guard", 2]],
			[["salamander", 3], ["ash_priest", 2]],
			[["cinder_wraith", 2], ["flame_guard", 2]],
			[["salamander", 4], ["cinder_wraith", 1]],
			[["flame_guard", 3], ["ash_priest", 2]],
			[["cinder_wraith", 3], ["salamander", 2]],
			[["flame_guard", 2], ["cinder_wraith", 2]],
			[["salamander", 3], ["ash_priest", 3]],
		],
		"bosses": [
			["flame_warden_tufan", [["flame_guard", 2]]],
			["ash_priestess_nevra", [["ash_priest", 2]]],
			["flame_warden_tufan", [["cinder_wraith", 2]]],
			["fire_dragon_kozhan", [["salamander", 2]]],
		],
	},
	"dragon_lair": {
		"seed": 505, "wall": CAVE_WALL, "floor": CAVE_FLOOR,
		# A lair: lava everywhere.
		"looks": ["havuz", "kanal", "run", "havuz", "depo", "kanal", "salon"],
		"packs": [
			[["dragon_cultist", 4], ["fire_slime", 2]],
			[["drake", 3], ["dragon_cultist", 2]],
			[["fire_slime", 4], ["dragonkin_guard", 1]],
			[["drake", 3], ["dragonkin_guard", 2]],
			[["dragon_cultist", 3], ["fire_slime", 3]],
			[["dragonkin_guard", 3], ["drake", 2]],
			[["drake", 4], ["dragon_cultist", 2]],
		],
		"bosses": [
			["ash_warden", [["dragon_cultist", 2]]],
			["lava_giant", []],
			["dragon_priest", [["dragonkin_guard", 2]]],
			["elder_dragon", [["drake", 2]]],
		],
	},
	"bone_crypt": {
		"seed": 530, "wall": WALL, "floor": COBBLE,
		"packs": [
			[["bone_soldier", 3], ["crypt_hound", 2]],
			[["grave_wraith", 2], ["bone_soldier", 3]],
			[["plague_slime", 3], ["crypt_hound", 2]],
			[["bone_soldier", 4], ["grave_wraith", 1]],
			[["crypt_hound", 3], ["plague_slime", 2]],
			[["grave_wraith", 3], ["bone_soldier", 2]],
			[["bone_soldier", 3], ["crypt_hound", 3]],
		],
		"bosses": [
			["grave_keeper", [["bone_soldier", 2]]],
			["bone_beast", [["crypt_hound", 2]]],
			["grave_keeper", [["grave_wraith", 2]]],
			["lich_azgor", [["bone_soldier", 2]]],
		],
	},
	"goblin_cave": {
		"seed": 540, "wall": CAVE_WALL, "floor": CAVE_FLOOR,
		"entrance_portal": "cave_exit", "final_portals": ["arena_exit", "jack_portal"],
		"looks": ["kamp", "mantarlik", "dikitli", "kamp", "yosunlu", "maden", "tuplu"],
		"packs": [
			[["goblin", 3], ["cave_slime", 2]],
			[["goblin_guard", 2], ["goblin", 3]],
			[["cave_slime", 3], ["goblin", 2]],
			[["goblin", 4], ["goblin_guard", 1]],
			[["goblin_guard", 3], ["cave_slime", 2]],
		],
		"bosses": [
			["goblin_chief", [["goblin", 2]]],
			["goblin_chief", [["goblin_guard", 2]]],
			["goblin_chief", [["cave_slime", 2]]],
			["goblin_chief", [["goblin_guard", 3]]],
		],
	},
	"red_caves": {
		"seed": 541, "wall": CAVE_WALL, "floor": SAND,
		"tint": Color(1.0, 0.82, 0.76),
		# Red caves: the tube growths everywhere.
		"looks": ["tuplu", "dikitli", "tuplu", "kamp", "yosunlu", "tuplu", "mantarlik"],
		"packs": [
			[["gnoll_hunter", 3], ["cave_hyena", 2]],
			[["dust_slime", 3], ["gnoll_seer", 2]],
			[["red_minotaur", 2], ["gnoll_hunter", 3]],
			[["cave_hyena", 4], ["gnoll_seer", 1]],
			[["gnoll_hunter", 3], ["dust_slime", 2]],
			[["red_minotaur", 3], ["cave_hyena", 2]],
			[["gnoll_seer", 3], ["gnoll_hunter", 2]],
		],
		"bosses": [
			["gnoll_chief", [["gnoll_hunter", 2]]],
			["hyena_matriarch", [["cave_hyena", 2]]],
			["gnoll_chief", [["gnoll_seer", 2]]],
			["red_bull_tarhan", [["red_minotaur", 2]]],
		],
	},
	"frost_cavern": {
		"seed": 542, "wall": CAVE_WALL, "floor": ICE, "ice": true,
		# The pack has no ice: the rock and floor take a cold tint.
		"tint": Color(0.78, 0.98, 1.45),
		# Ice: the mushrooms with icicles, no camps' fires but one.
		"looks": ["mantarlik", "dikitli", "yosunlu", "mantarlik", "dikitli", "kamp"],
		"packs": [
			[["ice_fox", 3], ["crystal_slime", 2]],
			[["frost_kobold", 3], ["frozen_spirit", 2]],
			[["ice_elemental", 2], ["ice_fox", 3]],
			[["frozen_spirit", 3], ["crystal_slime", 2]],
			[["frost_kobold", 4], ["ice_elemental", 1]],
			[["ice_fox", 3], ["frozen_spirit", 2]],
			[["ice_elemental", 3], ["frost_kobold", 2]],
		],
		"bosses": [
			["icebreaker_gorr", [["frost_kobold", 2]]],
			["snow_mother_fox", [["ice_fox", 2]]],
			["icebreaker_gorr", [["ice_elemental", 2]]],
			["crystal_mother_neyra", [["crystal_slime", 2]]],
		],
	},
	"khan_barrow": {
		"seed": 543, "wall": WALL, "floor": COBBLE,
		# A khan's barrow: mausoleums and tombs above all.
		"looks": ["turbe", "lahitler", "mezarlik", "sapel", "tabutluk", "turbe", "lahitler"],
		"packs": [
			[["barrow_warrior", 3], ["barrow_spirit", 2]],
			[["tomb_oracle", 2], ["khan_guard", 3]],
			[["barrow_spirit", 3], ["tomb_oracle", 2]],
			[["khan_guard", 4], ["barrow_spirit", 1]],
			[["barrow_warrior", 3], ["tomb_oracle", 2]],
			[["khan_guard", 3], ["barrow_warrior", 2]],
			[["barrow_spirit", 4], ["khan_guard", 1]],
		],
		"bosses": [
			["bone_bey_sokmen", [["barrow_warrior", 2]]],
			["oracle_albasti", [["tomb_oracle", 2]]],
			["bone_bey_sokmen", [["khan_guard", 2]]],
			["dead_khan_tolun", [["khan_guard", 2]]],
		],
	},
	"jack_lair": {
		"seed": 544, "wall": WALL, "floor": CAVE_FLOOR,
		"entrance_portal": "lair_exit", "final_portals": ["lair_exit_top"],
		# Jack's cellar: graves and coffins.
		"looks": ["mezarlik", "tabutluk", "kript_depo", "lahitler", "mezarlik", "turbe"],
		"packs": [
			[["ghost_wolf", 3], ["shadow_slime", 2]],
			[["dark_wolf", 2], ["ghost_wolf", 3]],
			[["poison_slime", 3], ["shadow_slime", 2]],
			[["ghost_wolf", 4], ["dark_wolf", 1]],
			[["shadow_slime", 3], ["poison_slime", 2]],
		],
		"bosses": [
			["goblin_chief", [["ghost_wolf", 2]]],
			["goblin_chief", [["dark_wolf", 2]]],
			["goblin_chief", [["shadow_slime", 2]]],
			["pumpkin_jack", [["ghost_wolf", 2]]],
		],
	},
	"buried_caravanserai": {
		"seed": 550, "wall": WALL, "floor": SAND,
		"packs": [
			[["shrouded_dead", 3], ["tomb_jackal", 2]],
			[["sand_shade", 3], ["cursed_merchant", 2]],
			[["ruin_golem", 2], ["shrouded_dead", 3]],
			[["tomb_jackal", 4], ["sand_shade", 1]],
			[["cursed_merchant", 3], ["shrouded_dead", 2]],
			[["sand_shade", 3], ["ruin_golem", 2]],
			[["tomb_jackal", 3], ["cursed_merchant", 2]],
		],
		"bosses": [
			["caravan_ghost", [["cursed_merchant", 2]]],
			["vizier_kamil", [["shrouded_dead", 2]]],
			["stone_sentinel", [["ruin_golem", 1]]],
			["sand_sultan", [["sand_shade", 2]]],
		],
	},
	"sunken_temple": {
		"seed": 560, "wall": WALL, "floor": COBBLE,
		"packs": [
			[["temple_guard", 3], ["serpent_hound", 2]],
			[["drowned_priest", 2], ["temple_guard", 3]],
			[["bog_slime", 3], ["serpent_hound", 2]],
			[["temple_guard", 4], ["drowned_priest", 1]],
			[["serpent_hound", 3], ["bog_slime", 2]],
			[["drowned_priest", 3], ["temple_guard", 2]],
			[["bog_slime", 3], ["temple_guard", 2]],
		],
		"bosses": [
			["stone_warden", [["temple_guard", 2]]],
			["sacrifice_priestess", []],
			["tide_beast", [["serpent_hound", 2]]],
			["sunken_king", [["temple_guard", 2]]],
		],
	},
	"orc_fortress": {
		"seed": 570, "wall": WALL, "floor": PATH,
		"packs": [
			[["orc_warrior", 3], ["war_wolf", 2]],
			[["orc_shaman", 2], ["orc_warrior", 3]],
			[["orc_brute", 2], ["war_wolf", 3]],
			[["orc_warrior", 4], ["orc_shaman", 1]],
			[["war_wolf", 3], ["orc_brute", 2]],
			[["orc_shaman", 3], ["orc_warrior", 2]],
			[["orc_brute", 3], ["orc_warrior", 2]],
		],
		"bosses": [
			["gate_keeper_grom", [["orc_warrior", 2]]],
			["wolf_rider_uruk", [["war_wolf", 2]]],
			["shaman_zulgar", [["orc_shaman", 2]]],
			["warlord_mogthar", [["orc_brute", 2]]],
		],
	},
	"frost_citadel": {
		"seed": 580, "wall": CAVE_WALL, "floor": SNOW,
		"packs": [
			[["frost_knight", 3], ["ice_hound", 2]],
			[["frost_mage", 2], ["frost_knight", 3]],
			[["winter_wraith", 3], ["ice_hound", 2]],
			[["giant_guard", 2], ["frost_knight", 3]],
			[["ice_hound", 4], ["frost_mage", 1]],
			[["winter_wraith", 3], ["giant_guard", 2]],
			[["frost_mage", 3], ["winter_wraith", 2]],
		],
		"bosses": [
			["gate_commander_sergun", [["frost_knight", 2]]],
			["ice_witch_ayaza", [["frost_mage", 2]]],
			["white_drake_kiragi", [["ice_hound", 2]]],
			["winter_king_ulukan", [["giant_guard", 2]]],
		],
	},
	"abandoned_mine": {
		"seed": 520, "wall": CAVE_WALL, "floor": CAVE_FLOOR,
		# A mine: worked seams and the miners' camps, the cave's own growth in between.
		"looks": ["maden", "kamp", "dikitli", "maden", "yosunlu", "mantarlik", "kamp"],
		"packs": [
			[["kobold_miner", 3], ["tunnel_rat", 2]],
			[["rock_slime", 3], ["kobold_miner", 2]],
			[["kobold_overseer", 2], ["tunnel_rat", 3]],
			[["kobold_miner", 3], ["rock_slime", 2]],
			[["tunnel_rat", 4], ["kobold_overseer", 1]],
			[["kobold_overseer", 3], ["rock_slime", 2]],
			[["kobold_miner", 4], ["kobold_overseer", 1]],
		],
		"bosses": [
			["foreman_dorak", [["kobold_miner", 2]]],
			["crystal_golem", [["rock_slime", 2]]],
			["crystal_golem", [["kobold_overseer", 2]]],
			["mine_king", [["kobold_overseer", 2]]],
		],
	},
}
const ROOMS := 20
const COLS := 5
## Every room but the entrance and the bosses' holds two packs of this many mobs each.
const PACK_MIN := 5
const PACK_MAX := 10
## Every room's box (odd, so it has a middle tile) and the corridor between two rooms.
const ROOM := Vector2i(19, 13)
const GAP := 8
const MARGIN := 3
const SHAPES := ["kare", "yuvarlak", "sekizgen", "arti", "oval_kose"]

var rng := RandomNumberGenerator.new()
## The mobs' own dice: the packs can grow without moving anything else in a dungeon laid out before.
var mob_rng := RandomNumberGenerator.new()


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	var theme: Dictionary = THEMES[args[1]]
	match args[0]:
		"lava":
			_lava_sheet(args[1], theme)
		"tileset":
			_tileset(theme)
		"scenes":
			_scenes(args[1], theme)
		"map":
			for zone in args.slice(2):
				_map(args[1], theme, zone)
		"build":
			for zone in args.slice(2):
				_build(args[1], theme, zone)
		"hall":
			_hall_keep(args[1], theme)
		"open":
			for zone in args.slice(2):
				_open(args[1], theme, zone)
		"field":
			for zone in args.slice(2):
				_field(args[1], theme, zone)
	quit()


# ---- TileSet ----------------------------------------------------------------------------

func _tileset(theme: Dictionary) -> void:
	var set: TileSet = load(TILESET)
	var id: int = theme.source
	if set.has_source(id):
		set.remove_source(id)
	var s := TileSetAtlasSource.new()
	s.texture = load(PACK + theme.sheet)
	s.texture_region_size = Vector2i(16, 16)
	set.add_source(s, id)
	var walls: Array = theme.wall_top.values()
	for row in ["trim", "brick", "ledge"]:
		walls.append_array(theme.face[row])
	walls.append(theme.face.trim_w)
	walls.append(theme.face.trim_e)
	for c in walls:
		_role_tile(s, c, WALL, WALL_IDS, BOTH)
	var fs := s
	if theme.has("floor_sheet"):
		if set.has_source(int(theme.floor_source)):
			set.remove_source(int(theme.floor_source))
		fs = TileSetAtlasSource.new()
		fs.texture = load(PACK + theme.floor_sheet)
		fs.texture_region_size = Vector2i(16, 16)
		set.add_source(fs, int(theme.floor_source))
	var floors: Array = theme.floor.duplicate()
	for list in theme.get("floor_by_id", {}).values():
		floors.append_array(list)
	for c in floors:
		_role_tile(fs, c, CAVE_FLOOR, FLOOR_IDS, 0)
	for list in theme.decor.values():
		for c in list:
			if not s.has_tile(c):
				s.create_tile(c)
				_data(s.get_tile_data(c, 0), -1, 0)
	if not theme.has("lava"):
		ResourceSaver.save(set, TILESET)
		print("tileset: source %d (%s), %d tiles" % [id, theme.sheet, s.get_tiles_count()])
		return
	var lava: Dictionary = theme.lava
	var lid: int = lava.source
	if set.has_source(lid):
		set.remove_source(lid)
	var ls := TileSetAtlasSource.new()
	ls.texture = load(_lava_path(theme))
	ls.texture_region_size = Vector2i(16, 16)
	set.add_source(ls, lid)
	for i in _blob_masks().size():
		var c := Vector2i(i, 0)
		ls.create_tile(c)
		ls.set_tile_animation_columns(c, 1)
		ls.set_tile_animation_frames_count(c, int(lava.frames))
		for f in int(lava.frames):
			ls.set_tile_animation_frame_duration(c, f, float(lava.duration))
		_data(ls.get_tile_data(c, 0), int(lava.get("tile", LAVA)), WALK)
		ls.create_alternative_tile(c, LAVA_DECOR)
		_data(ls.get_tile_data(c, LAVA_DECOR), -1, 0)
	ResourceSaver.save(set, TILESET)
	print("tileset: source %d (%s), %d tiles; lava %d" % [id, theme.sheet, s.get_tiles_count(), lid])


## A tile of a role: id `base` on the tile itself, every other id of the role on alternative ALT + id.
func _role_tile(s: TileSetAtlasSource, c: Vector2i, base: int, ids: Array, layers: int) -> void:
	if s.has_tile(c):
		return
	s.create_tile(c)
	_data(s.get_tile_data(c, 0), base, layers)
	for t in ids:
		if t != base:
			s.create_alternative_tile(c, ALT + t)
			_data(s.get_tile_data(c, ALT + t), t, layers)


func _data(d: TileData, tile_id: int, layers: int) -> void:
	d.set_custom_data("tile", tile_id)
	var square := PackedVector2Array([Vector2(-8, -8), Vector2(8, -8), Vector2(8, 8), Vector2(-8, 8)])
	for p in 2:
		while d.get_collision_polygons_count(p) > 0:
			d.remove_collision_polygon(p, 0)
		if layers & (1 << p):
			d.add_collision_polygon(p)
			d.set_collision_polygon_points(p, 0, square)


# ---- Lava -------------------------------------------------------------------------------

func _lava_path(theme: Dictionary) -> String:
	for key in THEMES:
		if THEMES[key] == theme:
			return "res://assets/zindan/%s_lav.png" % key
	return ""


## Every lava shape there is: the 8 neighbours as bits (N, NE, E, SE, S, SW, W, NW), a corner
## only counting when both sides next to it are lava too. 47 of them, in this order on the sheet.
static func _blob_masks() -> Array:
	var set := {}
	for m in 256:
		set[_normalize(m)] = true
	var list := set.keys()
	list.sort()
	return list


static func _normalize(bits: int) -> int:
	for k in [1, 3, 5, 7]:
		if not (bits & (1 << (k - 1))) or not (bits & (1 << ((k + 1) % 8))):
			bits &= ~(1 << k)
	return bits


func _lava_sheet(name: String, theme: Dictionary) -> void:
	var lava: Dictionary = theme.lava
	var src: Image = load(PACK + String(lava.get("sheet", theme.sheet))).get_image()
	src.decompress()
	src.convert(Image.FORMAT_RGBA8)
	var p: Array = lava.slice
	var inner: Array = lava.inner
	var masks := _blob_masks()
	var frames := int(lava.frames)
	var out := Image.create(masks.size() * 16, frames * 16, false, Image.FORMAT_RGBA8)
	for i in masks.size():
		var m: int = masks[i]
		var bit := func(k: int) -> bool: return m & (1 << k) != 0
		# Each quarter from the piece whose same quarter has the right rims.
		var quarters := [
			[Vector2i(0, 0), _quarter(bit.call(0), bit.call(6), bit.call(7), p[0], p[1], p[3], inner[3], p[4])],
			[Vector2i(8, 0), _quarter(bit.call(0), bit.call(2), bit.call(1), p[2], p[1], p[5], inner[2], p[4])],
			[Vector2i(0, 8), _quarter(bit.call(4), bit.call(6), bit.call(5), p[6], p[7], p[3], inner[1], p[4])],
			[Vector2i(8, 8), _quarter(bit.call(4), bit.call(2), bit.call(3), p[8], p[7], p[5], inner[0], p[4])],
		]
		for f in frames:
			for q in quarters:
				var at: Vector2i = q[0]
				var piece: Vector2i = q[1] + Vector2i(0, f * int(lava.frame_step))
				out.blit_rect(src, Rect2i(piece * 16 + at, Vector2i(8, 8)), Vector2i(i * 16, f * 16) + at)
	var path := _lava_path(theme)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(path.get_base_dir()))
	out.save_png(ProjectSettings.globalize_path(path))
	print("lava sheet: %s, %d shapes x %d frames" % [path, masks.size(), frames])


## The piece for one quarter of a lava cell: vert / side = lava above or below / beside it,
## diag = lava on that corner.
static func _quarter(vert: bool, side: bool, diag: bool, corner: Vector2i, edge_h: Vector2i, edge_v: Vector2i, inner: Vector2i, full: Vector2i) -> Vector2i:
	if not vert and not side:
		return corner
	if not vert:
		return edge_h
	if not side:
		return edge_v
	return full if diag else inner


# ---- Props ------------------------------------------------------------------------------

func _scenes(name: String, theme: Dictionary) -> void:
	var sheet: Texture2D = load(PACK + theme.sheet)
	for key in theme.props:
		var spec: Dictionary = theme.props[key]
		var root := Node2D.new()
		root.name = String(key).to_pascal_case()
		if not String(spec.get("shadow", "")).is_empty():
			var shadow := Sprite2D.new()
			shadow.name = "Golge"
			shadow.texture = load("res://assets/town/%s.png" % spec.shadow)
			shadow.position = Vector2(0, -3)
			shadow.modulate.a = 0.6
			shadow.z_index = -5
			shadow.z_as_relative = false
			root.add_child(shadow)
		var own_sheet: Texture2D = load(String(spec.png)) if spec.has("png") else (load(PACK + spec.sheet) if spec.has("sheet") else sheet)
		if spec.has("z"):
			root.z_index = int(spec.z)
		if spec.has("frames"):
			var f: Dictionary = spec.frames
			var size: Vector2i = f.size
			var tex: Texture2D = load(PACK + f.sheet)
			var frames := SpriteFrames.new()
			frames.set_animation_speed("default", float(f.fps))
			for i in int(f.count):
				var at := AtlasTexture.new()
				at.atlas = tex
				at.region = Rect2(Vector2((i % int(f.cols)) * size.x, (i / int(f.cols)) * size.y), size)
				frames.add_frame("default", at)
			var anim := AnimatedSprite2D.new()
			anim.name = "Gorsel"
			anim.sprite_frames = frames
			anim.autoplay = "default"
			anim.centered = false
			anim.position = Vector2(-size.x / 2, -int(f.get("bottom", size.y)))
			root.add_child(anim)
		else:
			var r: Rect2i = spec.rect
			var s := Sprite2D.new()
			s.name = "Gorsel"
			s.texture = own_sheet
			s.region_enabled = true
			s.region_rect = Rect2(r)
			s.centered = false
			s.position = Vector2(-float(spec.foot) if spec.has("foot") else -floorf(r.size.x / 2.0), -r.size.y)
			root.add_child(s)
		if spec.has("light"):
			var l: Dictionary = spec.light
			var light := MapLight.new()
			light.name = "Lamba"
			light.position = l.at
			light.radius = l.radius
			light.color = l.color
			light.flicker = l.get("flicker", 0.06)
			light.lamp = false
			root.add_child(light)
		if spec.has("block"):
			var size: Vector2 = spec.block
			var body := StaticBody2D.new()
			body.name = "Hitbox"
			body.collision_layer = spec.get("layers", BOTH)
			body.collision_mask = 0
			var shape := CollisionShape2D.new()
			shape.name = "Kutu"
			var box := RectangleShape2D.new()
			box.size = size
			shape.shape = box
			shape.position = Vector2(0, -size.y / 2)
			body.add_child(shape)
			root.add_child(body)
		_own(root, root)
		var path := "res://props/%s/%s.tscn" % [name, key]
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(path.get_base_dir()))
		var packed := PackedScene.new()
		packed.pack(root)
		ResourceSaver.save(packed, path)
		root.free()
	print("scenes: ", theme.props.keys())


func _own(node: Node, root: Node) -> void:
	for child in node.get_children():
		child.owner = root
		if child.scene_file_path.is_empty():
			_own(child, root)


# ---- Painting ---------------------------------------------------------------------------

## Paints walls, floors and lava on `ground` from the tile ids; `lavaish` are cells drawn as lava
## (real lava, and lava under a grate) so their rims run on together.
func _paint(theme: Dictionary, ground: TileMapLayer, tid: Dictionary, h: int, lavaish: Dictionary) -> int:
	var src: int = theme.source
	var solid := func(c: Vector2i) -> bool:
		return not tid.has(c) or tid[c] in WALL_IDS
	# The wall's front: the lowest wall cells over open ground, up to three high.
	var face := {}  # cell -> "trim" / "brick" / "ledge"
	for c: Vector2i in tid:
		if not solid.call(c) or c.y + 1 >= h or solid.call(c + Vector2i(0, 1)):
			continue
		var run := 1
		while run < 3 and c.y - run >= 0 and solid.call(c + Vector2i(0, -run)) and not face.has(c + Vector2i(0, -run)):
			run += 1
		face[c] = "ledge"
		if run == 2:
			face[c + Vector2i(0, -1)] = "trim"
		elif run == 3:
			face[c + Vector2i(0, -1)] = "brick"
			face[c + Vector2i(0, -2)] = "trim"
	var top := func(c: Vector2i) -> bool:
		return solid.call(c) and not face.has(c)

	var blobs := _blob_masks()
	var kept := 0
	for c: Vector2i in tid:
		var t: int = tid[c]
		var coords := Vector2i(-1, -1)
		var base := -1
		if t in WALL_IDS:
			base = WALL
			if face.has(c):
				var row: Array = theme.face[face[c]]
				var left_open: bool = not solid.call(c + Vector2i(-1, 0))
				var right_open: bool = not solid.call(c + Vector2i(1, 0))
				coords = row[1]
				if left_open and not right_open:
					coords = row[0]
				elif right_open and not left_open:
					coords = row[2]
				elif face[c] == "trim" and not left_open and not right_open:
					var above := c + Vector2i(0, -1)
					if top.call(above) and not top.call(above + Vector2i(-1, 0)):
						coords = theme.face.trim_w
					elif top.call(above) and not top.call(above + Vector2i(1, 0)):
						coords = theme.face.trim_e
			else:
				coords = _top_piece(theme.wall_top, c, top)
		elif t == LAVA:
			ground.set_cell(c, int(theme.lava.source), Vector2i(blobs.find(_lava_mask(c, lavaish)), 0))
			continue
		elif t in FLOOR_IDS:
			base = CAVE_FLOOR
			var list: Array = theme.get("floor_by_id", {}).get(t, theme.floor)
			coords = list[0] if rng.randf() < 0.5 else list[rng.randi() % list.size()]
			ground.set_cell(c, int(theme.get("floor_source", src)), coords, 0 if t == base else ALT + t)
			continue
		if base < 0:
			kept += 1
			continue
		ground.set_cell(c, src, coords, 0 if t == base else ALT + t)
	return kept


static func _lava_mask(c: Vector2i, lavaish: Dictionary) -> int:
	var m := 0
	for k in 8:
		if lavaish.has(c + DIRS[k]):
			m |= 1 << k
	return _normalize(m)


## The wall's top at c, by which of its sides (n, w, e) border something that isn't wall top.
func _top_piece(p: Dictionary, c: Vector2i, top: Callable) -> Vector2i:
	var n: bool = not top.call(c + Vector2i(0, -1))
	var wv: bool = not top.call(c + Vector2i(-1, 0))
	var e: bool = not top.call(c + Vector2i(1, 0))
	if wv and e:
		return p.we
	if n and wv:
		return p.nw
	if n and e:
		return p.ne
	if n:
		return p.n
	if wv:
		return p.w
	if e:
		return p.e
	if not top.call(c + Vector2i(-1, -1)):
		return p.in_nw
	if not top.call(c + Vector2i(1, -1)):
		return p.in_ne
	return p.fill


# ---- A map repainted --------------------------------------------------------------------

func _map(name: String, theme: Dictionary, zone: String) -> void:
	rng.seed = hash(zone + name)
	var path := "res://maps/%s.tscn" % zone
	var file: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(MapExport.file_path(zone)))
	var w: int = file.width
	var h: int = file.height
	var tid := {}
	for y in h:
		var row: String = file.tiles[y]
		for x in w:
			tid[Vector2i(x, y)] = row[x].to_int() if row[x] < "a" else row.unicode_at(x) - 87
	var root: GameMap = load(path).instantiate()
	var ground: TileMapLayer = root.get_node("Zemin")
	var lava := {}
	for c: Vector2i in tid:
		if tid[c] == LAVA:
			lava[c] = true
	var kept := _paint(theme, ground, tid, h, lava)
	# Other tile layers (the old grass overlay) go: the theme draws everything on Zemin.
	for layer: TileMapLayer in root.find_children("*", "TileMapLayer", false, false):
		if layer != ground:
			root.remove_child(layer)
			layer.free()
	_swap_props(root, name, theme)
	if theme.has("lava_light"):
		_lava_lights(root, theme, lava)
	_save_map(root, path)
	print("%s: %d cells, %d kept" % [zone, tid.size(), kept])


func _save_map(root: Node, path: String) -> void:
	_own(root, root)
	var packed := PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, path)
	root.free()
	var fresh: GameMap = load(path).instantiate()
	var err := MapExport.write(fresh)
	fresh.free()
	print("  ", err if not err.is_empty() else "shared/maps file written")


func _swap_props(root: Node, name: String, theme: Dictionary) -> void:
	var swap: Dictionary = theme.swap
	var moved := 0
	for n in root.find_children("*", "Node2D", true, false):
		if not is_instance_valid(n) or n.scene_file_path.is_empty() or n.owner != root:
			continue
		var file: String = n.scene_file_path.get_file().get_basename()
		var key := n.scene_file_path.get_base_dir().get_file() + "/" + file
		var to: Variant = swap.get(key, swap.get(file))
		if to == null:
			continue
		var scene: PackedScene = load("res://props/%s/%s.tscn" % [name, to[0]])
		var fresh: Node2D = scene.instantiate()
		fresh.position = n.position + to[1]
		fresh.name = n.name
		var parent := n.get_parent()
		parent.add_child(fresh)
		parent.move_child(fresh, n.get_index())
		parent.remove_child(n)
		n.free()
		moved += 1
	print("  props swapped: ", moved)


## A warm glow over each lava pool.
func _lava_lights(root: Node, theme: Dictionary, lava: Dictionary) -> void:
	var old := root.get_node_or_null("LavIsiklari")
	if old:
		root.remove_child(old)
		old.free()
	var lights := Node2D.new()
	lights.name = "LavIsiklari"
	root.add_child(lights)
	var seen := {}
	for c: Vector2i in lava:
		if seen.has(c):
			continue
		var pool := [c]
		seen[c] = true
		var i := 0
		while i < pool.size():
			for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
				var o: Vector2i = pool[i] + d
				if lava.has(o) and not seen.has(o):
					seen[o] = true
					pool.append(o)
			i += 1
		var sum := Vector2.ZERO
		for p: Vector2i in pool:
			sum += Vector2(p) * 16 + Vector2(8, 8)
		var light := MapLight.new()
		light.name = "Lav"
		light.position = sum / pool.size()
		light.radius = clampf(24.0 + sqrt(pool.size()) * 14.0, 40.0, 110.0)
		light.color = theme.lava_light
		light.flicker = 0.08
		light.lamp = false
		lights.add_child(light, true)


# ---- A dungeon built --------------------------------------------------------------------

## What a build collects before it becomes a scene.
class Plan:
	var theme := {}        # the theme dressing it, and its name (props/<name>/)
	var tname := ""
	var ice := false       # icy twins of the props where there are any
	var cfg := {}          # the dungeon's BUILDS entry
	var tid := {}          # cell -> tile id
	var lava_decor := {}   # cell -> true: lava drawn under a grate (walkable)
	var decor := {}        # cell -> atlas coords on the Sus layer
	var props := []        # [scene name, foot position, mirrored]
	var blocked := {}      # cell -> true: a prop's hitbox
	var lanes := {}        # cell -> true: kept free (the ways through a room)
	var spots := []        # [kind, ref, position]
	# The room being dressed: its floor cells, middle, and how often each prop is in it.
	var inside := {}
	var mid := Vector2i.ZERO
	var count := {}


func _build(name: String, theme: Dictionary, zone: String) -> void:
	var cfg: Dictionary = BUILDS[zone]
	rng.seed = int(cfg.seed)
	mob_rng.seed = int(cfg.seed) * 7919
	var rooms := _room_list(cfg)
	var rows := ceili(rooms.size() / float(COLS))
	var cell := ROOM + Vector2i(GAP, GAP)
	var w: int = MARGIN * 2 + COLS * cell.x
	var h: int = MARGIN * 2 + rows * cell.y
	var plan := Plan.new()
	plan.theme = theme
	plan.tname = name
	plan.ice = bool(cfg.get("ice", false))
	plan.cfg = cfg
	for y in h:
		for x in w:
			plan.tid[Vector2i(x, y)] = int(cfg.wall)

	# Rooms of one size in a snake through the rows; corridors all GAP long, three wide.
	var rects: Array[Rect2i] = []
	var mids: Array[Vector2i] = []
	for i in rooms.size():
		var row := i / COLS
		var k := i % COLS
		var col := k if row % 2 == 0 else COLS - 1 - k
		var mid := Vector2i(MARGIN + col * cell.x + cell.x / 2, MARGIN + row * cell.y + cell.y / 2)
		rects.append(Rect2i(mid - ROOM / 2, ROOM))
		mids.append(mid)
	var links: Array[Dictionary] = []
	for i in rooms.size():
		links.append({})
	var corridors: Array[Rect2i] = []
	for i in range(1, rooms.size()):
		var a := rects[i - 1]
		var b := rects[i]
		if mids[i].y == mids[i - 1].y:
			var left := a if a.position.x < b.position.x else b
			var right := b if left == a else a
			corridors.append(Rect2i(left.end.x, mids[i].y - 1, right.position.x - left.end.x, 3))
			links[i - 1]["e" if b == right else "w"] = true
			links[i]["w" if b == right else "e"] = true
		else:
			corridors.append(Rect2i(mids[i].x - 1, a.end.y, 3, b.position.y - a.end.y))
			links[i - 1]["s"] = true
			links[i]["n"] = true
	for r in corridors:
		_fill(plan, r, int(cfg.floor))

	# Room shapes: never the same twice in a row.
	var shapes: Array[String] = []
	var last_shape := ""
	for i in rooms.size():
		var pick: Array = SHAPES.duplicate()
		pick.erase(last_shape)
		last_shape = pick[rng.randi() % pick.size()]
		shapes.append(last_shape)
	var insides: Array[Dictionary] = []
	for i in rooms.size():
		var inside := _shape_cells(shapes[i], rects[i], mids[i])
		insides.append(inside)
		for c: Vector2i in inside:
			plan.tid[c] = int(cfg.floor)
			if absi(c.y - mids[i].y) <= 2 or absi(c.x - mids[i].x) <= 2:
				plan.lanes[c] = true

	# Two rooms get a joke of their own.
	var packs: Array[int] = []
	for i in rooms.size():
		if rooms[i].kind == "pack":
			packs.append(i)
	var jokes := {}
	var joke_kinds: Array = _role(plan, "jokes", ["mangal", "anahtar", "sohbet"]).duplicate()
	_shuffle(joke_kinds)
	jokes[packs[2 + rng.randi() % 3]] = joke_kinds[0]
	jokes[packs[packs.size() - 2 - rng.randi() % 3]] = joke_kinds[1]

	# Looks dealt from a shuffled bag, so each comes about as often.
	var bag := []
	var used_jokes := {}
	var last_look := ""
	for i in rooms.size():
		var room: Dictionary = rooms[i]
		plan.inside = insides[i]
		plan.mid = mids[i]
		plan.count = {}
		var r := rects[i]
		var look := ""
		match room.kind:
			"entrance":
				_entrance(plan, r, zone)
			"pack":
				var can_channel: bool = not links[i].has("n") and not links[i].has("s") and shapes[i] != "arti"
				if bag.is_empty():
					bag = cfg.get("looks", _role(plan, "looks", ["havuz", "salon", "atolye", "depo", "run", "kanal"])).duplicate()
					_shuffle(bag)
				var pick := 0
				while pick < bag.size() - 1 and (bag[pick] == last_look or (bag[pick] == "kanal" and not can_channel)):
					pick += 1
				look = bag[pick]
				if look == "kanal" and not can_channel:
					look = "havuz"
				else:
					bag.remove_at(pick)
				last_look = look
				call("_room_" + look, plan, r)
				if jokes.has(i):
					# The joke meant for the room, or another that fits it.
					var order: Array = [jokes[i]] + joke_kinds.filter(func(j): return j != jokes[i] and not used_jokes.has(j))
					var placed := ""
					for j in order:
						if not used_jokes.has(j) and call("_joke_" + j, plan, r):
							used_jokes[j] = true
							placed = j
							break
					jokes[i] = placed
			"boss", "final":
				_boss_room(plan, r, room, room.kind == "final", zone)
		_wall_decor(plan, r, links[i], room.kind, look)
		if plan.theme.get("roles", {}).has("extra"):
			call("_extra_" + String(plan.theme.roles.extra), plan, r)
		_urns(plan, r)
		if room.kind == "pack":
			# The dice the single pack of before took, so the rest of the dungeon comes out as it was.
			var legacy := []
			for c: Vector2i in plan.inside:
				if _free(plan, c, true) and (c - plan.mid).length() <= 6.0:
					legacy.append(c)
			_shuffle(legacy)
			var sides := [Vector2i(-5, 0), Vector2i(5, 0)]
			if mob_rng.randf() < 0.5:
				sides.reverse()
			for k in room.packs.size():
				_pack_mobs(plan, room.packs[k], plan.mid + sides[k % 2])
		if links[i].has("n") and theme.props.has("kemer"):
			plan.props.append(["kemer", _foot(Vector2i(mids[i].x, r.position.y - 1)), false])
		print("  %2d %-8s %-10s %s%s" % [i + 1, room.kind, shapes[i], look, (" + " + jokes[i]) if jokes.has(i) and jokes[i] != "" else ""])
	# Grate bridges over lava in every other corridor.
	for k in corridors.size():
		if k % 2 == 0 and theme.has("lava"):
			var c := corridors[k]
			var span := Rect2i(c.position + Vector2i((c.size.x - 3) / 2, 0), Vector2i(3, 3)) if c.size.y == 3 else Rect2i(c.position + Vector2i(0, (c.size.y - 3) / 2), Vector2i(3, 3))
			_grate_over_lava(plan, theme, span)
	_rubble(plan, theme, insides)

	_check_paths(plan)
	_make_scene(name, theme, zone, plan, w, h)


## Entrance, then packs in turn, a boss in every fifth room, the last one the final boss.
func _room_list(cfg: Dictionary) -> Array:
	var out := []
	var p := 0
	var b := 0
	for i in ROOMS:
		if i == 0:
			out.append({"kind": "entrance"})
		elif (i + 1) % 5 == 0:
			out.append({"kind": "final" if i == ROOMS - 1 else "boss", "boss": cfg.bosses[b][0], "mobs": cfg.bosses[b][1]})
			b += 1
		else:
			# Two packs a room, each of PACK_MIN to PACK_MAX mobs (a pack's mix kept).
			out.append({"kind": "pack", "packs": [_scaled(cfg.packs[p % cfg.packs.size()]), _scaled(cfg.packs[(p + 3) % cfg.packs.size()])]})
			p += 1
	return out


## The floor cells of a room of this shape in its box; every shape keeps the middle cross open
## (where the corridors come in).
func _shape_cells(shape: String, r: Rect2i, m: Vector2i) -> Dictionary:
	var hx := r.size.x / 2
	var hy := r.size.y / 2
	var out := {}
	for y in range(r.position.y, r.end.y):
		for x in range(r.position.x, r.end.x):
			var dx := absi(x - m.x)
			var dy := absi(y - m.y)
			var ok := true
			match shape:
				"yuvarlak":
					ok = pow(dx / (hx + 0.5), 2) + pow(dy / (hy + 0.5), 2) <= 1.0
				"sekizgen":
					ok = (hx - dx) + (hy - dy) >= 3
				"arti":
					ok = dy <= 3 or dx <= 4
				"oval_kose":
					var ex := dx - (hx - 3)
					var ey := dy - (hy - 3)
					ok = ex <= 0 or ey <= 0 or ex * ex + ey * ey <= 9
			if ok:
				out[Vector2i(x, y)] = true
	return out


func _fill(plan: Plan, r: Rect2i, t: int) -> void:
	for y in range(r.position.y, r.end.y):
		for x in range(r.position.x, r.end.x):
			plan.tid[Vector2i(x, y)] = t


## The foot of a prop standing on tile c (the middle of its lower edge).
static func _foot(c: Vector2i) -> Vector2:
	return Vector2(c.x * 16 + 8, c.y * 16 + 16)


## A cell of the room's floor nothing stands on (and, unless lanes_ok, off the ways through).
func _free(plan: Plan, c: Vector2i, lanes_ok := false) -> bool:
	return plan.inside.has(c) and plan.tid[c] != LAVA and not plan.blocked.has(c) and not plan.lava_decor.has(c) and (lanes_ok or not plan.lanes.has(c))


func _free_rect(plan: Plan, r: Rect2i) -> bool:
	for y in range(r.position.y, r.end.y):
		for x in range(r.position.x, r.end.x):
			if not _free(plan, Vector2i(x, y)):
				return false
	return true


## r, or r moved step by step towards the room's middle until it fits; size 0 when it never does.
func _fit(plan: Plan, r: Rect2i) -> Rect2i:
	var at := r
	for k in 5:
		if _free_rect(plan, at):
			return at
		var c := at.get_center()
		at.position += Vector2i(signi(plan.mid.x - c.x), signi(plan.mid.y - c.y))
	return Rect2i()


## A lava pool at r, moved in to fit the room; smaller (2 x 2) when even that won't do.
func _pool(plan: Plan, r: Rect2i) -> bool:
	var at := _fit(plan, r)
	if at.size == Vector2i.ZERO and r.size.x > 2:
		var small := Rect2i(r.position + (r.size - Vector2i(2, 2)) / 2, Vector2i(2, 2))
		at = _fit(plan, small)
	if at.size == Vector2i.ZERO:
		return false
	_fill(plan, at, LAVA)
	return true


func _nine(plan: Plan, r: Rect2i, pieces: Array) -> void:
	for y in range(r.position.y, r.end.y):
		for x in range(r.position.x, r.end.x):
			var col := 0 if x == r.position.x else (2 if x == r.end.x - 1 else 1)
			var row := 0 if y == r.position.y else (2 if y == r.end.y - 1 else 1)
			plan.decor[Vector2i(x, y)] = pieces[row * 3 + col]


func _grate_over_lava(plan: Plan, theme: Dictionary, r: Rect2i) -> void:
	for y in range(r.position.y, r.end.y):
		for x in range(r.position.x, r.end.x):
			plan.lava_decor[Vector2i(x, y)] = true
	_nine(plan, r, theme.decor.grate)


## A prop on tile c (at overrides its foot), at most twice a room. Its hitbox must find free floor
## off the ways through; one without a hitbox just needs floor (on_wall: none, it hangs there).
func _prop(plan: Plan, scene: String, c: Vector2i, at := Vector2.INF, on_wall := false, mirrored := false) -> bool:
	if int(plan.count.get(scene, 0)) >= 2:
		return false
	var foot := _foot(c) if at == Vector2.INF else at
	var spec: Dictionary = plan.theme.props[scene]
	var cells: Array[Vector2i] = []
	if spec.has("block"):
		var size: Vector2 = spec.block
		var box := Rect2(foot - Vector2(size.x / 2, size.y), size)
		for y in range(floori(box.position.y / 16), ceili(box.end.y / 16)):
			for x in range(floori(box.position.x / 16), ceili(box.end.x / 16)):
				cells.append(Vector2i(x, y))
		for cc in cells:
			if not _free(plan, cc):
				return false
	elif not on_wall and not _free(plan, c, true):
		return false
	for cc in cells:
		plan.blocked[cc] = true
	plan.props.append([scene, foot, mirrored])
	plan.count[scene] = int(plan.count.get(scene, 0)) + 1
	return true


## Tries the cells in turn until the prop stands.
func _prop_any(plan: Plan, scene: String, cells: Array) -> bool:
	for c in cells:
		if _prop(plan, scene, c):
			return true
	return false


## Free cells of the room nearest its box's corners (at least `inset` from them), one per corner.
func _corners(plan: Plan, r: Rect2i, inset := 0) -> Array:
	var out := []
	for corner in [r.position, Vector2i(r.end.x - 1, r.position.y), Vector2i(r.position.x, r.end.y - 1), r.end - Vector2i.ONE]:
		var best := Vector2i(-1, -1)
		var dist := INF
		for c: Vector2i in plan.inside:
			var d: float = (c - corner).length()
			if d >= inset and d < dist and _free(plan, c):
				dist = d
				best = c
		if best.x >= 0:
			out.append(best)
	return out


func _room_havuz(plan: Plan, r: Rect2i) -> void:
	# Lava pools in the quarters, a rune in the middle.
	var m := plan.mid
	for p in [Vector2i(r.position.x + 2, r.position.y + 1), Vector2i(r.end.x - 5, r.position.y + 1), Vector2i(r.position.x + 2, r.end.y - 3), Vector2i(r.end.x - 5, r.end.y - 3)]:
		_pool(plan, Rect2i(p, Vector2i(3, 2)))
	_nine(plan, Rect2i(m - Vector2i(1, 1), Vector2i(3, 3)), THEMES.forge.decor.rune)
	var corners := _corners(plan, r)
	_prop_any(plan, "varil", corners)
	_prop_any(plan, "varil_kurukafa", corners)


func _room_salon(plan: Plan, r: Rect2i) -> void:
	# Pillars down both sides of the way through, two of them lit.
	var m := plan.mid
	var k := 0
	for dy in [-4, 4]:
		for dx in [-5, 5]:
			_prop_any(plan, "sutun_mesale" if k < 2 else "sutun", [m + Vector2i(dx, dy), m + Vector2i(dx, dy - signi(dy)), m + Vector2i(dx - signi(dx), dy)])
			k += 1
	_nine(plan, Rect2i(m - Vector2i(1, 1), Vector2i(3, 3)), THEMES.forge.decor.rune)
	var corners := _corners(plan, r)
	_prop_any(plan, "kasa", corners)
	_prop_any(plan, "varil_2", corners)


func _room_atolye(plan: Plan, r: Rect2i) -> void:
	# A smithy: furnaces against the back wall, anvils at work, coal heaped by them.
	var m := plan.mid
	var top := _top_row(plan, r)
	var k := 0
	for dx in [-7, -4, 4, 7]:
		var x: int = m.x + dx
		var y: int = maxi(int(top.get(x, r.position.y)), int(top.get(x + 1, r.position.y)))
		_prop(plan, "ocak" if k % 2 == 0 else "ocak_demir", Vector2i(x, y), Vector2((x + 1) * 16, (y + 1) * 16))
		k += 1
	for dx in [-5, 5]:
		_prop_any(plan, "ors", [m + Vector2i(dx, 4), m + Vector2i(dx, 3)])
		_prop_any(plan, "komur", [m + Vector2i(dx + signi(dx) * 2, 4), m + Vector2i(dx + signi(dx) * 2, 3)])
	var corners := _corners(plan, r)
	_prop_any(plan, "varil_su", corners)


func _room_kanal(plan: Plan, r: Rect2i) -> void:
	# Two lava channels across the room, crossed by grate bridges on the way through.
	var m := plan.mid
	for x0 in [m.x - 6, m.x + 4]:
		for y in range(r.position.y, r.end.y):
			for x in range(x0, x0 + 3):
				var c := Vector2i(x, y)
				if plan.inside.has(c):
					plan.tid[c] = LAVA
		var bridge := Rect2i(x0, m.y - 1, 3, 3)
		_fill(plan, bridge, plan.tid[m])
		_grate_over_lava(plan, THEMES.forge, bridge)
	var corners := _corners(plan, r)
	_prop_any(plan, "varil_2", corners)
	_prop_any(plan, "fici_kurukafa", corners)


func _room_depo(plan: Plan, r: Rect2i) -> void:
	# A storeroom: crates and barrels along the walls, a chest someone got to first.
	var spots := _corners(plan, r) + _corners(plan, r, 2) + _corners(plan, r, 4)
	for scene in ["kasa", "kasa", "varil", "varil_2", "varil_su", "sandik_acik"]:
		_prop_any(plan, scene, spots)
	_nine(plan, Rect2i(plan.mid - Vector2i(1, 1), Vector2i(3, 3)), THEMES.forge.decor.grate)


func _room_run(plan: Plan, r: Rect2i) -> void:
	# A rune hall: the lit rune, pillars and statues keeping it, small pools by the walls.
	var m := plan.mid
	_nine(plan, Rect2i(m - Vector2i(1, 1), Vector2i(3, 3)), THEMES.forge.decor.rune_lit)
	_prop_any(plan, "sutun_mesale", [m + Vector2i(-4, -3), m + Vector2i(-4, -4)])
	_prop_any(plan, "sutun_mesale", [m + Vector2i(4, 3), m + Vector2i(4, 4)])
	_prop_any(plan, "heykel", [m + Vector2i(4, -3), m + Vector2i(4, -4)])
	_prop_any(plan, "heykel", [m + Vector2i(-4, 3), m + Vector2i(-4, 4)])
	for p in [Vector2i(r.position.x + 1, m.y - 5), Vector2i(r.end.x - 3, m.y + 4)]:
		_pool(plan, Rect2i(p, Vector2i(2, 2)))


## A grill with meat on it in a lava dungeon: someone's lunch break.
func _joke_mangal(plan: Plan, r: Rect2i) -> bool:
	var m := plan.mid
	if not _prop_any(plan, "mangal", [m + Vector2i(-6, 4), m + Vector2i(6, 4), m + Vector2i(-6, -4), m + Vector2i(6, -4), m + Vector2i(-5, 3), m + Vector2i(5, 3), m + Vector2i(-6, 3), m + Vector2i(6, 3), m + Vector2i(-6, -3), m + Vector2i(6, -3)]):
		return false
	_prop_any(plan, "fici", [m + Vector2i(-8, 4), m + Vector2i(8, 4), m + Vector2i(-8, -4), m + Vector2i(8, -4), m + Vector2i(-8, 3), m + Vector2i(8, 3)])
	return true


## The key lies right next to the chest it opens: it was open all along.
func _joke_anahtar(plan: Plan, r: Rect2i) -> bool:
	if int(plan.count.get("sandik_acik", 0)) > 0:
		return false
	for c in _corners(plan, r, 1) + _corners(plan, r, 3):
		if _prop(plan, "sandik_acik", c, Vector2((c.x + 1) * 16, (c.y + 1) * 16)):
			var k: Vector2i = c + Vector2i(2 if c.x < plan.mid.x else -2, 0)
			if plan.inside.has(k):
				if plan.theme.decor.has("key"):
					plan.decor[k] = plan.theme.decor.key[0]
				else:
					_prop(plan, "anahtar", k)
			return true
	return false


## Two statues turned to each other, deep in conversation.
func _joke_sohbet(plan: Plan, r: Rect2i) -> bool:
	var m := plan.mid
	var pair := _v(plan, _role(plan, "pair", "heykel"))
	if int(plan.count.get(pair, 0)) > 0:
		return false
	for row in [m.y - 4, m.y + 4, m.y - 3, m.y + 3, m.y - 5, m.y + 5]:
		for x in range(r.position.x + 1, r.end.x - 3):
			var left := Vector2i(x, row)
			var right := Vector2i(x + 2, row)
			if _free(plan, left) and _free(plan, right) and _free(plan, left + Vector2i(1, 0)):
				_prop(plan, pair, left)
				_prop(plan, pair, right, Vector2.INF, false, true)
				return true
	return false


func _entrance(plan: Plan, r: Rect2i, zone: String) -> void:
	var m := plan.mid
	plan.spots.append(["spawn", "", _foot(m)])
	plan.spots.append(["portal", String(plan.cfg.get("entrance_portal", zone + "_exit")), Vector2(m.x * 16 + 8, (int(_top_row(plan, r).get(m.x, r.position.y)) + 1) * 16)])
	var corners := _corners(plan, r)
	for scene in _role(plan, "entrance", ["kasa", "varil", "varil_su"]):
		_prop_any(plan, scene, corners)


func _boss_room(plan: Plan, r: Rect2i, room: Dictionary, final: bool, zone: String) -> void:
	var m := plan.mid
	if plan.theme.has("lava"):
		for p in [Vector2i(r.position.x + 2, r.position.y + 1), Vector2i(r.end.x - 5, r.position.y + 1), Vector2i(r.position.x + 2, r.end.y - 4), Vector2i(r.end.x - 5, r.end.y - 4)]:
			_pool(plan, Rect2i(p, Vector2i(3, 3)))
	_centre(plan, String(_role(plan, "center", "rune_lit")))
	# Watchers by the way in, broken ones by the far wall.
	for dx in [-4, 4]:
		_prop_any(plan, _v(plan, _role(plan, "watch", "heykel")), [m + Vector2i(dx, -5), m + Vector2i(dx, -4)])
		_prop_any(plan, _v(plan, _role(plan, "broken", "heykel_kirik")), [m + Vector2i(dx, 5), m + Vector2i(dx, 4)])
	if final:
		for dx in [-7, 7]:
			_prop_any(plan, _v(plan, _role(plan, "lit", "sutun_mesale")), [m + Vector2i(dx, 3), m + Vector2i(dx, -3)])
		# The way out (and any further portal beside it, a few tiles apart).
		var exits: Array = plan.cfg.get("final_portals", [zone + "_final_exit"])
		var top := _top_row(plan, r)
		for k in exits.size():
			var x: int = m.x + (k - (exits.size() - 1) / 2.0) * 4
			plan.spots.append(["portal", String(exits[k]), Vector2(x * 16 + 8, (int(top.get(x, r.position.y)) + 1) * 16)])
	plan.spots.append(["mob", room.boss, _foot(m)])
	var around := [Vector2i(-3, 0), Vector2i(3, 0), Vector2i(-2, 2), Vector2i(2, 2), Vector2i(0, 3), Vector2i(0, -3)]
	var k := 0
	for entry in room.mobs:
		for n in int(entry[1]):
			plan.spots.append(["mob", entry[0], _foot(m + around[k % around.size()])])
			k += 1


## Each column's top floor row in the room.
func _top_row(plan: Plan, r: Rect2i) -> Dictionary:
	var out := {}
	for x in range(r.position.x, r.end.x):
		for y in range(r.position.y, r.end.y):
			if plan.inside.has(Vector2i(x, y)):
				out[x] = y
				break
	return out


## An urn or two in every room, whole ones and cracked ones by turns.
func _urns(plan: Plan, r: Rect2i) -> void:
	var kinds: Array = _role(plan, "urns", ["vazo", "amfora", "vazo_kirik", "amfora_kirik", "kup", "kup_2"])
	var a: String = kinds[rng.randi() % kinds.size()]
	var b: String = kinds[rng.randi() % kinds.size()]
	var spots := _corners(plan, r) + _corners(plan, r, 2) + _corners(plan, r, 4)
	_prop_any(plan, a, spots)
	_prop_any(plan, b, spots)


## A pack of mobs about `centre`, kept a little apart (a tile and a half or more).
func _pack_mobs(plan: Plan, mobs: Array, centre: Vector2i) -> void:
	var free := []
	for c: Vector2i in plan.inside:
		if _free(plan, c, true) and (c - centre).length() <= 5.0:
			free.append(c)
	free.sort()
	for i in range(free.size() - 1, 0, -1):
		var j := mob_rng.randi() % (i + 1)
		var t: Variant = free[i]
		free[i] = free[j]
		free[j] = t
	free.sort_custom(func(a: Vector2i, b: Vector2i): return (a - centre).length_squared() < (b - centre).length_squared())
	var taken: Array[Vector2i] = []
	for entry in mobs:
		for n in int(entry[1]):
			for c: Vector2i in free:
				if taken.has(c):
					continue
				var near := false
				for t in taken:
					if (t - c).length_squared() < 2:
						near = true
						break
				if not near:
					taken.append(c)
					plan.spots.append(["mob", entry[0], _foot(c)])
					break


## A pack grown or shrunk to PACK_MIN..PACK_MAX mobs, its kinds in the same proportion.
func _scaled(pack: Array) -> Array:
	var total := 0
	for entry in pack:
		total += int(entry[1])
	var want := PACK_MIN + mob_rng.randi() % (PACK_MAX - PACK_MIN + 1)
	var out := []
	var given := 0
	for i in pack.size():
		var n := want - given if i == pack.size() - 1 else maxi(1, roundi(float(pack[i][1]) * want / total))
		given += n
		out.append([pack[i][0], n])
	return out


func _shuffle(list: Array) -> void:
	for i in range(list.size() - 1, 0, -1):
		var j := rng.randi() % (i + 1)
		var t: Variant = list[i]
		list[i] = list[j]
		list[j] = t


## Pillars, banners and pipes along the room's back wall, each at most twice; the doorway and
## the portals in the middle are left clear.
func _wall_decor(plan: Plan, r: Rect2i, link: Dictionary, kind: String, look: String) -> void:
	if look == "atolye":
		return
	var top := _top_row(plan, r)
	var order: Array = _role(plan, "wall", ["duvar_sutunu", "sancak", "boru", "duvar_sutunu_sonuk"]) if kind == "pack" else _role(plan, "wall_boss", _role(plan, "wall", ["duvar_sutunu", "sancak", "duvar_sutunu_sonuk", "boru"]))
	var k := 0
	for x in range(r.position.x + 1, r.end.x - 1, 3):
		if (link.has("n") or kind == "entrance" or kind == "final") and absi(x - plan.mid.x) <= 2:
			continue
		if not top.has(x):
			continue
		var c := Vector2i(x, int(top[x]) - 1)
		for tries in order.size():
			var scene: String = order[(k + tries) % order.size()]
			if _prop(plan, scene, c, _foot(c) + (Vector2(0, -4) if scene == "sancak" else Vector2.ZERO), true):
				break
		k += 1


func _rubble(plan: Plan, theme: Dictionary, insides: Array[Dictionary]) -> void:
	var bits: Array = theme.decor.rubble
	for inside in insides:
		for c: Vector2i in inside:
			if plan.tid[c] == LAVA or plan.decor.has(c) or plan.blocked.has(c) or plan.lava_decor.has(c):
				continue
			if rng.randf() < float(theme.get("roles", {}).get("rubble_rate", 0.035)):
				plan.decor[c] = bits[rng.randi() % bits.size()]


## Every mob, portal and the spawn must be reachable on foot from the spawn.
func _check_paths(plan: Plan) -> void:
	var start := Vector2i(-1, -1)
	for s in plan.spots:
		if s[0] == "spawn":
			start = Vector2i(floori(s[2].x / 16), floori(s[2].y / 16) - 1)
	var walk := func(c: Vector2i) -> bool:
		return plan.tid.has(c) and plan.tid[c] in FLOOR_IDS and not plan.blocked.has(c)
	var seen := {start: true}
	var queue := [start]
	while not queue.is_empty():
		var c: Vector2i = queue.pop_back()
		for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var o: Vector2i = c + d
			if not seen.has(o) and walk.call(o):
				seen[o] = true
				queue.append(o)
	var bad := 0
	for s in plan.spots:
		var cell := Vector2i(floori(s[2].x / 16), floori((s[2].y - 1) / 16))
		if not seen.has(cell):
			bad += 1
			push_error("unreachable %s %s at %s" % [s[0], s[1], cell])
	print("  paths: %d spots, %d unreachable" % [plan.spots.size(), bad])


func _make_scene(name: String, theme: Dictionary, zone: String, plan: Plan, w: int, h: int) -> void:
	var path := "res://maps/%s.tscn" % zone
	var root: GameMap = load(path).instantiate()
	for child in root.get_children():
		root.remove_child(child)
		child.free()
	root.width = w
	root.height = h
	if theme.has("background"):
		root.background = theme.background
	var set: TileSet = load(TILESET)
	if theme.get("underlay", false):
		# Grass under the walls, showing through their see-through edges.
		var alt := _layer(root, "Alt", set, -11)
		for c: Vector2i in plan.tid:
			if plan.tid[c] in WALL_IDS:
				alt.set_cell(c, int(theme.get("floor_source", theme.source)), theme.floor[0], 0 if int(plan.cfg.get("floor", GRASS)) == CAVE_FLOOR else ALT + int(plan.cfg.get("floor", GRASS)))
	var ground := _layer(root, "Zemin", set, -10)
	var under := _layer(root, "SusLav", set, -9)
	var decor := _layer(root, "Sus", set, -8)
	var lavaish := plan.lava_decor.duplicate()
	for c: Vector2i in plan.tid:
		if plan.tid[c] == LAVA:
			lavaish[c] = true
	_paint(theme, ground, plan.tid, h, lavaish)
	if plan.cfg.has("tint"):
		ground.modulate = plan.cfg.tint
		decor.modulate = plan.cfg.tint
	var blobs := _blob_masks()
	if theme.has("lava"):
		for c: Vector2i in plan.lava_decor:
			under.set_cell(c, int(theme.lava.source), Vector2i(blobs.find(_lava_mask(c, lavaish)), 0), LAVA_DECOR)
	if theme.face.has("tips"):
		_tips(theme, decor, plan.tid, h)
	for c: Vector2i in plan.decor:
		decor.set_cell(c, int(theme.source), plan.decor[c])

	var items := Node2D.new()
	items.name = "Esyalar"
	items.y_sort_enabled = true
	root.add_child(items)
	for p in plan.props:
		var node: Node2D = load("res://props/%s/%s.tscn" % [plan.tname, p[0]]).instantiate()
		node.position = p[1]
		if p[2]:
			node.scale.x = -1
		items.add_child(node, true)
	var lava := {}
	for c: Vector2i in plan.tid:
		if plan.tid[c] == LAVA:
			lava[c] = true
	if theme.has("lava_light"):
		_lava_lights(root, theme, lava)
	var spots := Node2D.new()
	spots.name = "Noktalar"
	spots.z_index = 100
	root.add_child(spots)
	for s in plan.spots:
		var spot := MapSpot.new()
		spot.kind = s[0]
		spot.ref = s[1]
		spot.position = s[2]
		if s.size() > 3:
			spot.radius = s[3]
			spot.count = s[4]
		spot.name = "Dogus" if s[0] == "spawn" else String(s[1]).to_pascal_case()
		spots.add_child(spot, true)
	_save_map(root, path)
	print("%s: %d x %d tiles, %d props, %d spots" % [zone, w, h, plan.props.size(), plan.spots.size()])


func _layer(root: Node, layer_name: String, set: TileSet, z: int) -> TileMapLayer:
	var layer := TileMapLayer.new()
	layer.name = layer_name
	layer.tile_set = set
	layer.z_index = z
	root.add_child(layer)
	return layer


# ---- Themes' roles, shared helpers --------------------------------------------------------

## What the theme puts in a role (the Forge's own choice when the theme names none).
func _role(plan: Plan, key: String, fallback: Variant) -> Variant:
	return plan.theme.get("roles", {}).get(key, fallback)


## The prop's icy twin in an icy dungeon, where it has one.
func _v(plan: Plan, scene: String) -> String:
	if plan.ice and plan.theme.props.has(scene + "_buz"):
		return scene + "_buz"
	return scene


## Something on the floor in the room's middle: a rune (9-slice) or a patch of moss.
func _centre(plan: Plan, key: String) -> void:
	if key == "moss":
		_moss(plan, plan.mid - Vector2i(2, 2))
	elif plan.theme.decor.has(key):
		_nine(plan, Rect2i(plan.mid - Vector2i(1, 1), Vector2i(3, 3)), plan.theme.decor[key])


## The theme's 5 x 5 moss patch with its top left at c (only on the room's floor).
func _moss(plan: Plan, c: Vector2i) -> void:
	if plan.ice:
		return  # no moss on ice
	var tiles: Array = plan.theme.decor.moss
	var w := int(plan.theme.get("patch_w", 5))
	for i in tiles.size():
		var cell := c + Vector2i(i % w, i / w)
		if plan.inside.has(cell) and not plan.decor.has(cell) and plan.tid[cell] != LAVA:
			plan.decor[cell] = tiles[i]


## The ends of the roots hanging from the wall's front over the floor below it.
func _tips(theme: Dictionary, decor: TileMapLayer, tid: Dictionary, h: int) -> void:
	var solid := func(c: Vector2i) -> bool:
		return not tid.has(c) or tid[c] in WALL_IDS
	var tips: Array = theme.face.tips
	for c: Vector2i in tid:
		if not solid.call(c) or c.y + 1 >= h or solid.call(c + Vector2i(0, 1)):
			continue
		var below := c + Vector2i(0, 1)
		if decor.get_cell_source_id(below) != -1:
			continue
		var left_open: bool = not solid.call(c + Vector2i(-1, 0))
		var right_open: bool = not solid.call(c + Vector2i(1, 0))
		var t: Vector2i = tips[1]
		if left_open and not right_open:
			t = tips[0]
		elif right_open and not left_open:
			t = tips[2]
		decor.set_cell(below, int(theme.source), t)


## Props scattered on free cells of the room (each at most twice, as always).
func _scatter(plan: Plan, scenes: Array, tries: int) -> void:
	var cells := []
	for c: Vector2i in plan.inside:
		if _free(plan, c):
			cells.append(c)
	cells.sort()
	_shuffle(cells)
	var k := 0
	for c in cells:
		if k >= tries:
			break
		if _prop(plan, scenes[k % scenes.size()], c):
			k += 1


# ---- Cave rooms ----------------------------------------------------------------------------

## A grove of great mushrooms in the room's quarters, little ones and moss between.
func _room_mantarlik(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	var big := ["mantar_buyuk", "mantar_egik", "mantar_dev", "mantar_orta"]
	_shuffle(big)
	var k := 0
	for q in [Vector2i(-6, -3), Vector2i(6, -3), Vector2i(-6, 4), Vector2i(6, 4)]:
		_prop_any(plan, _v(plan, big[k % big.size()]), [m + q, m + q + Vector2i(signi(q.x), 0), m + q - Vector2i(signi(q.x), 0), m + q + Vector2i(0, signi(q.y))])
		k += 1
	_moss(plan, m + Vector2i(-7, 1))
	_moss(plan, m + Vector2i(3, -5))
	_scatter(plan, [_v(plan, "mantar_kucuk"), _v(plan, "mantar_kucuk_2"), "mantar_kucuk_3"], 5)


## Moss over the floor, a glowing sprout in two corners, stones.
func _room_yosunlu(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	for c in [m + Vector2i(-7, -4), m + Vector2i(2, -4), m + Vector2i(-6, 2), m + Vector2i(3, 2)]:
		_moss(plan, c)
	var corners := _corners(plan, r, 1)
	_prop_any(plan, "filiz", corners)
	_prop_any(plan, "filiz", corners.slice(2) + corners)
	_scatter(plan, ["kaya", "kaya_2", "kaya_gri", _v(plan, "mantar_kucuk_2"), "dikit_kucuk"], 6)


## Stalagmites in clusters, stones round them.
func _room_dikitli(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	for base in [m + Vector2i(-6, -3), m + Vector2i(6, 3)]:
		_prop_any(plan, "dikit", [base, base + Vector2i(0, 1), base - Vector2i(0, 1)])
		_prop_any(plan, "dikit_orta", [base + Vector2i(1, 1), base + Vector2i(-1, 1), base + Vector2i(1, 0)])
		_prop_any(plan, "dikit_kucuk", [base + Vector2i(-1, 0), base + Vector2i(2, 0), base + Vector2i(-1, 1)])
	_scatter(plan, ["kaya", "kaya_gri", "kaya_2"], 5)
	_centre(plan, "moss")


## Red tube growths, big ones in the quarters, small ones about.
func _room_tuplu(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	var big := ["tup_buyuk", "tup", "tup_2", "tup_buyuk"]
	var k := 0
	for q in [Vector2i(-6, -3), Vector2i(6, -3), Vector2i(-6, 4), Vector2i(6, 4)]:
		_prop_any(plan, big[k], [m + q, m + q + Vector2i(signi(q.x), 0), m + q + Vector2i(0, signi(q.y))])
		k += 1
	_scatter(plan, ["tup_kucuk", "tup_kucuk_2", "tup_kucuk_3", "tup_yer"], 6)


## Someone's camp: a fire pit, sacks and barrels round it, a crate.
func _room_kamp(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	_prop_any(plan, "ates_cukuru", [m + Vector2i(-5, -3), m + Vector2i(5, -3), m + Vector2i(-5, 3), m + Vector2i(5, 3)])
	var corners := _corners(plan, r) + _corners(plan, r, 2)
	for scene in ["cuval", "cuval_2", "varil", "kasa", "fici_orta"]:
		_prop_any(plan, scene, corners)
	_scatter(plan, ["kaya_2", _v(plan, "mantar_kucuk")], 3)


## A worked seam: ore glinting, coal heaped, crates and barrels, a big cask.
func _room_maden(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	var spots := _corners(plan, r) + _corners(plan, r, 2) + _corners(plan, r, 4)
	for scene in ["fici_buyuk", "kasa", "varil_2", "sandik", "komur", "komur"]:
		_prop_any(plan, scene, spots)
	_scatter(plan, ["cevher", "cevher", "kaya", "kaya_gri"], 4)


## Every cave room: moss over the floor in a few places, little growth about.
func _extra_cave(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	var spots := [m + Vector2i(-8, -5), m + Vector2i(3, -5), m + Vector2i(-8, 1), m + Vector2i(4, 2), m + Vector2i(-2, -6), m + Vector2i(-2, 3)]
	_shuffle(spots)
	for k in 2 + rng.randi() % 2:
		_moss(plan, spots[k])
	_scatter(plan, [_v(plan, "mantar_kucuk_2"), "mantar_kucuk_3", "dikit_kucuk", "kaya_2", "filiz"], 4)


# ---- Crypt rooms ---------------------------------------------------------------------------

## Sarcophagi in two rows either side of the way through, candles at their heads.
func _room_lahitler(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	var tombs := ["lahit", "lahit_2", "lahit_tugla", "lahit_duz"]
	_shuffle(tombs)
	var k := 0
	for dx in [-6, -3, 3, 6]:
		_prop_any(plan, tombs[k % tombs.size()], [m + Vector2i(dx, -3), m + Vector2i(dx, -4), m + Vector2i(dx, 4), m + Vector2i(dx, 5)])
		k += 1
	var corners := _corners(plan, r)
	_prop_any(plan, "samdan", corners)
	_prop_any(plan, "samdan", corners.slice(1) + corners)


## Coffins along the walls, cobwebs in the corners, a candle or two.
func _room_tabutluk(plan: Plan, r: Rect2i) -> void:
	var spots := _corners(plan, r, 1) + _corners(plan, r, 3)
	for scene in ["tabut", "tabut_2", "tabut_acik", "tabut"]:
		_prop_any(plan, scene, spots)
	var corners := _corners(plan, r)
	_prop_any(plan, "ag_kose", corners)
	_prop_any(plan, "mum", corners.slice(1) + corners)
	_scatter(plan, ["mum", "kup"], 2)


## A graveyard indoors: rows of headstones and crosses, a fresh grave.
func _room_mezarlik(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	var stones := ["mezar_tasi", "mezar_hac", "hac", "hac_kucuk", "hac_demir", "hac_demir_2"]
	_shuffle(stones)
	var k := 0
	for dy in [-4, 4]:
		for dx in [-7, -5, 5, 7]:
			_prop_any(plan, stones[k % stones.size()], [m + Vector2i(dx, dy), m + Vector2i(dx, dy - signi(dy))])
			k += 1
	_prop_any(plan, "toprak", _corners(plan, r, 2))


## A chapel: busts and statues by the carpet, banners and candles.
func _room_sapel(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	_centre(plan, "carpet")
	for dx in [-4, 4]:
		_prop_any(plan, "bust" if dx < 0 else "bust_2", [m + Vector2i(dx, -3), m + Vector2i(dx, -4)])
		_prop_any(plan, "samdan", [m + Vector2i(dx, 3), m + Vector2i(dx, 4)])
	var corners := _corners(plan, r)
	_prop_any(plan, "heykel_melek", corners)
	_prop_any(plan, "saksi_agac", corners.slice(1) + corners)


## Mausoleums: two little shrines and a tall cross between.
func _room_turbe(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	_prop_any(plan, "turbe", [m + Vector2i(-6, -3), m + Vector2i(-6, -2), m + Vector2i(-5, -3)])
	_prop_any(plan, "turbe_kuru", [m + Vector2i(6, -3), m + Vector2i(6, -2), m + Vector2i(5, -3)])
	_prop_any(plan, "hac_buyuk", [m + Vector2i(-6, 4), m + Vector2i(6, 4), m + Vector2i(-5, 4)])
	_prop_any(plan, "heykel_azrail", [m + Vector2i(6, 4), m + Vector2i(5, 4), m + Vector2i(6, 3)])


## A storeroom gone to dust: crates, a chest, cobwebs.
func _room_kript_depo(plan: Plan, r: Rect2i) -> void:
	var spots := _corners(plan, r) + _corners(plan, r, 2) + _corners(plan, r, 4)
	for scene in ["kasa", "varil", "sandik", "kasa", "ag_kose"]:
		_prop_any(plan, scene, spots)


## Every crypt room: a candle and a cobweb or so.
func _extra_crypt(plan: Plan, r: Rect2i) -> void:
	_scatter(plan, ["mum", "hac_kucuk"], 2)


## Someone was digging here: a fresh mound, the shovel stuck in it, an open coffin waiting.
func _joke_kurek(plan: Plan, r: Rect2i) -> bool:
	var m := plan.mid
	for c in [m + Vector2i(-6, 4), m + Vector2i(6, 4), m + Vector2i(-6, -4), m + Vector2i(6, -4), m + Vector2i(-5, 3), m + Vector2i(5, 3)]:
		if _prop(plan, "toprak_kurek", c):
			_prop_any(plan, "tabut_acik", [c + Vector2i(3, 0), c + Vector2i(-3, 0), c + Vector2i(2, 0), c + Vector2i(-2, 0)])
			return true
	return false


# ---- Desert rooms --------------------------------------------------------------------------

## Ruins: sandstone pillars down the sides, a broken tower, rubble.
func _room_harabe(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	var k := 0
	for dy in [-4, 4]:
		for dx in [-5, 5]:
			_prop_any(plan, ["sutun", "sutun_kirik", "sutun_2", "sutun_kirik_2"][k], [m + Vector2i(dx, dy), m + Vector2i(dx, dy - signi(dy)), m + Vector2i(dx - signi(dx), dy)])
			k += 1
	_prop_any(plan, "kule_kirik", _corners(plan, r, 1))


## The bones of something huge, a dead tree over them.
func _room_kemikler(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	_prop_any(plan, "kaburga", [m + Vector2i(-6, -3), m + Vector2i(-5, -3), m + Vector2i(-6, 4)])
	_prop_any(plan, "boynuz", [m + Vector2i(6, -3), m + Vector2i(5, -3), m + Vector2i(6, 4)])
	_prop_any(plan, "boynuz_2", [m + Vector2i(6, 4), m + Vector2i(5, 4), m + Vector2i(-6, 4)])
	_prop_any(plan, "kuru_agac", _corners(plan, r, 2))
	_scatter(plan, ["kemik", "kemik"], 2)


## A caravan's camp: a fire, sacks and chests about it, urns.
func _room_kervan(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	_prop_any(plan, "ates_cukuru", [m + Vector2i(-5, -3), m + Vector2i(5, -3), m + Vector2i(-5, 3), m + Vector2i(5, 3)])
	var spots := _corners(plan, r) + _corners(plan, r, 2)
	for scene in ["cuval", "cuval_2", "sandik", "kup_2"]:
		_prop_any(plan, scene, spots)


## An oasis gone dry: cacti, bushes, a rock.
func _room_vaha(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	var k := 0
	for q in [Vector2i(-6, -3), Vector2i(6, -3), Vector2i(-6, 4), Vector2i(6, 4)]:
		_prop_any(plan, ["kaktus_dal", "kaktus", "kaya", "kaktus_ince"][k], [m + q, m + q + Vector2i(signi(q.x), 0), m + q + Vector2i(0, signi(q.y))])
		k += 1
	_scatter(plan, ["cali", "kaktus_kucuk", "cali"], 3)


## A treasury someone found first: chests open and shut, gold urns, a broken one.
func _room_hazine(plan: Plan, r: Rect2i) -> void:
	var spots := _corners(plan, r) + _corners(plan, r, 2) + _corners(plan, r, 4)
	for scene in ["sandik_2", "sandik_acik", "sandik_acik_2", "kup", "kup_2", "kup_kirik"]:
		_prop_any(plan, scene, spots)


## A hall of obelisks: two standing, two fallen to stumps.
func _room_dikilitaslar(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	_prop_any(plan, "dikilitas", [m + Vector2i(-5, -3), m + Vector2i(-5, -4)])
	_prop_any(plan, "dikilitas", [m + Vector2i(5, -3), m + Vector2i(5, -4)])
	_prop_any(plan, "dikilitas_kirik_2", [m + Vector2i(-5, 4), m + Vector2i(-5, 3)])
	_prop_any(plan, "kule", [m + Vector2i(5, 4), m + Vector2i(5, 3)])


## Every desert room: darker sand in a few places, a small thing or two.
func _extra_desert(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	var spots := [m + Vector2i(-8, -5), m + Vector2i(3, -5), m + Vector2i(-8, 1), m + Vector2i(4, 2), m + Vector2i(-2, -6), m + Vector2i(-2, 3)]
	_shuffle(spots)
	for k in 2:
		_moss(plan, spots[k])
	_scatter(plan, ["kaktus_kucuk", "kemik", "kuru_agac_kucuk", "cali"], 3)


# ---- Sunken temple rooms -------------------------------------------------------------------

## Pools of the sunken water in the room's quarters, a statue keeping watch between.
func _room_su_havuzu(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	for p in [Vector2i(r.position.x + 2, r.position.y + 1), Vector2i(r.end.x - 5, r.position.y + 1), Vector2i(r.position.x + 2, r.end.y - 3), Vector2i(r.end.x - 5, r.end.y - 3)]:
		_pool(plan, Rect2i(p, Vector2i(3, 2)))
	_prop_any(plan, "heykel", [m + Vector2i(-4, -3), m + Vector2i(4, -3), m + Vector2i(-4, 3)])
	_scatter(plan, ["servi", "kaide"], 2)


## Two channels of water across the room, a grate over each on the way through.
func _room_su_kanali(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	for x0 in [m.x - 6, m.x + 4]:
		for y in range(r.position.y, r.end.y):
			for x in range(x0, x0 + 3):
				var c := Vector2i(x, y)
				if plan.inside.has(c):
					plan.tid[c] = LAVA
		var bridge := Rect2i(x0, m.y - 1, 3, 3)
		_fill(plan, bridge, plan.tid[m])
		_grate_over_lava(plan, plan.theme, bridge)
	var corners := _corners(plan, r)
	_prop_any(plan, "varil_2", corners)
	_prop_any(plan, "lamba", corners)


## A hall of statues: two pouring water from their plinths, two standing, pedestals between.
func _room_heykeller(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	_prop_any(plan, "heykel_kaide", [m + Vector2i(-5, -3), m + Vector2i(-5, -4)])
	_prop_any(plan, "heykel_2", [m + Vector2i(5, -3), m + Vector2i(5, -4)])
	_prop_any(plan, "heykel", [m + Vector2i(-5, 4), m + Vector2i(-5, 3)])
	_prop_any(plan, "heykel_kucuk", [m + Vector2i(5, 4), m + Vector2i(5, 3)])
	_scatter(plan, ["kaide", "servi"], 2)


## An altar: the old fountain off the way through, lamps either side of it.
func _room_sunak(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	for c in [m + Vector2i(-5, -2), m + Vector2i(5, -2), m + Vector2i(-5, 4), m + Vector2i(5, 4)]:
		if _prop(plan, "cesme", c):
			_prop_any(plan, "lamba", [c + Vector2i(-4, 0), c + Vector2i(4, 0)])
			_prop_any(plan, "lamba", [c + Vector2i(4, 0), c + Vector2i(-4, 0)])
			break
	_scatter(plan, ["servi", "kaide"], 2)


## Where the sewer broke in: pillars fallen, a chain hanging, barrels washed up.
func _room_kanalizasyon(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	var k := 0
	for q in [Vector2i(-6, -3), Vector2i(6, -3), Vector2i(-6, 4), Vector2i(6, 4)]:
		_prop_any(plan, ["sutun", "sutun_kirik", "sutun_kirik_2", "sutun_kirik"][k], [m + q, m + q + Vector2i(signi(q.x), 0), m + q + Vector2i(0, signi(q.y))])
		k += 1
	_scatter(plan, ["varil", "zincir", "varil_2"], 3)


## The temple's store: chests, crates, potions left on the floor.
func _room_tapinak_depo(plan: Plan, r: Rect2i) -> void:
	var spots := _corners(plan, r) + _corners(plan, r, 2) + _corners(plan, r, 4)
	for scene in ["kasa", "sandik", "varil", "varil_2", "sandik_acik"]:
		_prop_any(plan, scene, spots)
	_scatter(plan, ["iksir", "iksir_2"], 2)


## Every temple room: a potion or a pedestal left about.
func _extra_temple(plan: Plan, r: Rect2i) -> void:
	_scatter(plan, ["iksir", "kaide"], 2)


# ---- Orc fortress rooms --------------------------------------------------------------------

## Barracks: bedrolls along the walls, a fire to sleep by, crates.
func _room_kisla(plan: Plan, r: Rect2i) -> void:
	var spots := _corners(plan, r, 1) + _corners(plan, r, 3)
	for scene in ["yatak", "yatak_2", "yatak", "yatak_2", "kasa"]:
		_prop_any(plan, scene, spots)
	_prop_any(plan, "ates", [plan.mid + Vector2i(-5, -3), plan.mid + Vector2i(5, 3), plan.mid + Vector2i(-5, 3)])


## A feast: tables, casks, a grill going.
func _room_ziyafet(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	_prop_any(plan, "masa", [m + Vector2i(-5, -3), m + Vector2i(-5, -4), m + Vector2i(-6, 3)])
	_prop_any(plan, "masa", [m + Vector2i(5, 3), m + Vector2i(5, 4), m + Vector2i(6, -3)])
	var corners := _corners(plan, r)
	for scene in ["fici_orta", "fici_kucuk", "varil"]:
		_prop_any(plan, scene, corners)


## The orcs' store: big casks, crates, a chest.
func _room_ork_depo(plan: Plan, r: Rect2i) -> void:
	var spots := _corners(plan, r) + _corners(plan, r, 2) + _corners(plan, r, 4)
	for scene in ["fici_buyuk", "kasa", "fici_orta", "sandik", "varil", "fici_kucuk"]:
		_prop_any(plan, scene, spots)


## A ring of fires off the way through, bedrolls about them.
func _room_ates_cemberi(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	_prop_any(plan, "ates_buyuk", [m + Vector2i(-5, -3), m + Vector2i(-5, 3)])
	_prop_any(plan, "ates_buyuk", [m + Vector2i(5, 3), m + Vector2i(5, -3)])
	_prop_any(plan, "ates_cukuru", [m + Vector2i(-6, 4), m + Vector2i(6, -4), m + Vector2i(6, 4)])
	_scatter(plan, ["yatak", "yatak_2"], 2)


## The warlord's quarters: a table of plans, shelves, a bush grown in through the walls.
func _room_karargah(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	_prop_any(plan, "masa", [m + Vector2i(-5, -3), m + Vector2i(5, -3)])
	var corners := _corners(plan, r, 1)
	_prop_any(plan, "raf", corners)
	_prop_any(plan, "raf_ince", corners.slice(1) + corners)
	_prop_any(plan, "cali", _corners(plan, r, 3))


## Every fortress room: trodden earth, cobwebs in a corner, a candle.
func _extra_hideout(plan: Plan, r: Rect2i) -> void:
	var m := plan.mid
	var spots := [m + Vector2i(-8, -5), m + Vector2i(4, -5), m + Vector2i(-8, 2), m + Vector2i(5, 3)]
	_shuffle(spots)
	_moss(plan, spots[0])
	_moss(plan, spots[1])
	_prop_any(plan, "ag_kose", _corners(plan, r))
	_scatter(plan, ["mum", "cali_2"], 2)


# ---- The keep's great hall (hand laid, not a dungeon) --------------------------------------

## The hall as before in size and in where everyone stands (the masters round the fire, the
## door in the front wall; the code knows those spots), dressed anew in the Castle pack.
func _hall_keep(name: String, theme: Dictionary) -> void:
	var zone := "keep_hall"
	var old: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(MapExport.file_path(zone)))
	var w := 30
	var h := 22
	var plan := Plan.new()
	plan.theme = theme
	plan.tname = name
	rng.seed = 77
	for y in h:
		for x in w:
			var wall := y < 3 or x == 0 or x == w - 1 or (y == h - 1 and (x < 14 or x > 15))
			plan.tid[Vector2i(x, y)] = WALL if wall else COBBLE
			if not wall:
				plan.inside[Vector2i(x, y)] = true
	# The rugs: a great one under the masters' ring, a runner from the door to it.
	_nine(plan, Rect2i(9, 6, 12, 10), theme.decor.carpet)
	_nine(plan, Rect2i(14, 16, 2, 6), theme.decor.carpet)
	var put := func(scene: String, foot: Vector2) -> void:
		var spec: Dictionary = theme.props[scene]
		if spec.has("block"):
			var size: Vector2 = spec.block
			var box := Rect2(foot - Vector2(size.x / 2, size.y), size)
			for y in range(floori(box.position.y / 16), ceili(box.end.y / 16)):
				for x in range(floori(box.position.x / 16), ceili(box.end.x / 16)):
					plan.blocked[Vector2i(x, y)] = true
		plan.props.append([scene, foot, false])
	var at := func(tx: float, ty: int) -> Vector2:
		return Vector2(tx * 16, (ty + 1) * 16)
	# The fire the masters sit round.
	put.call("ocak_cukuru", Vector2(15 * 16, 12 * 16 + 2))
	# The flame stands just in front of the pit's ring (so it's drawn over it), its picture lifted into it.
	put.call("ocak_merkez", Vector2(15 * 16, 12 * 16 + 3))
	# The back wall: the throne behind the warrior master, lit fireplaces, cupboards, banners
	# and windows on the wall's face.
	put.call("taht", at.call(15, 3))
	for x in [9.0, 21.0]:
		put.call("somine", at.call(x, 3))
	for x in [3.0, 5.0, 25.0, 27.0]:
		put.call("dolap", at.call(x, 3))
	for x in [7.5, 12.5, 17.5, 22.5]:
		put.call("sancak", at.call(x, 2) + Vector2(0, -2))
	for x in [2.5, 27.5]:
		put.call("pencere", at.call(x, 1))
	# The left: two feasting tables with their chairs; the right: the war table.
	for ty in [8, 13]:
		put.call("uzun_masa", at.call(5, ty))
		put.call("sandalye", at.call(3, ty))
		put.call("sandalye", at.call(7, ty))
	put.call("buyuk_masa", at.call(25, 10))
	put.call("sandalye", at.call(23, 10))
	put.call("sandalye", at.call(27, 10))
	# Candles down the side walls, trees in pots by the door, busts flanking it, store by it.
	for ty in [6, 11, 16]:
		put.call("samdan", at.call(1.5, ty))
		put.call("samdan", at.call(28.5, ty))
	for x in [10.5, 19.5]:
		put.call("bust", at.call(x, 19))
	for x in [2.5, 27.5]:
		put.call("saksi_agac", at.call(x, 19))
	put.call("kasa", at.call(5, 19))
	put.call("varil", at.call(24, 19))
	put.call("varil", at.call(25.2, 19))
	# Everyone where they were.
	for id in old.get("npcs", {}):
		var p: Dictionary = old.npcs[id]
		plan.spots.append(["npc", id, Vector2(float(p.x), float(p.y))])
	for id in old.get("portals", {}):
		var p: Dictionary = old.portals[id]
		plan.spots.append(["portal", id, Vector2(float(p.x), float(p.y))])
	plan.spots.append(["spawn", "", Vector2(float(old.spawn.x), float(old.spawn.y))])
	plan.cfg = {}
	_make_scene(name, theme, zone, plan, w, h)


# ---- An open dungeon (no rooms, no corridors) ---------------------------------------------

## A snowy expanse the size of the other dungeons: rock round its edge and in ridges across it,
## frozen pools, pine woods; as many packs as a dungeon of rooms has, spread evenly over it,
## the bosses far apart and far from the way in (the last, the farthest, by the way out).
func _open(name: String, theme: Dictionary, zone: String) -> void:
	var cfg: Dictionary = BUILDS[zone]
	rng.seed = int(cfg.seed)
	mob_rng.seed = int(cfg.seed) * 7919
	var cols := COLS
	var rows := ceili(ROOMS / float(COLS))
	var w: int = MARGIN * 2 + cols * (ROOM.x + GAP)
	var h: int = MARGIN * 2 + rows * (ROOM.y + GAP)
	var plan := Plan.new()
	plan.theme = theme
	plan.tname = name
	plan.cfg = cfg

	# The ground: rock where the edge is near or a ridge rises, snow elsewhere.
	var ridge := FastNoiseLite.new()
	ridge.seed = int(cfg.seed)
	ridge.frequency = 0.045
	var wobble := FastNoiseLite.new()
	wobble.seed = int(cfg.seed) + 1
	wobble.frequency = 0.08
	var rock := {}
	for y in h:
		for x in w:
			var edge := mini(mini(x, y), mini(w - 1 - x, h - 1 - y))
			var r := edge < 3 + int(2.5 + wobble.get_noise_2d(x, y) * 3.0) or ridge.get_noise_2d(x, y) > 0.26
			if r:
				rock[Vector2i(x, y)] = true
	# Smooth the rock (no single stones, no slits), then keep only the snow one can reach.
	for i in 2:
		var next := {}
		for y in h:
			for x in w:
				var n := 0
				for dy in range(-1, 2):
					for dx in range(-1, 2):
						var o := Vector2i(x + dx, y + dy)
						if o.x < 0 or o.y < 0 or o.x >= w or o.y >= h or rock.has(o):
							n += 1
				if n >= 5:
					next[Vector2i(x, y)] = true
		rock = next
	var start := Vector2i(10, h - 10)
	while rock.has(start):
		start += Vector2i(1, -1)
	var open := {start: true}
	var queue: Array[Vector2i] = [start]
	var qi := 0
	while qi < queue.size():
		var c := queue[qi]
		qi += 1
		for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var o: Vector2i = c + d
			if o.x > 0 and o.y > 0 and o.x < w - 1 and o.y < h - 1 and not rock.has(o) and not open.has(o):
				open[o] = true
				queue.append(o)
	var ice := FastNoiseLite.new()
	ice.seed = int(cfg.seed) + 2
	ice.frequency = 0.07
	for y in h:
		for x in w:
			var c := Vector2i(x, y)
			if not open.has(c):
				plan.tid[c] = int(cfg.wall)
				continue
			var near_rock := false
			for d in [Vector2i(2, 0), Vector2i(-2, 0), Vector2i(0, 2), Vector2i(0, -2)]:
				if not open.has(c + d):
					near_rock = true
			plan.tid[c] = int(cfg.floor)
			plan.inside[c] = true

	# The way in, the bosses (farthest apart), then the packs (evenly, off them all).
	var spawn := start
	plan.spots.append(["spawn", "", _foot(spawn)])
	plan.spots.append(["portal", zone + "_exit", _foot(spawn + Vector2i(0, -3)) if open.has(spawn + Vector2i(0, -3)) else _foot(spawn + Vector2i(2, 0))])
	var cells := open.keys()
	cells.sort()
	var far_from := func(c: Vector2i, others: Array, d: float) -> bool:
		for o: Vector2i in others:
			if Vector2(c - o).length() < d:
				return false
		return true
	var roomy := func(c: Vector2i, r: int) -> bool:
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				if not open.has(c + Vector2i(dx, dy)):
					return false
		return true
	var bosses: Array = []
	for k in 4:
		var best := Vector2i(-1, -1)
		var best_d := -1.0
		for i in 400:
			var c: Vector2i = cells[rng.randi() % cells.size()]
			if not roomy.call(c, 3):
				continue
			var d := Vector2(c - spawn).length()
			for b: Vector2i in bosses:
				d = minf(d, Vector2(c - b).length())
			if d > best_d:
				best_d = d
				best = c
		bosses.append(best)
	bosses.sort_custom(func(a: Vector2i, b: Vector2i): return Vector2(a - spawn).length() < Vector2(b - spawn).length())
	for k in 4:
		var b: Vector2i = bosses[k]
		var entry: Array = cfg.bosses[k]
		plan.spots.append(["mob", entry[0], _foot(b)])
		var around := [Vector2i(-2, 0), Vector2i(2, 0), Vector2i(0, 2), Vector2i(-2, 2), Vector2i(2, 2), Vector2i(0, -2)]
		var n := 0
		for e in entry[1]:
			for j in int(e[1]):
				var c: Vector2i = b + around[n % around.size()]
				if open.has(c):
					plan.spots.append(["mob", e[0], _foot(c)])
				n += 1
		for dy in range(-2, 3):
			for dx in range(-2, 3):
				plan.blocked[b + Vector2i(dx, dy)] = false
	var last: Vector2i = bosses[3]
	for d in [Vector2i(0, -4), Vector2i(4, 0), Vector2i(-4, 0), Vector2i(0, 4)]:
		if roomy.call(last + d, 1):
			plan.spots.append(["portal", zone + "_final_exit", _foot(last + d)])
			break
	var centres: Array = []
	var want := (ROOMS - 5) * 2
	var tries := 0
	var spacing := 15.0
	while centres.size() < want and tries < 20000:
		tries += 1
		if tries % 4000 == 0:
			spacing -= 1.5
		var c: Vector2i = cells[rng.randi() % cells.size()]
		if not roomy.call(c, 2) or not far_from.call(c, [spawn], 16.0) or not far_from.call(c, bosses, 10.0) or not far_from.call(c, centres, spacing):
			continue
		centres.append(c)
	var p := 0
	for c: Vector2i in centres:
		_pack_mobs(plan, _scaled(cfg.packs[p % cfg.packs.size()]), c)
		p += 1
	print("  packs: %d (spacing %.1f), bosses at %s" % [centres.size(), spacing, bosses])

	# Frozen pools where the ice noise peaks, apart from each other, off the packs and bosses.
	var pools: Array = []
	var by_ice := cells.duplicate()
	by_ice.sort_custom(func(a: Vector2i, b: Vector2i): return ice.get_noise_2d(a.x, a.y) > ice.get_noise_2d(b.x, b.y))
	for c: Vector2i in by_ice:
		if pools.size() >= 14 or ice.get_noise_2d(c.x, c.y) < 0.35:
			break
		if roomy.call(c, 3) and far_from.call(c, pools, 12.0) and far_from.call(c, [spawn] + bosses + centres, 4.0):
			pools.append(c)
			plan.props.append(["buz_golu" if pools.size() % 2 == 0 else "buz_golu_2", _foot(c + Vector2i(0, 2)), rng.randf() < 0.5])
	# The woods and stones: pines along the rock's foot and in clumps, a few dead trees, frozen
	# pools ringed with crystals, stones, twigs and leaves; never on a pack, a boss or the way in.
	var keep_clear := [spawn] + bosses + centres + pools
	var free := func(c: Vector2i, r: float) -> bool:
		return open.has(c) and plan.tid[c] != ICE and not plan.blocked.get(c, false) and far_from.call(c, keep_clear, r)
	var wood := FastNoiseLite.new()
	wood.seed = int(cfg.seed) + 3
	wood.frequency = 0.06
	var pines := ["cam", "cam_2", "cam_3", "cam_4", "cam_kucuk", "cam_kucuk_2"]
	var placed: Array[Vector2i] = []
	var put := func(scene: String, c: Vector2i) -> void:
		var spec: Dictionary = theme.props[scene]
		if spec.has("block"):
			plan.blocked[c] = true
		plan.props.append([scene, _foot(c) + Vector2(rng.randf_range(-4, 4), 0), rng.randf() < 0.5])
		placed.append(c)
	var shuffled := cells.duplicate()
	_shuffle(shuffled)
	for c: Vector2i in shuffled:
		if not free.call(c, 5.0):
			continue
		var by_rock: bool = not open.has(c + Vector2i(0, -1)) or not open.has(c + Vector2i(0, -2)) or not open.has(c + Vector2i(-1, 0)) or not open.has(c + Vector2i(1, 0))
		var woods := wood.get_noise_2d(c.x, c.y) > 0.42
		if not ((by_rock and rng.randf() < 0.6) or woods):
			continue
		if not far_from.call(c, placed, 2.6):
			continue
		var roll := rng.randf()
		if roll < 0.82:
			put.call(pines[rng.randi() % pines.size()], c)
		elif roll < 0.9:
			put.call("cam_kuru", c)
		elif roll < 0.95:
			put.call("mese_buz", c)
		else:
			put.call(["kaya_buyuk", "kaya"][rng.randi() % 2], c)
	# Crystals at the frozen pools' edges.
	for pc: Vector2i in pools:
		for d in [Vector2i(-3, 1), Vector2i(3, 0), Vector2i(-2, -2), Vector2i(2, 3)]:
			var o: Vector2i = pc + d
			if open.has(o) and not plan.blocked.get(o, false) and rng.randf() < 0.6:
				put.call(["kristal", "kristal_2", "kristal_3"][rng.randi() % 3], o)
	# Stones, stumps, twigs and leaves strewn about.
	var bits := ["tas", "tas_2", "tas_3", "dal", "dal_2", "dal_3", "yaprak", "yaprak_2", "kutuk_kar"]
	for c: Vector2i in shuffled:
		if free.call(c, 2.0) and rng.randf() < 0.035 and far_from.call(c, placed, 2.0):
			put.call(bits[rng.randi() % bits.size()], c)
	for c in plan.blocked.keys():
		if not plan.blocked[c]:
			plan.blocked.erase(c)

	_check_paths(plan)
	_make_scene(name, theme, zone, plan, w, h)



# ---- An open-world field made anew ---------------------------------------------------------

## The open zones' own settings: the seed, the tile ids, cells to keep open the code knows of.
const FIELDS := {
	"forest": {"seed": 4242, "wall": CAVE_WALL, "floor": GRASS, "keep": [Vector2i(65, 85)], "camp": Vector2i(65, 77), "ridge": 0.035},
	"world": {"seed": 1101, "wall": CAVE_WALL, "floor": GRASS, "ridge": 0.035, "wood": 0.3},
	"frost": {"seed": 1505, "wall": CAVE_WALL, "floor": SNOW, "ridge": 0.035, "camp": Vector2i(17, 47)},
	"canyon": {"seed": 1303, "wall": CAVE_WALL, "floor": SAND, "ridge": 0.04, "camp": Vector2i(107, 47)},
	"volcano": {"seed": 1404, "wall": CAVE_WALL, "floor": CAVE_FLOOR, "ridge": 0.035, "lava": 0.3, "tint": Color(0.72, 0.62, 0.6)},
	"kurgan": {"seed": 1202, "wall": CAVE_WALL, "floor": GRASS, "ridge": 0.035, "camp": Vector2i(27, 23)},
}


## An open zone (same size, same spots) laid out anew: plateaus round its edge and across it,
## a clearing round everything that has to be somewhere (the spawn, NPCs, portals, mob areas,
## gathering areas), winding ways between them, woods everywhere else.
func _field(name: String, theme: Dictionary, zone: String) -> void:
	var cfg: Dictionary = FIELDS[zone]
	rng.seed = int(cfg.seed)
	mob_rng.seed = int(cfg.seed) * 7919
	# The zone's plan (size, spots, mob and gathering areas) when it has one, else its map as it is.
	var plan_path := "res://tools/field_%s.json" % zone
	var from_plan := FileAccess.file_exists(plan_path)
	var old: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(plan_path if from_plan else MapExport.file_path(zone)))
	var nodes_all: Dictionary = {zone: old.nodes} if from_plan else JSON.parse_string(FileAccess.get_file_as_string("res://tools/open_world_nodes.json"))
	var w: int = old.width
	var h: int = old.height
	var plan := Plan.new()
	plan.theme = theme
	plan.tname = name
	plan.cfg = cfg
	var cell_of := func(p: Dictionary) -> Vector2i:
		return Vector2i(floori(float(p.x) / 16), floori((float(p.y) - 1) / 16))

	# Everything that has to stay where it is, and how much room it needs round it.
	var keep: Array = []  # [cell, radius]
	var spawn: Vector2i = cell_of.call(old.spawn)
	keep.append([spawn, 4.0])
	plan.spots.append(["spawn", "", Vector2(float(old.spawn.x), float(old.spawn.y))])
	for id in old.get("npcs", {}):
		keep.append([cell_of.call(old.npcs[id]), 2.5])
		plan.spots.append(["npc", id, Vector2(float(old.npcs[id].x), float(old.npcs[id].y))])
	for id in old.get("portals", {}):
		keep.append([cell_of.call(old.portals[id]), 2.5])
		plan.spots.append(["portal", id, Vector2(float(old.portals[id].x), float(old.portals[id].y))])
	for id in old.get("arrivals", {}):
		keep.append([cell_of.call(old.arrivals[id]), 2.0])
		plan.spots.append(["arrival", id, Vector2(float(old.arrivals[id].x), float(old.arrivals[id].y))])
	for c: Vector2i in cfg.get("keep", []):
		keep.append([c, 2.0])
	for z in old.get("spawnZones", []):
		var c := Vector2i(int(z.tx), int(z.ty))
		keep.append([c, maxf(2.0, float(z.radius) * 0.85)])
		plan.spots.append(["spawn_zone", z.mob, Vector2(c) * 16 + Vector2(8, 8), float(z.radius), int(z.count)])
	for n in nodes_all.get(zone, []):
		keep.append([Vector2i(int(n.tx), int(n.ty)), maxf(2.0, float(n.radius) * 0.7)])
	if cfg.has("camp"):
		keep.append([cfg.camp, 3.0])

	# The ground that must stay open: a ragged clearing round each of them, and winding ways
	# between them (a tree joining them all, and a few more for loops).
	var must := {}
	var edge_noise := FastNoiseLite.new()
	edge_noise.seed = int(cfg.seed) + 5
	edge_noise.frequency = 0.15
	var carve := func(c: Vector2i, r: float) -> void:
		var ri := ceili(r) + 1
		for dy in range(-ri, ri + 1):
			for dx in range(-ri, ri + 1):
				var o := c + Vector2i(dx, dy)
				if o.x < 1 or o.y < 1 or o.x >= w - 1 or o.y >= h - 1:
					continue
				if Vector2(dx, dy).length() <= r + edge_noise.get_noise_2d(o.x, o.y) * 1.2:
					must[o] = true
	for k in keep:
		carve.call(k[0], float(k[1]) + 1.0)
	var points: Array = []
	for k in keep:
		points.append(k[0])
	var edges: Array = []
	var joined := [0]
	while joined.size() < points.size():
		var best := [-1, -1, INF]
		for i: int in joined:
			for j in points.size():
				if joined.has(j):
					continue
				var d := Vector2(points[i] - points[j]).length()
				if d < best[2]:
					best = [i, j, d]
		edges.append([best[0], best[1]])
		joined.append(best[1])
	for i in points.size():
		var near := -1
		var near_d := INF
		for j in points.size():
			var d := Vector2(points[i] - points[j]).length()
			if i != j and d > 8.0 and d < near_d and not edges.has([i, j]) and not edges.has([j, i]):
				near_d = d
				near = j
		if near >= 0 and near_d < 20.0 and rng.randf() < 0.3:
			edges.append([i, near])
	for e in edges:
		var a: Vector2i = points[e[0]]
		var b: Vector2i = points[e[1]]
		var p := Vector2(a)
		var guard := 0
		while p.distance_to(Vector2(b)) > 1.0 and guard < 400:
			guard += 1
			var dir := (Vector2(b) - p).normalized().rotated(rng.randf_range(-0.7, 0.7))
			p += dir
			carve.call(Vector2i(roundi(p.x), roundi(p.y)), 1.6)

	# Plateaus: round the edge and where a ridge rises, never on what must stay open.
	var ridge := FastNoiseLite.new()
	ridge.seed = int(cfg.seed)
	ridge.frequency = float(cfg.get("ridge", 0.05))
	var wobble := FastNoiseLite.new()
	wobble.seed = int(cfg.seed) + 1
	wobble.frequency = 0.08
	var rock := {}
	for y in h:
		for x in w:
			var c := Vector2i(x, y)
			var edge := mini(mini(x, y), mini(w - 1 - x, h - 1 - y))
			if (edge < 3 + int(2.0 + wobble.get_noise_2d(x, y) * 3.0) or ridge.get_noise_2d(x, y) > 0.2) and not must.has(c):
				rock[c] = true
	for i in 3:
		var next := {}
		for y in h:
			for x in w:
				var c := Vector2i(x, y)
				if must.has(c):
					continue
				var n := 0
				for dy in range(-1, 2):
					for dx in range(-1, 2):
						var o := Vector2i(x + dx, y + dy)
						if o.x < 0 or o.y < 0 or o.x >= w or o.y >= h or rock.has(o):
							n += 1
				if n >= 5 or x == 0 or y == 0 or x == w - 1 or y == h - 1:
					next[c] = true
		rock = next
	# A plateau's front is at least two cells high (one is only a stone rim, no front).
	for y in range(h - 1, 0, -1):
		for x in w:
			var c := Vector2i(x, y)
			if rock.has(c) and not rock.has(c + Vector2i(0, -1)) and not rock.has(c + Vector2i(0, 1)) and y < h - 1:
				rock.erase(c)
	# Lava pools (where the zone has them): out in the open, never on what must stay open.
	var lava := {}
	if cfg.has("lava"):
		var pool := FastNoiseLite.new()
		pool.seed = int(cfg.seed) + 7
		pool.frequency = 0.06
		for y in h:
			for x in w:
				var c := Vector2i(x, y)
				if pool.get_noise_2d(x, y) > float(cfg.lava):
					lava[c] = true
		# Whole pools: no lone cells, two cells off the rock and off what must stay open.
		for i in 2:
			var next := {}
			for c: Vector2i in lava:
				var n := 0
				for dy in range(-1, 2):
					for dx in range(-1, 2):
						if lava.has(c + Vector2i(dx, dy)):
							n += 1
				if n >= 5:
					next[c] = true
			lava = next
		for c: Vector2i in lava.keys():
			for dy in range(-2, 3):
				for dx in range(-2, 3):
					if rock.has(c + Vector2i(dx, dy)) or must.has(c + Vector2i(dx, dy)):
						lava.erase(c)
	var open := {spawn: true}
	var queue: Array[Vector2i] = [spawn]
	var qi := 0
	while qi < queue.size():
		var c := queue[qi]
		qi += 1
		for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var o: Vector2i = c + d
			if o.x >= 0 and o.y >= 0 and o.x < w and o.y < h and not rock.has(o) and not lava.has(o) and not open.has(o):
				open[o] = true
				queue.append(o)
	for y in h:
		for x in w:
			var c := Vector2i(x, y)
			if open.has(c):
				plan.tid[c] = int(cfg.floor)
				plan.inside[c] = true
			elif lava.has(c):
				plan.tid[c] = LAVA
			else:
				plan.tid[c] = int(cfg.wall)

	var far_from_early := func(c: Vector2i, others: Array, d: float) -> bool:
		for o: Vector2i in others:
			if Vector2(c - o).length() < d:
				return false
		return true
	var cells := open.keys()
	cells.sort()
	var shuffled := cells.duplicate()
	_shuffle(shuffled)

	# Patches of bare earth and darker grass where the patch noise is strong, apart.
	var patch := FastNoiseLite.new()
	patch.seed = int(cfg.seed) + 6
	patch.frequency = 0.1
	var patches: Array = []
	var kinds: Array = theme.field.get("patches", ["toprak_yama", "koyu_cim_yama"])
	var pr := int(theme.props[kinds[0]].rect.size.x / 32)
	for c: Vector2i in shuffled:
		var v := patch.get_noise_2d(c.x, c.y)
		if absf(v) < (0.2 if pr <= 1 else 0.42) or not far_from_early.call(c, patches, 4.5 if pr <= 1 else pr * 2.0 + 9.0):
			continue
		var fits := true
		for dy in range(-pr, pr + 1):
			for dx in range(-pr, pr + 1):
				if not open.has(c + Vector2i(dx, dy)):
					fits = false
		if fits:
			patches.append(c)
			plan.props.append([kinds[0] if v > 0.35 else kinds[1], _foot(c + Vector2i(0, pr)), rng.randf() < 0.5])

	# The camp by the way in: a fire, two stumps to sit on.
	var placed: Array[Vector2i] = []
	var put := func(scene: String, c: Vector2i, jitter: bool) -> void:
		var spec: Dictionary = theme.props[scene]
		if spec.has("block"):
			plan.blocked[c] = true
		var at := _foot(c) + (Vector2(rng.randf_range(-4, 4), 0) if jitter else Vector2.ZERO)
		plan.props.append([scene, at, rng.randf() < 0.5])
		placed.append(c)
	if cfg.has("camp"):
		var camp: Vector2i = cfg.camp
		var parts: Array = theme.field.get("camp", ["ates", "kutuk"])
		put.call(parts[0], camp, false)
		if parts.size() > 1:
			put.call(parts[1], camp + Vector2i(-3, 0), false)
			put.call(parts[1], camp + Vector2i(3, 0), false)

	# Woods: trees where the wood noise rises and along the plateaus' feet, purple and teal
	# groves where the colour noise says so; on the plateaus' tops too (they're forest as well).
	var far_from := func(c: Vector2i, others: Array, d: float) -> bool:
		for o: Vector2i in others:
			if Vector2(c - o).length() < d:
				return false
		return true
	var clear_of_keep := func(c: Vector2i, extra: float) -> bool:
		for k in keep:
			if Vector2(c - k[0]).length() < float(k[1]) + extra:
				return false
		return true
	var wood := FastNoiseLite.new()
	wood.seed = int(cfg.seed) + 3
	wood.frequency = 0.07
	var hue := FastNoiseLite.new()
	hue.seed = int(cfg.seed) + 4
	hue.frequency = 0.04
	var field: Dictionary = theme.field
	# A tree's crown (half its width, its height, in cells) mustn't hide anything that has to be
	# seen: a big one only stands where nothing is above it for a dozen cells.
	var crown := func(scene: String) -> Vector2:
		if field.get("auto_crown", false):
			var r: Rect2i = theme.props[scene].rect
			return Vector2(r.size.x / 32.0 * 0.9, r.size.y / 16.0 * 0.85)
		if scene.begins_with("agac_orta"):
			return Vector2(4.0, 11.0)
		if scene.begins_with("agac_kucuk"):
			return Vector2(3.2, 8.5)
		if scene.begins_with("fidan"):
			return Vector2(1.5, 5.0)
		if scene.begins_with("cali"):
			return Vector2(2.2, 4.0)
		return Vector2(5.5, 13.0)
	var hides := func(foot: Vector2i, size: Vector2) -> bool:
		for k in keep:
			var r: float = float(k[1]) * 0.6
			var dx := absf(float(k[0].x - foot.x))
			var dy := float(foot.y - k[0].y)
			if dx < size.x + r and dy > -r - 1.0 and dy < size.y + r:
				return true
		return false
	var tree_for := func(c: Vector2i) -> String:
		var v := hue.get_noise_2d(c.x, c.y)
		var list: Array = field.green
		if v > 0.28:
			list = field.get("purple", field.green)
		elif v < -0.3:
			list = field.get("teal", field.green)
		var fits: Array = []
		for t: String in list:
			var size: Vector2 = crown.call(t)
			if not hides.call(c, size) and far_from.call(c, placed, size.x * 0.8):
				fits.append(t)
		if fits.is_empty():
			return ""
		return fits[rng.randi() % fits.size()]
	# The plateaus' fronts (roots) stay in sight: no tree right before one.
	var fronts := {}
	for c: Vector2i in plan.tid:
		if not open.has(c) and open.has(c + Vector2i(0, 1)):
			fronts[c] = true
	var before_front := func(c: Vector2i) -> bool:
		for dy in range(0, 6):
			for dx in range(-3, 4):
				if fronts.has(c + Vector2i(dx, -dy)):
					return true
		return false
	var trees := 0
	for c: Vector2i in shuffled:
		if plan.blocked.has(c) or not clear_of_keep.call(c, 1.0) or before_front.call(c):
			continue
		var by_side: bool = not open.has(c + Vector2i(-1, 0)) or not open.has(c + Vector2i(1, 0))
		var woods := wood.get_noise_2d(c.x, c.y) > float(cfg.get("wood", 0.15))
		if not ((by_side and rng.randf() < 0.5) or woods) or not far_from.call(c, placed, 2.0):
			continue
		var t: String = tree_for.call(c)
		if not t.is_empty():
			put.call(t, c, true)
			trees += 1
	# The plateaus' tops, well in from their edges (their stone rims and fronts stay seen).
	var tops: Array = []
	for y in range(1, h):
		for x in w:
			var c := Vector2i(x, y)
			if open.has(c):
				continue
			var inner := true
			for dy in range(-2, 5):
				for dx in range(-2, 3):
					if open.has(c + Vector2i(dx, dy)):
						inner = false
			if inner:
				tops.append(c)
	_shuffle(tops)
	for c: Vector2i in tops:
		if rng.randf() < 0.7 and far_from.call(c, placed, 2.5):
			var t: String = tree_for.call(c)
			if not t.is_empty():
				plan.props.append([t, _foot(c) + Vector2(rng.randf_range(-4, 4), 0), rng.randf() < 0.5])
				placed.append(c)
				trees += 1

	# Rune stones glowing in the clearings' edges, bell flowers and mushrooms round them.
	var stones: Array = []
	for c: Vector2i in shuffled:
		if not field.has("glow") or stones.size() >= w * h / 340:
			break
		if plan.blocked.has(c) or not clear_of_keep.call(c, 0.5) or not far_from.call(c, stones, 13.0) or not far_from.call(c, placed, 2.0):
			continue
		stones.append(c)
		put.call(field.glow[rng.randi() % field.glow.size()], c, true)
		for d in [Vector2i(-2, 1), Vector2i(2, 0), Vector2i(-1, -2), Vector2i(1, 2), Vector2i(3, -1)]:
			var o: Vector2i = c + d
			if field.has("glow_near") and open.has(o) and not plan.blocked.has(o) and clear_of_keep.call(o, 0.0) and rng.randf() < 0.55:
				put.call(field.glow_near[rng.randi() % field.glow_near.size()], o, true)
	# Stumps and boulders here and there; bushes, plants, flowers, pebbles strewn about.
	for c: Vector2i in shuffled:
		if not plan.blocked.has(c) and clear_of_keep.call(c, 1.0) and rng.randf() < 0.012 and far_from.call(c, placed, 3.0):
			put.call(field.rare[rng.randi() % field.rare.size()], c, true)
	for c: Vector2i in shuffled:
		if not plan.blocked.has(c) and clear_of_keep.call(c, -1.0) and rng.randf() < 0.1 and far_from.call(c, placed, 1.5):
			put.call(field.bits[rng.randi() % field.bits.size()], c, true)
	print("  %s: %d trees, %d rune stones, %d props" % [zone, trees, stones.size(), plan.props.size()])

	_check_paths(plan)
	_make_scene(name, theme, zone, plan, w, h)
