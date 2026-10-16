class_name MapExport
extends RefCounted

## What the server needs from a map scene (GameMap), as shared/maps/<zone>.json (version 2, read by
## shared/src/zoneFile.ts). The game builds its own collision map (ZoneMap) from the scene with
## the same function, so the server and the client's prediction agree to the pixel.
##   tiles   one string per row, one base-36 digit per cell: the Tile id (shared/src/map.ts) of the
##           top tile there (the TileSet's "tile" custom data), for the game's rules (water, sky...)
##   shapes  everything that blocks: {"r": [x, y, w, h]} boxes or {"p": [x0, y0, x1, y1, ...]}
##           convex polygons, whole pixels, "f": 1 blocks walking, 2 blocks sight, 3 both.
##           From the TileSet's collision polygons, every StaticBody2D's CollisionShape2D and
##           CollisionPolygon2D (any shape: curved ones become polygons, concave ones are cut
##           into convex pieces), and empty cells when the map says they block
##   spawn, spawns, mobs, spawnZones, npcs, portals, arrivals  from the MapSpots

const TILE := 16
const DIGITS := "0123456789abcdefghijklmnopqrstuvwxyz"
const WALK := 1
const SIGHT := 2
## Sides of the polygon a circle or capsule becomes.
const ROUND_SIDES := 16


## The repository's shared/maps/<zone>.json (the project sits in the repository).
static func file_path(zone: String) -> String:
	return ProjectSettings.globalize_path("res://").path_join("../shared/maps/%s.json" % zone).simplify_path()


## Writes the map's file; returns an error message, or "" when it went well.
static func write(root: GameMap) -> String:
	if root.zone.is_empty():
		return "Haritanın zone alanı boş"
	var path := file_path(root.zone)
	var out := FileAccess.open(path, FileAccess.WRITE)
	if out == null:
		return "%s yazılamadı (%s)" % [path, error_string(FileAccess.get_open_error())]
	out.store_string(format(export_map(root)))
	out.close()
	return ""


static func export_map(root: GameMap) -> Dictionary:
	var width := root.width
	var height := root.height
	var semantic := PackedInt32Array()
	semantic.resize(width * height)
	semantic.fill(-1)
	# Whole cells that block, by flags; anything else as shapes of its own.
	var cells := {}  # flags -> {index: true}
	var shapes: Array = []
	for layer: TileMapLayer in _layers(root):
		var set: TileSet = layer.tile_set
		if set == null:
			continue
		var xf := _relative(layer, root)
		var custom := set.get_custom_data_layer_by_name("tile")
		for cell in layer.get_used_cells():
			if cell.x < 0 or cell.y < 0 or cell.x >= width or cell.y >= height:
				continue
			var data: TileData = layer.get_cell_tile_data(cell)
			if data == null:
				continue
			var i: int = cell.y * width + cell.x
			if custom >= 0:
				var t: Variant = data.get_custom_data_by_layer_id(custom)
				if t is int and t >= 0:
					semantic[i] = t
			var origin: Vector2 = xf * layer.map_to_local(cell)
			for p in set.get_physics_layers_count():
				var flags := _flags(set.get_physics_layer_collision_layer(p))
				if flags == 0:
					continue
				for k in data.get_collision_polygons_count(p):
					var points: PackedVector2Array = data.get_collision_polygon_points(p, k)
					var world := PackedVector2Array()
					for pt in points:
						world.append(origin + _transformed(pt, layer.get_cell_alternative_tile(cell)))
					if _is_cell(world, cell):
						if not cells.has(flags):
							cells[flags] = {}
						cells[flags][i] = true
					else:
						_add_polygon(shapes, world, flags)
	if root.empty_blocks:
		for i in semantic.size():
			if semantic[i] < 0:
				if not cells.has(WALK):
					cells[WALK] = {}
				cells[WALK][i] = true
	var boxes: Array = []
	var flag_list := cells.keys()
	flag_list.sort()
	for flags in flag_list:
		for r in _merge_cells(cells[flags], width, height):
			boxes.append({"r": r, "f": flags})
	for body: StaticBody2D in _bodies(root):
		var flags := _flags(body.collision_layer)
		if flags == 0:
			continue
		for child in body.get_children():
			_add_collider(shapes, child, root, flags)

	var rows := []
	for y in height:
		var row := ""
		for x in width:
			var t := semantic[y * width + x]
			row += DIGITS[t if t >= 0 else root.empty_tile]
		rows.append(row)

	var spawn := {"x": width * TILE / 2, "y": height * TILE / 2}
	var spawns := []
	var mobs := []
	var spawn_zones := []
	var npcs := {}
	var portals := {}
	var arrivals := {}
	for spot: MapSpot in _spots(root):
		var at := _relative(spot, root).origin
		var p := {"x": roundi(at.x), "y": roundi(at.y)}
		match spot.kind:
			"spawn":
				spawn = p
			"spawns":
				spawns.append(p)
			"mob":
				mobs.append({"mob": spot.ref, "x": p.x, "y": p.y})
			"spawn_zone":
				spawn_zones.append({"mob": spot.ref, "tx": floori(at.x / TILE), "ty": floori(at.y / TILE), "radius": _num(spot.radius), "count": spot.count})
			"npc":
				npcs[spot.ref] = p
			"portal":
				portals[spot.ref] = p
			"arrival":
				arrivals[spot.ref] = p

	var file := {"version": 2, "zone": root.zone, "width": width, "height": height, "tiles": rows, "shapes": boxes + shapes, "spawn": spawn}
	if not spawns.is_empty():
		file.spawns = spawns
	file.mobs = mobs
	if not spawn_zones.is_empty():
		file.spawnZones = spawn_zones
	file.npcs = npcs
	file.portals = portals
	if not arrivals.is_empty():
		file.arrivals = arrivals
	return file


