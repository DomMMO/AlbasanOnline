extends SceneTree

## Turns a zone that is still drawn by the old TypeScript code into a plain Godot map: PNGs you can
## open in Aseprite, a TileSet, prop scenes and the map scene. Run once per zone, in two steps
## (Godot has to import the new pictures before scenes can use them):
##   godot --headless --path . -s res://tools/migrate_map.gd -- town images
##   godot --headless --path . --import
##   godot --headless --path . -s res://tools/migrate_map.gd -- town scenes
## Reads shared/maps/<zone>.json (version 1, tools/godot/import-zone.mts) and the bake of it
## (data/zones/<zone>.decor.json, .ground.json, art/decor, art/ui/tileset_1x.png, fringe_*.png).
## Writes:
##   assets/tiles/eski/zemin.png, kenar_cimen.png, kenar_tas.png  the old ground tiles and edges
##   tilesets/eski_zemin.tres                                  their TileSet (collision, tile ids),
##                                                             shared by every map moved this way
##   assets/props/<zone>/<name>.png (+ _golge, _isik<k>, _ek<k>)  every prop, one picture each
##   props/<zone>/<name>.tscn                                  the props (picture + hitbox + light)
##   maps/<zone>.tscn                                          the map

const TILE := 16
const COLUMNS := 16
## Tiles that block sight (shared/src/map.ts OPAQUE).
const OPAQUE := [4, 7, 11, 12, 19, 22]
## Decor standing on blocked tiles (shared/src/mapEdits.ts SOLID_DECOR).
const SOLID := ["building", "fountain", "lamp", "anvil", "banner", "campfire", "tent", "grave", "torch", "prop", "horse", "trough", "bigTree"]
## Names for the props (Turkish, for the FileSystem).
const NAMES := {
	"building": "ev", "fountain": "cesme", "lamp": "fener", "anvil": "ors", "banner": "sancak", "campfire": "kamp_atesi",
	"tent": "cadir", "grave": "mezar", "torch": "mesale", "signboard": "tabela", "fence": "cit", "groundFrame": "cerceve",
	"castleWall": "sur", "tower": "kule", "gateArch": "kapi_kemeri", "keep": "ic_kale", "drawbridge": "asma_kopru",
	"horse": "at", "trough": "yalak", "parkBench": "bank", "bigTree": "agac", "roundFence": "yuvarlak_cit", "plant": "bitki",
	"bush": "cali", "bridge": "kopru", "kurgan": "kurgan", "pier": "iskele", "ship": "gemi", "lighthouse": "deniz_feneri",
	"firepit": "ocak", "rug": "hali", "table": "masa", "shelf": "raf", "rack": "silahlik", "stool": "tabure", "bench": "sira",
}
const PROPS := {"barrel": "fici", "crate": "sandik", "hay": "saman", "well": "kuyu", "cart": "araba", "column": "sutun", "obelisk": "dikilitas", "dummy": "kukla", "sack": "cuval", "balbal": "balbal"}
const ROTATIONS := {90: TileSetAtlasSource.TRANSFORM_TRANSPOSE | TileSetAtlasSource.TRANSFORM_FLIP_H, 180: TileSetAtlasSource.TRANSFORM_FLIP_H | TileSetAtlasSource.TRANSFORM_FLIP_V, 270: TileSetAtlasSource.TRANSFORM_TRANSPOSE | TileSetAtlasSource.TRANSFORM_FLIP_V}

const TILES := "res://assets/tiles/eski/"
const TILESET := "res://tilesets/eski_zemin.tres"
const PROP_DIR := "res://props/%s/"
const PROP_ART := "res://assets/props/%s/"

var zone := ""
var res_root := ""


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() < 2:
		push_error("usage: -- <zone> images|scenes")
		quit(1)
		return
	zone = args[0]
	res_root = ProjectSettings.globalize_path("res://")
	var plan := _plan()
	if args[1] == "images":
		_write_images(plan)
	else:
		_write_scenes(plan)
	quit()


