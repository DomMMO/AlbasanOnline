extends SceneTree

## Houses (props/ev) that overlap another house, a forest or something solid move to the nearest
## spot where they stand free on open ground; NPCs at their door go with them.
##   godot --headless --path . -s res://tools/settle_houses.gd -- <zone> [<zone> ...]

const T := 16.0


func _initialize() -> void:
	for zone in OS.get_cmdline_user_args():
		_settle(zone)
	quit()


func _rel(node: Node, top: Node) -> Transform2D:
	var xf := Transform2D.IDENTITY
	var n := node
	while n != null and n != top:
		if n is Node2D:
			xf = n.transform * xf
		n = n.get_parent()
	return xf


func _hits(n: Node, at: Vector2) -> Array:
	var out := []
	for c in n.find_children("*", "CollisionShape2D", true, false):
		if c.shape is RectangleShape2D:
			out.append(Rect2(at + _rel(c, n).origin - c.shape.size / 2, c.shape.size))
	return out


func _pic(n: Node2D, at: Vector2) -> Rect2:
	var r := Rect2()
	var first := true
	for s in n.find_children("*", "Sprite2D", true, false):
		if s.texture == null or s.z_index < -1 or s is NightGlow:
			continue
		var size: Vector2 = s.region_rect.size if s.region_enabled else s.texture.get_size()
		var b := Rect2(at + _rel(s, n).origin, size)
		r = b if first else r.merge(b)
		first = false
	return r


func _settle(zone: String) -> void:
	var path := "res://maps/%s.tscn" % zone
	var root: GameMap = load(path).instantiate()
	var items: Node = root.get_node("Esyalar")
	# Open ground: floor tiles nothing blocks.
	var open := {}
	for layer: TileMapLayer in root.find_children("*", "TileMapLayer", true, false):
		for cell in layer.get_used_cells():
			var d := layer.get_cell_tile_data(cell)
			if d == null:
				continue
			if layer.name == "Zemin":
				open[cell] = d.get_collision_polygons_count(0) == 0
			elif d.get_collision_polygons_count(0) > 0:
				open[cell] = false
	var walls := []
	for body: StaticBody2D in root.find_children("*", "StaticBody2D", false, false):
		walls.append_array(_hits(body, Vector2.ZERO))
	var spots := root.find_children("*", "MapSpot", true, false)
	var offsets := []
	for dy in range(-16, 17):
		for dx in range(-16, 17):
			offsets.append(Vector2i(dx, dy))
	offsets.sort_custom(func(a, b): return a.length_squared() < b.length_squared())
	var houses := []
	for n: Node2D in items.get_children():
		if n.scene_file_path.begins_with("res://props/ev/"):
			houses.append(n)
	var moved := 0
	for h: Node2D in houses:
		var start := h.position
		var ok := func(at: Vector2) -> bool:
			var hit: Rect2 = _hits(h, at)[0]
			for ty in range(floori(hit.position.y / T), ceili(hit.end.y / T)):
				for tx in range(floori(hit.position.x / T), ceili(hit.end.x / T)):
					if not open.get(Vector2i(tx, ty), false):
						return false
			var pic := _pic(h, at).grow(-2)
			for w in walls:
				if hit.grow(2).intersects(w):
					return false
			for n: Node2D in items.get_children():
				if n == h:
					continue
				for o in _hits(n, n.position):
					if hit.grow(2).intersects(o):
						return false
				if n.scene_file_path.begins_with("res://props/ev/") and pic.intersects(_pic(n, n.position)):
					return false
			for s in spots:
				if s.kind != "npc" and pic.has_point(s.position):
					return false
			return true
		if ok.call(start):
			continue
		for o in offsets:
			var at := start + Vector2(o) * T
			if ok.call(at):
				h.position = at
				moved += 1
				var k := 0
				for s: MapSpot in spots:
					if s.kind == "npc" and Rect2(start.x - 48, start.y - 8, 96, 40).has_point(s.position):
						s.position = at + Vector2(-14 + 28 * k, 14)
						k += 1
				break
	var packed := PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, path)
	root.free()
	var fresh: GameMap = load(path).instantiate()
	var err := MapExport.write(fresh)
	fresh.free()
	print("%s: %d of %d houses moved; %s" % [zone, moved, houses.size(), err if not err.is_empty() else "written"])
