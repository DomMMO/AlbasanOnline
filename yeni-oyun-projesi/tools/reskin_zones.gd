extends SceneTree

## Dresses the maps moved from the old TypeScript drawing (tools/migrate_map.gd) in the WORLD ELEMENT
## pack, the way Ana Merkez was:
##   -- scenes        pack trees (props/doga/agac_*, cam*), a campfire and a gravestone (props/koy)
##   -- tileset       adds to tilesets/zemin.tres: dungeon tiles (7), water (8), rock walls (9) and the
##                    old tiles nothing in the pack replaces yet (10), with collision and tile ids
##   -- map <zone>    the zone's floor, walls, water and forests in pack tiles and trees, grass
##                    edges smoothed, props swapped; tiles with no pack match stay as they were

const TILESET := "res://tilesets/zemin.tres"
const OLD_TILESET := "res://tilesets/eski_zemin.tres"
const FLOORS := 3
const DUNGEON := 7
const WATER := 8
const ROCK := 9
const OLD := 10
const PACK := "res://assetpack/WORLD ELEMENT/Environment/"
const WALK := 1
const BOTH := 3

## Tile ids (shared/src/map.ts).
enum { GRASS = 0, GRASS_ALT = 1, PATH = 2, WATER_T = 3, TREE = 4, FLOWER = 5, CAVE_FLOOR = 6, CAVE_WALL = 7, COBBLE = 8, PLAZA = 9, MARKET = 10, WALL = 11, SOLID = 12, DARK_GRASS = 13, BRIDGE = 14, WOOD_FLOOR = 15, WOOD_WALL = 16, SKY = 17, SAND = 18, RED_ROCK = 19, SNOW = 20, ICE = 21, SNOW_TREE = 22, LAVA = 23, ASH = 24, BLIGHT = 25, DEAD_TREE = 26, BOG = 27 }

const OUTDOOR := ["world", "forest", "pvp_arena", "canyon", "frost", "volcano", "kurgan"]
## Rock colour per zone: Wall_Tiles column of its top fill, face rows.
const ROCK_COLOUR := {"frost_cavern": 7, "volcano": 13, "magma_forges": 13, "dragon_lair": 13}

var sprites: Dictionary
var rng := RandomNumberGenerator.new()


func _initialize() -> void:
	sprites = JSON.parse_string(FileAccess.get_file_as_string("res://assets/town/_pack_sprites.json"))
	var args := OS.get_cmdline_user_args()
	match args[0]:
		"scenes":
			_scenes()
		"tileset":
			_tileset()
		"map":
			for z in args.slice(1):
				_map(z)
	quit()


# ---- Scenes -----------------------------------------------------------------------------

func _region_sprite(key: String) -> Sprite2D:
	var info: Dictionary = sprites[key]
	var r: Array = info.rect
	var s := Sprite2D.new()
	s.name = "Gorsel"
	s.texture = load(info.sheet)
	s.region_enabled = true
	s.region_rect = Rect2(r[0], r[1], r[2], r[3])
	s.centered = false
	s.position = Vector2(-roundf(float(r[2]) / 2), -float(r[3]))
	return s


func _shadow(name: String) -> Sprite2D:
	var s := Sprite2D.new()
	s.name = "Golge"
	s.texture = load("res://assets/town/%s.png" % name)
	s.position = Vector2(0, -3)
	s.modulate.a = 0.6
	s.z_index = -5
	s.z_as_relative = false
	return s


func _body(rects: Array, layer := BOTH, name := "Hitbox") -> StaticBody2D:
	var body := StaticBody2D.new()
	body.name = name
	body.collision_layer = layer
	body.collision_mask = 0
	for r: Rect2 in rects:
		var shape := CollisionShape2D.new()
		var box := RectangleShape2D.new()
		box.size = r.size
		shape.shape = box
		shape.position = r.get_center()
		body.add_child(shape, true)
	return body


func _save(root: Node, path: String) -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(path.get_base_dir()))
	_own(root, root)
	var packed := PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, path)
	root.free()


