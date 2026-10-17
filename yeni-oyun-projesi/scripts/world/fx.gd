class_name Fx
extends RefCounted

## Short-lived effects (slashes, spells, floating text, teleports, dust): vector shapes that
## scale with the camera zoom. Every function takes the y-sorted world layer the effect goes
## into.

const CHEST := 7.0
const P := Depth.Painter


static func _add(layer: Node2D, painter: Callable, x: float, y: float, depth: float) -> Node2D:
	var node := P.new(painter)
	var w := Depth.wrap(layer, node)
	Depth.place(w, x, y, depth)
	return node


static func _tw(node: Node, trans := Tween.TRANS_LINEAR, ease := Tween.EASE_IN_OUT) -> Tween:
	return node.create_tween().set_trans(trans).set_ease(ease)


## Frees an effect node's depth wrapper (and so the effect).
static func _kill(node: Node2D) -> void:
	if is_instance_valid(node) and node.get_parent() != null:
		node.get_parent().queue_free()


# ---- slash.ts ----

static func _crescent(ci: CanvasItem, angle: float, color: Color, radius: float) -> void:
	var spread := 1.15
	ci.draw_arc(Vector2.ZERO, radius, angle - spread, angle + spread, 16, Color(color, 0.85), 4.0)
	ci.draw_arc(Vector2.ZERO, radius - 1, angle - spread * 0.75, angle + spread * 0.75, 16, Color.WHITE, 2.0)


static func slash(layer: Node2D, x: float, y: float, angle: float, color: Color, radius := 12.0, heavy := false) -> void:
	var g := _add(layer, func(ci: CanvasItem):
		_crescent(ci, angle, color, radius)
		if heavy:
			_crescent(ci, angle + PI * 0.15, color, radius - 4), roundf(x), roundf(y), y + 20)
	g.scale = Vector2(0.7, 0.7)
	_tw(g, Tween.TRANS_QUAD, Tween.EASE_OUT).tween_property(g, "scale", Vector2(1.1, 1.1), 0.29)
	var t := _tw(g)
	t.tween_interval(0.09)
	t.tween_property(g, "modulate:a", 0.0, 0.2)
	t.finished.connect(func(): _kill(g))


static func ring(layer: Node2D, x: float, y: float, color: Color, radius: float) -> void:
	var g := _add(layer, func(ci: CanvasItem):
		ci.draw_arc(Vector2.ZERO, radius, 0, TAU, 48, Color(color, 0.85), 4.0)
		ci.draw_arc(Vector2.ZERO, radius - 2, 0, TAU, 48, Color.WHITE, 2.0), roundf(x), roundf(y), y + 20)
	g.scale = Vector2(0.3, 0.15)
	_tw(g, Tween.TRANS_CUBIC, Tween.EASE_OUT).tween_property(g, "scale", Vector2(1, 0.5), 0.32)
	var t := _tw(g)
	t.tween_interval(0.2)
	t.tween_property(g, "modulate:a", 0.0, 0.26)
	t.finished.connect(func(): _kill(g))


# ---- floatingText.ts ----

static func floating_text(layer: Node2D, x: float, y: float, text: String, color: Color, big := false) -> void:
	var label := Label.new()
	label.text = text
	label.label_settings = Fonts.label_settings(Fonts.mono(), 11 if big else 8, color, 4, Color.BLACK)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
	label.size = Vector2(160, 16)
	var holder := Node2D.new()
	holder.add_child(label)
	label.position = Vector2(-80, -16)
	var w := Depth.wrap(layer, holder)
	Depth.place(w, roundf(x + (randf() - 0.5) * 6.0), roundf(y), 200000)
	var t := _tw(holder, Tween.TRANS_CUBIC, Tween.EASE_IN).set_parallel()
	var duration := 1.3 if big else 0.9
	t.tween_property(holder, "position:y", holder.position.y - 14, duration)
	t.tween_property(holder, "modulate:a", 0.0, duration)
	t.chain().tween_callback(w.queue_free)


# ---- spells.ts ----

static func burst(layer: Node2D, at: Vector2, color: Color, radius := 7.0) -> void:
	var g := _add(layer, func(ci: CanvasItem):
		ci.draw_circle(Vector2.ZERO, radius, Color(color, 0.8))
		ci.draw_circle(Vector2.ZERO, radius / 2, Color(1, 1, 1, 0.9)), at.x, at.y - CHEST, 100000)
	var t := _tw(g).set_parallel()
	t.tween_property(g, "scale", Vector2(1.8, 1.8), 0.26)
	t.tween_property(g, "modulate:a", 0.0, 0.26)
	t.chain().tween_callback(func(): _kill(g))


