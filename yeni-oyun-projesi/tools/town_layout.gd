extends SceneTree

## Lays Ana Merkez (maps/town.tscn) out in order, from the Pixel Crawler packs:
##   -- path        the garden path sheet (assets/kasaba/bahce_yol.png): every shape a path cell can
##                  have, from quarters of the Garden pack's path pieces (run --import after it)
##   -- tileset     TileSet sources 13 (Garden: flower beds, pools) and 14 (garden paths)
##   -- scenes      props/kasaba (trades' things) and props/garden (garden things)
##   -- organic     the town as a village grown by itself: winding roads from the garden, each
##                  house by its road near its NPC's quarter, trees in clumps, the farm south
##   -- layout      the town (the earlier, ordered plan): two avenues crossing at the fountain, a garden round it, two streets
##                  of six houses each (one per townsfolk NPC, who stands at the door with the
##                  things of the trade), the stable master's house and paddock in the south, a
##                  lantern right of every house and at both ends of every road
## Then: terrain_floors.gd -- map town (grass edges along the new roads).

const TILESET := "res://tilesets/zemin.tres"
const PACK := "res://assetpack/ANOKOLISA/"
const GARDEN := "Pixel Crawler - Garden Environment/Assets/Tiles.png"
const STATIONS := "Pixel Crawler - Town/Environment/Structures/Stations/"
const STATIC := "Pixel Crawler - Town/Environment/Props/Static/"
const PATH_PNG := "res://assets/kasaba/bahce_yol.png"
const GARDEN_SOURCE := 13
## The sea round the island: the Water tiles' open water, animated (4 frames, 6 tiles apart).
const WATER_SOURCE := 8
const SEA := [Vector2i(0, 0), Vector2i(4, 0), Vector2i(5, 0), Vector2i(5, 1), Vector2i(5, 2), Vector2i(5, 3), Vector2i(0, 4), Vector2i(4, 4), Vector2i(5, 4)]
const SEA_COLOUR := Color8(62, 145, 208)
## The shore (grass, a rim of earth, foam): the Water tiles' islet, put together from quarters for
## every shape a coast cell can have (assets/kasaba/kiyi.png, 47 shapes x 4 frames). 9-slice
## [tl, t, tr, l, c, r, bl, b, br] and inner corners [br, bl, tr, tl] of the islet's first frame.
const SHORE_SLICE := [Vector2i(0, 1), Vector2i(2, 0), Vector2i(4, 1), Vector2i(0, 2), Vector2i(2, 2), Vector2i(4, 2), Vector2i(0, 3), Vector2i(2, 4), Vector2i(4, 3)]
const SHORE_INNER := [Vector2i(3, 3), Vector2i(1, 3), Vector2i(3, 1), Vector2i(1, 1)]
const SHORE_PNG := "res://assets/kasaba/kiyi.png"
const SHORE_SOURCE := 15
const WATER_SHEET := "Pixel Crawler - Town/Environment/Tilesets/Water_tiles.png"
## How many rows of cliff stay below the land in the south (the rest of the old floating
## island's underside becomes sea).
const CLIFF_ROWS := 3
const PATH_SOURCE := 14
## The Garden pack's framed pool sits half a tile off its grid: re-cut, aligned, as a 3x3 sheet.
const POOL_PNG := "res://assets/kasaba/havuz.png"
const POOL_SOURCE := 16
const POOL_FRAME := Rect2i(331, 160, 58, 39)
const FLOORS := 3
const WALK := 1
const BOTH := 3
enum { GRASS = 0, WATER_T = 3, FLOWER = 5, PLAZA = 9 }
const DT := preload("res://tools/dungeon_theme.gd")

## The Garden pack's path: 9-slice and its inner corners [br, bl, tr, tl].
const PATH_SLICE := [Vector2i(8, 0), Vector2i(9, 0), Vector2i(10, 0), Vector2i(8, 1), Vector2i(9, 1), Vector2i(10, 1), Vector2i(8, 2), Vector2i(9, 2), Vector2i(10, 2)]
const PATH_INNER := [Vector2i(8, 3), Vector2i(10, 3), Vector2i(8, 5), Vector2i(10, 5)]
## Flower beds (9-slices) and the stone-rimmed pool.
const BEDS := {
	"pembe": [Vector2i(0, 25), Vector2i(1, 25), Vector2i(2, 25), Vector2i(0, 26), Vector2i(1, 26), Vector2i(2, 26), Vector2i(0, 27), Vector2i(1, 27), Vector2i(2, 27)],
	"kirmizi": [Vector2i(3, 25), Vector2i(4, 25), Vector2i(5, 25), Vector2i(3, 26), Vector2i(4, 26), Vector2i(5, 26), Vector2i(3, 27), Vector2i(4, 27), Vector2i(5, 27)],
	"mor": [Vector2i(6, 25), Vector2i(7, 25), Vector2i(8, 25), Vector2i(6, 26), Vector2i(7, 26), Vector2i(8, 26), Vector2i(6, 27), Vector2i(7, 27), Vector2i(8, 27)],
}
## The Garden pack's hedge ring (its cells that are grass inside or outside it are left out), and the
## pool's low crenellated wall (posts on top, wall below; left, middle, right).
const HEDGE_GRASS := [Vector2i(0, 15), Vector2i(5, 15), Vector2i(2, 17), Vector2i(3, 17), Vector2i(1, 18), Vector2i(2, 18), Vector2i(3, 18), Vector2i(4, 18), Vector2i(2, 19), Vector2i(3, 19), Vector2i(0, 21), Vector2i(5, 21)]
const WALL_TOP := [Vector2i(22, 13), Vector2i(23, 13), Vector2i(24, 13)]
const WALL_FACE := [Vector2i(22, 14), Vector2i(23, 14), Vector2i(24, 14)]
const POOL := [Vector2i(21, 10), Vector2i(22, 10), Vector2i(24, 10), Vector2i(21, 11), Vector2i(22, 11), Vector2i(24, 11), Vector2i(21, 12), Vector2i(22, 12), Vector2i(24, 12)]