# ---- Finding things --------------------------------------------------------------------

static func _layers(root: Node) -> Array:
	var out := []
	_find(root, func(n): return n is TileMapLayer, out)
	return out


static func _bodies(root: Node) -> Array:
	var out := []
	_find(root, func(n): return n is StaticBody2D, out)
	return out


static func _spots(root: Node) -> Array:
	var out := []
	_find(root, func(n): return n is MapSpot, out)
	return out


static func _find(node: Node, test: Callable, out: Array) -> void:
	for child in node.get_children():
		if test.call(child):
			out.append(child)
		_find(child, test, out)


## A node's transform in the map's space (works whether or not the scene is in a tree).
static func _relative(node: Node, root: Node) -> Transform2D:
	var xf := Transform2D.IDENTITY
	var n := node
	while n != null and n != root:
		if n is Node2D:
			xf = n.transform * xf
		n = n.get_parent()
	return xf


## Collision layer bits -> our flags (layer 1 walking, layer 2 sight).
static func _flags(layer_bits: int) -> int:
	return (WALK if layer_bits & 1 else 0) | (SIGHT if layer_bits & 2 else 0)


# ---- Shapes ----------------------------------------------------------------------------

## A tile's collision point as the cell's transform (flips, turns) puts it.
static func _transformed(p: Vector2, alt: int) -> Vector2:
	if alt & TileSetAtlasSource.TRANSFORM_TRANSPOSE:
		p = Vector2(p.y, p.x)
	if alt & TileSetAtlasSource.TRANSFORM_FLIP_H:
		p.x = -p.x
	if alt & TileSetAtlasSource.TRANSFORM_FLIP_V:
		p.y = -p.y
	return p


## Whether a polygon is exactly the cell's square.
static func _is_cell(points: PackedVector2Array, cell: Vector2i) -> bool:
	if points.size() != 4:
		return false
	var r := Rect2(points[0], Vector2.ZERO)
	for p in points:
		r = r.expand(p)
	var want := Rect2(Vector2(cell * TILE), Vector2(TILE, TILE))
	if not r.position.round().is_equal_approx(want.position) or not r.size.round().is_equal_approx(want.size):
		return false
	for p in points:
		if not (is_equal_approx(p.x, r.position.x) or is_equal_approx(p.x, r.end.x)) or not (is_equal_approx(p.y, r.position.y) or is_equal_approx(p.y, r.end.y)):
			return false
	return true