func _own(node: Node, root: Node) -> void:
	for child in node.get_children():
		child.owner = root
		if child.scene_file_path.is_empty():
			_own(child, root)


func _scenes() -> void:
	# Trees: picture and shadow only; a forest's own body blocks (the map's "Orman"), a lone tree
	# placed by hand gets its trunk hitbox.
	for key in ["agac_yesil", "agac_sari", "agac_turuncu", "agac_kuru", "agac_karli", "agac_buyuk", "cam", "cam_2", "cam_mavi", "cam_kuru"]:
		var r := Node2D.new()
		r.name = key.to_pascal_case()
		r.add_child(_shadow("golge_kucuk" if key != "agac_buyuk" else "golge_orta"))
		r.add_child(_region_sprite(key))
		_save(r, "res://props/doga/%s.tscn" % key)
	var grave := Node2D.new()
	grave.name = "Mezar"
	grave.add_child(_shadow("golge_minik"))
	grave.add_child(_region_sprite("mezar"))
	grave.add_child(_body([Rect2(-6, -6, 12, 6)], WALK))
	_save(grave, "res://props/koy/mezar.tscn")

	# Campfire: the pack's burning bonfire, light at night and by day.
	var fire := Node2D.new()
	fire.name = "KampAtesi"
	var info: Dictionary = sprites.kamp_atesi
	var frames := SpriteFrames.new()
	frames.set_animation_speed("default", 8.0)
	var sheet: Texture2D = load(info.sheet)
	for i in int(info.frames):
		var at := AtlasTexture.new()
		at.atlas = sheet
		at.region = Rect2(i * 32, 0, 32, 32)
		frames.add_frame("default", at)
	var anim := AnimatedSprite2D.new()
	anim.name = "Ates"
	anim.sprite_frames = frames
	anim.autoplay = "default"
	anim.position = Vector2(0, -14)
	fire.add_child(anim)
	var light := MapLight.new()
	light.name = "Isik"
	light.position = Vector2(0, -10)
	light.radius = 72.0
	light.color = Color8(0xff, 0xa0, 0x50)
	light.flicker = 0.12
	light.lamp = false
	fire.add_child(light)
	fire.add_child(_body([Rect2(-10, -8, 20, 8)], WALK))
	_save(fire, "res://props/koy/kamp_atesi.tscn")
	print("scenes written")


# ---- TileSet ----------------------------------------------------------------------------

func _source(set: TileSet, id: int, texture: String) -> TileSetAtlasSource:
	if set.has_source(id):
		set.remove_source(id)
	var s := TileSetAtlasSource.new()
	s.texture = load(texture)
	s.texture_region_size = Vector2i(16, 16)
	set.add_source(s, id)
	return s


func _tile(s: TileSetAtlasSource, c: Vector2i, tile_id: int, layers: int) -> void:
	if not s.has_tile(c):
		s.create_tile(c)
	var d := s.get_tile_data(c, 0)
	d.set_custom_data("tile", tile_id)
	var square := PackedVector2Array([Vector2(-8, -8), Vector2(8, -8), Vector2(8, 8), Vector2(-8, 8)])
	for p in 2:
		while d.get_collision_polygons_count(p) > 0:
			d.remove_collision_polygon(p, 0)
		if layers & (1 << p):
			d.add_collision_polygon(p)
			d.set_collision_polygon_points(p, 0, square)