## Props: name -> {sheet, rect | frames {sheet, size, count, cols, fps, bottom}, block, layers, shadow}.
const PROPS := {
	# The trades.
	"simya_masasi": {"frames": {"sheet": STATIONS + "Alchemy/Alchemy_Table_01-Sheet.png", "size": Vector2i(32, 64), "count": 6, "cols": 6, "fps": 6.0}, "block": Vector2(28, 10), "layers": WALK},
	"iksir_sandigi": {"sheet": STATIC + "Esoteric.png", "rect": Rect2i(88, 19, 17, 13), "block": Vector2(14, 6), "layers": WALK},
	"kavanoz": {"sheet": STATIC + "Esoteric.png", "rect": Rect2i(2, 91, 11, 21)},
	"kavanoz_2": {"sheet": STATIC + "Esoteric.png", "rect": Rect2i(35, 91, 11, 21)},
	"kitap": {"sheet": STATIC + "Esoteric.png", "rect": Rect2i(0, 162, 15, 12)},
	"kalem": {"sheet": STATIC + "Esoteric.png", "rect": Rect2i(21, 145, 9, 14)},
	"iksir": {"sheet": STATIC + "Esoteric.png", "rect": Rect2i(3, 17, 11, 15)},
	"tezgah": {"sheet": STATIC + "Furniture.png", "rect": Rect2i(44, 20, 36, 28), "block": Vector2(34, 10), "layers": WALK},
	"vitrin": {"sheet": STATIC + "Furniture.png", "rect": Rect2i(28, 86, 68, 28), "block": Vector2(64, 10), "layers": WALK},
	"masa": {"sheet": STATIC + "Furniture.png", "rect": Rect2i(0, 18, 50, 32), "block": Vector2(46, 10), "layers": WALK},
	"sandalye": {"sheet": STATIC + "Furniture.png", "rect": Rect2i(114, 489, 12, 16)},
	"yem_cuvali": {"sheet": STATIC + "Farm.png", "rect": Rect2i(0, 16, 15, 16)},
	"sebze_sandigi": {"sheet": STATIC + "Farm.png", "rect": Rect2i(158, 0, 18, 34), "block": Vector2(16, 8), "layers": WALK},
	"tarla_korkulugu": {"sheet": STATIC + "Farm.png", "rect": Rect2i(244, 33, 24, 47)},
	"un_cuvali": {"sheet": STATIC + "Farm.png", "rect": Rect2i(273, 14, 17, 20)},
	"tezgah_ahsap": {"sheet": STATIONS + "Workbench/Workbench.png", "rect": Rect2i(48, 72, 48, 40), "block": Vector2(44, 10), "layers": WALK},
	"tezgah_buyuk": {"sheet": STATIONS + "Workbench/Workbench.png", "rect": Rect2i(103, 64, 73, 48), "block": Vector2(68, 10), "layers": WALK},
	"tezgah_demir": {"sheet": STATIONS + "Workbench/Workbench.png", "rect": Rect2i(48, 115, 48, 45), "block": Vector2(44, 10), "layers": WALK},
	"kazan": {"sheet": STATIONS + "Cooking Station/Cooking Station.png", "rect": Rect2i(78, 82, 36, 40), "block": Vector2(28, 10), "layers": WALK, "light": {"at": Vector2(0, -8), "radius": 44.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.2}},
	"et_tezgahi": {"sheet": STATIONS + "Cooking Station/Cooking Station.png", "rect": Rect2i(144, 20, 56, 40), "block": Vector2(52, 10), "layers": WALK},
	"ors_tezgah": {"sheet": STATIONS + "Anvil/Anvil.png", "rect": Rect2i(6, 37, 53, 34), "block": Vector2(48, 10), "layers": WALK},
	"testere": {"sheet": STATIONS + "Sawmill/Base.png", "rect": Rect2i(48, 3, 52, 54), "block": Vector2(48, 12), "layers": WALK},
	# Crops (grown), a row of each in the fields.
	"ekin_havuc": {"sheet": STATIC + "Farm.png", "rect": Rect2i(82, 16, 10, 16)},
	"ekin_pancar": {"sheet": STATIC + "Farm.png", "rect": Rect2i(80, 48, 16, 16)},
	"ekin_lahana": {"sheet": STATIC + "Farm.png", "rect": Rect2i(80, 83, 16, 13)},
	"ekin_marul": {"sheet": STATIC + "Farm.png", "rect": Rect2i(80, 112, 16, 16)},
	"ekin_karnabahar": {"sheet": STATIC + "Farm.png", "rect": Rect2i(80, 145, 16, 15)},
	"ekin_brokoli": {"sheet": STATIC + "Farm.png", "rect": Rect2i(80, 178, 16, 14)},
	# The riding horse at rest (assetpack/HORSE).
	"at": {"frames": {"sheet": "../HORSE/Horse I/Horse Black/64x64_Atlas_Horse_Idle.png", "size": Vector2i(64, 64), "count": 5, "cols": 3, "fps": 6.0, "bottom": 63}, "block": Vector2(36, 8), "layers": WALK},
	# The trades' working stations (Town pack, animated).
	"ors_buyuk": {"frames": {"sheet": STATIONS + "Anvil/Anvil_02-Sheet.png", "size": Vector2i(80, 80), "count": 35, "cols": 6, "fps": 10.0, "bottom": 76}, "block": Vector2(60, 12), "layers": WALK},
	"bicki": {"frames": {"sheet": STATIONS + "Sawmill/Level_2-Sheet.png", "size": Vector2i(80, 64), "count": 60, "cols": 8, "fps": 10.0, "bottom": 63}, "block": Vector2(60, 12), "layers": WALK},
	"kutuk_balta": {"sheet": STATIONS + "Sawmill/Level_1.png", "rect": Rect2i(0, 6, 31, 26), "block": Vector2(20, 8), "layers": WALK},
	"simya_buyuk": {"frames": {"sheet": STATIONS + "Alchemy/Alchemy_Table_03-Sheet.png", "size": Vector2i(80, 80), "count": 22, "cols": 5, "fps": 8.0}, "block": Vector2(64, 12), "layers": WALK},
	"simya_orta": {"frames": {"sheet": STATIONS + "Alchemy/Alchemy_Table_02-Sheet.png", "size": Vector2i(48, 64), "count": 51, "cols": 11, "fps": 8.0}, "block": Vector2(40, 10), "layers": WALK},
	"mutfak": {"frames": {"sheet": STATIONS + "Cooking Station/Cooker/Cooker_04-Sheet.png", "size": Vector2i(80, 80), "count": 4, "cols": 4, "fps": 6.0}, "block": Vector2(64, 14), "layers": WALK, "light": {"at": Vector2(-14, -10), "radius": 40.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.2}},
	"kazan_atesi": {"frames": {"sheet": STATIONS + "Cooking Station/Cooker/Cooker_03-Sheet.png", "size": Vector2i(32, 32), "count": 6, "cols": 6, "fps": 8.0}, "block": Vector2(20, 8), "layers": WALK, "light": {"at": Vector2(0, -6), "radius": 36.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.25}},
	"sis_mangal": {"frames": {"sheet": STATIONS + "Cooking Station/Grill/Grill_01-Sheet.png", "size": Vector2i(64, 64), "count": 4, "cols": 4, "fps": 6.0, "bottom": 61}, "block": Vector2(48, 10), "layers": WALK, "light": {"at": Vector2(0, -10), "radius": 40.0, "color": Color8(0xff, 0x90, 0x40), "flicker": 0.25}},
	# The garden.
	"servi_kucuk": {"sheet": GARDEN, "rect": Rect2i(128, 320, 16, 30), "block": Vector2(8, 6), "layers": WALK},
	"kaide": {"sheet": GARDEN, "rect": Rect2i(384, 448, 32, 24), "block": Vector2(28, 8), "layers": WALK},
	"kaide_saksi": {"parts": [[GARDEN, Rect2i(368, 420, 16, 28), Vector2(-8, -28)], [GARDEN, Rect2i(400, 403, 16, 13), Vector2(-8, -38)]], "block": Vector2(12, 8), "layers": WALK},
	"servi": {"sheet": GARDEN, "rect": Rect2i(160, 272, 23, 95), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_kucuk"},
	"servi_2": {"sheet": GARDEN, "rect": Rect2i(194, 272, 28, 95), "block": Vector2(10, 6), "layers": WALK, "shadow": "golge_kucuk"},
	"bank_ahsap": {"sheet": GARDEN, "rect": Rect2i(67, 368, 74, 32), "block": Vector2(70, 8), "layers": WALK},
	"bank_tas": {"sheet": GARDEN, "rect": Rect2i(338, 448, 44, 32), "block": Vector2(40, 8), "layers": WALK},
	"heykel_cesme": {"sheet": GARDEN, "rect": Rect2i(432, 352, 48, 48)},
	"heykel": {"sheet": GARDEN, "rect": Rect2i(418, 420, 28, 54), "block": Vector2(20, 8), "layers": WALK, "shadow": "golge_kucuk"},
	"heykel_2": {"sheet": GARDEN, "rect": Rect2i(453, 432, 25, 42), "block": Vector2(20, 8), "layers": WALK, "shadow": "golge_kucuk"},
	"cicek_mavi": {"sheet": GARDEN, "rect": Rect2i(144, 384, 16, 16)},
	"cicek_pembe": {"sheet": GARDEN, "rect": Rect2i(176, 384, 16, 16)},
	"cicek_kirmizi": {"sheet": GARDEN, "rect": Rect2i(144, 432, 16, 16)},
	"cicek_beyaz": {"sheet": GARDEN, "rect": Rect2i(176, 432, 16, 16)},
	"nilufer": {"sheet": GARDEN, "rect": Rect2i(304, 244, 31, 23)},
	"nilufer_2": {"sheet": GARDEN, "rect": Rect2i(336, 240, 16, 16)},
	"nilufer_3": {"sheet": GARDEN, "rect": Rect2i(320, 274, 32, 26)},
	"kaya": {"sheet": GARDEN, "rect": Rect2i(354, 355, 12, 12)},
	"saksi": {"sheet": GARDEN, "rect": Rect2i(400, 368, 16, 16), "block": Vector2(12, 6), "layers": WALK},
}
## Where each scene lives: props/kasaba unless it's a garden thing.
const GARDEN_PROPS := ["servi_kucuk", "kaide", "kaide_saksi", "servi", "servi_2", "bank_ahsap", "bank_tas", "heykel_cesme", "heykel", "heykel_2", "cicek_mavi", "cicek_pembe", "cicek_kirmizi", "cicek_beyaz", "nilufer", "nilufer_2", "nilufer_3", "kaya", "saksi"]

## The town plan, in tiles. The town is mirrored about the north-south avenue's middle (MID_X, in
## pixels): what stands on the west side stands the same, mirrored, on the east side.
const MID_X := 1200.0
const AVE_NS := Rect2i(73, 28, 4, 75)      # the keep's door to the harbour gate
const AVE_EW := Rect2i(30, 58, 90, 4)      # the arena (west) to the field gate (east)
const STREETS := [Rect2i(34, 45, 82, 3), Rect2i(37, 83, 76, 3)]
## The stable master's lane, off the avenue in the south (west side only).
const LANE := Rect2i(57, 103, 16, 2)
const GARDEN_BOX := Rect2i(62, 49, 26, 25)
## The garden's parts (west side; mirrored east): the square round the fountain, the hedge round
## the northern flower carpet, the southern pool.
const PLAZA_BOX := Rect2i(71, 55, 8, 10)
const HEDGE_RING := Rect2i(62, 49, 9, 9)
const POOL_BOX := Rect2i(63, 66, 8, 6)
## The farm in the south: a crop field each side (mirrored), the paddock east of the avenue.
const FIELDS := [Rect2i(46, 88, 25, 4), Rect2i(79, 88, 25, 4)]
const CROPS := ["ekin_havuc", "ekin_pancar", "ekin_lahana", "ekin_marul", "ekin_karnabahar", "ekin_brokoli"]
## The lawns between the streets and the avenue (west side; mirrored east): parks.
const PARKS := [Rect2i(35, 49, 25, 8), Rect2i(34, 63, 26, 9)]
const TREES := ["res://props/doga/agac_yesil.tscn", "res://props/doga/agac_sari.tscn", "res://props/doga/agac_turuncu.tscn"]
## The keep's door, its guards, and where one comes out of the keep hall / the arena.
const KEEP_DOOR := Vector2(1188, 452)
const KEEP_GUARDS := {"guard_keep_west": Vector2(1144, 474), "guard_keep_east": Vector2(1232, 474)}
const ARRIVALS := {"keep_hall_door": Vector2(1188, 500), "pvp_exit": Vector2(584, 970)}
## Houses on the west side: [tile x of the middle, tile y of the foot, NPC living there, NPC in
## the mirrored house on the east side ("" for none), house kind (props/ev/ev_N)].
const HOUSES := [
	[38, 44, "craftsman", "cook", 10], [53, 44, "sage", "weaponsmith", 3], [66, 44, "alchemist", "armorer", 9],
	[39, 82, "scribe", "blacksmith", 8], [53, 82, "jeweler", "storekeeper", 7], [66, 82, "barber", "pet_keeper", 1],
	[61, 103, "stable_master", "", 5],
]
## Each house kind's half width and height, in pixels (for its lantern and what's kept clear).
const HOUSE_SIZE := {1: Vector2(80, 133), 2: Vector2(80, 132), 3: Vector2(80, 133), 4: Vector2(80, 133), 5: Vector2(80, 132), 6: Vector2(80, 133), 7: Vector2(88, 157), 8: Vector2(88, 207), 9: Vector2(88, 157), 10: Vector2(109, 209), 11: Vector2(117, 267)}
## The trade's things by the door (on the house's outer side), feet relative to the house's foot
## in pixels, for a west-side house (an east-side house has them mirrored). A third entry puts
## things on top of it (relative to its own foot), so they're drawn over it.
const TRADES := {
	"scribe": [["masa", Vector2(52, 22), [["kitap", Vector2(-8, -18)], ["kalem", Vector2(10, -18)]]], ["kavanoz_2", Vector2(-52, 20)]],
	"sage": [["simya_orta", Vector2(54, 22)], ["kavanoz", Vector2(-52, 20)]],
	"alchemist": [["simya_buyuk", Vector2(56, 22)], ["iksir_sandigi", Vector2(-54, 22)]],
	"armorer": [["ors_tezgah", Vector2(54, 22)], ["sandik", Vector2(-54, 22)]],
	"weaponsmith": [["ors", Vector2(52, 22)], ["tezgah_demir", Vector2(-50, 22)]],
	"blacksmith": [["ors_buyuk", Vector2(56, 22)], ["ocak", Vector2(-50, 24)]],
	"barber": [["sandalye", Vector2(40, 20)], ["iksir", Vector2(56, 20)], ["kavanoz_2", Vector2(-52, 20)]],
	"jeweler": [["vitrin", Vector2(56, 22)]],
	"craftsman": [["bicki", Vector2(56, 22)], ["kutuk_balta", Vector2(-52, 22)]],
	"cook": [["mutfak", Vector2(56, 22)], ["kazan_atesi", Vector2(-52, 22)]],
	"storekeeper": [["tezgah", Vector2(50, 22)], ["sandik", Vector2(78, 22)], ["un_cuvali", Vector2(-52, 22)]],
	"pet_keeper": [["yalak", Vector2(56, 22)], ["yem_cuvali", Vector2(-52, 22)], ["sebze_sandigi", Vector2(-68, 22)]],
	"stable_master": [["un_cuvali", Vector2(48, 20)], ["yem_cuvali", Vector2(64, 20)]],
}
## Scenes that are already there (not made here).
const EXISTING := {
	"ors": "res://props/forge/ors.tscn", "ocak": "res://props/forge/ocak.tscn", "sandik": "res://props/koy/sandik.tscn",
	"fici": "res://props/koy/fici.tscn", "yalak": "res://props/koy/yalak.tscn", "lamba": "res://props/koy/sokak_lambasi.tscn",
	"cicek_kutusu": "res://props/koy/cicek_kutusu.tscn", "cali": "res://props/doga/cali_yesil_1.tscn",
}
## What goes from the town before the new plan is laid (it puts its own back).
const CLEARED := ["res://props/ev/", "res://props/koy/sokak_lambasi", "res://props/koy/sandik", "res://props/koy/fici", "res://props/koy/cuval", "res://props/koy/korkuluk", "res://props/koy/ors", "res://props/koy/patates", "res://props/koy/sebze", "res://props/koy/bank", "res://props/araba", "res://props/kuyu", "res://props/mesale", "res://props/at_"]
## The paddock moves as one, to the south-east of the avenue (its horses are the riding horses).
const PADDOCK := ["res://props/koy/agil", "res://props/koy/yalak", "res://props/koy/ciftlik_tabelasi"]
const PADDOCK_MOVE := Vector2(-111, 265)
const HORSES := [[Vector2(1328, 1608), false], [Vector2(1410, 1620), true], [Vector2(1372, 1586), true]]
## A lantern stands this far beyond a house's side (right of a west-side house, left of an
## east-side one).
const LANTERN_GAP := 24.0

func _initialize() -> void:
	match OS.get_cmdline_user_args()[0]:
		"path":
			_path_sheet()
			_shore_sheet()
			_pool_sheet()
		"tileset":
			_tileset()
		"scenes":
			_scenes()
		"layout":
			_layout()
		"organic":
			_organic()
		"grid":
			_grid()
		"meydan_tiles":
			_meydan_tiles()
		"hub":
			_hub()
	quit()


# ---- Path sheet and TileSet -------------------------------------------------------------

func _path_sheet() -> void:
	var src: Image = load(PACK + GARDEN).get_image()
	src.decompress()
	src.convert(Image.FORMAT_RGBA8)
	var masks: Array = DT._blob_masks()
	var p := PATH_SLICE
	var inner := PATH_INNER
	var out := Image.create(masks.size() * 16, 16, false, Image.FORMAT_RGBA8)
	for i in masks.size():
		var m: int = masks[i]
		var bit := func(k: int) -> bool: return m & (1 << k) != 0
		var quarters := [
			[Vector2i(0, 0), DT._quarter(bit.call(0), bit.call(6), bit.call(7), p[0], p[1], p[3], inner[3], p[4])],
			[Vector2i(8, 0), DT._quarter(bit.call(0), bit.call(2), bit.call(1), p[2], p[1], p[5], inner[2], p[4])],
			[Vector2i(0, 8), DT._quarter(bit.call(4), bit.call(6), bit.call(5), p[6], p[7], p[3], inner[1], p[4])],
			[Vector2i(8, 8), DT._quarter(bit.call(4), bit.call(2), bit.call(3), p[8], p[7], p[5], inner[0], p[4])],
		]
		for q in quarters:
			var at: Vector2i = q[0]
			var piece: Vector2i = q[1]
			out.blit_rect(src, Rect2i(piece * 16 + at, Vector2i(8, 8)), Vector2i(i * 16, 0) + at)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(PATH_PNG.get_base_dir()))
	out.save_png(ProjectSettings.globalize_path(PATH_PNG))
	print("path sheet: %d shapes" % masks.size())


## The pool's frame as nine tiles: its corners and edges as drawn, the sides and the water in
## between repeated from its middle.
func _pool_sheet() -> void:
	var src: Image = load(PACK + GARDEN).get_image()
	src.decompress()
	src.convert(Image.FORMAT_RGBA8)
	var f := src.get_region(POOL_FRAME)
	var w := f.get_width()
	var h := f.get_height()
	var mid := Vector2i(w / 2, h / 2)
	var out := Image.create(48, 48, false, Image.FORMAT_RGBA8)
	var cols := [0, mid.x - 8, w - 16]
	var rows := [0, -1, h - 16]
	for r in 3:
		for c in 3:
			for y in 16:
				for x in 16:
					var sx: int = cols[c] + x
					var sy: int = mid.y if rows[r] < 0 else rows[r] + y
					out.set_pixel(c * 16 + x, r * 16 + y, f.get_pixel(sx, sy))
	out.save_png(ProjectSettings.globalize_path(POOL_PNG))
	print("pool sheet: %dx%d frame" % [w, h])


func _shore_sheet() -> void:
	var src: Image = load(PACK + WATER_SHEET).get_image()
	src.decompress()
	src.convert(Image.FORMAT_RGBA8)
	var masks: Array = DT._blob_masks()
	var p := SHORE_SLICE
	var inner := SHORE_INNER
	var out := Image.create(masks.size() * 16, 16, false, Image.FORMAT_RGBA8)
	for i in masks.size():
		var m: int = masks[i]
		var bit := func(k: int) -> bool: return m & (1 << k) != 0
		var quarters := [
			[Vector2i(0, 0), DT._quarter(bit.call(0), bit.call(6), bit.call(7), p[0], p[1], p[3], inner[3], p[4])],
			[Vector2i(8, 0), DT._quarter(bit.call(0), bit.call(2), bit.call(1), p[2], p[1], p[5], inner[2], p[4])],
			[Vector2i(0, 8), DT._quarter(bit.call(4), bit.call(6), bit.call(5), p[6], p[7], p[3], inner[1], p[4])],
			[Vector2i(8, 8), DT._quarter(bit.call(4), bit.call(2), bit.call(3), p[8], p[7], p[5], inner[0], p[4])],
		]
		for q in quarters:
			var at: Vector2i = q[0]
			var piece: Vector2i = q[1]
			out.blit_rect(src, Rect2i(piece * 16 + at, Vector2i(8, 8)), Vector2i(i * 16, 0) + at)
	out.save_png(ProjectSettings.globalize_path(SHORE_PNG))
	print("shore sheet: %d shapes" % masks.size())


func _tileset() -> void:
	var set: TileSet = load(TILESET)
	for id in [GARDEN_SOURCE, PATH_SOURCE]:
		if set.has_source(id):
			set.remove_source(id)
	var g := TileSetAtlasSource.new()
	g.texture = load(PACK + GARDEN)
	g.texture_region_size = Vector2i(16, 16)
	set.add_source(g, GARDEN_SOURCE)
	for bed in BEDS.values():
		for c in bed:
			_tile(g, c, FLOWER, WALK)
	for c in POOL:
		_tile(g, c, WATER_T, WALK)
	for y in range(15, 22):
		for x in range(6):
			if not Vector2i(x, y) in HEDGE_GRASS:
				_tile(g, Vector2i(x, y), 13, WALK)
	for c in WALL_TOP + WALL_FACE:
		_tile(g, c, 12, WALK)
	var water: TileSetAtlasSource = set.get_source(WATER_SOURCE)
	for y in range(11, 14):
		for x in range(1, 4):
			var w := Vector2i(x, y)
			if not water.has_tile(w):
				water.create_tile(w)
				var wd := water.get_tile_data(w, 0)
				wd.set_custom_data("tile", WATER_T)
				wd.add_collision_polygon(0)
				wd.set_collision_polygon_points(0, 0, PackedVector2Array([Vector2(-8, -8), Vector2(8, -8), Vector2(8, 8), Vector2(-8, 8)]))
	# The animated sea tiles of before are no longer used.
	for c in SEA:
		if water.has_tile(c):
			water.remove_tile(c)
	if set.has_source(POOL_SOURCE):
		set.remove_source(POOL_SOURCE)
	var pool := TileSetAtlasSource.new()
	pool.texture = load(POOL_PNG)
	pool.texture_region_size = Vector2i(16, 16)
	set.add_source(pool, POOL_SOURCE)
	for y in 3:
		for x in 3:
			_tile(pool, Vector2i(x, y), WATER_T, WALK)
	if set.has_source(SHORE_SOURCE):
		set.remove_source(SHORE_SOURCE)
	var shore := TileSetAtlasSource.new()
	shore.texture = load(SHORE_PNG)
	shore.texture_region_size = Vector2i(16, 16)
	set.add_source(shore, SHORE_SOURCE)
	for i in DT._blob_masks().size():
		var c := Vector2i(i, 0)
		shore.create_tile(c)
		shore.get_tile_data(c, 0).set_custom_data("tile", -1)
	var p := TileSetAtlasSource.new()
	p.texture = load(PATH_PNG)
	p.texture_region_size = Vector2i(16, 16)
	set.add_source(p, PATH_SOURCE)
	for i in DT._blob_masks().size():
		_tile(p, Vector2i(i, 0), PLAZA, 0)
	ResourceSaver.save(set, TILESET)
	print("tileset: garden %d, paths %d" % [g.get_tiles_count(), p.get_tiles_count()])


