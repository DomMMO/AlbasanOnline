class_name WeaponView
extends RefCounted

## The weapon in a character's hand. Placement by facing,
## the swing, and the +7..+10 purple glow with sparkles at +9 and +10.

const GLOW_COLOR := Color(0.651, 0.302, 1.0)
const GLOW := {
	7: {"strength": 1.2},
	8: {"strength": 2.5, "pulse_to": 4.0, "pulse_ms": 900},
	9: {"strength": 3.5, "pulse_to": 6.0, "pulse_ms": 600, "sparkle_ms": 120},
	10: {"strength": 5.0, "pulse_to": 8.0, "pulse_ms": 450, "sparkle_ms": 60},
}
## weapons.ts HAND: hand position relative to the feet, per facing (down, up, left, right).
const HAND := [Vector2(-4, -5), Vector2(4, -5), Vector2(-5, -5), Vector2(5, -5)]
const PAD := 8

static var _glow_shader: Shader = preload("res://shaders/glow.gdshader")
static var _padded := {}

var sprite: Sprite2D
var _w: Node2D
var _grip := Vector2(1.5 / 12.0, 10.5 / 12.0)
var _frame_size := Vector2(12, 12)
var _frames: Array = []
var _pad := 0
var _swing := 0.0
var _swing_tween: Tween
var _pulse: Tween
var _sparkles: CPUParticles2D
var _sparkle_w: Node2D


func _init(layer: Node2D, def_id: String, enhance: int) -> void:
	var tier := GameData.glow_tier(enhance)
	sprite = Sprite2D.new()
	sprite.centered = false
	_w = Depth.wrap(layer, sprite)
	var grip = GameData.get_value("WEAPON_GRIPS", {}).get(def_id)
	if grip is Dictionary:
		_grip = Vector2(float(grip.x), float(grip.y))
	var tex := Art.held(def_id)
	if tex:
		_pad = PAD if tier > 0 else 0
		_frames = _frames_for(def_id, tex, _pad)
		_frame_size = Vector2(tex.get_width() / 2.0, tex.get_height())
		sprite.texture = _frames[0]
	if tier > 0:
		_apply_glow(layer, tier)


## Frame 0 and 1 (mirrored) of the held sprite, with transparent padding for the glow.
static func _frames_for(def_id: String, tex: Texture2D, pad: int) -> Array:
	var key := "%s:%d" % [def_id, pad]
	if _padded.has(key):
		return _padded[key]
	var frames := []
	var w := tex.get_width() / 2
	var h := tex.get_height()
	if pad == 0:
		for i in 2:
			var at := AtlasTexture.new()
			at.atlas = tex
			at.region = Rect2(i * w, 0, w, h)
			frames.append(at)
	else:
		var image := tex.get_image()
		if image.is_compressed():
			image.decompress()
		image.convert(Image.FORMAT_RGBA8)
		for i in 2:
			var padded := Image.create_empty(w + pad * 2, h + pad * 2, false, Image.FORMAT_RGBA8)
			padded.blit_rect(image, Rect2i(i * w, 0, w, h), Vector2i(pad, pad))
			frames.append(ImageTexture.create_from_image(padded))
	_padded[key] = frames
	return frames


func _apply_glow(layer: Node2D, tier: int) -> void:
	var style: Dictionary = GLOW[tier]
	var mat := ShaderMaterial.new()
	mat.shader = _glow_shader
	mat.set_shader_parameter("glow_color", GLOW_COLOR)
	mat.set_shader_parameter("strength", style.strength)
	sprite.material = mat
	if style.has("pulse_to"):
		_pulse = sprite.create_tween().set_loops().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		var half: float = style.pulse_ms / 1000.0
		_pulse.tween_method(func(v: float): mat.set_shader_parameter("strength", v), style.strength, style.pulse_to, half)
		_pulse.tween_method(func(v: float): mat.set_shader_parameter("strength", v), style.pulse_to, style.strength, half)
	if style.has("sparkle_ms"):
		_sparkles = CPUParticles2D.new()
		_sparkles.lifetime = 0.65
		_sparkles.amount = maxi(2, int(650.0 / float(style.sparkle_ms)))
		_sparkles.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
		_sparkles.emission_rect_extents = Vector2(8, 5.5)
		_sparkles.direction = Vector2(0, -1)
		_sparkles.spread = 40
		_sparkles.gravity = Vector2.ZERO
		_sparkles.initial_velocity_min = 2
		_sparkles.initial_velocity_max = 9
		_sparkles.scale_amount_min = 0.9
		_sparkles.scale_amount_max = 0.9
		var grad := Gradient.new()
		grad.set_color(0, Color(1, 0.95, 1, 1))
		grad.set_color(1, Color(0.69, 0.4, 1, 0))
		_sparkles.color_ramp = grad
		var add_mat := CanvasItemMaterial.new()
		add_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
		_sparkles.material = add_mat
		_sparkle_w = Depth.wrap(layer, _sparkles)


## Places the weapon in the hand for the feet position and facing.
func layout(px: float, py: float, facing: int) -> void:
	var hand: Vector2 = HAND[facing]
	var mirrored := facing == ZoneMap.Dir.LEFT or facing == ZoneMap.Dir.DOWN
	if not _frames.is_empty():
		sprite.texture = _frames[1 if mirrored else 0]
	var gx := (1.0 - _grip.x) if mirrored else _grip.x
	sprite.offset = -Vector2(gx * _frame_size.x + _pad, _grip.y * _frame_size.y + _pad)
	sprite.rotation_degrees = -_swing if mirrored else _swing
	# Seen from behind (facing up) the weapon is behind the body.
	var depth := py - 0.5 if facing == ZoneMap.Dir.UP else py + 0.5
	Depth.place(_w, px + hand.x, py + hand.y, depth)
	if _sparkle_w:
		Depth.place(_sparkle_w, px + hand.x, py + hand.y - 5.5, depth + 0.1)


## Wind back, chop forward, recover.
func swing_once(heavy: bool) -> void:
	if _swing_tween:
		_swing_tween.kill()
	_swing = 0.0
	_swing_tween = sprite.create_tween()
	_swing_tween.tween_method(_set_swing, 0.0, -35.0, 0.07).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_swing_tween.tween_method(_set_swing, -35.0, 125.0 if heavy else 100.0, 0.12 if heavy else 0.1).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	_swing_tween.tween_method(_set_swing, 125.0 if heavy else 100.0, 0.0, 0.16).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)


## Two full turns (Whirlwind).
func spin() -> void:
	if _swing_tween:
		_swing_tween.kill()
	_swing_tween = sprite.create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	_swing_tween.tween_method(_set_swing, 0.0, 720.0, 0.42)
	_swing_tween.tween_callback(func(): _swing = 0.0)


func _set_swing(angle: float) -> void:
	_swing = angle


func set_visible(visible: bool) -> void:
	sprite.visible = visible
	if _sparkles:
		_sparkles.visible = visible


func set_alpha(alpha: float) -> void:
	sprite.modulate.a = alpha


func destroy() -> void:
	if _swing_tween:
		_swing_tween.kill()
	if _pulse:
		_pulse.kill()
	if is_instance_valid(_sparkle_w):
		_sparkle_w.queue_free()
	if is_instance_valid(_w):
		_w.queue_free()
