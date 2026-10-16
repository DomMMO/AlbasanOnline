extends SceneTree
## The town island's dock (the harbour zone is gone): a walkway down from the south-west shore
## and a platform across its end, the Town pack's dock pieces on it (posts with rope, the lantern
## post, the bench, crates), the fisherman on it. The deck picture is assets/rihtim/rihtim.png
## (tools/rihtim_gorsel.py), cut into tiles. Edits maps/town.tscn in place and can run again.
##   godot --headless --path . -s res://tools/rihtim.gd

const TILESET := "res://tilesets/zemin.tres"
const TOWN := "res://maps/town.tscn"
const DECK_PNG := "res://assets/rihtim/rihtim.png"
const FURNITURE := "res://assetpack/ANOKOLISA/Pixel Crawler - Town/Environment/Props/Static/Furniture.png"
const SRC := 36          # the deck picture
const SEA := 8           # Water_tiles
const BRIDGE := 14
const ALT := 100
const T := 16
## The deck picture's top-left cell on the map.
const AT := Vector2i(33, 145)
const WALK_W := 3
const PLAT_TOP := 12     # the platform's first row in the picture (tiles)

## Props (feet at the bottom middle of the rect unless "foot" says where the post stands).
const PROPS := {
	"direk": {"rect": Rect2i(148, 422, 8, 23), "block": Vector2(6, 4)},
	"direk_halat": {"rect": Rect2i(162, 422, 12, 23), "block": Vector2(6, 4)},
	"bank": {"rect": Rect2i(83, 432, 58, 32), "block": Vector2(54, 10)},
	"sandik": {"rect": Rect2i(736, 73, 16, 23), "block": Vector2(14, 8)},
	"sandik_acik": {"rect": Rect2i(720, 73, 16, 23), "block": Vector2(14, 8)},
	"fici": {"rect": Rect2i(752, 73, 16, 23), "block": Vector2(12, 8)},
	"tahta": {"rect": Rect2i(146, 561, 28, 29), "z": -5},
	"tahta_2": {"rect": Rect2i(82, 593, 29, 29), "z": -5},
	"tahta_duz": {"rect": Rect2i(112, 565, 32, 6), "z": -5},
}
const LAMP_POST := Rect2i(147, 448, 27, 46)
const LAMP := Rect2i(176, 451, 14, 20)
const FISHERMAN := Vector2(AT.x * T + 26, (AT.y + PLAT_TOP) * T + 42)

var rng := RandomNumberGenerator.new()


func _initialize() -> void:
	rng.seed = 2024
	_scenes()
	var set: TileSet = load(TILESET)
	if set.has_source(SRC):
		set.remove_source(SRC)
	var s := TileSetAtlasSource.new()
	var deck_tex: Texture2D = load(DECK_PNG)
	s.texture = deck_tex
	s.texture_region_size = Vector2i(T, T)
	set.add_source(s, SRC)
	var image := deck_tex.get_image()
	var cells: Array[Vector2i] = []
	for cy in image.get_height() / T:
		for cx in image.get_width() / T:
			if not image.get_region(Rect2i(cx * T, cy * T, T, T)).is_invisible():
				var c := Vector2i(cx, cy)
				s.create_tile(c)
				_data(s.get_tile_data(c, 0), BRIDGE)
				cells.append(c)

	var root: Node = load(TOWN).instantiate()
	var sea_layer: TileMapLayer = root.get_node("Deniz")
	var shore: TileMapLayer = root.get_node("Kiyi")
	var items: Node = root.get_node("Esyalar")
	var old := root.get_node_or_null("Iskele")
	if old:
		root.remove_child(old)
		old.free()
	var deck := TileMapLayer.new()
	deck.name = "Iskele"
	deck.tile_set = set
	deck.z_index = -6
	root.add_child(deck)
	root.move_child(deck, shore.get_index() + 1)
	var sea: TileSetAtlasSource = set.get_source(SEA)
	var under := {}
	for c in cells:
		var m := AT + c
		under[m] = true
		deck.set_cell(m, SRC, c)
		# The sea under the deck: the same water, walkable (a bridge) and not blocking.
		if sea_layer.get_cell_source_id(m) == SEA:
			var at := sea_layer.get_cell_atlas_coords(m)
			if not sea.has_alternative_tile(at, ALT + BRIDGE):
				sea.create_alternative_tile(at, ALT + BRIDGE)
				_data(sea.get_tile_data(at, ALT + BRIDGE), BRIDGE)
			sea_layer.set_cell(m, SEA, at, ALT + BRIDGE)
		shore.erase_cell(m)

	# This tool's own props go before it lays them again; nothing else stands on the deck.
	for n in items.get_children():
		if not n is Node2D:
			continue
		var cell := Vector2i(floori(n.position.x / T), floori((n.position.y - 1) / T))
		if n.has_meta("rihtim") or under.has(cell):
			items.remove_child(n)
			n.free()
	var o := Vector2(AT * T)
	var w := float(image.get_width())
	var h := float(image.get_height())
	var plat := float(PLAT_TOP * T)
	var put := func(scene: String, at: Vector2, flip: bool) -> void:
		var node: Node2D = load("res://props/rihtim/%s.tscn" % scene).instantiate()
		node.position = o + at
		if flip:
			node.scale.x = -1
		node.set_meta("rihtim", true)
		items.add_child(node, true)
	# Posts along the walkway's sides (out in the water), the platform's sides and its front.
	for y in [5.0, 9.0]:
		put.call("direk_halat", Vector2(1, y * T), false)
		put.call("direk_halat", Vector2(WALK_W * T - 1, y * T), true)
	put.call("direk", Vector2(1, plat + 40), false)
	put.call("direk", Vector2(w - 1, plat + 24), false)
	for k in 5:
		put.call("direk_halat" if k % 2 == 0 else "direk", Vector2(4 + k * (w - 8) / 4.0, h + 5), false)
	# On the platform: the bench at its back, crates by it, the lantern post at its far corner,
	# loose planks lying about.
	put.call("bank", Vector2(w * 0.5, plat + 30), false)
	put.call("sandik_acik", Vector2(w * 0.5 - 44, plat + 28), false)
	put.call("sandik", Vector2(w * 0.5 + 42, plat + 27), false)
	put.call("sandik", Vector2(w * 0.5 + 58, plat + 27), false)
	put.call("fici", Vector2(w * 0.5 + 50, plat + 44), false)
	put.call("fener", Vector2(w - 18, plat + 22), false)
	put.call("tahta", Vector2(40, plat + 58), false)
	put.call("tahta_2", Vector2(w - 34, plat + 60), false)
	put.call("tahta_duz", Vector2(24, 6 * T), false)

	# The harbour gate and its arrival go; the fisherman stands on the dock.
	var spots: Node = root.get_node("Noktalar")
	for spot in spots.get_children():
		if spot is MapSpot and (spot.ref in ["town_harbor_gate", "harbor_town_gate", "fisherman"]):
			spots.remove_child(spot)
			spot.free()
	var fisher := MapSpot.new()
	fisher.kind = "npc"
	fisher.ref = "fisherman"
	fisher.name = "Fisherman"
	fisher.position = FISHERMAN
	spots.add_child(fisher, true)

	ResourceSaver.save(set, TILESET)
	_own(root, root)
	var packed := PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, TOWN)
	root.free()
	var fresh: GameMap = load(TOWN).instantiate()
	var err := MapExport.write(fresh)
	fresh.free()
	print(err if not err.is_empty() else "town written: dock of %d cells, fisherman at %s" % [cells.size(), FISHERMAN])
	quit()