func _tile(s: TileSetAtlasSource, c: Vector2i, tile_id: int, layers: int) -> void:
	if s.has_tile(c):
		return
	s.create_tile(c)
	var d := s.get_tile_data(c, 0)
	d.set_custom_data("tile", tile_id)
	if layers & WALK:
		d.add_collision_polygon(0)
		d.set_collision_polygon_points(0, 0, PackedVector2Array([Vector2(-8, -8), Vector2(8, -8), Vector2(8, 8), Vector2(-8, 8)]))


# ---- Scenes -----------------------------------------------------------------------------

func _scene_path(key: String) -> String:
	if EXISTING.has(key):
		return EXISTING[key]
	return "res://props/%s/%s.tscn" % ["garden" if key in GARDEN_PROPS else "kasaba", key]


func _scenes() -> void:
	for key in PROPS:
		var spec: Dictionary = PROPS[key]
		var root := Node2D.new()
		root.name = String(key).to_pascal_case()
		if spec.has("shadow"):
			var shadow := Sprite2D.new()
			shadow.name = "Golge"
			shadow.texture = load("res://assets/town/%s.png" % spec.shadow)
			shadow.position = Vector2(0, -3)
			shadow.modulate.a = 0.6
			shadow.z_index = -5
			shadow.z_as_relative = false
			root.add_child(shadow)
		if spec.has("parts"):
			for part in spec.parts:
				var ps := Sprite2D.new()
				ps.name = "Gorsel"
				ps.texture = load(PACK + part[0])
				ps.region_enabled = true
				ps.region_rect = Rect2(part[1])
				ps.centered = false
				ps.position = part[2]
				root.add_child(ps, true)
		elif spec.has("frames"):
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
			s.texture = load(PACK + spec.sheet)
			s.region_enabled = true
			s.region_rect = Rect2(r)
			s.centered = false
			s.position = Vector2(-floorf(r.size.x / 2.0), -r.size.y)
			root.add_child(s)
		if spec.has("light"):
			var l: Dictionary = spec.light
			var light := MapLight.new()
			light.name = "Lamba"
			light.position = l.at
			light.radius = l.radius
			light.color = l.color
			light.flicker = l.flicker
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
		for child in root.get_children():
			child.owner = root
			for c in child.get_children():
				c.owner = root
		var path := _scene_path(key)
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(path.get_base_dir()))
		var packed := PackedScene.new()
		packed.pack(root)
		ResourceSaver.save(packed, path)
		root.free()
	print("scenes: %d" % PROPS.size())


# ---- The town ---------------------------------------------------------------------------

func _layout() -> void:
	var path := "res://maps/town.tscn"
	var root: GameMap = load(path).instantiate()
	var ground: TileMapLayer = root.get_node("Zemin")
	var grass: TileMapLayer = root.get_node("Cimen")
	var items: Node2D = root.get_node("Esyalar")

	# The land, and how far each cell of it is from its rim.
	var land := {}
	for c in ground.get_used_cells():
		if ground.get_cell_source_id(c) == FLOORS:
			land[c] = true
	var rim := _rim_distance(land)

	# Roads and fields: dirt (no grass over it); the garden: grass, its paths drawn on Bahce.
	var roads := {}
	for r in [AVE_NS, AVE_EW, LANE] + STREETS + FIELDS:
		for y in range(r.position.y, r.end.y):
			for x in range(r.position.x, r.end.x):
				var c := Vector2i(x, y)
				if land.has(c) and not GARDEN_BOX.has_point(c):
					roads[c] = true
	var dirt := [Vector2i(6, 10), Vector2i(7, 10), Vector2i(8, 10)]
	var rng := RandomNumberGenerator.new()
	rng.seed = 1015
	for c: Vector2i in land:
		var x := ground.get_cell_atlas_coords(c).x
		if roads.has(c) or x >= 15:
			ground.set_cell(c, FLOORS, dirt[rng.randi() % dirt.size()])
		if roads.has(c):
			grass.erase_cell(c)
		else:
			grass.set_cell(c, FLOORS, Vector2i(2, 10))

	# What was in the way goes; the paddock moves south.
	var keep_out: Array[Rect2] = []
	for h in HOUSES:
		var foot := Vector2(h[0] * 16 + 8, h[1] * 16)
		var size: Vector2 = HOUSE_SIZE[h[4]]
		for f in [foot, _mirror(foot)]:
			# A house's box and the rows above its roof (a tree there looks cut by the roof).
			keep_out.append(_house_area(f, size))
	for r in [AVE_NS, AVE_EW, GARDEN_BOX, LANE] + STREETS + FIELDS + PARKS:
		# Below it too: what stands there reaches up over it.
		var box := Rect2(Vector2(r.position) * 16 - Vector2(24, 40), Vector2(r.size) * 16 + Vector2(48, 120))
		keep_out.append(box)
		keep_out.append(Rect2(Vector2(2 * MID_X - box.end.x, box.position.y), box.size))
	keep_out.append(Rect2(Vector2(1250, 1380), Vector2(260, 260)))
	# The vegetation drawn as tiles goes from the town's inside and from whatever is laid out.
	var edge: TileMapLayer = root.get_node_or_null("CimenKenari")
	if edge:
		for c in edge.get_used_cells():
			var at := Vector2(c) * 16 + Vector2(8, 16)
			if rim.get(c, 0) > 4 or roads.has(c) or keep_out.any(func(r: Rect2): return r.has_point(at)):
				edge.erase_cell(c)
	var removed := 0
	for n in items.get_children():
		var scene: String = n.scene_file_path
		if scene.is_empty():
			continue
		if PADDOCK.any(func(p): return scene.begins_with(p)):
			n.position += PADDOCK_MOVE
			continue
		var cell := Vector2i(floori(n.position.x / 16), floori((n.position.y - 1) / 16))
		var inside: bool = rim.get(cell, 0) > 4 and n.position.y > 34 * 16
		var in_way: bool = keep_out.any(func(r: Rect2): return r.has_point(n.position))
		if CLEARED.any(func(p): return scene.begins_with(p)) or ((scene.contains("/doga/") or scene.contains("/agac_")) and (inside or in_way)):
			items.remove_child(n)
			n.free()
			removed += 1

	# Houses (the six kinds in turn, the same kind facing it across the avenue), each with its
	# lantern on the street side and its NPC's trade at the door; east of the avenue mirrored.
	var spots := {}
	for s: MapSpot in root.find_children("*", "MapSpot", true, false):
		spots[s.kind + ":" + s.ref] = s
	for h in HOUSES:
		var foot := Vector2(h[0] * 16 + 8, h[1] * 16)
		var size: Vector2 = HOUSE_SIZE[h[4]]
		for east in [false, true]:
			var who: String = h[3] if east else h[2]
			if who.is_empty():
				continue
			_put(items, "res://props/ev/ev_%d.tscn" % h[4], foot, east)
			# A little in front of the house line, so it stands before a close neighbour's wall.
			_put(items, EXISTING.lamba, foot + Vector2(size.x + LANTERN_GAP, 12), east)
			var npc: MapSpot = spots.get("npc:" + who)
			if npc:
				npc.position = _side(foot + Vector2(-24, 18), east)
			for t in TRADES.get(who, []):
				var node := _put(items, _scene_path(t[0]), foot + t[1], east)
				if t.size() > 2:
					for on in t[2]:
						var item: Node2D = load(_scene_path(on[0])).instantiate()
						item.position = on[1]
						node.add_child(item, true)
	# Lanterns at both ends of every road, each turned towards the road's middle.
	for r in [AVE_EW] + STREETS:
		_put(items, EXISTING.lamba, Vector2(r.position.x * 16 + 8, r.position.y * 16), false)
		_put(items, EXISTING.lamba, Vector2(r.position.x * 16 + 8, r.position.y * 16), true)
	for y in [AVE_NS.position.y + 2, AVE_NS.end.y - 2]:
		_put(items, EXISTING.lamba, Vector2(AVE_NS.position.x * 16 - 12, y * 16), false)
		_put(items, EXISTING.lamba, Vector2(AVE_NS.position.x * 16 - 12, y * 16), true)
	_put(items, EXISTING.lamba, Vector2(LANE.position.x * 16 + 8, LANE.position.y * 16), false)

	_garden(root, items)
	_parks(items)
	_farm(items)
	_sea(root, ground)

	# The keep: its door where the castle's is, the guards either side, the hall's way out below.
	var door: MapSpot = spots.get("portal:town_keep_door")
	if door:
		door.position = KEEP_DOOR
	for id in KEEP_GUARDS:
		var guard: MapSpot = spots.get("npc:" + id)
		if guard:
			guard.position = KEEP_GUARDS[id]
	for id in ARRIVALS:
		var at: MapSpot = spots.get("arrival:" + id)
		if at == null:
			at = MapSpot.new()
			at.kind = "arrival"
			at.ref = id
			at.name = String(id).to_pascal_case()
			root.get_node("Noktalar").add_child(at, true)
		at.position = ARRIVALS[id]
	# The arena's entrance at the west end of the avenue.
	var arena: MapSpot = spots.get("portal:pvp_arena_entrance")
	if arena:
		arena.position = Vector2((AVE_EW.position.x + 3) * 16 + 8, (AVE_EW.position.y + 2) * 16)

	for n in root.get_children():
		_own(n, root)
	var packed := PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, path)
	root.free()
	print("town: %d props cleared, roads %d cells" % [removed, roads.size()])


## The ground a house stands on and the rows above its roof (a tree there looks cut by it).
func _house_area(foot: Vector2, size: Vector2) -> Rect2:
	return Rect2(foot + Vector2(-size.x - 40, -size.y - 90), Vector2(size.x * 2 + 80, size.y + 160))


func _behind_house(at: Vector2) -> bool:
	for h in HOUSES:
		var foot := Vector2(h[0] * 16 + 8, h[1] * 16)
		if _house_area(foot, HOUSE_SIZE[h[4]]).has_point(at):
			return true
	return false


## A real island: the clouds go, the sea fills everything round the land (and the background
## beyond the map's edge is the sea's colour).
func _sea(root: GameMap, ground: TileMapLayer) -> void:
	var clouds := root.get_node_or_null("Bulutlar")
	if clouds:
		root.remove_child(clouds)
		clouds.free()
	var sea: TileMapLayer = root.get_node_or_null("Deniz")
	if sea == null:
		sea = TileMapLayer.new()
		sea.name = "Deniz"
		sea.tile_set = ground.tile_set
		sea.z_index = -11
		root.add_child(sea)
		root.move_child(sea, 0)
	sea.clear()
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	# The floating island's underside goes: a few rows of cliff stay where the land ends.
	var floor_bottom := {}
	for c in ground.get_used_cells():
		if ground.get_cell_source_id(c) == FLOORS:
			floor_bottom[c.x] = maxi(int(floor_bottom.get(c.x, -1)), c.y)
	for c in ground.get_used_cells():
		if ground.get_cell_source_id(c) == FLOORS:
			continue
		# Below the land: the cliff, a few rows of it. Anywhere else (the old rim round the sides): sea.
		var below: bool = c.y > int(floor_bottom.get(c.x, 1 << 20))
		if not below or c.y > int(floor_bottom.get(c.x, -100)) + CLIFF_ROWS:
			ground.erase_cell(c)
	var land := {}
	for c in ground.get_used_cells():
		land[c] = true
	# Holes inside the island (cells the old map left empty) are land too: the sea only comes in
	# from the map's edge.
	var outside := {}
	var queue: Array[Vector2i] = []
	for y in root.height:
		for x in root.width:
			var c := Vector2i(x, y)
			if (x == 0 or y == 0 or x == root.width - 1 or y == root.height - 1) and not land.has(c):
				outside[c] = true
				queue.append(c)
	var qi := 0
	while qi < queue.size():
		var c := queue[qi]
		qi += 1
		for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var o: Vector2i = c + d
			if o.x >= 0 and o.y >= 0 and o.x < root.width and o.y < root.height and not land.has(o) and not outside.has(o):
				outside[o] = true
				queue.append(o)
	var grass_layer: TileMapLayer = root.get_node("Cimen")
	for y in root.height:
		for x in root.width:
			var c := Vector2i(x, y)
			if not land.has(c) and not outside.has(c):
				ground.set_cell(c, FLOORS, Vector2i(7, 10))
				grass_layer.set_cell(c, FLOORS, Vector2i(2, 10))
				land[c] = true
	# The coast: on the land's outermost grass, the islet's rim of earth and foam.
	var shore: TileMapLayer = root.get_node_or_null("Kiyi")
	if shore == null:
		shore = TileMapLayer.new()
		shore.name = "Kiyi"
		shore.tile_set = ground.tile_set
		shore.z_index = -7
		root.add_child(shore)
	shore.clear()
	var blobs: Array = DT._blob_masks()
	for c in land:
		if ground.get_cell_source_id(c) != FLOORS:
			continue
		var m := 0
		for k in 8:
			if land.has(c + DT.DIRS[k]):
				m |= 1 << k
		if m != 255:
			shore.set_cell(c, SHORE_SOURCE, Vector2i(blobs.find(DT._normalize(m)), 0))
	for y in root.height:
		for x in root.width:
			var c := Vector2i(x, y)
			if not land.has(c):
				sea.set_cell(c, WATER_SOURCE, Vector2i(1 + x % 3, 11 + y % 3))
	root.background = SEA_COLOUR


func _mirror(p: Vector2) -> Vector2:
	return Vector2(2 * MID_X - p.x, p.y)


func _side(p: Vector2, east: bool) -> Vector2:
	return _mirror(p) if east else p


## A prop at `at` (a west-side position), or at its mirror image, mirrored, on the east side.
func _put(items: Node2D, scene: String, at: Vector2, east: bool) -> Node2D:
	return _place(items, scene, _side(at, east), east)