static func projectile(layer: Node2D, from: Vector2, to: Vector2, color: Color, size: float, on_arrive := Callable()) -> void:
	var g := _add(layer, func(ci: CanvasItem):
		ci.draw_circle(Vector2.ZERO, size + 2, Color(color, 0.35))
		ci.draw_circle(Vector2.ZERO, size, color)
		ci.draw_circle(Vector2(-size / 3, -size / 3), maxf(1, size / 2.5), Color(1, 1, 1, 0.9)), from.x, from.y - CHEST, 100000)
	var w := g.get_parent() as Node2D
	var distance := from.distance_to(to)
	var t := _tw(w, Tween.TRANS_QUAD, Tween.EASE_IN)
	t.tween_property(w, "position:x", to.x, maxf(0.12, distance * 0.0022))
	t.parallel().tween_property(g, "position:y", to.y - CHEST - 100000, maxf(0.12, distance * 0.0022))
	t.tween_callback(func():
		_kill(g)
		burst(layer, to, color)
		if on_arrive.is_valid():
			on_arrive.call())


static func lightning(layer: Node2D, at: Vector2) -> void:
	var points := PackedVector2Array([Vector2(at.x + 6, at.y - 90)])
	for i in range(1, 7):
		points.append(Vector2(at.x + randi_range(-6, 6), at.y - 90 + i * 13))
	points.append(Vector2(at.x, at.y - CHEST))
	var local := PackedVector2Array()
	for p in points:
		local.append(p - Vector2(at.x, at.y))
	var g := _add(layer, func(ci: CanvasItem):
		ci.draw_polyline(local, Color(Depth.c(0xffd43b), 0.6), 4.0)
		ci.draw_polyline(local, Color.WHITE, 2.0), at.x, at.y, 100000)
	var t := _tw(g)
	t.tween_interval(0.08)
	t.tween_property(g, "modulate:a", 0.0, 0.22)
	t.tween_callback(func(): _kill(g))
	burst(layer, at, Depth.c(0xffd43b), 9)


static func holy_beam(layer: Node2D, at: Vector2) -> void:
	var g := _add(layer, func(ci: CanvasItem):
		ci.draw_rect(Rect2(-6, -70, 12, 70), Depth.c(0xffe066, 0.35))
		ci.draw_rect(Rect2(-2, -70, 4, 70), Depth.c(0xfff3bf, 0.8)), at.x, at.y, 100000)
	var t := _tw(g).set_parallel()
	t.tween_property(g, "modulate:a", 0.0, 0.45)
	t.tween_property(g, "scale:x", 0.2, 0.45)
	t.chain().tween_callback(func(): _kill(g))
	burst(layer, at, Depth.c(0xffe066), 8)


static func heal_sparkles(layer: Node2D, at: Vector2) -> void:
	for i in 8:
		var color := Depth.c(0x8ce99a) if i % 2 else Color.WHITE
		var g := _add(layer, func(ci: CanvasItem): ci.draw_rect(Rect2(-1, -1, 2, 2), color), at.x + randi_range(-8, 8), at.y - randi_range(0, 10), 100000)
		var t := _tw(g).set_parallel()
		t.tween_property(g, "position:y", g.position.y - 18, 0.6).set_delay(i * 0.04)
		t.tween_property(g, "modulate:a", 0.0, 0.6).set_delay(i * 0.04)
		t.chain().tween_callback(func(): _kill(g))


static func _ground_ring(layer: Node2D, at: Vector2, radius: float, painter: Callable, grow_from: float, grow_ms: float, fade_delay: float, fade_ms: float) -> Node2D:
	var g := _add(layer, painter, at.x, at.y - 2, at.y + 20)
	g.scale = Vector2(grow_from, grow_from)
	_tw(g, Tween.TRANS_CUBIC, Tween.EASE_OUT).tween_property(g, "scale", Vector2.ONE, grow_ms)
	var t := _tw(g)
	t.tween_interval(fade_delay)
	t.tween_property(g, "modulate:a", 0.0, fade_ms)
	t.tween_callback(func(): _kill(g))
	return g


