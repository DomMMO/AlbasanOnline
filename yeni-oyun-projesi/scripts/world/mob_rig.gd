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
## Drawing the bow (0..1): the arrow hand pulls back, the bow tilts a little (rigs without
## drawn-bow sheets).
var _pull := 0.0
var _front_at := Vector2.ZERO
## Archers: the bow half and fully drawn (front sheets), the nocked arrow's place per frame, and
## which state is showing now (0 slack, 1 half, 2 full).
var _drawn: Array = []
var _nocks: Array = []
var _draw := 0
var _nock_at := Vector2.ZERO
var _front_tex: Texture2D
## The arrow it shoots, when it has its own (the elves'); else the Wood sheet's.
var _arrow: Texture2D
## Casting: the staff raised (0..1), lifted and tipped forward.
var _raise := 0.0
var _staff_head := Vector2.ZERO


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
		if side == "front":
			_front_tex = s.texture
	if rig.has("draw"):
		for path: String in rig.draw.front:
			if not _textures.has(path):
				_textures[path] = load(path)
			_drawn.append(_textures[path])
		_nocks = rig.draw.nock
		if rig.draw.has("arrow"):
			var path := String(rig.draw.arrow)
			if not _textures.has(path):
				_textures[path] = load(path)
			_arrow = _textures[path]


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
		var back_part := float(p[3]) < 0.0
		# Drawing: the front sheet shows the drawn bow (with both hands on it), the back is empty.
		if not _drawn.is_empty():
			if back_part:
				s.visible = _draw == 0
			else:
				s.texture = _front_tex if _draw == 0 else _drawn[_draw - 1]
				var nv: Variant = _nocks[index] if index < _nocks.size() else null
				if nv != null:
					var n := (Vector2(float(nv[0]), float(nv[1])) - Vector2(_fw * 0.5, _fh)) * _scale
					_nock_at = Vector2(px + n.x * side, py + n.y)
		s.rotation_degrees = (_swing * side if s == _swinging else 0.0) + (0.0 if back_part else (-8.0 * _pull + 18.0 * _raise) * side)
		var at := (pivot - Vector2(_fw * 0.5, _fh)) * _scale
		if not back_part:
			at.y -= 4.0 * _raise * _scale * _fh / 64.0
		if back_part:
			at.x -= 3.0 * _pull * _scale
		Depth.place(p[1], px + at.x * side, py + at.y, py + float(p[3]))
		if not back_part:
			_front_at = Vector2(px + at.x * side, py + at.y)
			# The staff's head: up from the hand along the (tipped) staff.
			var up := Vector2(0, -24.0 * _scale * _fh / 64.0).rotated(deg_to_rad(s.rotation_degrees))
			_staff_head = _front_at + up


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


## Draw and loose: pull back, let go (the arrow itself is the caller's).
func shoot(relayout: Callable) -> void:
	if _tween:
		_tween.kill()
	_tween = _parts[0][0].create_tween()
	var step := func(v: float) -> void:
		_pull = v
		relayout.call()
	_tween.tween_method(step, 0.0, 1.0, 0.12).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_tween.tween_method(step, 1.0, 0.0, 0.08).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)


## Where the bow is (the front hand), in the world.
func front_point() -> Vector2:
	return _front_at


## A caster's bolt: raise the staff, hold it up a moment, loose (`on_release` gets the staff's
## head, where the bolt leaves from), lower it.
func raise_and_cast(relayout: Callable, on_release: Callable) -> void:
	if _tween:
		_tween.kill()
	_tween = _parts[0][0].create_tween()
	var step := func(v: float) -> void:
		_raise = v
		relayout.call()
	_tween.tween_method(step, 0.0, 1.0, 0.3).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	_tween.tween_interval(0.12)
	_tween.tween_callback(func(): on_release.call(_staff_head))
	_tween.tween_method(step, 1.0, 0.0, 0.2).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)


## The arrow it shoots (null: the Wood sheet's).
func arrow_texture() -> Texture2D:
	return _arrow


func can_draw() -> bool:
	return not _drawn.is_empty()


## An archer's shot: half draw, full draw, hold a moment, loose (`on_release` gets where the
## nocked arrow was), the bow back slack.
func draw_and_loose(relayout: Callable, on_release: Callable) -> void:
	if _tween:
		_tween.kill()
	_tween = _parts[0][0].create_tween()
	var state := func(v: int) -> void:
		_draw = v
		relayout.call()
	_tween.tween_callback(state.bind(1))
	_tween.tween_interval(0.1)
	_tween.tween_callback(state.bind(2))
	_tween.tween_interval(0.16)
	_tween.tween_callback(func():
		var at := _nock_at
		state.call(0)
		on_release.call(at))


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
