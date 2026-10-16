class_name MobRig
extends RefCounted

## The hands of a mob the Pixel Crawler pack draws without them, and what they hold, exactly as
## the artist placed them frame by frame (the held layer of the pack's .aseprite files): the back
## hand's group and the front hand's group, each a sheet on the body's frames with its pivot (the
## hand) per frame. An attack swings the weapon's group round its hand, not too far.
## Made by tools/mob_sheets.py.

const SWING_BACK := -20.0

static var _textures := {}

var _anims: Dictionary
var _fw := 64.0
var _fh := 64.0
var _scale := 1.0
## [sprite, wrapper, pivots, depth]
var _parts: Array = []
var _swinging: Sprite2D
var _swing_to := 75.0
var _swing := 0.0
var _tween: Tween


func _init(layer: Node2D, meta: Dictionary, draw_scale: float) -> void:
	var rig: Dictionary = meta.rig
	_anims = meta.anims
	_fw = float(meta.frameWidth)
	_fh = float(meta.frameHeight)
	_scale = draw_scale
	_swing_to = float(rig.get("swing_to", 75))
	for side in ["back", "front"]:
		var spec: Dictionary = rig[side]
		var path := String(spec.sheet)
		if not _textures.has(path):
			_textures[path] = load(path)
		var s := Sprite2D.new()
		s.texture = _textures[path]
		s.region_enabled = true
		s.centered = false
		if String(rig.get("swing", "front")) == side:
			_swinging = s
		_parts.append([s, Depth.wrap(layer, s), spec.pivots, -0.3 if side == "back" else 0.3])


## Places the rig for the feet position, facing (flip = facing left), the body's frame, its look.
func layout(px: float, py: float, flip: bool, anim: String, frame: int, modulate: Color) -> void:
	var frames: Array = _anims.get(anim, [])
	var index := int(frames[frame]) if frame < frames.size() else -1
	var side := -1.0 if flip else 1.0
	for p in _parts:
		var s: Sprite2D = p[0]
		var pivots: Array = p[2]
		var pv: Variant = pivots[index] if index >= 0 and index < pivots.size() else null
		if pv == null:
			s.visible = false
			continue
		s.visible = true
		var pivot := Vector2(float(pv[0]), float(pv[1]))
		s.region_rect = Rect2(index * _fw, 0, _fw, _fh)
		s.offset = -pivot
		s.scale = Vector2(_scale * side, _scale)
		s.modulate = modulate
		s.rotation_degrees = _swing * side if s == _swinging else 0.0
		var at := (pivot - Vector2(_fw * 0.5, _fh)) * _scale
		Depth.place(p[1], px + at.x * side, py + at.y, py + float(p[3]))


## Wind back a little, swing forward, come back.
func swing_once(heavy: bool, relayout: Callable) -> void:
	if _swinging == null:
		return
	if _tween:
		_tween.kill()
	_tween = _swinging.create_tween()
	var to := _swing_to * (1.25 if heavy else 1.0)
	var back := SWING_BACK * _swing_to / 75.0
	var step := func(v: float) -> void:
		_swing = v
		relayout.call()
	_tween.tween_method(step, 0.0, back, 0.08).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_tween.tween_method(step, back, to, 0.1).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	_tween.tween_method(step, to, 0.0, 0.18).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)


func set_visible(visible: bool) -> void:
	for p in _parts:
		p[1].visible = visible


## On death what they hold fades with the body's fall.
func drop() -> void:
	if _tween:
		_tween.kill()
	var last: Tween = null
	for p in _parts:
		last = p[0].create_tween()
		last.tween_property(p[0], "modulate:a", 0.0, 0.25)
	if last:
		last.tween_callback(destroy)


func destroy() -> void:
	if _tween:
		_tween.kill()
	for p in _parts:
		if is_instance_valid(p[1]):
			p[1].queue_free()