static func frost_ring(layer: Node2D, at: Vector2, radius: float) -> void:
	_ground_ring(layer, at, radius, func(ci: CanvasItem):
		Depth.fill_ellipse(ci, 0, 0, radius * 2, radius, Depth.c(0xa5d8ff, 0.25))
		Depth.stroke_ellipse(ci, 0, 0, radius * 2, radius, Depth.c(0x74c0fc, 0.9), 3)
		Depth.stroke_ellipse(ci, 0, 0, radius * 2 - 4, radius - 2, Color.WHITE, 1), 0.2, 0.26, 0.3, 0.3)


static func storm_ring(layer: Node2D, at: Vector2, radius: float) -> void:
	_ground_ring(layer, at, radius, func(ci: CanvasItem):
		Depth.fill_ellipse(ci, 0, 0, radius * 2, radius, Depth.c(0x339af0, 0.2))
		Depth.stroke_ellipse(ci, 0, 0, radius * 2, radius, Depth.c(0x74c0fc, 0.9), 3), 0.2, 0.24, 0.28, 0.3)
	for i in 3:
		var a := TAU * i / 3.0 + randf()
		var spot := Vector2(at.x + cos(a) * radius * 0.7, at.y + sin(a) * radius * 0.35)
		layer.get_tree().create_timer(i * 0.07).timeout.connect(func(): if is_instance_valid(layer): lightning(layer, spot))


static func bone_burst(layer: Node2D, at: Vector2, radius: float) -> void:
	for i in 12:
		var angle := TAU * i / 12.0
		var color := Depth.c(0xf1f3f5) if i % 3 else Depth.c(0xced4da)
		var g := _add(layer, func(ci: CanvasItem): ci.draw_rect(Rect2(-2, -1, 4, 2), color), at.x, at.y - CHEST, 100000)
		g.rotation = angle
		var w := g.get_parent() as Node2D
		var t := _tw(w, Tween.TRANS_CUBIC, Tween.EASE_OUT).set_parallel()
		t.tween_property(w, "position:x", at.x + cos(angle) * radius, 0.38)
		t.tween_property(g, "position:y", g.position.y + sin(angle) * radius * 0.5, 0.38)
		t.tween_property(g, "modulate:a", 0.0, 0.38)
		t.chain().tween_callback(func(): _kill(g))
	var ring_node := _add(layer, func(ci: CanvasItem): Depth.stroke_ellipse(ci, 0, 0, radius * 2, radius, Depth.c(0xdee2e6, 0.8), 2), at.x, at.y - 2, at.y + 20)
	ring_node.scale = Vector2(0.2, 0.2)
	var rt := _tw(ring_node).set_parallel()
	rt.tween_property(ring_node, "scale", Vector2.ONE, 0.42)
	rt.tween_property(ring_node, "modulate:a", 0.0, 0.42)
	rt.chain().tween_callback(func(): _kill(ring_node))


## `follow` returns the stunned one's feet (it may move while the stars circle).
static func stun_stars(layer: Node2D, follow: Callable) -> void:
	for i in 3:
		var angle := TAU * i / 3.0
		var start: Vector2 = follow.call()
		var g := _add(layer, func(ci: CanvasItem): ci.draw_rect(Rect2(-1, -1, 3, 3), Depth.c(0xffe066)), start.x, start.y - 20, 100000)
		var w := g.get_parent() as Node2D
		var t := _tw(w)
		t.tween_method(func(a: float):
			var base: Vector2 = follow.call()
			Depth.place(w, base.x + cos(a) * 6, base.y - 20 + sin(a) * 2, 100000), angle, angle + PI * 4, 1.4)
		t.tween_callback(func(): _kill(g))


static func arrow_shot(layer: Node2D, from: Vector2, to: Vector2, on_arrive := Callable()) -> void:
	var g := _add(layer, func(ci: CanvasItem):
		ci.draw_line(Vector2(-6, 0), Vector2(3, 0), Depth.c(0x8a5a2b), 1)
		ci.draw_colored_polygon(PackedVector2Array([Vector2(3, -1.5), Vector2(3, 1.5), Vector2(6, 0)]), Depth.c(0xced4da))
		ci.draw_rect(Rect2(-7, -1.5, 2, 1), Depth.c(0xff8787))
		ci.draw_rect(Rect2(-7, 0.5, 2, 1), Depth.c(0xff8787)), from.x, from.y - CHEST, 100000)
	g.rotation = atan2(to.y - from.y, to.x - from.x)
	var w := g.get_parent() as Node2D
	var duration := maxf(0.09, from.distance_to(to) * 0.0013)
	var t := _tw(w).set_parallel()
	t.tween_property(w, "position:x", to.x, duration)
	t.tween_property(g, "position:y", to.y - CHEST - 100000, duration)
	t.chain().tween_callback(func():
		_kill(g)
		burst(layer, to, Depth.c(0xffe8cc), 4)
		if on_arrive.is_valid():
			on_arrive.call())