func _place(items: Node2D, scene: String, at: Vector2, mirrored := false) -> Node2D:
	var node: Node2D = load(scene).instantiate()
	node.position = at
	if mirrored:
		node.scale.x = -1
	items.add_child(node, true)
	return node


## The lawns either side of the garden: a row of trees (the same kind facing each other across
## the avenue), benches and flower boxes before them, bushes at the ends.
func _parks(items: Node2D) -> void:
	var k := 0
	for p: Rect2i in PARKS:
		var tree_y := p.position.y + 3
		var t := 0
		for x in range(p.position.x + 3, p.end.x - 2, 6):
			var at := Vector2(x * 16 + 8, (tree_y + 1) * 16)
			if not _behind_house(at):
				for east in [false, true]:
					_put(items, TREES[(k + t) % TREES.size()], at, east)
			t += 1
		var bench_y := p.end.y - 1
		var things := []
		for x in range(p.position.x + 6, p.end.x - 4, 12):
			things.append(["bank_ahsap", Vector2(x * 16 + 8, (bench_y + 1) * 16)])
			things.append([EXISTING.cicek_kutusu, Vector2((x + 4) * 16 + 8, (bench_y + 1) * 16)])
			things.append([EXISTING.cicek_kutusu, Vector2((x - 4) * 16 + 8, (bench_y + 1) * 16)])
		things.append([EXISTING.cali, Vector2(p.position.x * 16 + 8, p.end.y * 16)])
		things.append([EXISTING.cali, Vector2((p.end.x - 1) * 16 + 8, p.end.y * 16)])
		for th in things:
			if _behind_house(th[1]):
				continue
			var scene: String = th[0] if th[0].begins_with("res://") else _scene_path(th[0])
			for east in [false, true]:
				_put(items, scene, th[1], east)
		k += 1


## The farm: crops in rows across the two fields, a scarecrow in each, sacks at the ends; the
## riding horses in the paddock.
func _farm(items: Node2D) -> void:
	var k := 0
	for f: Rect2i in FIELDS:
		var row := 0
		for y in range(f.position.y, f.end.y, 2):
			var crop: String = CROPS[(k + row) % CROPS.size()]
			for x in range(f.position.x + 1, f.end.x - 1):
				if x == f.get_center().x and row == 1:
					continue
				_place(items, _scene_path(crop), Vector2(x * 16 + 8, (y + 1) * 16))
			row += 1
		_place(items, _scene_path("tarla_korkulugu"), Vector2(f.get_center().x * 16 + 8, (f.position.y + 3) * 16 + 2))
		var fence := Rect2(Vector2(f.position) * 16 - Vector2(12, 8), Vector2(f.size) * 16 + Vector2(24, 24))
		_fence(items, fence)
		_place(items, _scene_path("yem_cuvali"), Vector2(fence.position.x - 12, fence.end.y))
		_place(items, _scene_path("un_cuvali"), Vector2(fence.end.x + 12, fence.end.y))
		k += 3
	for h in HORSES:
		_place(items, _scene_path("at"), h[0], h[1])


## The garden round the fountain, after the Garden pack's own picture: paths crossing at the
## fountain, a hedged flower carpet with a cypress in each northern corner, stone pedestals with
## pots and trimmed cypresses lining the avenue, walled pools with fountain statues in the south.
## Everything west of the avenue is mirrored to the east.
func _garden(root: Node, items: Node2D) -> void:
	var layer: TileMapLayer = root.get_node_or_null("Bahce")
	if layer == null:
		layer = TileMapLayer.new()
		layer.name = "Bahce"
		layer.tile_set = load(TILESET)
		layer.z_index = -8
		root.add_child(layer)
		root.move_child(layer, root.get_node("Cimen").get_index() + 1)
	layer.clear()
	var g := GARDEN_BOX
	var path := {}
	var add := func(r: Rect2i) -> void:
		for y in range(r.position.y, r.end.y):
			for x in range(r.position.x, r.end.x):
				path[Vector2i(x, y)] = true
	add.call(Rect2i(AVE_NS.position.x, g.position.y, AVE_NS.size.x, g.size.y))
	add.call(Rect2i(g.position.x, AVE_EW.position.y, g.size.x, AVE_EW.size.y))
	add.call(PLAZA_BOX)
	var blobs: Array = DT._blob_masks()
	for c: Vector2i in path:
		var m := 0
		for k in 8:
			if path.has(c + DT.DIRS[k]):
				m |= 1 << k
		layer.set_cell(c, PATH_SOURCE, Vector2i(blobs.find(DT._normalize(m)), 0))

	for east in [false, true]:
		# North: a hedge round a flower carpet, a cypress standing in the carpet.
		var ring := _mirror_rect(HEDGE_RING, east)
		_hedge_ring(layer, ring)
		var bed := Rect2i(ring.position + Vector2i(2, 3), Vector2i(ring.size.x - 4, ring.size.y - 6))
		_nine(layer, bed, BEDS["pembe" if not east else "kirmizi"])
		_place(items, _scene_path("servi"), Vector2(bed.get_center().x * 16 + (0 if bed.size.x % 2 == 0 else 8), bed.end.y * 16 - 3), east)
		# South: a pool behind a low crenellated wall, a statue pouring water into it from its
		# plinth, lilies and stones on the water.
		var pool := _mirror_rect(POOL_BOX, east)
		var nine := []
		for y in 3:
			for x in 3:
				nine.append(Vector2i(x, y))
		_nine(layer, pool, nine, POOL_SOURCE)
		var plinth := Vector2((POOL_BOX.position.x + 2) * 16, (POOL_BOX.position.y + 4) * 16)
		_put(items, _scene_path("kaide"), plinth, east)
		_put(items, _scene_path("heykel_cesme"), plinth + Vector2(4, -15), east)
		_put(items, _scene_path("nilufer"), Vector2((POOL_BOX.position.x + 5) * 16, (POOL_BOX.position.y + 3) * 16), east)
		_put(items, _scene_path("nilufer_2"), Vector2((POOL_BOX.end.x - 2) * 16, (POOL_BOX.position.y + 2) * 16), east)
		_put(items, _scene_path("nilufer_3"), Vector2((POOL_BOX.position.x + 4) * 16, (POOL_BOX.end.y - 1) * 16), east)
		_put(items, _scene_path("kaya"), Vector2((POOL_BOX.end.x - 3) * 16, (POOL_BOX.end.y - 1) * 16 - 2), east)
		_put(items, _scene_path("kaya"), Vector2((POOL_BOX.position.x + 6) * 16 + 6, (POOL_BOX.position.y + 2) * 16 + 4), east)
		# Pedestals with flowers and trimmed cypresses by turns along the avenue's edges.
		var x := AVE_NS.position.x - 1
		var k := 0
		for y in [g.position.y + 1, g.position.y + 3, g.position.y + 5, POOL_BOX.position.y + 1, POOL_BOX.position.y + 3, POOL_BOX.position.y + 5, g.end.y - 1]:
			var at := Vector2(x * 16 + 8, (y + 1) * 16)
			if k % 2 == 0:
				_put_potted(items, at, ["cicek_mavi", "cicek_pembe", "cicek_kirmizi", "cicek_beyaz"][k / 2 % 4], east)
			else:
				_put(items, _scene_path("servi_kucuk"), at, east)
			k += 1
		# Cypresses down the garden's outer edge beside the pool.
		for y in range(POOL_BOX.position.y, g.end.y - 2, 3):
			_put(items, _scene_path("servi"), Vector2(g.position.x * 16 + 8, (y + 1) * 16), east)
		# Stone benches on the square round the fountain.
		_put(items, _scene_path("bank_tas"), Vector2((PLAZA_BOX.position.x + 1) * 16 + 8, (PLAZA_BOX.position.y + 1) * 16 + 4), east)
		_put(items, _scene_path("bank_tas"), Vector2((PLAZA_BOX.position.x + 1) * 16 + 8, (PLAZA_BOX.end.y) * 16 - 2), east)


func _mirror_rect(r: Rect2i, east: bool) -> Rect2i:
	if not east:
		return r
	var x0 := roundi((2 * MID_X - r.end.x * 16) / 16.0)
	return Rect2i(x0, r.position.y, r.size.x, r.size.y)


## A hedge all round r (the Garden pack's hedge ring, its middle rows and columns repeated).
func _hedge_ring(layer: TileMapLayer, r: Rect2i) -> void:
	var cols := [0, 1]
	for i in r.size.x - 4:
		cols.append(2 + i % 2)
	cols.append_array([4, 5])
	var rows := [15, 16, 17]
	for i in r.size.y - 6:
		rows.append(18)
	rows.append_array([19, 20, 21])
	for yi in rows.size():
		for xi in cols.size():
			var c := Vector2i(cols[xi], rows[yi])
			if not c in HEDGE_GRASS:
				layer.set_cell(r.position + Vector2i(xi, yi), GARDEN_SOURCE, c)


## A pot of flowers on a stone pedestal (the flowers its child, drawn over it).
func _put_potted(items: Node2D, at: Vector2, flower: String, east: bool) -> void:
	var pot := _put(items, _scene_path("kaide_saksi"), at, east)
	var f: Node2D = load(_scene_path(flower)).instantiate()
	f.position = Vector2(0, -36)
	pot.add_child(f, true)


## A field's fence (the paddock's pieces): rails along the top and bottom, posts down the sides.
func _fence(items: Node2D, r: Rect2) -> void:
	var fence := Node2D.new()
	fence.name = "TarlaCiti"
	fence.y_sort_enabled = true
	items.add_child(fence, true)
	var piece := func(tex: String, at: Vector2) -> void:
		var holder := Node2D.new()
		holder.position = at
		var s := Sprite2D.new()
		s.texture = load("res://assets/town/%s.png" % tex)
		s.centered = false
		s.position = Vector2(0, -16)
		holder.add_child(s)
		fence.add_child(holder, true)
	for row in [[r.position.y, "cit_sol_ust", "cit_ust", "cit_sag_ust"], [r.end.y, "cit_sol_alt", "cit_alt", "cit_sag_alt"]]:
		piece.call(row[1], Vector2(r.position.x, row[0]))
		var x := r.position.x + 16
		while x < r.end.x - 36:
			piece.call(row[2], Vector2(x, row[0]))
			x += 32
		piece.call(row[2], Vector2(r.end.x - 52, row[0]))
		piece.call(row[3], Vector2(r.end.x - 20, row[0]))
	var y := r.position.y + 16
	while y < r.end.y:
		piece.call("cit_yan", Vector2(r.position.x, y))
		piece.call("cit_yan_sag", Vector2(r.end.x - 4, y))
		y += 16
	var body := StaticBody2D.new()
	body.name = "Hitbox"
	body.collision_layer = WALK
	body.collision_mask = 0
	for box in [Rect2(r.position.x, r.position.y - 6, r.size.x, 6), Rect2(r.position.x, r.end.y - 6, r.size.x, 6), Rect2(r.position.x, r.position.y, 4, r.size.y), Rect2(r.end.x - 4, r.position.y, 4, r.size.y)]:
		var shape := CollisionShape2D.new()
		var rect := RectangleShape2D.new()
		rect.size = box.size
		shape.shape = rect
		shape.position = box.get_center()
		body.add_child(shape)
	fence.add_child(body)


## A pot with flowers in it (the flowers its child, so drawn over it).
func _potted(items: Node2D, at: Vector2, flower: String) -> void:
	var pot := _place(items, _scene_path("saksi"), at)
	var f: Node2D = load(_scene_path(flower)).instantiate()
	f.position = Vector2(0, -9)
	pot.add_child(f, true)


func _nine(layer: TileMapLayer, r: Rect2i, pieces: Array, source := GARDEN_SOURCE) -> void:
	for y in range(r.position.y, r.end.y):
		for x in range(r.position.x, r.end.x):
			var col := 0 if x == r.position.x else (2 if x == r.end.x - 1 else 1)
			var row := 0 if y == r.position.y else (2 if y == r.end.y - 1 else 1)
			layer.set_cell(Vector2i(x, y), source, pieces[row * 3 + col])


func _rim_distance(land: Dictionary) -> Dictionary:
	var dist := {}
	var queue: Array[Vector2i] = []
	for c: Vector2i in land:
		for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			if not land.has(c + d):
				dist[c] = 1
				queue.append(c)
				break
	var i := 0
	while i < queue.size():
		var c := queue[i]
		i += 1
		for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var o: Vector2i = c + d
			if land.has(o) and not dist.has(o):
				dist[o] = dist[c] + 1
				queue.append(o)
	return dist


## Everything added here belongs to the map (things put on an instanced prop too); what an
## instanced prop is made of keeps belonging to it.
func _own(node: Node, root: Node) -> void:
	if node != root and node.owner == null:
		node.owner = root
	for child in node.get_children():
		_own(child, root)

# ---- The organic village ----------------------------------------------------------------

## Winding roads (tiles, through these points) and their width: the four from the garden to the
## keep, the arena, the field gate and the harbour, then lanes off them to the houses and farm.
const ROADS := [
	[3.4, [Vector2(74.5, 28), Vector2(73.8, 34), Vector2(75.6, 41), Vector2(74.5, 48.5)]],
	[3.2, [Vector2(62, 59.5), Vector2(55, 58.3), Vector2(47, 61.5), Vector2(38, 59), Vector2(28, 61), Vector2(19, 59.5)]],
	[3.2, [Vector2(87, 59.5), Vector2(95, 61.2), Vector2(103, 58.4), Vector2(112, 60.8), Vector2(122, 59), Vector2(136, 60)]],
	[3.2, [Vector2(74.5, 73.5), Vector2(72.8, 82), Vector2(76.2, 92), Vector2(73.8, 104), Vector2(75, 120)]],
	[2.6, [Vector2(73.5, 89), Vector2(62, 88.5), Vector2(48, 91.5), Vector2(34, 89), Vector2(21, 91)]],
	[2.6, [Vector2(76, 90), Vector2(88, 89.5), Vector2(102, 92), Vector2(116, 89), Vector2(132, 90.5)]],
	[2.2, [Vector2(117, 90), Vector2(121, 99), Vector2(118, 108), Vector2(108, 114)]],
]
## Each NPC's house: [NPC, house kind, mirrored, roughly where (tile of its foot)]. The house
## goes to the nearest free spot by the road there.
const VILLAGE := [
	["craftsman", 10, false, Vector2(36, 44)], ["alchemist", 9, false, Vector2(50, 34)],
	["sage", 3, true, Vector2(99, 34)], ["cook", 10, true, Vector2(114, 44)],
	["scribe", 7, false, Vector2(26, 74)], ["storekeeper", 1, true, Vector2(128, 56)],
	["blacksmith", 6, false, Vector2(30, 86)], ["weaponsmith", 8, false, Vector2(50, 78)],
	["armorer", 2, true, Vector2(100, 78)], ["jeweler", 9, true, Vector2(122, 76)],
	["barber", 4, false, Vector2(58, 106)], ["pet_keeper", 5, true, Vector2(110, 106)],
	["stable_master", 7, true, Vector2(100, 108)],
]
## The farm: two fields and the paddock (with its horses) south of the village.
const FIELDS2 := [Rect2i(30, 100, 16, 4), Rect2i(104, 66, 14, 4)]
const PADDOCK_TARGET := Vector2(1376, 1872)
## The island: an ellipse round this centre (tiles), its coast wavering by up to ISLAND_WOBBLE.
const ISLAND_CENTER := Vector2(79, 67)
const ISLAND_RADII := Vector2(68, 59)
const ISLAND_WOBBLE := 0.07
## The keep and the woods behind it stay as they are.
const KEEP_AREA := Rect2i(58, 0, 34, 31)
const TREE_SCENES := ["res://props/doga/agac_yesil.tscn", "res://props/doga/agac_sari.tscn", "res://props/doga/agac_turuncu.tscn", "res://props/agac_1.tscn", "res://props/agac_2.tscn", "res://props/agac_3.tscn"]
const BUSH_SCENES := ["res://props/doga/cali_yesil_1.tscn", "res://props/doga/cali_yesil_2.tscn", "res://props/doga/cali_yesil_3.tscn", "res://props/doga/cali_zeytin_1.tscn", "res://props/doga/cali_zeytin_2.tscn"]
const SMALL_SCENES := ["res://props/doga/cicek_04.tscn", "res://props/doga/cicek_11.tscn", "res://props/doga/cicek_21.tscn", "res://props/doga/cicek_22.tscn", "res://props/doga/bitki_04.tscn", "res://props/doga/bitki_06.tscn", "res://props/doga/bitki_29.tscn", "res://props/doga/tas_01.tscn", "res://props/doga/tas_05.tscn", "res://props/doga/mantar_04.tscn"]