func _tileset() -> void:
	var set: TileSet = load(TILESET)
	# Floors the zones use beyond what Ana Merkez painted: sand, ice, darker cave dirt, paving.
	var floors: TileSetAtlasSource = set.get_source(FLOORS)
	var floor_img := floors.texture.get_image()
	floor_img.decompress()
	for y in range(12, 26):
		for x in range(10):
			var any := false
			for py in range(0, 16, 3):
				for px in range(0, 16, 3):
					if floor_img.get_pixel(x * 16 + px, y * 16 + py).a > 0.5:
						any = true
			if any:
				_tile(floors, Vector2i(x, y), SAND if x >= 5 else ICE, 0)
	for x in range(6, 9):
		_tile(floors, Vector2i(x, 23), SAND, 0)
		_tile(floors, Vector2i(x, 10), PATH, 0)
		_tile(floors, Vector2i(x, 11), CAVE_FLOOR, 0)
	for x in range(1, 4):
		_tile(floors, Vector2i(x, 23), ICE, 0)
		_tile(floors, Vector2i(x, 10), GRASS, 0)
	for y in range(1, 4):
		for x in range(16, 19):
			_tile(floors, Vector2i(x, y), COBBLE, 0)
	# Dungeon: brick wall faces, the wall's dark top, flagstones, planks.
	var dun := _source(set, DUNGEON, PACK + "Tilesets/Dungeon_Tiles.png")
	for c in [Vector2i(0, 1), Vector2i(1, 1), Vector2i(2, 1), Vector2i(0, 2), Vector2i(1, 2), Vector2i(2, 2)]:
		_tile(dun, c, WALL, BOTH)
	_tile(dun, Vector2i(8, 1), WALL, BOTH)
	for y in 3:
		for x in range(5, 8):
			_tile(dun, Vector2i(x, y), COBBLE, 0)
	for y in range(1, 3):
		for x in range(14, 17):
			_tile(dun, Vector2i(x, y), WOOD_FLOOR, 0)
	# Water: open water, not to be walked on (it doesn't hide anything).
	var water := _source(set, WATER, PACK + "Tilesets/Water_tiles.png")
	for y in range(11, 13):
		for x in [1, 2, 3, 6, 7, 8]:
			_tile(water, Vector2i(x, y), WATER_T, WALK)
	# Rock walls (Wall_Tiles in three colours): the top and the face over open ground.
	var rock := _source(set, ROCK, PACK + "Tilesets/Wall_Tiles.png")
	for col in [1, 7, 13]:
		for dx in 3:
			for y in range(3, 6):
				_tile(rock, Vector2i(col + dx, y), CAVE_WALL, BOTH)
			for y in range(16, 18):
				_tile(rock, Vector2i(col + dx, y), CAVE_WALL, BOTH)
	# The old tiles the pack has nothing for yet (snow, ash, lava, bog...): copied as they are.
	var old_set: TileSet = load(OLD_TILESET)
	var old_src: TileSetAtlasSource = old_set.get_source(0)
	var old := _source(set, OLD, "res://assets/tiles/eski/zemin.png")
	for i in old_src.get_tiles_count():
		var c := old_src.get_tile_id(i)
		var od := old_src.get_tile_data(c, 0)
		var layers := (WALK if od.get_collision_polygons_count(0) > 0 else 0) | (2 if od.get_collision_polygons_count(1) > 0 else 0)
		_tile(old, c, int(od.get_custom_data("tile")), layers)
	ResourceSaver.save(set, TILESET)
	print("tileset: dungeon, water, rock and old tiles added")


# ---- A map ------------------------------------------------------------------------------