## A mob's arrow: the Pixel Crawler pack's wooden arrow (pointing right; or the mob's own, `look`)
## flying from the bow to the target's chest, following the target as it moves (`target` gives
## its feet each frame).
const PACK_ARROW := "res://assetpack/ANOKOLISA/Pixel Crawler - Town/Weapons/Wood/Wood.png"
const PACK_ARROW_RECT := Rect2(32, 4, 16, 7)
const ARROW_SPEED := 240.0
static var _pack_arrow_tex: Texture2D


static func pack_arrow(layer: Node2D, from: Vector2, target: Callable, look: Texture2D = null) -> void:
	if _pack_arrow_tex == null:
		_pack_arrow_tex = load(PACK_ARROW)
	var s := Sprite2D.new()
	if look:
		s.texture = look
	else:
		s.texture = _pack_arrow_tex
		s.region_enabled = true
		s.region_rect = PACK_ARROW_RECT
	var w := Depth.wrap(layer, s)
	var chest := func() -> Vector2:
		var feet: Vector2 = target.call()
		return Vector2(feet.x, feet.y - CHEST)
	var first: Vector2 = chest.call()
	var duration := maxf(0.12, from.distance_to(first) / ARROW_SPEED)
	var fly := func(t: float) -> void:
		# Towards where the target is now: the arrow homes in and always arrives.
		var aim: Vector2 = chest.call()
		var at := from.lerp(aim, t)
		var ahead := from.lerp(aim, minf(1.0, t + 0.05))
		if ahead.distance_squared_to(at) > 0.01:
			s.rotation = (ahead - at).angle()
		Depth.place(w, at.x, at.y, 100000)
	fly.call(0.0)
	var tw := _tw(w)
	tw.tween_method(fly, 0.0, 1.0, duration)
	tw.tween_callback(func():
		var feet: Vector2 = target.call()
		w.queue_free()
		burst(layer, feet, Depth.c(0xffe8cc), 3))


## A mob caster's bolt: a glowing orb from the staff's head to the target's chest, following it
## as it moves (`target` gives its feet each frame); the speed is the server's MOB_BOLT_SPEED.
const BOLT_SPEED := 200.0


static func homing_bolt(layer: Node2D, from: Vector2, target: Callable, color: Color) -> void:
	var g := _add(layer, func(ci: CanvasItem):
		ci.draw_circle(Vector2.ZERO, 4.0, Color(color, 0.35))
		ci.draw_circle(Vector2.ZERO, 2.5, Color(color, 0.9))
		ci.draw_circle(Vector2.ZERO, 1.2, Color(1, 1, 1, 0.95)), from.x, from.y, 100000)
	var w := g.get_parent() as Node2D
	var trail := CPUParticles2D.new()
	trail.amount = 12
	trail.lifetime = 0.3
	trail.gravity = Vector2.ZERO
	trail.initial_velocity_min = 0
	trail.initial_velocity_max = 4
	trail.scale_amount_min = 1.5
	trail.scale_amount_max = 1.5
	var ramp := Gradient.new()
	ramp.set_color(0, Color(color, 0.8))
	ramp.set_color(1, Color(color, 0.0))
	trail.color_ramp = ramp
	var add := CanvasItemMaterial.new()
	add.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	trail.material = add
	g.add_child(trail)
	var chest := func() -> Vector2:
		var feet: Vector2 = target.call()
		return Vector2(feet.x, feet.y - CHEST)
	var first: Vector2 = chest.call()
	var duration := maxf(0.15, from.distance_to(first) / BOLT_SPEED)
	var fly := func(t: float) -> void:
		var at := from.lerp(chest.call(), t)
		Depth.place(w, at.x, at.y, 100000)
	var tw := _tw(w)
	tw.tween_method(fly, 0.0, 1.0, duration)
	tw.tween_callback(func():
		var feet: Vector2 = target.call()
		w.queue_free()
		burst(layer, feet, color, 6))


