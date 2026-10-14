class_name NightLayer
extends CanvasLayer

## Night darkness with lamp light (client/src/fx/nightLights.ts): lamps fade with the clock,
## glows (lit windows, flames) follow them, and characters near a lamp get its warm light.

const NIGHT := Color8(0x1c, 0x22, 0x52)
const MAX_LIGHTS := 64

var darkness := 0.0
## Where the lamps are heading (from the clock) and where they are now.
var lamp_target := 1.0
var lamp_current := 1.0
var zone: ZoneView
var camera: Camera2D

var _rect: ColorRect
var _mat: ShaderMaterial
var _last_ms := 0.0


func _init() -> void:
	layer = 1
	_rect = ColorRect.new()
	_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_mat = ShaderMaterial.new()
	_mat.shader = preload("res://shaders/night.gdshader")
	_rect.material = _mat
	_rect.visible = false
	add_child(_rect)


func set_darkness(value: float) -> void:
	darkness = value


func set_lamp_level(level: float, instant := false) -> void:
	lamp_target = level
	if instant:
		lamp_current = level


## How much lamp light falls on a point (0..1) and the way it falls (unit vector from the light).
func light_at(x: float, y: float) -> Vector3:
	var strength := darkness * lamp_current
	if zone == null or strength <= 0.02:
		return Vector3.ZERO
	var amount := 0.0
	var dx := 0.0
	var dy := 0.0
	for l in zone.lights:
		var r: float = l.r * 1.1
		var ox: float = x - l.x
		var oy: float = y - l.y
		if absf(ox) > r or absf(oy) > r:
			continue
		var d := sqrt(ox * ox + oy * oy)
		if d >= r:
			continue
		var w := pow(1.0 - d / r, 2.0) * (1.0 if l.lamp else 1.0 / maxf(0.01, lamp_current))
		amount += w
		if d > 0.5:
			dx += ox / d * w
			dy += oy / d * w
	var length := sqrt(dx * dx + dy * dy)
	return Vector3(minf(1.0, amount * strength), dx / length if length > 0.0 else 0.0, dy / length if length > 0.0 else 0.0)


func _process(_delta: float) -> void:
	var time := Time.get_ticks_msec()
	var dt := minf(0.25, (time - _last_ms) / 1000.0) if _last_ms > 0.0 else 0.0
	_last_ms = time
	lamp_current += (lamp_target - lamp_current) * minf(1.0, dt * 1.5)
	if absf(lamp_target - lamp_current) < 0.002:
		lamp_current = lamp_target
	if zone:
		var i := 0
		for glow in zone.glows:
			var node: CanvasItem = glow.node
			if is_instance_valid(node):
				var flicker: float = 1.0 - glow.flicker + glow.flicker * sin(time / 140.0 + i * 1.7)
				node.modulate.a = glow.base * lamp_current * flicker
			i += 1

	var d := darkness
	if d <= 0.01 or camera == null or zone == null:
		_rect.visible = false
		return
	_rect.visible = true
	var view_size := get_viewport().get_visible_rect().size / camera.zoom
	var origin := camera.get_screen_center_position() - view_size / 2.0
	var strength := d * 0.72
	var base := Color(1, 1, 1).lerp(NIGHT, strength)
	_mat.set_shader_parameter("view_origin", origin)
	_mat.set_shader_parameter("view_size", view_size)
	_mat.set_shader_parameter("night", Vector3(base.r, base.g, base.b))
	var packed_lights: Array[Vector4] = []
	var packed_tints: Array[Vector4] = []
	for l in zone.lights:
		var on: float = lamp_current if l.lamp else 1.0
		if on <= 0.01:
			continue
		var flicker: float = 1.0 + sin(time / 90.0 + l.x * 0.37) * l.f
		var r: float = l.r * flicker * (0.6 + 0.4 * on)
		if l.x + r < origin.x or l.x - r > origin.x + view_size.x or l.y + r < origin.y or l.y - r > origin.y + view_size.y:
			continue
		packed_lights.append(Vector4(l.x, l.y, r, minf(1.0, d * 1.1) * on))
		var c: Color = l.c
		packed_tints.append(Vector4(c.r, c.g, c.b, 0.55 * d * on))
		if packed_lights.size() >= MAX_LIGHTS:
			break
	var count := packed_lights.size()
	while packed_lights.size() < MAX_LIGHTS:
		packed_lights.append(Vector4.ZERO)
		packed_tints.append(Vector4.ZERO)
	_mat.set_shader_parameter("count", count)
	_mat.set_shader_parameter("lights", packed_lights)
	_mat.set_shader_parameter("tints", packed_tints)