func _data(d: TileData, tile_id: int) -> void:
	d.set_custom_data("tile", tile_id)
	for p in 2:
		while d.get_collision_polygons_count(p) > 0:
			d.remove_collision_polygon(p, 0)


## The dock's props as scenes (props/rihtim/): Sprite2D from Furniture.png, a hitbox at the foot.
func _scenes() -> void:
	var tex: Texture2D = load(FURNITURE)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://props/rihtim"))
	for key in PROPS:
		var spec: Dictionary = PROPS[key]
		var root := Node2D.new()
		root.name = String(key).to_pascal_case()
		var r: Rect2i = spec.rect
		root.add_child(_sprite(tex, r, Vector2(-floorf(r.size.x / 2.0), -r.size.y)))
		if spec.has("z"):
			root.z_index = int(spec.z)
		if spec.has("block"):
			root.add_child(_body(spec.block))
		_save(root, key)
	# The lantern post: its arm reaches out over the water, the lantern hanging from it, lit.
	var lamp_root := Node2D.new()
	lamp_root.name = "Fener"
	var post_x := 4.0  # the post's middle in its picture
	lamp_root.add_child(_sprite(tex, LAMP_POST, Vector2(-post_x, -LAMP_POST.size.y)))
	var hang := _sprite(tex, LAMP, Vector2(LAMP.position.x - LAMP_POST.position.x - post_x - 2, LAMP.position.y - LAMP_POST.end.y))
	hang.name = "Fener"
	lamp_root.add_child(hang)
	var light := MapLight.new()
	light.name = "Lamba"
	light.position = Vector2(LAMP.position.x - LAMP_POST.position.x - post_x + 5, LAMP.position.y - LAMP_POST.end.y + 14)
	light.radius = 64.0
	light.color = Color8(0xff, 0xc8, 0x78)
	light.flicker = 0.08
	light.lamp = true
	lamp_root.add_child(light)
	lamp_root.add_child(_body(Vector2(8, 6)))
	_save(lamp_root, "fener")


func _sprite(tex: Texture2D, r: Rect2i, at: Vector2) -> Sprite2D:
	var sp := Sprite2D.new()
	sp.name = "Gorsel"
	sp.texture = tex
	sp.region_enabled = true
	sp.region_rect = Rect2(r)
	sp.centered = false
	sp.position = at
	return sp


func _body(size: Vector2) -> StaticBody2D:
	var body := StaticBody2D.new()
	body.name = "Hitbox"
	body.collision_layer = 1
	body.collision_mask = 0
	var shape := CollisionShape2D.new()
	shape.name = "Kutu"
	var box := RectangleShape2D.new()
	box.size = size
	shape.shape = box
	shape.position = Vector2(0, -size.y / 2)
	body.add_child(shape)
	return body


func _save(root: Node2D, key: String) -> void:
	_own(root, root)
	var packed := PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, "res://props/rihtim/%s.tscn" % key)
	root.free()


func _own(node: Node, root: Node) -> void:
	for child in node.get_children():
		child.owner = root
		if child.scene_file_path.is_empty():
			_own(child, root)