static func arrow_volley(layer: Node2D, at: Vector2, radius: float) -> void:
	for i in 12:
		var tx := at.x + randi_range(int(-radius), int(radius))
		var ty := at.y + randi_range(int(-radius / 2), int(radius / 2))
		var g := _add(layer, func(ci: CanvasItem):
			ci.draw_line(Vector2(0, -8), Vector2(0, 0), Depth.c(0x8a5a2b), 1)
			ci.draw_colored_polygon(PackedVector2Array([Vector2(-1.5, 0), Vector2(1.5, 0), Vector2(0, 3)]), Depth.c(0xced4da)), tx - 10, ty - 70, 100000)
		g.rotation = -0.14
		var w := g.get_parent() as Node2D
		var t := _tw(w, Tween.TRANS_QUAD, Tween.EASE_IN).set_parallel()
		t.tween_property(w, "position:x", tx, 0.26).set_delay(i * 0.035)
		t.tween_property(g, "position:y", g.position.y + 68, 0.26).set_delay(i * 0.035)
		t.chain().tween_interval(0.25)
		t.chain().tween_property(g, "modulate:a", 0.0, 0.2)
		t.chain().tween_callback(func(): _kill(g))
	var ring_node := _add(layer, func(ci: CanvasItem): Depth.stroke_ellipse(ci, 0, 0, radius * 2, radius, Depth.c(0xe67700, 0.7), 2), at.x, at.y - 2, at.y + 20)
	var rt := _tw(ring_node)
	rt.tween_interval(0.35)
	rt.tween_property(ring_node, "modulate:a", 0.0, 0.3)
	rt.tween_callback(func(): _kill(ring_node))


static func spirit_wisps(layer: Node2D, at: Vector2) -> void:
	for i in 6:
		var a := TAU * i / 6.0
		var g := _add(layer, func(ci: CanvasItem):
			ci.draw_circle(Vector2.ZERO, 3, Depth.c(0x96f2d7, 0.5))
			ci.draw_circle(Vector2.ZERO, 1.5, Depth.c(0xe6fcf5, 0.9)), at.x + cos(a) * 10, at.y - 4 + sin(a) * 4, 100000)
		var w := g.get_parent() as Node2D
		var t := _tw(w, Tween.TRANS_SINE, Tween.EASE_OUT).set_parallel()
		t.tween_property(w, "position:x", at.x + cos(a + 1.5) * 4, 0.7).set_delay(i * 0.05)
		t.tween_property(g, "position:y", at.y - 24 - 100000, 0.7).set_delay(i * 0.05)
		t.tween_property(g, "modulate:a", 0.0, 0.7).set_delay(i * 0.05)
		t.chain().tween_callback(func(): _kill(g))
	burst(layer, at, Depth.c(0x63e6be), 7)


static func leaf_burst(layer: Node2D, at: Vector2, radius: float) -> void:
	for i in 10:
		var angle := TAU * i / 10.0
		var color := Depth.c(0x69db7c) if i % 2 else Depth.c(0x2f9e44)
		var g := _add(layer, func(ci: CanvasItem): Depth.fill_ellipse(ci, 0, 0, 4, 2, color), at.x, at.y - CHEST, 100000)
		g.rotation = angle
		var w := g.get_parent() as Node2D
		var t := _tw(w, Tween.TRANS_CUBIC, Tween.EASE_OUT).set_parallel()
		t.tween_property(w, "position:x", at.x + cos(angle) * radius, 0.5)
		t.tween_property(g, "position:y", g.position.y + sin(angle) * radius * 0.5, 0.5)
		t.tween_property(g, "rotation", angle + 4, 0.5)
		t.tween_property(g, "modulate:a", 0.0, 0.5)
		t.chain().tween_callback(func(): _kill(g))


static func roots_ring(layer: Node2D, at: Vector2, radius: float) -> void:
	var g := _add(layer, func(ci: CanvasItem):
		Depth.fill_ellipse(ci, 0, 0, radius * 2, radius, Depth.c(0x5c940d, 0.22))
		for i in 10:
			var a := TAU * i / 10.0
			var x := cos(a) * radius * 0.8
			var y := sin(a) * radius * 0.4
			ci.draw_polyline(PackedVector2Array([Vector2(x, y), Vector2(x + 2, y - 6), Vector2(x - 1, y - 10)]), Depth.c(0x6b4423), 2)
			ci.draw_rect(Rect2(x - 2, y - 11, 3, 2), Depth.c(0x69db7c)), at.x, at.y - 2, at.y + 20)
	g.scale = Vector2(1, 0.2)
	_tw(g, Tween.TRANS_BACK, Tween.EASE_OUT).tween_property(g, "scale:y", 1.0, 0.22)
	var t := _tw(g)
	t.tween_interval(0.6)
	t.tween_property(g, "modulate:a", 0.0, 0.3)
	t.tween_callback(func(): _kill(g))