func _map(zone: String) -> void:
	rng.seed = hash(zone)
	var path := "res://maps/%s.tscn" % zone
	var root: GameMap = load(path).instantiate()
	var ground: TileMapLayer = root.get_node("Zemin")
	var set: TileSet = load(TILESET)
	var old_set: TileSet = ground.tile_set
	var outdoor := zone in OUTDOOR
	var w := root.width
	var h := root.height

	# What every cell is (its old tile id) and how it was drawn.
	var tid := {}
	var drawn := {}
	for cell in ground.get_used_cells():
		var data := ground.get_cell_tile_data(cell)
		if data == null:
			continue
		tid[cell] = int(data.get_custom_data("tile"))
		drawn[cell] = [ground.get_cell_atlas_coords(cell), ground.get_cell_alternative_tile(cell)]
	var walkable := func(c: Vector2i) -> bool:
		return tid.has(c) and not (tid[c] in [CAVE_WALL, RED_ROCK, WALL, WATER_T, TREE, SNOW_TREE, DEAD_TREE, LAVA, BOG, SKY, SOLID, WOOD_WALL])

	ground.tile_set = set
	var kinds := {}  # cell -> "grass" / "sand" / "ice" (overlays), "x" hard floor (their edges show), "o" anything else
	var trees := []
	var rock_col: int = ROCK_COLOUR.get(zone, 1)
	var dirt: Array = [Vector2i(6, 10), Vector2i(7, 10), Vector2i(8, 10)]
	var cave_dirt: Array = [Vector2i(6, 11), Vector2i(7, 11), Vector2i(8, 11)]
	var pick := func(list: Array) -> Vector2i:
		return list[rng.randi() % list.size()]
	var kept := 0
	for cell in tid:
		var t: int = tid[cell]
		var below: Vector2i = cell + Vector2i(1, 0) * 0 + Vector2i(0, 1)
		match t:
			GRASS, GRASS_ALT, FLOWER, DARK_GRASS:
				ground.set_cell(cell, FLOORS, pick.call(dirt))
				kinds[cell] = "grass"
			PATH:
				ground.set_cell(cell, FLOORS, pick.call(dirt))
				kinds[cell] = "x"
			CAVE_FLOOR:
				ground.set_cell(cell, FLOORS, pick.call(cave_dirt))
				kinds[cell] = "x"
			COBBLE, PLAZA, MARKET:
				if outdoor:
					ground.set_cell(cell, FLOORS, Vector2i(16 + rng.randi() % 3, 1 + rng.randi() % 3))
				else:
					ground.set_cell(cell, DUNGEON, Vector2i(5 + rng.randi() % 3, rng.randi() % 3))
				kinds[cell] = "x"
			SAND:
				ground.set_cell(cell, FLOORS, pick.call(cave_dirt if not outdoor else dirt))
				kinds[cell] = "sand"
			ICE:
				ground.set_cell(cell, FLOORS, pick.call(cave_dirt if not outdoor else dirt))
				kinds[cell] = "ice"
			WATER_T:
				ground.set_cell(cell, WATER, Vector2i(2, 12))
				kinds[cell] = "x"
			WOOD_FLOOR:
				ground.set_cell(cell, DUNGEON, Vector2i(14 + rng.randi() % 3, 1 + rng.randi() % 2))
				kinds[cell] = "o"
			CAVE_WALL, RED_ROCK:
				if walkable.call(below):
					ground.set_cell(cell, ROCK, Vector2i(rock_col + rng.randi() % 3, 16 + rng.randi() % 2))
				else:
					ground.set_cell(cell, ROCK, Vector2i(rock_col + rng.randi() % 3, 3 + rng.randi() % 3))
				kinds[cell] = "o"
			WALL:
				if walkable.call(below):
					ground.set_cell(cell, DUNGEON, Vector2i(rng.randi() % 3, 1 + rng.randi() % 2))
				else:
					ground.set_cell(cell, DUNGEON, Vector2i(8, 1))
				kinds[cell] = "o"
			TREE:
				ground.set_cell(cell, FLOORS, pick.call(dirt))
				kinds[cell] = "grass"
				trees.append(cell)
			SNOW_TREE, DEAD_TREE:
				# Snow or withered steppe under the tree (old tiles), the pack's tree on it.
				var under := Vector2i(SNOW % 16, SNOW / 16) if t == SNOW_TREE else Vector2i(BLIGHT % 16, BLIGHT / 16)
				ground.set_cell(cell, OLD, under)
				kinds[cell] = "o"
				trees.append(cell)
			_:
				ground.set_cell(cell, OLD, drawn[cell][0], drawn[cell][1])
				kinds[cell] = "o"
				kept += 1

	# Trees (no longer tiles): one per 2 x 2 block, the forest's cells as one collision body.
	_forest(root, trees, tid, zone)

	# Grass, sand and ice on top, edges smoothed where they meet paths, stone or water.
	_overlay(root, ground, kinds, "grass", "Cimen", Rect2i(0, 0, 5, 10), [Vector2i(1, 10), Vector2i(2, 10), Vector2i(3, 10)])
	_overlay(root, ground, kinds, "sand", "Kum", Rect2i(5, 12, 5, 10), [Vector2i(6, 23), Vector2i(7, 23), Vector2i(8, 23)])
	_overlay(root, ground, kinds, "ice", "Buz", Rect2i(0, 12, 5, 10), [Vector2i(1, 23), Vector2i(2, 23), Vector2i(3, 23)])

	# Old edge layers (grass over the old stones) and any other old layer go.
	for layer: TileMapLayer in root.find_children("*", "TileMapLayer", true, false):
		if layer != ground and not (layer.name in ["Cimen", "Kum", "Buz"]) and layer.tile_set == old_set:
			root.remove_child(layer)
			layer.free()

	_props(root, zone, outdoor)
	_own(root, root)
	var packed := PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, path)
	root.free()
	var fresh: GameMap = load(path).instantiate()
	var err := MapExport.write(fresh)
	fresh.free()
	print("%s: %d cells, %d kept old, %d tree cells; %s" % [zone, tid.size(), kept, trees.size(), err if not err.is_empty() else "written"])