func _organic() -> void:
	var path := "res://maps/town.tscn"
	var root: GameMap = load(path).instantiate()
	var ground: TileMapLayer = root.get_node("Zemin")
	var grass: TileMapLayer = root.get_node("Cimen")
	var items: Node2D = root.get_node("Esyalar")
	var rng := RandomNumberGenerator.new()
	rng.seed = 2026

	# Trim the old floating island's sides and underside first: what's land is what stays.
	_trim_island(root, ground)
	_grow_island(root, ground)
	_fill_holes(root, ground)
	var land := {}
	for c in ground.get_used_cells():
		if ground.get_cell_source_id(c) == FLOORS:
			land[c] = true
	var rim := _rim_distance(land)

	# Roads: winding, their edges a little uneven.
	var roads := {}
	for r in ROADS:
		_road(roads, r[1], r[0], rng)
	for c in roads.keys():
		if not land.has(c) or GARDEN_BOX.has_point(c):
			roads.erase(c)

	# What may not be built on.
	var taken := {}
	var mark := func(r: Rect2i, d: Dictionary) -> void:
		for y in range(r.position.y, r.end.y):
			for x in range(r.position.x, r.end.x):
				d[Vector2i(x, y)] = true
	mark.call(GARDEN_BOX.grow(1), taken)
	mark.call(KEEP_AREA, taken)
	for f in FIELDS2:
		mark.call(f.grow(2), taken)
	var paddock := Rect2i(Vector2i(PADDOCK_TARGET / 16) - Vector2i(6, 8), Vector2i(12, 10))
	mark.call(paddock, taken)

	# Houses: each by its road, near where it's meant to be.
	var spots := {}
	for s: MapSpot in root.find_children("*", "MapSpot", true, false):
		spots[s.kind + ":" + s.ref] = s
	var houses := []  # [foot (px), size, flip, npc, kind]
	for v in VILLAGE:
		var kind: int = v[1]
		var size: Vector2 = HOUSE_SIZE[kind]
		var best := Vector2i(-1, -1)
		var best_road := Vector2i(-1, -1)
		var best_score := INF
		var why := {}
		for dy in range(-10, 11):
			for dx in range(-11, 12):
				var foot := Vector2i(v[3]) + Vector2i(dx, dy)
				var box := _house_box(foot, size)
				var bad := _box_problem(box, land, rim, roads, taken)
				if not bad.is_empty():
					why[bad] = int(why.get(bad, 0)) + 1
					continue
				var road := _nearest_road(foot + Vector2i(0, 3), roads, 16)
				if road.x < 0:
					why["far"] = int(why.get("far", 0)) + 1
					continue
				var score := Vector2(dx, dy).length() + Vector2(road - foot).length() * 0.25
				if score < best_score:
					best_score = score
					best = foot
					best_road = road
		if best.x < 0:
			push_error("no room for %s's house: %s" % [v[0], why])
			continue
		mark.call(_house_box(best, size).grow(1), taken)
		# A path winds from the door to the road.
		var door := Vector2(best.x, best.y + 0.5)
		var to := Vector2(best_road) + Vector2(0.5, 0.5)
		var bend := Vector2(lerpf(door.x, to.x, 0.25), lerpf(door.y, to.y, 0.75) + 1.0)
		_road(roads, [door, door + Vector2(0, 2.5), bend, to], 2.2, rng)
		houses.append([Vector2(best.x * 16, best.y * 16), size, v[2], v[0], kind])

	if OS.get_cmdline_user_args().has("mask"):
		_save_mask(land, rim, roads, taken, houses)
	# Ground: roads and fields are earth, the rest grass.
	var dirt := [Vector2i(6, 10), Vector2i(7, 10), Vector2i(8, 10)]
	var earth := roads.duplicate()
	for f in FIELDS2:
		mark.call(f, earth)
	for c: Vector2i in land:
		var x := ground.get_cell_atlas_coords(c).x
		if earth.has(c) or x >= 15:
			ground.set_cell(c, FLOORS, dirt[rng.randi() % dirt.size()])
		if earth.has(c):
			grass.erase_cell(c)
		else:
			grass.set_cell(c, FLOORS, Vector2i(2, 10))
	var edge: TileMapLayer = root.get_node_or_null("CimenKenari")
	if edge:
		edge.clear()

	# Everything old goes but the keep's woods and the paddock (which moves south).
	var removed := 0
	for n in items.get_children():
		var scene: String = n.scene_file_path
		if scene.is_empty():
			items.remove_child(n)
			n.free()
			continue
		if PADDOCK.any(func(p): return scene.begins_with(p)):
			n.position += PADDOCK_TARGET - Vector2(1481, 1369)
			continue
		var cell := Vector2i(floori(n.position.x / 16), floori((n.position.y - 1) / 16))
		var keep_woods: bool = KEEP_AREA.has_point(cell) and (scene.contains("/doga/") or scene.contains("/agac_") or scene.contains("ic_kale"))
		if keep_woods:
			continue
		items.remove_child(n)
		n.free()
		removed += 1

	# The houses, their NPCs, trades, lanterns.
	for h in houses:
		var foot: Vector2 = h[0]
		var size: Vector2 = h[1]
		var flip: bool = h[2]
		var s := -1.0 if flip else 1.0
		_place(items, "res://props/ev/ev_%d.tscn" % h[4], foot, flip)
		_place(items, EXISTING.lamba, foot + Vector2(s * (size.x + 16), 12), flip)
		var npc: MapSpot = spots.get("npc:" + h[3])
		if npc:
			npc.position = foot + Vector2(-24 * s, 18)
		for t in TRADES.get(h[3], []):
			var off: Vector2 = t[1]
			var node := _place(items, _scene_path(t[0]), foot + Vector2(off.x * s, off.y), flip)
			if t.size() > 2:
				for on in t[2]:
					var item: Node2D = load(_scene_path(on[0])).instantiate()
					item.position = on[1]
					node.add_child(item, true)
	# Lanterns where the roads start and end, and here and there along the big ones.
	for r in ROADS:
		var pts: Array = r[1]
		for p in [pts[0], pts[pts.size() - 1]]:
			var at := _beside_road(Vector2(p), roads, taken, land)
			if at.x >= 0:
				_place(items, EXISTING.lamba, at, at.x > Vector2(p).x * 16)

	_garden(root, items)
	_farm2(items)
	_nature(items, land, rim, roads, taken, houses, rng)
	_sea(root, ground)

	var door: MapSpot = spots.get("portal:town_keep_door")
	if door:
		door.position = KEEP_DOOR
	for id in KEEP_GUARDS:
		var guard: MapSpot = spots.get("npc:" + id)
		if guard:
			guard.position = KEEP_GUARDS[id]
	for id in ARRIVALS:
		var at: MapSpot = spots.get("arrival:" + id)
		if at == null:
			at = MapSpot.new()
			at.kind = "arrival"
			at.ref = id
			at.name = String(id).to_pascal_case()
			root.get_node("Noktalar").add_child(at, true)
		at.position = ARRIVALS[id]
	var arena: MapSpot = spots.get("portal:pvp_arena_entrance")
	if arena:
		arena.position = Vector2(35 * 16, 60 * 16 + 8)

	for n in root.get_children():
		_own(n, root)
	var packed := PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, path)
	root.free()
	print("village: %d old props gone, %d houses, %d road cells" % [removed, houses.size(), roads.size()])


## A debug picture of the plan: sea blue, coast yellow, land green, roads brown, taken grey,
## house feet red.
func _save_mask(land: Dictionary, rim: Dictionary, roads: Dictionary, taken: Dictionary, houses: Array) -> void:
	var img := Image.create(160, 136, false, Image.FORMAT_RGB8)
	img.fill(Color(0.2, 0.4, 0.8))
	for c: Vector2i in land:
		if c.x >= 0 and c.y >= 0 and c.x < 160 and c.y < 136:
			var col := Color(0.3, 0.7, 0.3) if int(rim.get(c, 0)) >= 2 else Color(0.9, 0.9, 0.3)
			if taken.has(c):
				col = Color(0.5, 0.5, 0.5)
			if roads.has(c):
				col = Color(0.5, 0.3, 0.1)
			img.set_pixelv(c, col)
	for h in houses:
		img.set_pixelv(Vector2i(h[0] / 16), Color(1, 0, 0))
	img.resize(640, 544, Image.INTERPOLATE_NEAREST)
	img.save_png("user://town_mask.png")
	print("mask: ", ProjectSettings.globalize_path("user://town_mask.png"))


## Cells along a smooth curve through the points, `width` wide, its edges a little uneven.
func _road(roads: Dictionary, pts: Array, width: float, rng: RandomNumberGenerator) -> void:
	for i in pts.size() - 1:
		var p0: Vector2 = pts[maxi(i - 1, 0)]
		var p1: Vector2 = pts[i]
		var p2: Vector2 = pts[i + 1]
		var p3: Vector2 = pts[mini(i + 2, pts.size() - 1)]
		for k in 40:
			var t := k / 40.0
			var p := 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
			var r := width / 2.0 + sin((p.x + p.y) * 0.9) * 0.25 + rng.randf() * 0.15
			for y in range(floori(p.y - r), ceili(p.y + r) + 1):
				for x in range(floori(p.x - r), ceili(p.x + r) + 1):
					if Vector2(x + 0.5, y + 0.5).distance_to(p) <= r:
						roads[Vector2i(x, y)] = true


## A house's ground: its walls and roof, and the yard before it (its trade's things).
static func _house_box(foot: Vector2i, size: Vector2) -> Rect2i:
	# Wide enough for the trade's things and the lantern either side of the door (96 px).
	var half := ceili(maxf(size.x / 2.0, 96.0) / 16.0)
	var up := ceili(size.y / 16.0)
	return Rect2i(foot.x - half, foot.y - up, half * 2, up + 3)


## Why a house can't stand on this ground ("" when it can).
func _box_problem(box: Rect2i, land: Dictionary, rim: Dictionary, roads: Dictionary, taken: Dictionary) -> String:
	for y in range(box.position.y, box.end.y):
		for x in range(box.position.x, box.end.x):
			var c := Vector2i(x, y)
			if taken.has(c):
				return "taken"
			if roads.has(c):
				return "road"
			if not land.has(c) or int(rim.get(c, 0)) < 2:
				return "coast"
	return ""


## The nearest road cell to c within r tiles ((-1, -1): none).
static func _nearest_road(c: Vector2i, roads: Dictionary, r: int) -> Vector2i:
	var best := Vector2i(-1, -1)
	var dist := INF
	for dy in range(-r, r + 1):
		for dx in range(-r, r + 1):
			var o := c + Vector2i(dx, dy)
			if roads.has(o) and dy >= -1:
				var d := Vector2(dx, dy).length()
				if d < dist:
					dist = d
					best = o
	return best


## How many rows below the house's foot the road is (-1: none near).
static func _road_below(foot: Vector2i, roads: Dictionary) -> int:
	for d in range(3, 9):
		if roads.has(Vector2i(foot.x, foot.y + d)) or roads.has(Vector2i(foot.x - 1, foot.y + d)):
			return d
	return -1


## A free spot right beside the road near p (tiles), for a lantern.
func _beside_road(p: Vector2, roads: Dictionary, taken: Dictionary, land: Dictionary) -> Vector2:
	var c := Vector2i(p)
	for r in range(1, 6):
		for d in [Vector2i(r, -1), Vector2i(-r, -1), Vector2i(r, 1), Vector2i(-r, 1)]:
			var o: Vector2i = c + d
			if land.has(o) and not roads.has(o) and not taken.has(o):
				return Vector2(o.x * 16 + 8, o.y * 16 + 16)
	return Vector2(-1, -1)


## The farm: crops in rows in the fenced fields, a scarecrow, sacks; the horses in the paddock.
func _farm2(items: Node2D) -> void:
	var k := 0
	for f: Rect2i in FIELDS2:
		var row := 0
		for y in range(f.position.y, f.end.y, 2):
			var crop: String = CROPS[(k + row) % CROPS.size()]
			for x in range(f.position.x + 1, f.end.x - 1):
				if x == f.get_center().x and row == 1:
					continue
				_place(items, _scene_path(crop), Vector2(x * 16 + 8, (y + 1) * 16))
			row += 1
		_place(items, _scene_path("tarla_korkulugu"), Vector2(f.get_center().x * 16 + 8, (f.position.y + 3) * 16 + 2))
		var fence := Rect2(Vector2(f.position) * 16 - Vector2(12, 8), Vector2(f.size) * 16 + Vector2(24, 24))
		_fence(items, fence)
		_place(items, _scene_path("yem_cuvali"), Vector2(fence.position.x - 12, fence.end.y))
		_place(items, _scene_path("un_cuvali"), Vector2(fence.end.x + 12, fence.end.y))
		k += 3
	for h in [[Vector2(-48, -26), false], [Vector2(30, -14), true], [Vector2(-8, -52), true]]:
		_place(items, _scene_path("at"), PADDOCK_TARGET + h[0], h[1])