## A pulsing ring under a caster. Returns its depth wrapper: place it with
## Depth.place(w, x, y - 1, 0.6) every frame, free it to stop.
static func casting_glow(layer: Node2D, color: Color) -> Node2D:
	var g := P.new(func(ci: CanvasItem):
		Depth.fill_ellipse(ci, 0, 0, 18, 7, Color(color, 0.2))
		Depth.stroke_ellipse(ci, 0, 0, 18, 7, color, 1))
	var w := Depth.wrap(layer, g)
	var t := g.create_tween().set_loops()
	t.tween_property(g, "scale", Vector2(1.25, 1.25), 0.3)
	t.tween_property(g, "scale", Vector2.ONE, 0.3)
	return w


# ---- teleport.ts / dust.ts ----

static func beam(layer: Node2D, at: Vector2, grow: bool, duration: float) -> void:
	var g := _add(layer, func(ci: CanvasItem):
		ci.draw_rect(Rect2(-7, -120, 14, 120), Depth.c(0x9d8cff, 0.35))
		ci.draw_rect(Rect2(-3, -120, 6, 120), Depth.c(0xc8f0ff, 0.6))
		ci.draw_rect(Rect2(-1, -120, 2, 120), Depth.c(0xffffff, 0.9))
		Depth.fill_ellipse(ci, 0, 0, 26, 8, Depth.c(0xc8f0ff, 0.5)), at.x, at.y, at.y + 1)
	var add_mat := CanvasItemMaterial.new()
	add_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	g.material = add_mat
	g.scale = Vector2(0.1 if grow else 1.0, 1)
	g.modulate.a = 1.0
	var t := _tw(g, Tween.TRANS_QUAD, Tween.EASE_OUT if grow else Tween.EASE_IN).set_parallel()
	t.tween_property(g, "scale:x", 1.2 if grow else 0.0, duration)
	t.tween_property(g, "modulate:a", 1.0 if grow else 0.0, duration)
	if grow:
		t.chain().tween_property(g, "modulate:a", 0.0, 0.2)
	t.chain().tween_callback(func(): _kill(g))
	var colors := [Depth.c(0x6f5bd9), Depth.c(0xc8f0ff), Depth.c(0x9d8cff)]
	for i in 14:
		var color: Color = colors[i % 3]
		var s := _add(layer, func(ci: CanvasItem): ci.draw_rect(Rect2(0, 0, 1, 1), color), at.x + randi_range(-8, 8), at.y - randi_range(0, 12), at.y + 1.1)
		var sw := s.get_parent() as Node2D
		var st := _tw(sw, Tween.TRANS_SINE, Tween.EASE_IN).set_parallel()
		st.tween_property(s, "position:y", s.position.y - randi_range(25, 60), duration).set_delay(i * 0.02)
		st.tween_property(sw, "position:x", at.x + randi_range(-3, 3), duration).set_delay(i * 0.02)
		st.tween_property(s, "modulate:a", 0.0, duration).set_delay(i * 0.02)
		st.chain().tween_callback(func(): _kill(s))


static func dust_puff(layer: Node2D, x: float, y: float) -> void:
	var p := CPUParticles2D.new()
	p.one_shot = true
	p.explosiveness = 1.0
	p.amount = 14
	p.lifetime = 0.52
	p.direction = Vector2(0, -1)
	p.spread = 90
	p.gravity = Vector2.ZERO
	p.initial_velocity_min = 8
	p.initial_velocity_max = 26
	p.scale_amount_min = 2.2
	p.scale_amount_max = 4.0
	var grad := Gradient.new()
	grad.set_color(0, Color(Depth.c(0xc8b490), 0.55))
	grad.set_color(1, Color(Depth.c(0xe0d0b0), 0.0))
	p.color_ramp = grad
	var w := Depth.wrap(layer, p)
	Depth.place(w, x, y - 2, y + 1)
	p.emitting = true
	p.finished.connect(w.queue_free)