func _json(path: String) -> Variant:
	var text := FileAccess.get_file_as_string(path)
	if text.is_empty():
		push_error("missing " + path)
		return null
	return JSON.parse_string(text)


func _mkdir(res_path: String) -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(res_path))


# ---- Plan: which props there are --------------------------------------------------------

## Every piece of decor grouped into props: decor that look exactly alike share one prop.
func _plan() -> Dictionary:
	var file: Dictionary = _json(res_root.path_join("../shared/maps/%s.json" % zone))
	var baked: Dictionary = _json("res://data/zones/%s.decor.json" % zone)
	var by_decor := {}
	for p in baked.pieces:
		var i := int(p.i)
		if not by_decor.has(i):
			by_decor[i] = []
		by_decor[i].append(p)
	var lights_by := {}
	for l in baked.get("lights", []):
		var i := int(l.i)
		if not lights_by.has(i):
			lights_by[i] = []
		lights_by[i].append(l)

	var props := {}  # key -> {name, ...}
	var counts := {}
	var placed := []  # [{prop, x, y}]
	var clouds := []
	for i in file.decor.size():
		var d: Dictionary = file.decor[i]
		var pieces: Array = by_decor.get(i, [])
		if d.kind == "clouds":
			for p in pieces:
				clouds.append(p)
			continue
		var body := []
		var ground := []
		var glows := []
		var extras := []
		for p in pieces:
			var depth := float(p.d)
			if p.has("g"):
				glows.append(p)
			elif p.has("u") or (depth >= 0 and (p.has("a") or p.get("b", "") == "add")):
				extras.append(p)
			elif depth < 0:
				ground.append(p)
			else:
				body.append(p)
		# The prop sorts with the characters by its biggest standing picture's depth.
		var main: Variant = null
		for p in (body if not body.is_empty() else pieces):
			if main == null or _area(p) > _area(main):
				main = p
		if main == null:
			continue
		var box := _bounds(body if not body.is_empty() else [main])
		var origin := Vector2(roundf(box.get_center().x), float(main.d))
		var hitboxes := []
		if d.has("hitbox"):
			for r in d.hitbox:
				hitboxes.append([float(d.tx) * TILE + float(r[0]) - origin.x, float(d.ty) * TILE + float(r[1]) - origin.y, float(r[2]), float(r[3])])
		elif d.kind in SOLID and d.has("tx"):
			var w := 2 if d.get("prop", "") == "well" else int(d.get("w", 1))
			var h := 2 if d.get("prop", "") == "well" else int(d.get("h", 1))
			hitboxes.append([float(d.tx) * TILE - origin.x, float(d.ty) * TILE - origin.y, w * TILE, h * TILE])
		var rel := func(list: Array) -> Array:
			return list.map(func(p): return [p.t, float(p.x) - origin.x, float(p.y) - origin.y, snappedf(float(p.d) - origin.y, 0.001), p.get("a", 1.0), p.get("b", ""), p.get("g", []), p.has("u")])
		var lights: Array = lights_by.get(i, []).map(func(l): return [float(l.x) - origin.x, float(l.y) - origin.y, float(l.r), int(l.c), float(l.f), bool(l.lamp)])
		var key := JSON.stringify([d.kind, rel.call(body), rel.call(ground), rel.call(glows), rel.call(extras), lights, hitboxes])
		if not props.has(key):
			var base := String(PROPS.get(d.get("prop", ""), NAMES.get(d.kind, String(d.kind).to_snake_case())))
			counts[base] = counts.get(base, 0) + 1
			props[key] = {"name": "%s_%02d" % [base, counts[base]], "origin": origin, "body": body, "ground": ground, "glows": glows, "extras": extras, "lights": lights_by.get(i, []), "hitboxes": hitboxes}
		placed.append({"prop": props[key].name, "x": origin.x, "y": origin.y, "kind": d.kind})
	var loose: Array = baked.get("lights", []).filter(func(l): return int(l.i) < 0)
	return {"file": file, "props": props.values(), "placed": placed, "clouds": clouds, "lights": loose}