## Trees in clumps, bushes, flowers and stones over the open ground: never on a road, in a
## yard, on the farm, or right behind a house (a roof would cut it).
func _nature(items: Node2D, land: Dictionary, rim: Dictionary, roads: Dictionary, taken: Dictionary, houses: Array, rng: RandomNumberGenerator, trees: Array = TREE_SCENES, bushes: Array = BUSH_SCENES, small: Array = SMALL_SCENES) -> void:
	var near_road := {}
	for c: Vector2i in roads:
		for dy in range(-1, 2):
			for dx in range(-1, 2):
				near_road[c + Vector2i(dx, dy)] = true
	var behind: Array[Rect2] = []
	for h in houses:
		var foot: Vector2 = h[0]
		var size: Vector2 = h[1]
		behind.append(Rect2(foot + Vector2(-size.x - 32, -size.y - 110), Vector2(size.x * 2 + 64, size.y + 150)))
	var placed: Array[Vector2] = []
	var cells := land.keys()
	cells.sort()
	for i in range(cells.size() - 1, 0, -1):
		var j := rng.randi() % (i + 1)
		var t: Variant = cells[i]
		cells[i] = cells[j]
		cells[j] = t
	for c: Vector2i in cells:
		if int(rim.get(c, 0)) < 4 or near_road.has(c) or taken.has(c) or KEEP_AREA.has_point(c):
			continue
		var at := Vector2(c.x * 16 + 8, c.y * 16 + 16)
		if behind.any(func(r: Rect2): return r.has_point(at)):
			continue
		# Clumps: trees where a slow wave says so, elsewhere scattered bushes and flowers.
		var clump := sin(c.x * 0.31) + cos(c.y * 0.27) + sin((c.x + c.y) * 0.13)
		var tree := clump > 1.1
		var gap := 3.2 if tree else 4.5
		if placed.any(func(p: Vector2): return p.distance_to(at) < gap * 16):
			continue
		if not tree and rng.randf() < 0.55:
			continue
		var scene: String
		if tree:
			scene = trees[rng.randi() % trees.size()]
		elif rng.randf() < 0.45:
			scene = bushes[rng.randi() % bushes.size()]
		else:
			scene = small[rng.randi() % small.size()]
		_place(items, scene, at, rng.randf() < 0.5)
		placed.append(at)


## The old floating island's rim round the sides goes and only a few rows of cliff stay below
## the land; holes inside become grass.
## The island grows out to a wide, uneven oval (the old land stays); the old cliffs go, it's a
## real island now with a shore all round.
func _grow_island(root: GameMap, ground: TileMapLayer) -> void:
	var noise := FastNoiseLite.new()
	noise.seed = 31
	noise.frequency = 0.035
	for c in ground.get_used_cells():
		if ground.get_cell_source_id(c) != FLOORS and not KEEP_AREA.has_point(c):
			ground.erase_cell(c)
	for y in range(1, root.height - 1):
		for x in range(1, root.width - 1):
			var c := Vector2i(x, y)
			var d := ((Vector2(c) - ISLAND_CENTER) / ISLAND_RADII).length()
			if d <= 1.0 + noise.get_noise_2d(x, y) * ISLAND_WOBBLE * 2.0 and ground.get_cell_source_id(c) == -1:
				ground.set_cell(c, FLOORS, Vector2i(7, 10))
	# Smooth the coast (no single-tile spits or notches), and only the one island stays.
	var land := {}
	for c in ground.get_used_cells():
		if ground.get_cell_source_id(c) == FLOORS:
			land[c] = true
	for i in 3:
		var next := {}
		for y in range(1, root.height - 1):
			for x in range(1, root.width - 1):
				var c := Vector2i(x, y)
				var n := 0
				for dy in range(-1, 2):
					for dx in range(-1, 2):
						if land.has(c + Vector2i(dx, dy)):
							n += 1
				if n >= 5 or (KEEP_AREA.has_point(c) and land.has(c)):
					next[c] = true
		land = next
	var island := {}
	var queue: Array[Vector2i] = [Vector2i(ISLAND_CENTER)]
	island[queue[0]] = true
	var qi := 0
	while qi < queue.size():
		var c := queue[qi]
		qi += 1
		for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var o: Vector2i = c + d
			if land.has(o) and not island.has(o):
				island[o] = true
				queue.append(o)
	var grass: TileMapLayer = root.get_node("Cimen")
	for c in ground.get_used_cells():
		if ground.get_cell_source_id(c) == FLOORS and not island.has(c):
			ground.erase_cell(c)
			grass.erase_cell(c)
	for c: Vector2i in island:
		if ground.get_cell_source_id(c) == -1:
			ground.set_cell(c, FLOORS, Vector2i(7, 10))


func _trim_island(root: GameMap, ground: TileMapLayer) -> void:
	var floor_bottom := {}
	for c in ground.get_used_cells():
		if ground.get_cell_source_id(c) == FLOORS:
			floor_bottom[c.x] = maxi(int(floor_bottom.get(c.x, -1)), c.y)
	for c in ground.get_used_cells():
		if ground.get_cell_source_id(c) == FLOORS:
			continue
		var below: bool = c.y > int(floor_bottom.get(c.x, 1 << 20))
		if not below or c.y > int(floor_bottom.get(c.x, -100)) + CLIFF_ROWS:
			ground.erase_cell(c)


## Cells inside the island that aren't ground (under the old buildings, or emptied) become earth:
## only what the map's edge reaches is sea.
func _fill_holes(root: GameMap, ground: TileMapLayer) -> void:
	var outside := {}
	var queue: Array[Vector2i] = []
	for y in root.height:
		for x in root.width:
			var c := Vector2i(x, y)
			if (x == 0 or y == 0 or x == root.width - 1 or y == root.height - 1) and ground.get_cell_source_id(c) != FLOORS:
				outside[c] = true
				queue.append(c)
	var i := 0
	while i < queue.size():
		var c := queue[i]
		i += 1
		for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var o: Vector2i = c + d
			if o.x >= 0 and o.y >= 0 and o.x < root.width and o.y < root.height and ground.get_cell_source_id(o) != FLOORS and not outside.has(o):
				outside[o] = true
				queue.append(o)
	for y in root.height:
		for x in root.width:
			var c := Vector2i(x, y)
			if ground.get_cell_source_id(c) != FLOORS and not outside.has(c):
				ground.set_cell(c, FLOORS, Vector2i(7, 10))


# ---- The village on a grid --------------------------------------------------------------

## The island: a rectangle (the pack's shore round it, its corners its own rounded ones).
const GRID_ISLAND := Rect2i(12, 1, 135, 127)
## Straight roads (tiles): the avenue from the keep, the main road east-west, the avenue south,
## the street before the keep's houses, the street before the southern houses, the stable lane.
const GRID_ROADS := [
	Rect2i(73, 28, 4, 21), Rect2i(15, 58, 47, 4), Rect2i(88, 58, 47, 4), Rect2i(73, 74, 4, 51),
	Rect2i(44, 39, 63, 3), Rect2i(15, 84, 120, 3), Rect2i(77, 111, 34, 3),
]
## Houses: [NPC, kind, mirrored, foot (tile; the house's middle, its front wall's foot)]. Each
## faces the road just below its yard.
const GRID_VILLAGE := [
	["alchemist", 1, false, Vector2i(51, 36)], ["sage", 3, true, Vector2i(99, 36)],
	["scribe", 8, false, Vector2i(23, 55)], ["storekeeper", 2, false, Vector2i(39, 55)], ["blacksmith", 6, false, Vector2i(54, 55)],
	["weaponsmith", 5, true, Vector2i(97, 55)], ["armorer", 4, true, Vector2i(112, 55)], ["jeweler", 1, true, Vector2i(127, 55)],
	["craftsman", 3, false, Vector2i(23, 81)], ["cook", 1, false, Vector2i(54, 81)],
	["barber", 4, true, Vector2i(97, 81)], ["pet_keeper", 2, true, Vector2i(127, 81)],
	["stable_master", 7, false, Vector2i(104, 108)],
]
## Where a house's door is, from its middle (px; the log houses' doors are off to one side).
const DOOR_X := {7: 36, 8: -40}
## The log houses' trades, placed clear of their doors (unmirrored offsets from the foot).
const TRADES_LOG := {
	"scribe": [["masa", Vector2(40, 22), [["kitap", Vector2(-8, -18)], ["kalem", Vector2(10, -18)]]], ["kavanoz_2", Vector2(76, 20)]],
	"stable_master": [["un_cuvali", Vector2(-40, 20)], ["yem_cuvali", Vector2(-60, 20)]],
}
const GRID_FIELDS := [Rect2i(20, 98, 18, 4), Rect2i(114, 98, 17, 4)]
const GRID_PADDOCK := Vector2(1440, 1696)


func _grid() -> void:
	var path := "res://maps/town.tscn"
	var root: GameMap = load(path).instantiate()
	var ground: TileMapLayer = root.get_node("Zemin")
	var grass: TileMapLayer = root.get_node("Cimen")
	var items: Node2D = root.get_node("Esyalar")
	var rng := RandomNumberGenerator.new()
	rng.seed = 2026

	# The island: the rectangle is land, everything outside it sea (the keep keeps its ground).
	for c in ground.get_used_cells():
		if KEEP_AREA.has_point(c) and GRID_ISLAND.has_point(c):
			continue
		if not GRID_ISLAND.has_point(c) or ground.get_cell_source_id(c) != FLOORS:
			ground.erase_cell(c)
	for c in grass.get_used_cells():
		if not GRID_ISLAND.has_point(c):
			grass.erase_cell(c)
	var land := {}
	for y in range(GRID_ISLAND.position.y, GRID_ISLAND.end.y):
		for x in range(GRID_ISLAND.position.x, GRID_ISLAND.end.x):
			var c := Vector2i(x, y)
			land[c] = true
			if ground.get_cell_source_id(c) == -1:
				ground.set_cell(c, FLOORS, Vector2i(7, 10))
	var rim := _rim_distance(land)

	var mark := func(r: Rect2i, d: Dictionary) -> void:
		for y in range(r.position.y, r.end.y):
			for x in range(r.position.x, r.end.x):
				d[Vector2i(x, y)] = true
	var roads := {}
	for r: Rect2i in GRID_ROADS:
		mark.call(r, roads)
	for c in roads.keys():
		if GARDEN_BOX.has_point(c):
			roads.erase(c)
	var taken := {}
	mark.call(GARDEN_BOX.grow(1), taken)
	mark.call(KEEP_AREA, taken)
	for f in GRID_FIELDS:
		mark.call(f.grow(2), taken)
	var paddock := Rect2i(Vector2i(GRID_PADDOCK / 16) - Vector2i(6, 8), Vector2i(12, 10))
	mark.call(paddock, taken)

	# Houses, each with a straight path from its door down to the road.
	var spots := {}
	for s: MapSpot in root.find_children("*", "MapSpot", true, false):
		spots[s.kind + ":" + s.ref] = s
	var houses := []
	for v in GRID_VILLAGE:
		var kind: int = v[1]
		var size: Vector2 = HOUSE_SIZE[kind]
		var foot: Vector2i = v[3]
		var box := _grid_box(foot, size)
		var bad := _box_problem(box, land, rim, roads, taken)
		if not bad.is_empty():
			push_error("%s's house: %s" % [v[0], bad])
		mark.call(box.grow(1), taken)
		var s := -1 if v[2] else 1
		var door_px: float = foot.x * 16 + int(DOOR_X.get(kind, 0)) * s
		var x0 := roundi(door_px / 16.0) - 1
		var y := foot.y
		while not roads.has(Vector2i(x0, y)) and y < foot.y + 12:
			roads[Vector2i(x0, y)] = true
			roads[Vector2i(x0 + 1, y)] = true
			y += 1
		houses.append([Vector2(foot * 16), size, v[2], v[0], kind, door_px])

	if OS.get_cmdline_user_args().has("mask"):
		_save_mask(land, rim, roads, taken, houses)

	# Ground: roads and fields earth, the rest grass.
	var dirt := [Vector2i(6, 10), Vector2i(7, 10), Vector2i(8, 10)]
	var earth := roads.duplicate()
	for f in GRID_FIELDS:
		mark.call(f, earth)
	# A beach of earth all round, the grass easing into it.
	for c: Vector2i in land:
		if int(rim.get(c, 0)) <= 2:
			earth[c] = true
	for c: Vector2i in land:
		if KEEP_AREA.has_point(c) and ground.get_cell_source_id(c) != FLOORS:
			continue
		var x := ground.get_cell_atlas_coords(c).x
		if earth.has(c) or x >= 15:
			ground.set_cell(c, FLOORS, dirt[rng.randi() % dirt.size()])
		if earth.has(c):
			grass.erase_cell(c)
		else:
			grass.set_cell(c, FLOORS, Vector2i(2, 10))
	var edge: TileMapLayer = root.get_node_or_null("CimenKenari")
	if edge:
		edge.clear()

	# Everything old goes but the keep's woods and the paddock (moved).
	var removed := 0
	for n in items.get_children():
		var scene: String = n.scene_file_path
		if scene.is_empty():
			items.remove_child(n)
			n.free()
			continue
		if PADDOCK.any(func(p): return scene.begins_with(p)):
			n.position += GRID_PADDOCK - Vector2(1481, 1369)
			continue
		var cell := Vector2i(floori(n.position.x / 16), floori((n.position.y - 1) / 16))
		if KEEP_AREA.has_point(cell) and (scene.contains("/doga/") or scene.contains("/agac_") or scene.contains("ic_kale")):
			continue
		items.remove_child(n)
		n.free()
		removed += 1

	# The houses, their NPCs by the door, their trades, a lantern to the right of each.
	for h in houses:
		var foot: Vector2 = h[0]
		var size: Vector2 = h[1]
		var flip: bool = h[2]
		var npc_id: String = h[3]
		var kind: int = h[4]
		var door_px: float = h[5]
		var s := -1.0 if flip else 1.0
		_place(items, "res://props/ev/ev_%d.tscn" % kind, foot, flip)
		_place(items, EXISTING.lamba, foot + Vector2(s * (size.x + 16), 12), flip)
		var npc: MapSpot = spots.get("npc:" + npc_id)
		var off_door := door_px - foot.x
		if npc:
			if absf(off_door) < 1.0:
				npc.position = foot + Vector2(-24 * s, 18)
			else:
				npc.position = Vector2(door_px + 24 * signf(off_door), foot.y + 18)
		var trades: Array = TRADES_LOG.get(npc_id, TRADES.get(npc_id, []))
		for t in trades:
			var off: Vector2 = t[1]
			var node := _place(items, _scene_path(t[0]), foot + Vector2(off.x * s, off.y), flip)
			if t.size() > 2:
				for on in t[2]:
					var item: Node2D = load(_scene_path(on[0])).instantiate()
					item.position = on[1]
					node.add_child(item, true)
	# Lanterns at the roads' ends.
	for r: Rect2i in GRID_ROADS:
		var horiz := r.size.x > r.size.y
		var ends := [Vector2(r.position.x - 1, r.position.y - 1), Vector2(r.end.x, r.position.y - 1)] if horiz else [Vector2(r.position.x - 1, r.end.y - 1), Vector2(r.end.x, r.end.y - 1)]
		for e: Vector2 in ends:
			var c := Vector2i(e)
			if land.has(c) and int(rim.get(c, 0)) >= 3 and not taken.has(c) and not roads.has(c):
				_place(items, EXISTING.lamba, Vector2(c.x * 16 + 8, c.y * 16 + 16), c.x < r.get_center().x)

	_garden(root, items)
	_grid_farm(items)
	_nature(items, land, rim, roads, taken, houses, rng)
	_sea(root, ground)

	var door: MapSpot = spots.get("portal:town_keep_door")
	if door:
		door.position = KEEP_DOOR
	for id in KEEP_GUARDS:
		var guard: MapSpot = spots.get("npc:" + id)
		if guard:
			guard.position = KEEP_GUARDS[id]
	for id in ARRIVALS:
		var at: MapSpot = spots.get("arrival:" + id)
		if at == null:
			at = MapSpot.new()
			at.kind = "arrival"
			at.ref = id
			at.name = String(id).to_pascal_case()
			root.get_node("Noktalar").add_child(at, true)
		at.position = ARRIVALS[id]
	var arena: MapSpot = spots.get("portal:pvp_arena_entrance")
	if arena:
		arena.position = Vector2(20 * 16, 60 * 16)

	for n in root.get_children():
		_own(n, root)
	var packed := PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, path)
	root.free()
	print("grid village: %d old props gone, %d houses" % [removed, houses.size()])