static func _add_collider(shapes: Array, node: Node, root: Node, flags: int) -> void:
	var xf := _relative(node, root)
	if node is CollisionShape2D:
		if node.disabled or node.shape == null:
			return
		var shape: Shape2D = node.shape
		var local := PackedVector2Array()
		if shape is RectangleShape2D:
			var h: Vector2 = shape.size / 2
			local = PackedVector2Array([Vector2(-h.x, -h.y), Vector2(h.x, -h.y), Vector2(h.x, h.y), Vector2(-h.x, h.y)])
		elif shape is CircleShape2D:
			for k in ROUND_SIDES:
				local.append(Vector2.from_angle(TAU * k / ROUND_SIDES) * shape.radius)
		elif shape is CapsuleShape2D:
			var r: float = shape.radius
			var half: float = maxf(0.0, shape.height / 2 - r)
			for k in ROUND_SIDES + 1:
				local.append(Vector2(0, -half) + Vector2.from_angle(PI + PI * k / ROUND_SIDES) * r)
			for k in ROUND_SIDES + 1:
				local.append(Vector2(0, half) + Vector2.from_angle(PI * k / ROUND_SIDES) * r)
		elif shape is ConvexPolygonShape2D:
			local = shape.points
		elif shape is ConcavePolygonShape2D:
			# Segments only (no inside): each one a thin box.
			var seg: PackedVector2Array = shape.segments
			for k in range(0, seg.size() - 1, 2):
				_add_segment(shapes, xf * seg[k], xf * seg[k + 1], flags)
			return
		else:
			var rect := shape.get_rect()
			local = PackedVector2Array([rect.position, Vector2(rect.end.x, rect.position.y), rect.end, Vector2(rect.position.x, rect.end.y)])
		var world := PackedVector2Array()
		for p in local:
			world.append(xf * p)
		_add_polygon(shapes, world, flags)
	elif node is CollisionPolygon2D:
		if node.disabled or node.polygon.size() < 3:
			return
		var world := PackedVector2Array()
		for p in node.polygon:
			world.append(xf * p)
		if node.build_mode == CollisionPolygon2D.BUILD_SEGMENTS:
			for k in world.size():
				_add_segment(shapes, world[k], world[(k + 1) % world.size()], flags)
			return
		for piece in Geometry2D.decompose_polygon_in_convex(world):
			_add_polygon(shapes, piece, flags)


static func _add_segment(shapes: Array, a: Vector2, b: Vector2, flags: int) -> void:
	var n := (b - a).orthogonal().normalized()
	_add_polygon(shapes, PackedVector2Array([a - n, b - n, b + n, a + n]), flags)


## A convex polygon in whole pixels: a box when it is one ("r"), else its points ("p").
static func _add_polygon(shapes: Array, points: PackedVector2Array, flags: int) -> void:
	var pts := PackedVector2Array()
	for p in points:
		var q := p.round()
		if pts.is_empty() or not q.is_equal_approx(pts[pts.size() - 1]):
			pts.append(q)
	if pts.size() > 1 and pts[0].is_equal_approx(pts[pts.size() - 1]):
		pts.remove_at(pts.size() - 1)
	if pts.size() < 3:
		return
	var r := Rect2(pts[0], Vector2.ZERO)
	for p in pts:
		r = r.expand(p)
	if r.size.x < 1 or r.size.y < 1:
		return
	var box := pts.size() == 4
	for p in pts:
		if (p.x != r.position.x and p.x != r.end.x) or (p.y != r.position.y and p.y != r.end.y):
			box = false
	if box:
		shapes.append({"r": [int(r.position.x), int(r.position.y), int(r.size.x), int(r.size.y)], "f": flags})
		return
	# Clockwise in screen space (y down), as shared/src/map.ts expects nothing in particular but
	# a fixed order keeps the file stable.
	if Geometry2D.is_polygon_clockwise(pts):
		pts.reverse()
	var flat := []
	for p in pts:
		flat.append(int(p.x))
		flat.append(int(p.y))
	shapes.append({"p": flat, "f": flags})