func _area(p: Dictionary) -> float:
	var img := _piece(p)
	return img.get_width() * img.get_height() if img else 0.0


func _bounds(list: Array) -> Rect2:
	var r := Rect2()
	var first := true
	for p in list:
		var img := _piece(p)
		if img == null:
			continue
		var pr := Rect2(float(p.x), float(p.y), img.get_width(), img.get_height())
		r = pr if first else r.merge(pr)
		first = false
	return r


var _pieces := {}


func _piece(p: Dictionary) -> Image:
	var t := String(p.t)
	if not _pieces.has(t):
		_pieces[t] = Image.load_from_file(ProjectSettings.globalize_path("res://art/decor/%s.png" % t))
	return _pieces[t]


# ---- Step 1: pictures -------------------------------------------------------------------

func _write_images(plan: Dictionary) -> void:
	_mkdir(TILES)
	_mkdir(PROP_ART % zone)
	var tileset := Image.load_from_file(ProjectSettings.globalize_path("res://art/ui/tileset_1x.png"))
	tileset.save_png(ProjectSettings.globalize_path(TILES + "zemin.png"))
	for kind in ["grass", "stone"]:
		var sheet := Image.load_from_file(ProjectSettings.globalize_path("res://art/ui/fringe_%s.png" % kind))
		_edges(sheet).save_png(ProjectSettings.globalize_path(TILES + "kenar_%s.png" % ("cimen" if kind == "grass" else "tas")))
	var written := 0
	for prop in plan.props:
		var name: String = prop.name
		if not prop.body.is_empty():
			_compose(prop.body, false).save_png(_prop_png(name))
		if not prop.ground.is_empty():
			_compose(prop.ground, true).save_png(_prop_png(name + "_golge"))
		for k in prop.glows.size():
			_piece(prop.glows[k]).save_png(_prop_png("%s_isik%d" % [name, k + 1]))
		for k in prop.extras.size():
			_piece(prop.extras[k]).save_png(_prop_png("%s_ek%d" % [name, k + 1]))
		written += 1
	var clouds := 0
	_mkdir("res://assets/clouds")
	for p in plan.clouds:
		var path := ProjectSettings.globalize_path("res://assets/clouds/%s.png" % p.t)
		if not FileAccess.file_exists(path):
			_piece(p).save_png(path)
			clouds += 1
	print("[migrate] %s: %d props, %d cloud pictures; now run godot --headless --path . --import" % [zone, written, clouds])


func _prop_png(name: String) -> String:
	return ProjectSettings.globalize_path((PROP_ART % zone) + name + ".png")


## The edges grass (or cobbles) spill over a cell from its sides, one tile per side mask
## (columns: 1 n, 2 e, 4 s, 8 w) and cell variant (rows), as ground.ts draws them.
func _edges(sheet: Image) -> Image:
	var out := Image.create_empty(16 * TILE, 4 * TILE, false, Image.FORMAT_RGBA8)
	for variant in 4:
		for mask in 16:
			for side in 4:
				if mask & (1 << side):
					var v := (variant + side) % 4
					out.blend_rect(sheet, Rect2i(v * TILE, side * TILE, TILE, TILE), Vector2i(mask * TILE, variant * TILE))
	return out


## Pieces drawn into one picture, in drawing order (with their alpha when `with_alpha`).
func _compose(list: Array, with_alpha: bool) -> Image:
	var box := _bounds(list)
	var out := Image.create_empty(int(box.size.x), int(box.size.y), false, Image.FORMAT_RGBA8)
	var ordered := list.duplicate()
	ordered.sort_custom(func(a, b): return float(a.d) < float(b.d))
	for p in ordered:
		var img := _piece(p)
		if img == null:
			continue
		img = img.duplicate()
		img.convert(Image.FORMAT_RGBA8)
		var alpha := float(p.get("a", 1.0)) if with_alpha else 1.0
		if alpha < 1.0:
			for y in img.get_height():
				for x in img.get_width():
					var c := img.get_pixel(x, y)
					c.a *= alpha
					img.set_pixel(x, y, c)
		out.blend_rect(img, Rect2i(Vector2i.ZERO, img.get_size()), Vector2i(int(float(p.x) - box.position.x), int(float(p.y) - box.position.y)))
	return out


