extends SceneTree

## Smooth grass edges with the pack's transition tiles (Floors_Tiles, TileSet source 3).
##   -- tileset        give the grass / dirt blocks of Floors_Tiles Godot terrains (terrain set 0,
##                     "Match Corners and Sides"), peering bits read from the pictures, so the
##                     TileMap editor's Terrains tab paints edges by itself
##   -- map <zone>     redo a map's floor that way: dirt (or stone) under everything, the grass on
##                     its own "Cimen" layer, every grass cell the piece that fits its neighbours
## A grass cell's side or corner counts as grass when the cell(s) there are grass or off the
## island (the island's rim stays grass; only roads and squares cut into it).

const TILESET := "res://tilesets/zemin.tres"
const FLOORS := 3
## Terrain blocks of Floors_Tiles: [first column, name, colour, full tiles].
const BLOCKS := [
	[0, "Çimen", Color(0.3, 0.6, 0.2), [Vector2i(1, 10), Vector2i(2, 10), Vector2i(3, 10)]],
	[5, "Toprak yol", Color(0.55, 0.45, 0.35), [Vector2i(6, 10), Vector2i(7, 10), Vector2i(8, 10)]],
	[10, "Turuncu toprak", Color(0.7, 0.45, 0.25), [Vector2i(11, 10), Vector2i(12, 10), Vector2i(13, 10)]],
]
## The 8 neighbours in the order the bits are kept, and Godot's names for them.
const DIRS := [Vector2i(0, -1), Vector2i(1, -1), Vector2i(1, 0), Vector2i(1, 1), Vector2i(0, 1), Vector2i(-1, 1), Vector2i(-1, 0), Vector2i(-1, -1)]
const PEERS := [
	TileSet.CELL_NEIGHBOR_TOP_SIDE, TileSet.CELL_NEIGHBOR_TOP_RIGHT_CORNER, TileSet.CELL_NEIGHBOR_RIGHT_SIDE,
	TileSet.CELL_NEIGHBOR_BOTTOM_RIGHT_CORNER, TileSet.CELL_NEIGHBOR_BOTTOM_SIDE, TileSet.CELL_NEIGHBOR_BOTTOM_LEFT_CORNER,
	TileSet.CELL_NEIGHBOR_LEFT_SIDE, TileSet.CELL_NEIGHBOR_TOP_LEFT_CORNER,
]


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args[0] == "tileset":
		_tileset()
	else:
		_map(args[1])
	quit()


## Bits of a tile from its picture: which of its 8 border spots (and its middle) are covered.
static func tile_bits(img: Image, coords: Vector2i) -> int:
	var spots := [Vector2i(6, 0), Vector2i(12, 0), Vector2i(12, 6), Vector2i(12, 12), Vector2i(6, 12), Vector2i(0, 12), Vector2i(0, 6), Vector2i(0, 0)]
	var bits := 0
	for k in 8:
		if _covered(img, coords * 16 + spots[k], 4):
			bits |= 1 << k
	if _covered(img, coords * 16 + Vector2i(6, 6), 4):
		bits |= 1 << 8
	return bits


static func _covered(img: Image, at: Vector2i, size: int) -> bool:
	var n := 0
	for y in size:
		for x in size:
			if img.get_pixel(at.x + x, at.y + y).a > 0.5:
				n += 1
	return n * 2 >= size * size


## Every tile of each terrain block with its bits: block index -> [[coords, bits]].
static func block_tiles(source: TileSetAtlasSource) -> Array:
	var img := source.texture.get_image()
	img.decompress()
	var out := []
	for b in BLOCKS:
		var list := []
		for y in 12:
			for x in range(b[0], b[0] + 5):
				var c := Vector2i(x, y)
				if not source.has_tile(c):
					continue
				var bits := tile_bits(img, c)
				if bits & (1 << 8):
					list.append([c, normalize(bits & 255)])
		out.append(list)
	return out


func _tileset() -> void:
	var set: TileSet = load(TILESET)
	while set.get_terrain_sets_count() > 0:
		set.remove_terrain_set(0)
	set.add_terrain_set()
	set.set_terrain_set_mode(0, TileSet.TERRAIN_MODE_MATCH_CORNERS_AND_SIDES)
	for i in BLOCKS.size():
		set.add_terrain(0)
		set.set_terrain_name(0, i, BLOCKS[i][1])
		set.set_terrain_color(0, i, BLOCKS[i][2])
	var source: TileSetAtlasSource = set.get_source(FLOORS)
	var tiles := block_tiles(source)
	var n := 0
	for i in BLOCKS.size():
		for entry in tiles[i]:
			var data := source.get_tile_data(entry[0], 0)
			data.terrain_set = 0
			data.terrain = i
			for k in 8:
				data.set_terrain_peering_bit(PEERS[k], i if entry[1] & (1 << k) else -1)
			# The plain tiles are picked; the darker ones (patchy as squares) only by hand.
			data.probability = 1.0 if entry[1] == 255 and entry[0].y == 10 else (0.0 if entry[1] == 255 else 1.0)
			n += 1
	ResourceSaver.save(set, TILESET)
	print("terrain tiles: ", n, " (", tiles.map(func(l): return l.size()), ")")