func _forest(root: Node, trees: Array, tid: Dictionary, zone: String) -> void:
	if trees.is_empty():
		return
	var models: Array
	if zone == "frost":
		models = ["agac_karli", "cam_mavi"]
	elif zone == "kurgan":
		models = ["agac_kuru", "cam_kuru"]
	elif zone == "forest":
		models = ["cam", "cam_2", "cam", "agac_yesil"]
	else:
		models = ["agac_yesil", "agac_yesil", "agac_sari", "cam"]
	var blocks := {}
	for c: Vector2i in trees:
		var b := Vector2i(floori(c.x / 2.0), floori(c.y / 2.0))
		if not blocks.has(b):
			blocks[b] = []
		blocks[b].append(c)
	var items: Node2D = root.get_node("Esyalar")
	var keys := blocks.keys()
	keys.sort_custom(func(a, b): return a.y < b.y or (a.y == b.y and a.x < b.x))
	for b: Vector2i in keys:
		var cells: Array = blocks[b]
		# The tree stands on the block's lowest tree cells.
		var bottom := 0
		var xs := 0.0
		for c in cells:
			bottom = maxi(bottom, c.y)
		var low := cells.filter(func(c): return c.y == bottom)
		for c in low:
			xs += c.x * 16 + 8
		var at := Vector2(roundf(xs / low.size()) + rng.randi_range(-3, 3), bottom * 16 + 14)
		var scene: PackedScene = load("res://props/doga/%s.tscn" % models[rng.randi() % models.size()])
		var tree: Node2D = scene.instantiate(PackedScene.GEN_EDIT_STATE_INSTANCE)
		tree.position = at
		items.add_child(tree, true)
	# Collision: the tree cells, merged into rows.
	var rects := []
	var set := {}
	for c in trees:
		set[c] = true
	var done := {}
	var sorted := trees.duplicate()
	sorted.sort_custom(func(a, b): return a.y < b.y or (a.y == b.y and a.x < b.x))
	for c: Vector2i in sorted:
		if done.has(c):
			continue
		var x1 := c.x
		while set.has(Vector2i(x1 + 1, c.y)) and not done.has(Vector2i(x1 + 1, c.y)):
			x1 += 1
		for x in range(c.x, x1 + 1):
			done[Vector2i(x, c.y)] = true
		rects.append(Rect2(c.x * 16, c.y * 16, (x1 - c.x + 1) * 16, 16))
	var old := root.get_node_or_null("Orman")
	if old:
		root.remove_child(old)
		old.free()
	root.add_child(_body(rects, BOTH, "Orman"))