## A house's ground: its walls and roof, the lantern to its side, and its yard (3 rows).
static func _grid_box(foot: Vector2i, size: Vector2) -> Rect2i:
	var half := ceili((size.x + 28.0) / 16.0)
	var up := ceili(size.y / 16.0)
	return Rect2i(foot.x - half, foot.y - up, half * 2, up + 3)


func _grid_farm(items: Node2D) -> void:
	var k := 0
	for f: Rect2i in GRID_FIELDS:
		var row := 0
		for y in range(f.position.y, f.end.y, 2):
			var crop: String = CROPS[(k + row) % CROPS.size()]
			for x in range(f.position.x + 1, f.end.x - 1):
				if x == f.get_center().x and row == 1:
					continue
				_place(items, _scene_path(crop), Vector2(x * 16 + 8, (y + 1) * 16))
			row += 1
		_place(items, _scene_path("tarla_korkulugu"), Vector2(f.get_center().x * 16 + 8, (f.position.y + 3) * 16 + 2))
		var fence := Rect2(Vector2(f.position) * 16 - Vector2(12, 8), Vector2(f.size) * 16 + Vector2(24, 24))
		_fence(items, fence)
		_place(items, _scene_path("yem_cuvali"), Vector2(fence.position.x + 8, fence.end.y + 18))
		_place(items, _scene_path("un_cuvali"), Vector2(fence.end.x - 8, fence.end.y + 18))
		k += 3
	for h in [[Vector2(-48, -26), false], [Vector2(30, -14), true], [Vector2(-8, -52), true]]:
		_place(items, _scene_path("at"), GRID_PADDOCK + h[0], h[1])


# ---- The hub: the Garden pack's square in the middle, everything round it ----------------

## The square, tile for tile as the Garden pack's own picture of it (tools/meydan.json, solved
## from that picture): ground layers, what stands over a walker, small things off the grid.
const MEYDAN_PLAN := "res://tools/meydan.json"
## The new map: bigger, the square's middle in its middle.
const HUB_SIZE := Vector2i(200, 184)
const HUB_PLAZA := Vector2i(88, 82)          # the square's top left cell (it is 25 x 25)
const HUB_CENTER := Vector2(1608, 1512)      # the square's middle (px)
const HUB_ISLAND_RADII := Vector2(88, 82)    # tiles
## Every NPC stands this far from the middle (tiles), the ring road just inside them.
const HUB_NPC_R := 49.0
const HUB_RING := Vector2(44.0, 46.6)
## The keep moves so its door is due north of the square, this far out (tiles).
const HUB_KEEP_R := 54.0
const HUB_GATE_R := 58.0
## [NPC, house kind, angle (degrees, counterclockwise from east)]: three or four to each quarter
## between the four roads out (north to the keep, east to the fields, south to the harbour, west
## to the arena).
const HUB_VILLAGE := [
	["sage", 3, 20.0], ["alchemist", 1, 38.0], ["scribe", 8, 56.0],
	["craftsman", 7, 124.0], ["storekeeper", 2, 142.0], ["jeweler", 4, 160.0],
	["blacksmith", 6, 202.0], ["weaponsmith", 5, 225.0], ["armorer", 3, 248.0],
	["stable_master", 7, 288.0], ["pet_keeper", 2, 308.0], ["barber", 5, 328.0], ["cook", 1, 346.0],
]
const HUB_FIELDS := [Rect2i(18, 112, 16, 4), Rect2i(66, 158, 16, 4)]
## The Garden pack's grass (its plain tiles), trees and smaller things, all over the island.
const HUB_GRASS := [Vector2i(0, 1), Vector2i(1, 1), Vector2i(2, 1), Vector2i(3, 1), Vector2i(4, 1), Vector2i(5, 1), Vector2i(6, 1), Vector2i(7, 1), Vector2i(0, 2), Vector2i(1, 2), Vector2i(2, 2), Vector2i(3, 2), Vector2i(4, 2), Vector2i(5, 2), Vector2i(6, 2), Vector2i(7, 2), Vector2i(1, 4), Vector2i(2, 4), Vector2i(1, 5), Vector2i(2, 5)]
const HUB_TREES := ["res://props/meydan/servi_buyuk.tscn", "res://props/meydan/servi_buyuk.tscn", "res://props/meydan/servi_sutun.tscn"]
const HUB_BUSHES := ["res://props/meydan/topiary.tscn"]
const HUB_SMALL := ["res://props/garden/cicek_mavi.tscn", "res://props/garden/cicek_pembe.tscn", "res://props/garden/cicek_kirmizi.tscn", "res://props/garden/cicek_beyaz.tscn", "res://props/garden/kaya.tscn"]
## The trades' big working stations (80 px wide); the rest are small things.
const BIG_STATIONS := ["ors_buyuk", "bicki", "simya_buyuk", "mutfak", "sis_mangal"]
const HUB_PADDOCK := Vector2(2160, 2560)


## The square's tiles in the Garden source: what each is, whether it blocks.
func _meydan_tiles() -> void:
	var plan: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(MEYDAN_PLAN))
	var set: TileSet = load(TILESET)
	var g: TileSetAtlasSource = set.get_source(GARDEN_SOURCE)
	var made := 0
	for t in plan.tiles:
		var c := Vector2i(int(t.atlas[0]), int(t.atlas[1]))
		if not g.has_tile(c):
			g.create_tile(c)
			made += 1
		var d := g.get_tile_data(c, 0)
		d.set_custom_data("tile", int(t.tile))
		while d.get_collision_polygons_count(0) > 0:
			d.remove_collision_polygon(0, 0)
		if bool(t.block):
			d.add_collision_polygon(0)
			d.set_collision_polygon_points(0, 0, PackedVector2Array([Vector2(-8, -8), Vector2(8, -8), Vector2(8, 8), Vector2(-8, 8)]))
	# The beach of before is gone (the shore pack's own edge is enough).
	if set.has_source(17):
		set.remove_source(17)
	for c in HUB_GRASS:
		if not g.has_tile(c):
			g.create_tile(c)
			made += 1
		g.get_tile_data(c, 0).set_custom_data("tile", 0)
	ResourceSaver.save(set, TILESET)
	print("square tiles: %d new, %d in all" % [made, plan.tiles.size()])