func _map(zone: String) -> void:
	var path := "res://maps/%s.tscn" % zone
	var root: GameMap = load(path).instantiate()
	var ground: TileMapLayer = root.get_node("Zemin")
	var source: TileSetAtlasSource = ground.tile_set.get_source(FLOORS)
	var grass_tiles: Array = block_tiles(source)[0]
	var land := {}
	var kind := {}  # cell -> "g" grass, "d" dirt, "s" stone
	for cell in ground.get_used_cells():
		if ground.get_cell_source_id(cell) != FLOORS:
			continue
		land[cell] = true
		var x := ground.get_cell_atlas_coords(cell).x
		kind[cell] = "g" if x <= 4 else ("s" if x >= 15 else "d")
	# Run again: the grass is on its own layer by then.
	var done: TileMapLayer = root.get_node_or_null("Cimen")
	if done:
		for cell in done.get_used_cells():
			if kind.has(cell):
				kind[cell] = "g"
	var rng := RandomNumberGenerator.new()
	rng.seed = 1015

	# Underneath: dirt everywhere on the island, the paving where it was.
	for cell in kind:
		if kind[cell] == "s":
			ground.set_cell(cell, FLOORS, Vector2i(16 + rng.randi() % 3, 1 + rng.randi() % 3))
		else:
			var full: Array = BLOCKS[1][3]
			ground.set_cell(cell, FLOORS, full[rng.randi() % full.size()])

	# The grass on top, each cell the piece that fits.
	var layer: TileMapLayer = root.get_node_or_null("Cimen")
	if layer == null:
		layer = TileMapLayer.new()
		layer.name = "Cimen"
		layer.tile_set = ground.tile_set
		layer.z_index = -9
		root.add_child(layer)
		root.move_child(layer, ground.get_index() + 1)
		layer.owner = root
	layer.clear()
	var is_grass := func(c: Vector2i) -> bool:
		return not land.has(c) or kind[c] == "g"
	var full_grass: Array = BLOCKS[0][3]
	var exact := 0
	var close := 0
	for cell in kind:
		if kind[cell] != "g":
			continue
		var want := 0
		for k in 8:
			if is_grass.call(cell + DIRS[k]):
				want |= 1 << k
		want = normalize(want)
		if want == 255:
			var pick: Vector2i = full_grass[rng.randi() % full_grass.size()]
			layer.set_cell(cell, FLOORS, pick)
			continue
		var best: Vector2i = full_grass[0]
		var best_score := -1
		var ties := []
		for entry in grass_tiles:
			if entry[1] == 255:
				continue
			var score := 8 - _popcount((entry[1] ^ want) & 255)
			if score > best_score:
				best_score = score
				ties = [entry[0]]
			elif score == best_score:
				ties.append(entry[0])
		best = ties[rng.randi() % ties.size()]
		if best_score == 8:
			exact += 1
		else:
			close += 1
		layer.set_cell(cell, FLOORS, best)

	# The hand-painted edge layers are replaced; plants painted as tiles stay.
	for name in ["CimenKenari", "TasKenari"]:
		var old: TileMapLayer = root.get_node_or_null(name)
		if old == null:
			continue
		for cell in old.get_used_cells():
			if old.get_cell_source_id(cell) == FLOORS:
				old.erase_cell(cell)
		if old.get_used_cells().is_empty():
			root.remove_child(old)
			old.free()
	print("grass edges: %d exact, %d nearest" % [exact, close])
	var packed := PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, path)
	print(MapExport.write(load(path).instantiate()), "shared/maps/%s.json written" % zone)
	root.free()


## A corner is only grass when both sides next to it are (otherwise it can't be told apart).
static func normalize(bits: int) -> int:
	for k in [1, 3, 5, 7]:
		if not (bits & (1 << (k - 1))) or not (bits & (1 << ((k + 1) % 8))):
			bits &= ~(1 << k)
	return bits


static func _popcount(v: int) -> int:
	var n := 0
	while v:
		n += v & 1
		v >>= 1
	return n