# ---- Step 2: TileSet, props, map ------------------------------------------------------

func _write_scenes(plan: Dictionary) -> void:
	_mkdir("res://tilesets")
	_mkdir(PROP_DIR % zone)
	_mkdir("res://maps")
	if not ResourceLoader.exists(TILESET):
		ResourceSaver.save(_tileset(), TILESET)
	var tileset: TileSet = load(TILESET)
	for prop in plan.props:
		_save(_prop_scene(prop), (PROP_DIR % zone) + prop.name + ".tscn")
	_save(_map_scene(plan, tileset), "res://maps/%s.tscn" % zone)
	print("[migrate] %s: tileset, %d props, maps/%s.tscn" % [zone, plan.props.size(), zone])


func _save(root: Node, path: String) -> void:
	_own(root, root)
	var packed := PackedScene.new()
	var err := packed.pack(root)
	if err != OK:
		push_error("pack %s: %s" % [path, error_string(err)])
	ResourceSaver.save(packed, path)
	root.free()


func _own(node: Node, root: Node) -> void:
	for child in node.get_children():
		child.owner = root
		if child.scene_file_path.is_empty():
			_own(child, root)


func _tileset() -> TileSet:
	var meta: Dictionary = _json("res://data/tileset_meta.json")
	var set := TileSet.new()
	set.tile_size = Vector2i(TILE, TILE)
	set.add_physics_layer()
	set.set_physics_layer_collision_layer(0, 1)
	set.set_physics_layer_collision_mask(0, 0)
	set.add_physics_layer()
	set.set_physics_layer_collision_layer(1, 2)
	set.set_physics_layer_collision_mask(1, 0)
	set.add_custom_data_layer()
	set.set_custom_data_layer_name(0, "tile")
	set.set_custom_data_layer_type(0, TYPE_INT)
	var square := PackedVector2Array([Vector2(-8, -8), Vector2(8, -8), Vector2(8, 8), Vector2(-8, 8)])

	var ground := TileSetAtlasSource.new()
	ground.resource_name = "Zemin"
	ground.texture = load(TILES + "zemin.png")
	ground.texture_region_size = Vector2i(TILE, TILE)
	set.add_source(ground, 0)
	for i in int(meta.count):
		var coords := Vector2i(i % COLUMNS, i / COLUMNS)
		ground.create_tile(coords)
		var data := ground.get_tile_data(coords, 0)
		var t := int(meta.base[i])
		data.set_custom_data("tile", t)
		if bool(meta.blocking[i]):
			data.add_collision_polygon(0)
			data.set_collision_polygon_points(0, 0, square)
			if t in OPAQUE:
				data.add_collision_polygon(1)
				data.set_collision_polygon_points(1, 0, square)
	for k in 2:
		var edges := TileSetAtlasSource.new()
		edges.resource_name = "Kenar (çimen)" if k == 0 else "Kenar (taş)"
		edges.texture = load(TILES + ("kenar_cimen.png" if k == 0 else "kenar_tas.png"))
		edges.texture_region_size = Vector2i(TILE, TILE)
		set.add_source(edges, k + 1)
		for variant in 4:
			for mask in range(1, 16):
				var coords := Vector2i(mask, variant)
				edges.create_tile(coords)
				edges.get_tile_data(coords, 0).set_custom_data("tile", -1)
	return set


func _sprite(name: String, path: String, at: Vector2) -> Sprite2D:
	var s := Sprite2D.new()
	s.name = name
	s.centered = false
	s.texture = load(path)
	s.position = at
	return s