## Blocked cells as few boxes: runs along each row, stacked down while the rows below have the
## very same run.
static func _merge_cells(set: Dictionary, width: int, height: int) -> Array:
	var boxes := []
	var done := {}
	for y in height:
		var x := 0
		while x < width:
			var i := y * width + x
			if not set.has(i) or done.has(i):
				x += 1
				continue
			var x1 := x
			while x1 + 1 < width and set.has(y * width + x1 + 1) and not done.has(y * width + x1 + 1):
				x1 += 1
			var y1 := y
			while y1 + 1 < height and _same_run(set, done, y1 + 1, x, x1, width):
				y1 += 1
			for yy in range(y, y1 + 1):
				for xx in range(x, x1 + 1):
					done[yy * width + xx] = true
			boxes.append([x * TILE, y * TILE, (x1 - x + 1) * TILE, (y1 - y + 1) * TILE])
			x = x1 + 1
	return boxes


static func _same_run(set: Dictionary, done: Dictionary, row: int, x0: int, x1: int, width: int) -> bool:
	for k in range(x0, x1 + 1):
		var i := row * width + k
		if not set.has(i) or done.has(i):
			return false
	var left := row * width + x0 - 1
	var right := row * width + x1 + 1
	return (x0 == 0 or not set.has(left) or done.has(left)) and (x1 + 1 >= width or not set.has(right) or done.has(right))


# ---- Text ------------------------------------------------------------------------------

static func _num(v: float) -> Variant:
	return int(v) if v == floorf(v) else snappedf(v, 0.000001)


## JSON as JavaScript writes it: no spaces, keys in order, short numbers.
static func json(value: Variant) -> String:
	match typeof(value):
		TYPE_DICTIONARY:
			var parts := PackedStringArray()
			for k in value:
				parts.append(JSON.stringify(String(k)) + ":" + json(value[k]))
			return "{" + ",".join(parts) + "}"
		TYPE_ARRAY, TYPE_PACKED_STRING_ARRAY, TYPE_PACKED_INT32_ARRAY, TYPE_PACKED_FLOAT64_ARRAY, TYPE_PACKED_FLOAT32_ARRAY, TYPE_PACKED_INT64_ARRAY:
			var parts := PackedStringArray()
			for v in value:
				parts.append(json(v))
			return "[" + ",".join(parts) + "]"
		TYPE_FLOAT:
			if value == floorf(value) and absf(value) < 1e15:
				return str(int(value))
			var v := snappedf(value, 0.000001)
			for decimals in range(1, 7):
				var text := String.num(v, decimals)
				if absf(text.to_float() - v) < 0.0000005:
					return text
			return String.num(v, 6)
		TYPE_INT:
			return str(value)
		TYPE_BOOL:
			return "true" if value else "false"
		TYPE_NIL:
			return "null"
		_:
			return JSON.stringify(String(value))


## The file as text, one row / shape / spot per line (as formatZoneFile() in zoneFile.ts).
static func format(file: Dictionary) -> String:
	var lines := PackedStringArray()
	for key in file:
		var value: Variant = file[key]
		var head := "  %s: " % json(key)
		if value is Array and not value.is_empty():
			var items := PackedStringArray()
			for v in value:
				items.append("    " + json(v))
			lines.append(head + "[\n" + ",\n".join(items) + "\n  ]")
		elif value is Dictionary and not value.is_empty():
			var items := PackedStringArray()
			for k in value:
				items.append("    %s: %s" % [json(k), json(value[k])])
			lines.append(head + "{\n" + ",\n".join(items) + "\n  }")
		else:
			lines.append(head + json(value))
	return "{\n" + ",\n".join(lines) + "\n}\n"