## One overlay (grass, sand or ice) on its own layer: each of its cells the piece of the pack's
## template (`block`, in tiles) that fits its neighbours; edges where it meets a path, paving,
## water or another overlay ("x" or a different kind), none against walls or off the map.
func _overlay(root: Node, ground: TileMapLayer, kinds: Dictionary, kind: String, layer_name: String, block: Rect2i, full: Array) -> void:
	var tf := load("res://tools/terrain_floors.gd")
	var source: TileSetAtlasSource = ground.tile_set.get_source(FLOORS)
	var img := source.texture.get_image()
	img.decompress()
	var pieces := []
	for y in range(block.position.y, block.end.y):
		for x in range(block.position.x, block.end.x):
			var c := Vector2i(x, y)
			if not source.has_tile(c):
				continue
			var bits: int = tf.tile_bits(img, c)
			if bits & (1 << 8) and (bits & 255) != 255:
				pieces.append([c, tf.normalize(bits & 255)])
	var cells := kinds.keys().filter(func(c): return kinds[c] == kind)
	var layer: TileMapLayer = root.get_node_or_null(layer_name)
	if cells.is_empty():
		if layer:
			root.remove_child(layer)
			layer.free()
		return
	if layer == null:
		layer = TileMapLayer.new()
		layer.name = layer_name
		layer.z_index = -9
		root.add_child(layer)
		root.move_child(layer, ground.get_index() + 1)
	layer.tile_set = ground.tile_set
	layer.clear()
	var dirs: Array = tf.DIRS
	for cell in cells:
		var want := 0
		for k in 8:
			var n: Vector2i = cell + dirs[k]
			if not kinds.has(n) or kinds[n] == kind or kinds[n] == "o":
				want |= 1 << k
		want = tf.normalize(want)
		if want == 255 or pieces.is_empty():
			layer.set_cell(cell, FLOORS, full[rng.randi() % full.size()])
			continue
		var best := -1
		var ties := []
		for entry in pieces:
			var score: int = 8 - tf._popcount((entry[1] ^ want) & 255)
			if score > best:
				best = score
				ties = [entry[0]]
			elif score == best:
				ties.append(entry[0])
		layer.set_cell(cell, FLOORS, ties[rng.randi() % ties.size()])


func _props(root: Node, zone: String, outdoor: bool) -> void:
	var swap := {
		"fici": "res://props/koy/fici.tscn", "sandik": "res://props/koy/sandik.tscn", "cuval": "res://props/koy/cuval.tscn",
		"saman": "res://props/koy/sebze_kasasi.tscn", "sancak": "res://props/koy/sancak_1.tscn",
		"fener": "res://props/koy/sokak_lambasi.tscn", "kamp_atesi": "res://props/koy/kamp_atesi.tscn", "mezar": "res://props/koy/mezar.tscn",
	}
	if outdoor:
		swap["kukla"] = "res://props/koy/korkuluk.tscn"
	var items: Node = root.get_node("Esyalar")
	var house := 0
	var count := {}
	for n: Node2D in items.get_children():
		var base := n.scene_file_path.get_file().get_basename()
		var cut := base.rfind("_")
		var kind := base.substr(0, cut) if cut > 0 and base.substr(cut + 1).is_valid_int() else base
		if not n.scene_file_path.begins_with("res://props/%s/" % zone):
			continue
		var to: String = swap.get(kind, "")
		if kind == "ev":
			house += 1
			to = "res://props/ev/ev_%d.tscn" % ((house - 1) % 6 + 1)
		if to.is_empty():
			continue
		var feet := n.position
		for c in n.find_children("*", "CollisionShape2D", true, false):
			if c.shape is RectangleShape2D:
				var at: Vector2 = n.position + _rel(c, n).origin
				feet = Vector2(roundf(at.x), at.y + c.shape.size.y / 2)
				break
		var node: Node2D = load(to).instantiate(PackedScene.GEN_EDIT_STATE_INSTANCE)
		node.position = feet
		items.add_child(node, true)
		items.move_child(node, n.get_index())
		items.remove_child(n)
		n.free()
		count[kind] = count.get(kind, 0) + 1
	if not count.is_empty():
		print("  %s props: %s" % [zone, count])


func _rel(node: Node, top: Node) -> Transform2D:
	var xf := Transform2D.IDENTITY
	var n := node
	while n != null and n != top:
		if n is Node2D:
			xf = n.transform * xf
		n = n.get_parent()
	return xf