func _hub() -> void:
	var path := "res://maps/town.tscn"
	var root: GameMap = load(path).instantiate()
	var ground: TileMapLayer = root.get_node("Zemin")
	var grass: TileMapLayer = root.get_node("Cimen")
	var items: Node2D = root.get_node("Esyalar")
	var rng := RandomNumberGenerator.new()
	rng.seed = 2026
	root.width = HUB_SIZE.x
	root.height = HUB_SIZE.y
	var c_tile := HUB_CENTER / 16.0
	var keep_shift := Vector2(HUB_CENTER.x, HUB_CENTER.y - HUB_KEEP_R * 16) - KEEP_DOOR
	var keep_box := Rect2i(Vector2i((Vector2(KEEP_AREA.position) + keep_shift / 16).round()), KEEP_AREA.size)

	# The island: a wide oval with a wavering coast round the square (and the keep on it).
	ground.clear()
	grass.clear()
	for name in ["Bahce", "CimenKenari"]:
		var l: TileMapLayer = root.get_node_or_null(name)
		if l:
			l.clear()
	var noise := FastNoiseLite.new()
	noise.seed = 31
	noise.frequency = 0.03
	var land := {}
	for y in range(1, HUB_SIZE.y - 1):
		for x in range(1, HUB_SIZE.x - 1):
			var d := ((Vector2(x, y) + Vector2(0.5, 0.5) - c_tile) / HUB_ISLAND_RADII).length()
			if d <= 1.0 + noise.get_noise_2d(x, y) * 0.06:
				land[Vector2i(x, y)] = true
	for i in 3:
		var next := {}
		for y in range(1, HUB_SIZE.y - 1):
			for x in range(1, HUB_SIZE.x - 1):
				var c := Vector2i(x, y)
				var n := 0
				for dy in range(-1, 2):
					for dx in range(-1, 2):
						if land.has(c + Vector2i(dx, dy)):
							n += 1
				if n >= 5:
					next[c] = true
		land = next
	for c: Vector2i in land:
		ground.set_cell(c, FLOORS, Vector2i(7, 10))
	var rim := _rim_distance(land)

	var mark := func(r: Rect2i, d: Dictionary) -> void:
		for y in range(r.position.y, r.end.y):
			for x in range(r.position.x, r.end.x):
				d[Vector2i(x, y)] = true
	var plaza := Rect2i(HUB_PLAZA, Vector2i(25, 25))
	var taken := {}
	mark.call(plaza.grow(3), taken)
	mark.call(keep_box, taken)
	for f in HUB_FIELDS:
		mark.call(f.grow(2), taken)
	var paddock := Rect2i(Vector2i(HUB_PADDOCK / 16) - Vector2i(6, 8), Vector2i(12, 10))
	mark.call(paddock, taken)

	# Roads: the ring, and the four out of it (north to the keep's door, west and east from the
	# square's cross path, south from the ring to the harbour gate).
	var roads := {}
	for c: Vector2i in land:
		var r := (Vector2(c) + Vector2(0.5, 0.5) - c_tile).length()
		if r >= HUB_RING.x and r <= HUB_RING.y:
			roads[c] = true
	var px := HUB_PLAZA.x
	var py := HUB_PLAZA.y
	var door_y := int(HUB_CENTER.y / 16 - HUB_KEEP_R)
	mark.call(Rect2i(px + 11, door_y, 3, py - door_y), roads)
	var gate := int(HUB_GATE_R)
	mark.call(Rect2i(px + 12 - gate, py + 12, gate - 12, 2), roads)
	mark.call(Rect2i(px + 25, py + 12, gate - 13, 2), roads)
	mark.call(Rect2i(px + 11, py + 12 + int(HUB_RING.x), 3, gate - int(HUB_RING.x) + 1), roads)
	for c in roads.keys():
		if plaza.has_point(c) or not land.has(c):
			roads.erase(c)

	# The houses: each NPC stands on the circle, its house just beyond (outwards from the square),
	# its trade's things beside it.
	var spots := {}
	for s: MapSpot in root.find_children("*", "MapSpot", true, false):
		spots[s.kind + ":" + s.ref] = s
	var houses := []
	var stalls := []
	var house_cells := {}
	# What the trades' things may not stand on: the square, the keep, the farm, the houses
	# themselves (not the room round them).
	var open_taken := taken.duplicate()
	# Each NPC's stall: along the ring to both sides of it, kept free of houses.
	var stalls_ground := {}
	for v in HUB_VILLAGE:
		var a0 := deg_to_rad(float(v[2]))
		var d0 := Vector2(cos(a0), -sin(a0))
		var n0 := HUB_CENTER + d0 * HUB_NPC_R * 16
		var t0 := Vector2(-d0.y, d0.x)
		for k in range(-16, 17):
			for o in [-0.6, 0.0, 0.7]:
				stalls_ground[Vector2i((n0 + t0 * k * 8 + d0 * o * 16) / 16)] = true
	for v in HUB_VILLAGE:
		var kind: int = v[1]
		var size: Vector2 = HOUSE_SIZE[kind]
		var a := deg_to_rad(float(v[2]))
		var dir := Vector2(cos(a), -sin(a))
		var npc_at := (HUB_CENTER + dir * HUB_NPC_R * 16).round()
		# The house goes straight out from the NPC, as close as it fits (nudged sideways if need be).
		var best := Vector2(-1, -1)
		var side := Vector2(-dir.y, dir.x)
		for k in range(3, 20):
			for t in [0, 1, -1, 2, -2, 3, -3]:
				var centre: Vector2 = npc_at + dir * k * 16 + side * t * 16
				var foot: Vector2 = (Vector2(centre.x, centre.y + size.y / 2) / 16).round() * 16
				var box := _hub_box(Vector2i(foot / 16), size)
				if box.has_point(Vector2i(npc_at / 16)) or not _box_problem(box, land, rim, roads, taken).is_empty() or not _box_problem(box, land, rim, {}, stalls_ground).is_empty():
					continue
				best = foot
				break
			if best.x >= 0:
				break
		if best.x < 0:
			push_error("no room for %s's house" % v[0])
			continue
		mark.call(_hub_box(Vector2i(best / 16), size).grow(1), taken)
		mark.call(_hub_box(Vector2i(best / 16), size), house_cells)
		var flip: bool = dir.x > 0.15
		houses.append([best, size, flip, v[0], kind, npc_at])
		# The door's path down to the road when the door faces it.
		if best.y < npc_at.y:
			var s := -1 if flip else 1
			var door_x := best.x + int(DOOR_X.get(kind, 0)) * s
			var x0 := roundi(door_x / 16.0) - 1
			var y := int(best.y / 16)
			while not roads.has(Vector2i(x0, y)) and y < int(best.y / 16) + 14:
				roads[Vector2i(x0, y)] = true
				roads[Vector2i(x0 + 1, y)] = true
				y += 1

	if OS.get_cmdline_user_args().has("mask"):
		_save_hub_mask(land, rim, roads, taken, houses)

	# Ground: the light grass of the Floors tiles everywhere (the shore pack's green matches it),
	# the Garden paving on the roads (running on into the square's own paths), earth in the fields.
	var dirt := [Vector2i(6, 10), Vector2i(7, 10), Vector2i(8, 10)]
	var fields := {}
	for f in HUB_FIELDS:
		mark.call(f, fields)
	for c: Vector2i in land:
		ground.set_cell(c, FLOORS, dirt[rng.randi() % dirt.size()])
		# Under the roads too: the paving's soft edges are see-through and sit on grass.
		if not fields.has(c):
			grass.set_cell(c, FLOORS, Vector2i(2, 10))
	var paving: TileMapLayer = root.get_node_or_null("Yol")
	if paving == null:
		paving = TileMapLayer.new()
		paving.name = "Yol"
		paving.tile_set = load(TILESET)
		paving.z_index = -8
		root.add_child(paving)
		root.move_child(paving, grass.get_index() + 1)
	paving.clear()
	var joined := roads.duplicate()
	for k in 25:
		for c in [Vector2i(px + 11, py + k), Vector2i(px + 12, py + k), Vector2i(px + 13, py + k), Vector2i(px + k, py + 12), Vector2i(px + k, py + 13)]:
			if k < 2 or k > 22:
				joined[c] = true
	var blobs: Array = DT._blob_masks()
	for c: Vector2i in roads:
		var m := 0
		for k in 8:
			if joined.has(c + DT.DIRS[k]):
				m |= 1 << k
		paving.set_cell(c, PATH_SOURCE, Vector2i(blobs.find(DT._normalize(m)), 0))

	# Everything old goes but the keep (moved) and the paddock (moved).
	for n in items.get_children():
		var scene: String = n.scene_file_path
		var keep := false
		if PADDOCK.any(func(p): return scene.begins_with(p)):
			n.position += HUB_PADDOCK - Vector2(1481, 1369)
			keep = true
		elif not scene.is_empty():
			var cell := Vector2i(floori(n.position.x / 16), floori((n.position.y - 1) / 16))
			if KEEP_AREA.has_point(cell) and scene.contains("ic_kale"):
				n.position += keep_shift
				keep = true
		if not keep:
			items.remove_child(n)
			n.free()

	_build_meydan(root, items)

	for h in houses:
		var foot: Vector2 = h[0]
		var size: Vector2 = h[1]
		var flip: bool = h[2]
		var npc_id: String = h[3]
		var npc_at: Vector2 = h[5]
		var s := -1.0 if flip else 1.0
		_place(items, "res://props/ev/ev_%d.tscn" % h[4], foot, flip)
		_place(items, EXISTING.lamba, foot + Vector2(s * (size.x + 16), 12), flip)
		# Off the door's path (still on the circle).
		for step in [0.0, 28.0, -28.0, 44.0, -44.0]:
			var at: Vector2 = HUB_CENTER + (npc_at + Vector2(-(npc_at - HUB_CENTER).normalized().y, (npc_at - HUB_CENTER).normalized().x) * step - HUB_CENTER).normalized() * HUB_NPC_R * 16
			if _clear_ground(Rect2(at - Vector2(10, 12), Vector2(20, 14)), land, rim, roads, {}):
				npc_at = at.round()
				break
		var npc: MapSpot = spots.get("npc:" + npc_id)
		if npc:
			npc.position = npc_at
		for yy in range(floori((npc_at.y - 24) / 16), floori((npc_at.y + 56) / 16) + 1):
			for xx in range(floori((npc_at.x - 24) / 16), floori((npc_at.x + 24) / 16) + 1):
				taken[Vector2i(xx, yy)] = true
		# The trade's things round the NPC, along the ring to its sides (or out behind it): never on
		# a road, a house, or each other.
		var dir: Vector2 = (npc_at - HUB_CENTER).normalized()
		var along := Vector2(-dir.y, dir.x)
		if along.x < 0 or (absf(along.x) < 0.01 and along.y > 0):
			along = -along
		var placed: Array[Rect2] = [Rect2(npc_at - Vector2(12, 20), Vector2(24, 24))]
		for t in TRADES.get(npc_id, []):
			var off: Vector2 = t[1]
			var half := 40.0 if String(t[0]) in BIG_STATIONS else 18.0
			var spot := Vector2.INF
			for d in [40.0, 56.0, 72.0, 88.0, 104.0, 120.0]:
				for o in [0.0, -10.0, 14.0, 26.0]:
					var at: Vector2 = (npc_at + along * signf(off.x) * (d + half - 18.0) + dir * o).round()
					var area := Rect2(at - Vector2(half, 14), Vector2(half * 2, 18))
					if placed.any(func(r: Rect2): return r.intersects(area)) or not _clear_ground(area, land, rim, roads, open_taken) or not _clear_ground(area, land, rim, {}, house_cells):
						continue
					spot = at
					placed.append(area)
					break
				if spot != Vector2.INF:
					break
			if spot == Vector2.INF:
				push_warning("no room for %s's %s" % [npc_id, t[0]])
				continue
			for yy in range(floori((spot.y - 24) / 16), floori((spot.y + 56) / 16) + 1):
				for xx in range(floori((spot.x - half - 8) / 16), floori((spot.x + half + 8) / 16) + 1):
					taken[Vector2i(xx, yy)] = true
			var node := _place(items, _scene_path(t[0]), spot, off.x < 0)
			if t.size() > 2:
				for on in t[2]:
					var item: Node2D = load(_scene_path(on[0])).instantiate()
					item.position = on[1]
					node.add_child(item, true)
	# Lanterns round the ring road, between the houses.
	for k in 24:
		var a := TAU * (k + 0.5) / 24
		var at := HUB_CENTER + Vector2(cos(a), -sin(a)) * (HUB_RING.x - 1.2) * 16
		var cell := Vector2i(at / 16)
		if not roads.has(cell) and not taken.has(cell) and land.has(cell):
			_place(items, EXISTING.lamba, at.round(), cos(a) < 0)

	_grid_farm_at(items, HUB_FIELDS, HUB_PADDOCK)
	_nature(items, land, rim, roads, taken, houses, rng, HUB_TREES, HUB_BUSHES, HUB_SMALL)
	_sea(root, ground)

	# The keep's door and guards, the gates, where people arrive.
	var move := func(id: String, at: Vector2) -> void:
		var spot: MapSpot = spots.get(id)
		if spot:
			spot.position = at.round()
	move.call("portal:town_keep_door", KEEP_DOOR + keep_shift)
	for id in KEEP_GUARDS:
		move.call("npc:" + id, KEEP_GUARDS[id] + keep_shift)
	move.call("arrival:keep_hall_door", ARRIVALS.keep_hall_door + keep_shift)
	var west := Vector2(HUB_CENTER.x - HUB_GATE_R * 16, (py + 13) * 16)
	var east := Vector2(HUB_CENTER.x + HUB_GATE_R * 16, (py + 13) * 16)
	var south := Vector2(HUB_CENTER.x, HUB_CENTER.y + HUB_GATE_R * 16)
	move.call("portal:pvp_arena_entrance", west)
	move.call("arrival:pvp_exit", west + Vector2(48, 0))
	move.call("portal:town_field_gate", east)
	move.call("arrival:world_town_gate", east - Vector2(48, 0))
	move.call("npc:commander", east + Vector2(-72, -44))
	move.call("npc:guard_gate_north", east + Vector2(-24, -40))
	move.call("npc:guard_gate_south", east + Vector2(-24, 40))
	move.call("portal:town_harbor_gate", south)
	move.call("arrival:harbor_town_gate", south - Vector2(0, 48))
	for s: MapSpot in root.find_children("*", "MapSpot", true, false):
		if s.kind == "spawn" or s.name == "Dogus":
			s.position = Vector2((px + 12.5) * 16, (py + 7.5) * 16)

	for n in root.get_children():
		_own(n, root)
	var packed := PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, path)
	root.free()
	print("hub: %d houses" % houses.size())


## The square from its plan: its ground on tile layers; every thing on it (trees, statues, the
## fountain, benches, pedestals, the trellises and ruins) a prop of its own (props/meydan/), its
## sprite and hitbox, sorting with the characters. Rocks and lilies lie flat on the water.
func _build_meydan(root: GameMap, items: Node2D) -> void:
	var plan: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(MEYDAN_PLAN))
	for n in root.get_children():
		if String(n.name).begins_with("Meydan"):
			root.remove_child(n)
			n.free()
	var set: TileSet = load(TILESET)
	# Where the next layer goes (in an array: a lambda's own copy of a plain local wouldn't move on).
	var at := [root.get_node("Cimen").get_index() + 1]
	var make := func(name: String, entries: Array) -> void:
		var l := TileMapLayer.new()
		l.name = name
		l.tile_set = set
		l.z_index = -8
		for e in entries:
			l.set_cell(HUB_PLAZA + Vector2i(int(e[0]), int(e[1])), GARDEN_SOURCE, Vector2i(int(e[2]), int(e[3])))
		root.add_child(l)
		root.move_child(l, at[0])
		at[0] += 1
	var base := []
	for y in 25:
		for x in 25:
			base.append([x, y, 6, 2, false])
	make.call("MeydanTaban", base)
	var i := 0
	for layer in plan.ground:
		make.call("Meydan%d" % i, layer)
		i += 1
	var flat := Node2D.new()
	flat.name = "MeydanSu"
	flat.z_index = -7
	root.add_child(flat)
	root.move_child(flat, at[0])

	var scenes := {}
	for key in plan.defs:
		scenes[key] = _meydan_scene(String(key), plan.defs[key])
	var origin := Vector2(HUB_PLAZA * 16)
	for p in plan.props:
		var d: Dictionary = plan.defs[p.key]
		_place(flat if bool(d.flat) else items, scenes[p.key], origin + Vector2(float(p.x), float(p.y)), bool(p.flip))


## One of the square's things as a prop scene: its sprite standing on the node's point (the
## middle of its foot), and its hitbox.
func _meydan_scene(key: String, d: Dictionary) -> String:
	var path := "res://props/meydan/%s.tscn" % key
	var root := Node2D.new()
	root.name = key.to_pascal_case()
	var w := float(d.size[0])
	var h := float(d.size[1])
	var sprite := Sprite2D.new()
	sprite.name = "Gorsel"
	if d.has("png"):
		sprite.texture = load("res://assets/meydan/" + String(d.png))
	else:
		sprite.texture = load(PACK + GARDEN)
		sprite.region_enabled = true
		sprite.region_rect = Rect2(float(d.rect[0]), float(d.rect[1]), w, h)
	sprite.centered = false
	sprite.position = Vector2(-floorf(w / 2), -h)
	root.add_child(sprite)
	sprite.owner = root
	if not d.boxes.is_empty():
		var body := StaticBody2D.new()
		body.name = "Hitbox"
		body.collision_layer = WALK
		body.collision_mask = 0
		root.add_child(body)
		body.owner = root
		for b in d.boxes:
			var shape := CollisionShape2D.new()
			var rect := RectangleShape2D.new()
			rect.size = Vector2(float(b[2]), float(b[3]))
			shape.shape = rect
			shape.position = sprite.position + Vector2(float(b[0]), float(b[1])) + rect.size / 2
			body.add_child(shape)
			shape.owner = root
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://props/meydan"))
	var packed := PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, path)
	root.free()
	return path


## Whether nothing but open grass lies under this rect (px).
func _clear_ground(r: Rect2, land: Dictionary, rim: Dictionary, roads: Dictionary, taken: Dictionary) -> bool:
	for y in range(floori(r.position.y / 16), floori((r.end.y - 1) / 16) + 1):
		for x in range(floori(r.position.x / 16), floori((r.end.x - 1) / 16) + 1):
			var c := Vector2i(x, y)
			if not land.has(c) or int(rim.get(c, 0)) < 3 or roads.has(c) or taken.has(c):
				return false
	return true


## A house on the ring: its walls and roof and the lantern beside it (its trade stands by the NPC).
static func _hub_box(foot: Vector2i, size: Vector2) -> Rect2i:
	var half := ceili((size.x + 28.0) / 16.0)
	var up := ceili(size.y / 16.0)
	return Rect2i(foot.x - half, foot.y - up, half * 2, up + 2)


func _grid_farm_at(items: Node2D, fields: Array, paddock_at: Vector2) -> void:
	var k := 0
	for f: Rect2i in fields:
		var row := 0
		for y in range(f.position.y, f.end.y, 2):
			var crop: String = CROPS[(k + row) % CROPS.size()]
			for x in range(f.position.x + 1, f.end.x - 1):
				if x == f.get_center().x and row == 1:
					continue
				_place(items, _scene_path(crop), Vector2(x * 16 + 8, (y + 1) * 16))
			row += 1
		_place(items, _scene_path("tarla_korkulugu"), Vector2(f.get_center().x * 16 + 8, (f.position.y + 3) * 16 + 2))
		var fence := Rect2(Vector2(f.position) * 16 - Vector2(12, 8), Vector2(f.size) * 16 + Vector2(24, 24))
		_fence(items, fence)
		_place(items, _scene_path("yem_cuvali"), Vector2(fence.position.x + 8, fence.end.y + 18))
		_place(items, _scene_path("un_cuvali"), Vector2(fence.end.x - 8, fence.end.y + 18))
		k += 3
	for h in [[Vector2(-48, -26), false], [Vector2(30, -14), true], [Vector2(-8, -52), true]]:
		_place(items, _scene_path("at"), paddock_at + h[0], h[1])


func _save_hub_mask(land: Dictionary, rim: Dictionary, roads: Dictionary, taken: Dictionary, houses: Array) -> void:
	var img := Image.create(HUB_SIZE.x, HUB_SIZE.y, false, Image.FORMAT_RGB8)
	img.fill(Color(0.2, 0.4, 0.8))
	for c: Vector2i in land:
		var col := Color(0.3, 0.7, 0.3) if int(rim.get(c, 0)) >= 2 else Color(0.9, 0.9, 0.3)
		if taken.has(c):
			col = Color(0.5, 0.5, 0.5)
		if roads.has(c):
			col = Color(0.5, 0.3, 0.1)
		img.set_pixelv(c, col)
	for h in houses:
		img.set_pixelv(Vector2i(h[0] / 16), Color(1, 0, 0))
		img.set_pixelv(Vector2i(h[5] / 16), Color(1, 1, 1))
	img.resize(HUB_SIZE.x * 3, HUB_SIZE.y * 3, Image.INTERPOLATE_NEAREST)
	img.save_png("user://hub_mask.png")
	print("mask: ", ProjectSettings.globalize_path("user://hub_mask.png"))