func _prop_scene(prop: Dictionary) -> Node2D:
	var root := Node2D.new()
	root.name = String(prop.name).to_pascal_case()
	var origin: Vector2 = prop.origin
	if not prop.ground.is_empty():
		var g := _sprite("Golge", (PROP_ART % zone) + prop.name + "_golge.png", _bounds(prop.ground).position - origin)
		# Under everything standing (and over the ground).
		g.z_index = -5
		g.z_as_relative = false
		root.add_child(g)
	if not prop.body.is_empty():
		root.add_child(_sprite("Gorsel", (PROP_ART % zone) + prop.name + ".png", _bounds(prop.body).position - origin))
	var add := CanvasItemMaterial.new()
	add.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	for k in prop.extras.size():
		var p: Dictionary = prop.extras[k]
		var s := _sprite("Ek%d" % (k + 1), (PROP_ART % zone) + "%s_ek%d.png" % [prop.name, k + 1], Vector2(float(p.x), float(p.y)) - origin)
		if p.has("a"):
			s.modulate.a = float(p.a)
		if p.get("b", "") == "add":
			s.material = add
		if p.has("u"):
			s.z_index = -20
			s.z_as_relative = false
		root.add_child(s)
	for k in prop.glows.size():
		var p: Dictionary = prop.glows[k]
		var s := NightGlow.new()
		s.name = "Isik%d" % (k + 1)
		s.centered = false
		s.texture = load((PROP_ART % zone) + "%s_isik%d.png" % [prop.name, k + 1])
		s.position = Vector2(float(p.x), float(p.y)) - origin
		s.base = float(p.g[0])
		s.flicker = float(p.g[1])
		if p.get("b", "") == "add":
			s.material = add
		root.add_child(s)
	for k in prop.lights.size():
		var l: Dictionary = prop.lights[k]
		var light := MapLight.new()
		light.name = "Lamba%d" % (k + 1)
		light.position = Vector2(float(l.x), float(l.y)) - origin
		light.radius = float(l.r)
		var c := int(l.c)
		light.color = Color8((c >> 16) & 255, (c >> 8) & 255, c & 255)
		light.flicker = float(l.f)
		light.lamp = bool(l.lamp)
		root.add_child(light)
	if not prop.hitboxes.is_empty():
		var body := StaticBody2D.new()
		body.name = "Hitbox"
		body.collision_layer = 3
		body.collision_mask = 0
		root.add_child(body)
		for r in prop.hitboxes:
			var shape := CollisionShape2D.new()
			shape.name = "Kutu"
			var box := RectangleShape2D.new()
			box.size = Vector2(float(r[2]), float(r[3]))
			shape.shape = box
			shape.position = Vector2(float(r[0]) + float(r[2]) / 2, float(r[1]) + float(r[3]) / 2)
			body.add_child(shape, true)
	return root


