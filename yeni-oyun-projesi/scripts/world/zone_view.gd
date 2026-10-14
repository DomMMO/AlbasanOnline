class_name ZoneView
extends Node2D

## A zone's ground and decor, from the bake (data/zones/<id>.json + art/): the ground in
## 1024 px chunks under everything, standing decor in the shared y-sorted layer (so characters
## walk behind and in front of it), drifting clouds under the sky island, and the
## lights and lamp glows for the night layer.

var map: ZoneMap
var data := {}
var lights: Array = []  # [{x, y, r, c: Color, f, lamp}]
var glows: Array = []  # [{node, base, flicker}]
var background: Variant = null
var _clouds: Array = []  # [{node, speed}]
var _decor: Array = []
var _width_px := 0.0


static func load_data(zone_id: String) -> Dictionary:
	var text := FileAccess.get_file_as_string("res://data/zones/%s.json" % zone_id)
	if text.is_empty():
		push_error("data/zones/%s.json missing: run the bake" % zone_id)
		return {}
	return JSON.parse_string(text)


## Builds the zone. `sorted` is the y-sorted layer shared with the characters.
func build(zone_id: String, sorted: Node2D) -> void:
	data = load_data(zone_id)
	if data.is_empty():
		return
	map = ZoneMap.from_zone_data(data)
	_width_px = map.width * GameData.TILE_SIZE
	background = data.get("background")
	var under := Node2D.new()
	under.name = "Under"
	add_child(under)
	var ground := Node2D.new()
	ground.name = "Ground"
	add_child(ground)
	for chunk in data.get("ground", []):
		var s := Sprite2D.new()
		s.centered = false
		s.texture = Art.tex("res://" + String(chunk.file))
		s.position = Vector2(float(chunk.x), float(chunk.y))
		ground.add_child(s)
	var add_mat := CanvasItemMaterial.new()
	add_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	var objects: Array = data.get("objects", [])
	var under_list: Array = []
	for o in objects:
		var s := Sprite2D.new()
		s.centered = false
		s.texture = Art.decor(String(o.t))
		if o.has("a"):
			s.modulate.a = float(o.a)
		if o.get("b", "") == "add":
			s.material = add_mat
		if o.has("u"):
			s.position = Vector2(float(o.x), float(o.y))
			under_list.append([float(o.d), s])
			continue
		var w := Depth.wrap(sorted, s)
		Depth.place(w, float(o.x), float(o.y), float(o.d))
		_decor.append(w)
		if o.has("g"):
			glows.append({"node": s, "base": float(o.g[0]), "flicker": float(o.g[1])})
	# Clouds below the island drift east (decor.ts clouds()).
	under_list.sort_custom(func(a, b): return a[0] < b[0])
	var rng := RandomNumberGenerator.new()
	rng.seed = 777
	for pair in under_list:
		var s: Sprite2D = pair[1]
		under.add_child(s)
		var far: bool = pair[0] <= -2.5
		_clouds.append({"node": s, "speed": (3.0 if far else 6.0) + rng.randf() * 4.0})
	for l in data.get("lights", []):
		lights.append({"x": float(l.x), "y": float(l.y), "r": float(l.r), "c": GameData.rgb(l.c), "f": float(l.f), "lamp": bool(l.lamp)})
	set_process(not _clouds.is_empty())


func _process(delta: float) -> void:
	for cloud in _clouds:
		var s: Sprite2D = cloud.node
		s.position.x += cloud.speed * delta
		if s.position.x > _width_px + 160:
			s.position.x = -160 - s.texture.get_width() if s.texture else -160


func destroy() -> void:
	for w in _decor:
		if is_instance_valid(w):
			w.queue_free()
	_decor.clear()
	queue_free()