func _map_scene(plan: Dictionary, tileset: TileSet) -> Node2D:
	var file: Dictionary = plan.file
	var root := GameMap.new()
	root.name = zone.to_pascal_case()
	root.zone = zone
	root.width = int(file.width)
	root.height = int(file.height)
	var zdata: Variant = _json("res://data/zones/%s.json" % zone)
	if zdata is Dictionary and zdata.get("background") != null:
		var c := int(zdata.background)
		root.background = Color8((c >> 16) & 255, (c >> 8) & 255, c & 255)

	var cells: Dictionary = _json("res://data/zones/%s.ground.json" % zone)
	var ground := TileMapLayer.new()
	ground.name = "Zemin"
	ground.tile_set = tileset
	ground.z_index = -10
	root.add_child(ground)
	for y in cells.render.size():
		var row: Array = cells.render[y]
		for x in row.size():
			var index := int(row[x])
			if index < 0:
				continue
			var turn: int = ROTATIONS.get(int(cells.rotations.get("%d,%d" % [x, y], 0)), 0)
			ground.set_cell(Vector2i(x, y), 0, Vector2i(index % COLUMNS, index / COLUMNS), turn)
	for k in 2:
		var layer := TileMapLayer.new()
		layer.name = "TasKenari" if k == 0 else "CimenKenari"
		layer.tile_set = tileset
		layer.z_index = -9 + k
		root.add_child(layer)
		for e in (cells.stones if k == 0 else cells.grass):
			layer.set_cell(Vector2i(int(e[0]), int(e[1])), 2 if k == 0 else 1, Vector2i(int(e[2]), int(e[3])))

	if not plan.clouds.is_empty():
		var clouds := DriftingClouds.new()
		clouds.name = "Bulutlar"
		clouds.map_width = root.width * TILE
		clouds.z_index = -20
		root.add_child(clouds)
		var rng := RandomNumberGenerator.new()
		rng.seed = 777
		for p in plan.clouds:
			var s := _sprite("Bulut", "res://assets/clouds/%s.png" % p.t, Vector2(float(p.x), float(p.y)))
			if p.has("a"):
				s.modulate.a = float(p.a)
			s.set_meta("speed", (3.0 if float(p.d) <= -2.5 else 6.0) + rng.randf() * 4.0)
			clouds.add_child(s, true)

	var items := Node2D.new()
	items.name = "Esyalar"
	items.y_sort_enabled = true
	root.add_child(items)
	var scenes := {}
	for p in plan.placed:
		if not scenes.has(p.prop):
			scenes[p.prop] = load((PROP_DIR % zone) + p.prop + ".tscn")
		var node: Node2D = scenes[p.prop].instantiate(PackedScene.GEN_EDIT_STATE_INSTANCE)
		node.position = Vector2(float(p.x), float(p.y))
		items.add_child(node, true)

	if not file.get("colliders", []).is_empty():
		var walls := StaticBody2D.new()
		walls.name = "Engeller"
		walls.collision_layer = 3
		walls.collision_mask = 0
		root.add_child(walls)
		for r in file.colliders:
			var shape := CollisionShape2D.new()
			shape.name = "Kutu"
			var box := RectangleShape2D.new()
			box.size = Vector2(float(r[2]), float(r[3]))
			shape.shape = box
			shape.position = Vector2(float(r[0]) + float(r[2]) / 2, float(r[1]) + float(r[3]) / 2)
			walls.add_child(shape, true)

	if not plan.lights.is_empty():
		var lights := Node2D.new()
		lights.name = "Isiklar"
		root.add_child(lights)
		for l in plan.lights:
			var light := MapLight.new()
			light.name = "Isik"
			light.position = Vector2(float(l.x), float(l.y))
			light.radius = float(l.r)
			var c := int(l.c)
			light.color = Color8((c >> 16) & 255, (c >> 8) & 255, c & 255)
			light.flicker = float(l.f)
			light.lamp = bool(l.lamp)
			lights.add_child(light, true)

	var spots := Node2D.new()
	spots.name = "Noktalar"
	spots.z_index = 100
	root.add_child(spots)
	_spot(spots, "spawn", "", file.spawn, "Dogus")
	for p in file.get("spawns", []):
		_spot(spots, "spawns", "", p, "Dogus")
	for m in file.get("mobs", []):
		_spot(spots, "mob", m.mob, m, m.mob)
	for z in file.get("spawnZones", []):
		var spot := _spot(spots, "spawn_zone", z.mob, {"x": (float(z.tx) + 0.5) * TILE, "y": (float(z.ty) + 0.5) * TILE}, z.mob)
		spot.count = int(z.count)
		spot.radius = float(z.radius)
	for id in file.get("npcs", {}):
		_spot(spots, "npc", id, file.npcs[id], id)
	for id in file.get("portals", {}):
		_spot(spots, "portal", id, file.portals[id], id)
	return root


func _spot(parent: Node, kind: String, ref: String, at: Dictionary, label: String) -> MapSpot:
	var spot := MapSpot.new()
	spot.kind = kind
	spot.ref = ref
	spot.name = label.validate_node_name().to_pascal_case()
	spot.position = Vector2(float(at.x), float(at.y))
	parent.add_child(spot, true)
	return spot
