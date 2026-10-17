class_name EntityView
extends Node

## One player, mob, NPC, portal or loot chest on screen.
## Holds no game logic; it only shows what it is told. Position (x, y) is the feet.
##
## Hitboxes: `hurtbox` (Area2D, layer 1) covers the opaque pixels of the sprite and takes mouse
## clicks (targeting, talking, looting); `body_box` (Area2D, layer 2) is the server's collision
## box at the feet (shared PLAYER_HITBOX: 10 x 6), shown with Debug > Visible Collision Shapes.

signal clicked(view: EntityView, event: InputEventMouseButton)
signal hovered(view: EntityView, inside: bool)

const HP_BAR_WIDTH := 16.0
const SEAT_CROP := 3
const SEAT_DROP := 1.0
const HORSE_RIDER_LIFT := 20.0
## The riding horse (assetpack/HORSE, Pixel Horse): 64 x 64 frames, side view facing right,
## hooves on the frame's last row, the saddle's middle at x 32.
const HORSE_SHEETS := "res://assetpack/HORSE/Horse I/Horse Black/64x64_Atlas_Horse_%s.png"
const HORSE_FRAME := 64
const SLASH_COLORS := {"normal": 0xe8e8f0, "heavy": 0xff7a3d, "spin": 0xffc04d}
const Dir := ZoneMap.Dir

static var _entity_shader: Shader = preload("res://shaders/entity.gdshader")
static var _horse_frames := {}

var layer: Node2D
var set: Sprites.SpriteSet
var sprite: AnimatedSprite2D
var hurtbox: Area2D
var body_box: Area2D
var _sprite_w: Node2D
var _label: Label
var _label_holder: Node2D
var _label_w: Node2D
var _hp_bar: Depth.Painter
var _hp_w: Node2D
var _hp_ratio := 1.0
var _hp_visible := false
## A mob's nameplate: its name inside a bar that empties with its health (empty = no plate).
var _plate_name := ""
var _plate_color := Color.WHITE
## The cast bar under the plate: what it casts, its colour (yellow: an interrupt stops it; grey:
## only a stun), when it began and how long it takes (ms; 0 = not casting). After a stop the bar
## shows "Kesildi" until _cast_flash_until.
var _cast_name := ""
var _cast_color := Color.WHITE
var _cast_start := 0
var _cast_ms := 0.0
var _cast_flash_until := 0
const CAST_YELLOW := Color(0.95, 0.75, 0.15)
const CAST_GREY := Color(0.62, 0.64, 0.66)
const CAST_FLASH_MS := 700
const PLATE_FONT_SIZE := 7
## The whole plate drawn at this scale (text and width); its height 90% of the 9 px it was.
const PLATE_SCALE := 0.95
const PLATE_HEIGHT := 9.0 * 0.9 / PLATE_SCALE
const CAST_BAR_HEIGHT := 7.0
const CAST_FONT_SIZE := 6
var _raw := Vector2.ZERO
var _facing := Dir.DOWN
var _offset := Vector2.ZERO
var _scale := 1.0
var _material: ShaderMaterial
var _hurt_shape: CollisionShape2D

var _horse: AnimatedSprite2D
var _horse_w: Node2D
var _horse_key := ""
var _ride_left := false
var _moving := false
var _seated := false
var _gallop_dust: CPUParticles2D
var _gallop_w: Node2D

var _weapon: WeaponView
var _weapon_key := ""
## Hands and weapon of a mob drawn without them (the pack's enemies).
var _rig: MobRig
var _weapon_hidden := false

var _crown: Node2D
var _crown_w: Node2D
var _gm: Label
var _gm_holder: Node2D
var _gm_w: Node2D
var _gm_bounce := 0.0

var _action_until := 0
## When it last moved: a mob keeps walking over the short gaps between position updates (it
## would flicker between idle and walk otherwise, starting the walk over each time).
var _moved_at := -10000
const WALK_HOLD_MS := 180
var _base_tint: Variant = null
var _light_tint: Variant = null
var _shadow: Depth.Painter
var _shadow_w: Node2D
var _shadow_len := 14.0
var _dimmed := false
var _ghost := false
var _visible := true
var _destroyed := false


func _init(world_layer: Node2D, x: float, y: float, appearance: Dictionary, name_text := "", name_color := Color.WHITE, draw_scale := 1.0, asset := "") -> void:
	layer = world_layer
	_raw = Vector2(x, y)
	_scale = draw_scale
	set = Sprites.sprite_set(appearance, asset)
	sprite = AnimatedSprite2D.new()
	sprite.centered = false
	sprite.sprite_frames = set.frames
	sprite.scale = Vector2(_scale, _scale)
	_material = ShaderMaterial.new()
	_material.shader = _entity_shader
	sprite.material = _material
	_sprite_w = Depth.wrap(layer, sprite)
	_apply_origin()
	_build_hitboxes()
	match set.kind:
		"image":
			_play("idle")
			if set.appearance.has("tint"):
				set_base_tint(int(set.appearance.tint))
		"slime", "portal":
			if set.frames.has_animation("idle"):
				_play("idle")
			else:
				_play("frame0")
		_:
			_play(_idle_name(Dir.DOWN))
	if not name_text.is_empty():
		_label = Label.new()
		_label.text = name_text
		_label.label_settings = Fonts.label_settings(Fonts.names(), 7, name_color, 2, Color.BLACK)
		_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_label_holder = Node2D.new()
		_label_holder.add_child(_label)
		_label_w = Depth.wrap(layer, _label_holder)
		_label.reset_size()
		_label.position = Vector2(-_label.size.x / 2.0, -_label.size.y)
	_hp_bar = Depth.Painter.new(_paint_hp)
	_hp_bar.visible = false
	_hp_w = Depth.wrap(layer, _hp_bar)
	if set.kind == "image":
		var meta := Sprites.sheet_meta(String(set.appearance.get("key", "")))
		if meta.has("rig"):
			_rig = MobRig.new(layer, meta, _scale)
			sprite.frame_changed.connect(_layout_rig)
			sprite.animation_changed.connect(_layout_rig)
	set_position(x, y)


func _ready() -> void:
	set_process(false)


var x: float:
	get:
		return _raw.x

var y: float:
	get:
		return _raw.y

var position: Vector2:
	get:
		return _raw


## Top of the sprite, for floating text.
var head_y: float:
	get:
		return _raw.y - _lift() - set.height * _scale


var mounted: bool:
	get:
		return _horse != null


func _play(anim: String) -> void:
	if sprite.sprite_frames.has_animation(anim):
		if sprite.animation != anim or not sprite.is_playing():
			sprite.play(anim)


func _apply_origin() -> void:
	var ox := set.origin.x
	if sprite.flip_h:
		ox = 1.0 - ox
	sprite.offset = Vector2(-ox * set.width, -set.origin.y * set.height)
	_update_hurtbox()


# ---- Hitboxes ----

func _build_hitboxes() -> void:
	hurtbox = Area2D.new()
	hurtbox.collision_layer = 1
	hurtbox.collision_mask = 0
	hurtbox.monitoring = false
	hurtbox.monitorable = false
	hurtbox.input_pickable = true
	_hurt_shape = CollisionShape2D.new()
	_hurt_shape.shape = RectangleShape2D.new()
	hurtbox.add_child(_hurt_shape)
	sprite.add_child(hurtbox)
	hurtbox.input_event.connect(_on_input)
	hurtbox.mouse_entered.connect(func(): hovered.emit(self, true))
	hurtbox.mouse_exited.connect(func(): hovered.emit(self, false))
	_update_hurtbox()

	body_box = Area2D.new()
	body_box.collision_layer = 2
	body_box.collision_mask = 0
	body_box.monitoring = false
	body_box.monitorable = false
	body_box.input_pickable = false
	var feet := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	var hb: Dictionary = GameData.get_value("PLAYER_HITBOX", {"halfWidth": 5, "height": 6})
	rect.size = Vector2(float(hb.halfWidth) * 2.0, float(hb.height))
	feet.shape = rect
	feet.position = Vector2(0, -float(hb.height) / 2.0)
	feet.debug_color = Color(1, 0.3, 0.2, 0.45)
	body_box.add_child(feet)
	_sprite_w.add_child(body_box)


## The opaque part of the sprite (frame coordinates), so clicks hit the creature, not the empty cell.
static var _opaque_cache := {}


func _opaque_rect() -> Rect2:
	if _opaque_cache.has(set.key):
		return _opaque_cache[set.key]
	var rect := Rect2(0, 0, set.width, set.height)
	var tex: Texture2D = null
	for name in ["idle", "idle_down", "idle_side", "frame0"]:
		if set.frames.has_animation(name):
			tex = set.frames.get_frame_texture(name, 0)
			break
	if tex is AtlasTexture:
		var image := (tex as AtlasTexture).atlas.get_image()
		if image:
			if image.is_compressed():
				image.decompress()
			var region := (tex as AtlasTexture).region
			var used := image.get_region(Rect2i(region)).get_used_rect()
			if used.size.x > 0:
				rect = Rect2(used)
	_opaque_cache[set.key] = rect
	return rect


func _update_hurtbox() -> void:
	if _hurt_shape == null:
		return
	var r := _opaque_rect()
	if sprite.flip_h:
		r.position.x = set.width - r.position.x - r.size.x
	(_hurt_shape.shape as RectangleShape2D).size = r.size + Vector2(2, 2)
	_hurt_shape.position = sprite.offset + r.position + r.size / 2.0
	_hurt_shape.debug_color = Color(0.2, 0.6, 1.0, 0.35)


func _on_input(_viewport: Node, event: InputEvent, _shape: int) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		clicked.emit(self, event)
		get_viewport().set_input_as_handled()


func set_interactive(on: bool) -> void:
	hurtbox.input_pickable = on


func set_name_color(color: Color) -> void:
	if _label:
		_label.label_settings.font_color = color


# ---- Riding ----

func _lift() -> float:
	if _horse:
		return HORSE_RIDER_LIFT
	return -SEAT_DROP if _seated else 0.0


func set_seated(on: bool) -> void:
	if on == _seated:
		return
	_seated = on
	_apply_crop()
	set_position(_raw.x, _raw.y)


func _apply_crop() -> void:
	# Sitting: the lower legs are hidden under the seat.
	if _seated:
		var tex := sprite.sprite_frames.get_frame_texture(sprite.animation, sprite.frame)
		if tex is AtlasTexture:
			var cropped := AtlasTexture.new()
			cropped.atlas = tex.atlas
			cropped.region = Rect2(tex.region.position, tex.region.size - Vector2(0, SEAT_CROP))
			# Seated characters don't animate: show the cropped still frame.
			var frames := SpriteFrames.new()
			frames.remove_animation("default")
			frames.add_animation("seat")
			frames.add_frame("seat", cropped)
			sprite.sprite_frames = frames
			sprite.play("seat")
	elif sprite.sprite_frames != set.frames:
		sprite.sprite_frames = set.frames
		set_animation(_facing, false)


## The riding horse's animations: "run" and "idle", side view (one horse for every breed and look
## for now; its colours come later).
static func horse_frames(_look: Dictionary) -> SpriteFrames:
	if _horse_frames.has("pack"):
		return _horse_frames["pack"]
	var frames := SpriteFrames.new()
	frames.remove_animation("default")
	for spec in [["run", "Run", 6, 10.0], ["idle", "Idle", 5, 6.0]]:
		var tex: Texture2D = load(HORSE_SHEETS % spec[1])
		frames.add_animation(spec[0])
		frames.set_animation_speed(spec[0], spec[3])
		for i in int(spec[2]):
			var at := AtlasTexture.new()
			at.atlas = tex
			at.region = Rect2((i % 3) * HORSE_FRAME, (i / 3) * HORSE_FRAME, HORSE_FRAME, HORSE_FRAME)
			frames.add_frame(spec[0], at)
	_horse_frames["pack"] = frames
	return frames


## The look a player's horse is drawn with: its synced colours, else its breed's.
static func horse_look_for(look: String, breed: String) -> Dictionary:
	var decoded = HorsePainter.decode(look) if not look.is_empty() else null
	return decoded if decoded != null else HorsePainter.breed_look(breed)


func set_mounted(on: bool, look := "", breed := "village") -> void:
	var horse_look := horse_look_for(look, breed)
	var key := HorsePainter.encode(horse_look) if on else ""
	if key == _horse_key and on == (_horse != null):
		return
	set_gallop(false)
	if _horse_w:
		_horse_w.queue_free()
	_horse = null
	_horse_w = null
	_horse_key = key
	if on:
		_horse = AnimatedSprite2D.new()
		_horse.centered = false
		_horse.offset = Vector2(-HORSE_FRAME / 2.0, -HORSE_FRAME)
		_horse.sprite_frames = horse_frames(horse_look)
		_horse.play("idle")
		_horse.modulate.a = sprite.modulate.a
		_horse_w = Depth.wrap(layer, _horse)
	set_animation(_facing, _moving)


func set_gallop(on: bool) -> void:
	on = on and _horse != null
	if on == (_gallop_dust != null):
		return
	if _horse:
		_horse.speed_scale = 1.8 if on else 1.0
	if not on:
		var dust := _gallop_dust
		var w := _gallop_w
		_gallop_dust = null
		_gallop_w = null
		dust.emitting = false
		get_tree().create_timer(0.6).timeout.connect(func(): if is_instance_valid(w): w.queue_free())
		return
	_gallop_dust = CPUParticles2D.new()
	_gallop_dust.amount = 9
	_gallop_dust.lifetime = 0.42
	_gallop_dust.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	_gallop_dust.emission_rect_extents = Vector2(6, 0.5)
	_gallop_dust.direction = Vector2(0, -1)
	_gallop_dust.spread = 45
	_gallop_dust.gravity = Vector2.ZERO
	_gallop_dust.initial_velocity_min = 4
	_gallop_dust.initial_velocity_max = 14
	_gallop_dust.scale_amount_min = 1.6
	_gallop_dust.scale_amount_max = 3.2
	var grad := Gradient.new()
	grad.set_color(0, Color(Depth.c(0xc8b490), 0.45))
	grad.set_color(1, Color(Depth.c(0xe0d0b0), 0.0))
	_gallop_dust.color_ramp = grad
	_gallop_w = Depth.wrap(layer, _gallop_dust)
	set_position(_raw.x, _raw.y)


# ---- Over the name: crown and GM tag ----

func set_crown(on: bool) -> void:
	if on == (_crown != null):
		return
	if not on:
		_crown_w.queue_free()
		_crown = null
		_crown_w = null
		return
	_crown = Node2D.new()
	var glow := Depth.Painter.new(func(ci: CanvasItem): ci.draw_circle(Vector2(0, -4), 9, Depth.c(0xffd34d, 0.28)))
	var add_mat := CanvasItemMaterial.new()
	add_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	glow.material = add_mat
	_crown.add_child(glow)
	var image := Sprite2D.new()
	image.texture = Art.tex("res://art/ui/crown.png")
	image.centered = false
	if image.texture:
		image.offset = Vector2(-image.texture.get_width() / 2.0, -image.texture.get_height())
	_crown.add_child(image)
	_crown_w = Depth.wrap(layer, _crown)
	var t := glow.create_tween().set_loops().set_trans(Tween.TRANS_SINE)
	t.tween_property(glow, "scale", Vector2(1.35, 1.35), 0.75)
	t.parallel().tween_property(glow, "modulate:a", 0.35, 0.75)
	t.tween_property(glow, "scale", Vector2.ONE, 0.75)
	t.parallel().tween_property(glow, "modulate:a", 1.0, 0.75)
	var r := image.create_tween().set_loops().set_trans(Tween.TRANS_SINE)
	r.tween_property(image, "rotation_degrees", 6.0, 1.3).from(-6.0)
	r.tween_property(image, "rotation_degrees", -6.0, 1.3)
	set_position(_raw.x, _raw.y)


func set_gm_tag(on: bool) -> void:
	if on == (_gm != null):
		return
	if not on:
		_gm_w.queue_free()
		_gm = null
		_gm_w = null
		set_process(_cast_ms > 0.0 or Time.get_ticks_msec() < _cast_flash_until)
		return
	_gm = Label.new()
	_gm.text = "GM"
	_gm.label_settings = Fonts.label_settings(Fonts.title(true), 6, Color("#e6c46a"), 1, Color("#3a1a0a"))
	_gm_holder = Node2D.new()
	_gm_holder.add_child(_gm)
	_gm.reset_size()
	_gm.position = Vector2(-_gm.size.x / 2.0, -_gm.size.y)
	_gm_w = Depth.wrap(layer, _gm_holder)
	set_process(true)
	set_position(_raw.x, _raw.y)


func _process(_delta: float) -> void:
	# Gone (killed mid-cast, say): its plate is freed, nothing more to draw.
	if _destroyed or not is_instance_valid(_hp_bar):
		set_process(false)
		return
	if _cast_ms > 0.0 or _cast_flash_until > 0:
		if _cast_ms <= 0.0 and Time.get_ticks_msec() >= _cast_flash_until:
			_cast_flash_until = 0
			if _gm == null:
				set_process(false)
		_hp_bar.queue_redraw()
	if _gm:
		# A steady little bounce (Quad ease out, 320 ms each way).
		var t := fmod(Time.get_ticks_msec() / 320.0, 2.0)
		var k := t if t < 1.0 else 2.0 - t
		_gm_bounce = -2.0 * (1.0 - (1.0 - k) * (1.0 - k))
		set_position(_raw.x, _raw.y)


func _layout_overhead(px: float, py: float, top: float) -> void:
	if _crown == null and _gm == null:
		return
	var ly := top - 2.0
	if _label:
		var label_y := (top - 5.0) if _hp_visible else (top - 1.0)
		ly = label_y - _label.size.y + 1.0
	var depth := 100000.0 + py + 0.2
	if _crown:
		Depth.place(_crown_w, px, ly, depth + 0.1)
		ly -= 10.0
	if _gm:
		Depth.place(_gm_w, px, ly + 2.0 + _gm_bounce, depth + 0.3)


# ---- Position ----

func set_position(px_raw: float, py_raw: float) -> void:
	_raw = Vector2(px_raw, py_raw)
	if _destroyed:
		return
	var px := roundf(px_raw + _offset.x)
	var py := roundf(py_raw + _offset.y)
	var lift := _lift()
	Depth.place(_sprite_w, px, py - lift, py)
	if _horse:
		Depth.place(_horse_w, px, py, py - 0.2)
		if _gallop_w:
			Depth.place(_gallop_w, px, py - 2.0, py - 0.3)
	var top := py - lift - set.height * _scale
	if _plate_name.is_empty():
		Depth.place(_hp_w, px - HP_BAR_WIDTH / 2.0, top - 4.0, 100000.0 + py)
	else:
		# Over the head itself (the pack's frames are much taller than what is drawn in them).
		var head := py - lift + (_opaque_rect().position.y - set.origin.y * set.height) * _scale
		Depth.place(_hp_w, px, head - 3.0, 100000.0 + py)
	if _label_w:
		Depth.place(_label_w, px, (top - 5.0) if _hp_visible else (top - 1.0), 100000.0 + py)
	_layout_overhead(px, py, top)
	if _weapon:
		_weapon.layout(px, py - lift, _facing)
	_layout_rig()


func _layout_rig() -> void:
	if _rig == null or _destroyed:
		return
	var px := roundf(_raw.x + _offset.x)
	var py := roundf(_raw.y + _offset.y)
	_rig.layout(px, py - _lift(), sprite.flip_h, String(sprite.animation), sprite.frame, sprite.modulate)


# ---- Look ----

func set_look(appearance: Dictionary) -> void:
	var next := Sprites.sprite_set(appearance)
	if next.key == set.key:
		return
	var before = set.appearance.get("gear") if set.kind == "humanoid" else null
	var after = appearance.get("gear") if String(appearance.get("type", "")) == "humanoid" else null
	set = next
	sprite.sprite_frames = set.frames
	_apply_origin()
	set_animation(_facing, _moving)
	if _seated:
		_apply_crop()
	if not (before is Dictionary) or not (after is Dictionary):
		return
	var put_on := false
	for part in ["head", "chest", "legs", "feet"]:
		var b = before.get(part)
		var a = after.get(part)
		if b != null and String(b) != "" and b != a:
			_drop_piece(String(b), part)
		if a != null and String(a) != "" and b != a:
			put_on = true
	if put_on:
		flash()


const BODY_PART_Y := {"head": -14, "chest": -9, "legs": -4, "feet": -1, "weapon": -8, "neck": -11, "ring": -7, "earring": -13}


## An equipment icon pops off the body and tumbles to the ground.
func _drop_piece(def_id: String, part: String) -> void:
	var tex := Art.held(def_id)
	if tex == null:
		return
	var piece := Sprite2D.new()
	var at := AtlasTexture.new()
	at.atlas = tex
	at.region = Rect2(0, 0, tex.get_width() / 2.0, tex.get_height())
	piece.texture = at
	piece.scale = Vector2(0.75, 0.75)
	var w := Depth.wrap(layer, piece)
	var start := Vector2(roundf(_raw.x), roundf(_raw.y + BODY_PART_Y.get(part, -8)))
	Depth.place(w, start.x, start.y, _raw.y + 30)
	var side := -1.0 if randf() < 0.5 else 1.0
	var t := piece.create_tween()
	t.tween_property(piece, "position", piece.position + Vector2(side * 3, -6), 0.12).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	t.tween_property(piece, "position", piece.position + Vector2(side * 8, 10), 0.42).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	t.parallel().tween_property(piece, "rotation_degrees", side * 140, 0.42)
	t.parallel().tween_property(piece, "modulate:a", 0.0, 0.42)
	t.tween_callback(w.queue_free)


# ---- Weapon ----

func set_weapon(def_id: String, enhance: int) -> void:
	var key := ("%s:%d" % [def_id, GameData.glow_tier(enhance)]) if not def_id.is_empty() else ""
	if key == _weapon_key:
		return
	var previous := _weapon_key.split(":")[0] if not _weapon_key.is_empty() else ""
	if not previous.is_empty() and previous != def_id:
		_drop_piece(previous, "weapon")
	_weapon_key = key
	if _weapon:
		_weapon.destroy()
	_weapon = WeaponView.new(layer, def_id, enhance) if not def_id.is_empty() else null
	if _weapon:
		_weapon.set_alpha(sprite.modulate.a)
		_weapon.set_visible(_visible and not _weapon_hidden)
	set_position(_raw.x, _raw.y)


func set_weapon_hidden(hidden: bool) -> void:
	if hidden == _weapon_hidden:
		return
	_weapon_hidden = hidden
	if _weapon:
		_weapon.set_visible(_visible and not hidden)


# ---- Attacks ----

func play_attack(kind: String, target: Variant = null) -> void:
	var color := Depth.c(SLASH_COLORS.get(kind, 0xe8e8f0))
	if kind == "spin":
		if _weapon:
			_weapon.spin()
		Fx.ring(layer, _raw.x, _raw.y - 3, color, 30)
		return
	if target == null:
		return
	var tp: Vector2 = target
	var dx := tp.x - _raw.x
	var dy := tp.y - _raw.y
	var angle := atan2(dy, dx)
	if set.kind == "humanoid":
		_facing = ZoneMap.direction_toward(dx, dy, _facing)
	if _rig:
		if dx != 0.0:
			sprite.flip_h = dx < 0
			_apply_origin()
		_rig.swing_once(kind == "heavy", _layout_rig)
	elif _weapon:
		_weapon.swing_once(kind == "heavy")
	elif set.kind == "image" and set.has_anim("attack"):
		if dx != 0.0:
			set_animation(Dir.LEFT if dx < 0 else Dir.RIGHT, false)
		play_action("attack", 520)
	else:
		lunge(dx, dy)
	var reach := 7.0
	var length := sqrt(dx * dx + dy * dy)
	if length == 0.0:
		length = 1.0
	var heavy := kind == "heavy"
	Fx.slash(layer, _raw.x + dx / length * reach, _raw.y - 6 + dy / length * reach, angle, color, 16.0 if heavy else 12.0, heavy)


## A mob's shot: turn to the target, draw, and when the string is let go `on_release` gets the
## bow's place (the arrow flies from there).
func play_shot(target: Vector2, on_release: Callable) -> void:
	var dx := target.x - _raw.x
	if set.kind == "image" and dx != 0.0:
		sprite.flip_h = dx < 0
		_apply_origin()
	if _rig and _rig.can_draw():
		_rig.draw_and_loose(_layout_rig, func(at: Vector2):
			if not _destroyed:
				on_release.call(at))
		return
	if _rig:
		_rig.shoot(_layout_rig)
	get_tree().create_timer(0.12).timeout.connect(func():
		if _destroyed:
			return
		on_release.call(_rig.front_point() if _rig else Vector2(_raw.x, _raw.y - 10)))


## The arrow this mob shoots, when it has its own (null: the Wood sheet's).
func arrow_texture() -> Texture2D:
	return _rig.arrow_texture() if _rig else null


## A mob caster's bolt: turn to the target, raise the staff, and `on_release` gets where the bolt
## leaves from (the staff's head).
func play_cast(target: Vector2, on_release: Callable) -> void:
	var dx := target.x - _raw.x
	if set.kind == "image" and dx != 0.0:
		sprite.flip_h = dx < 0
		_apply_origin()
	if _rig:
		_rig.raise_and_cast(_layout_rig, func(at: Vector2):
			if not _destroyed:
				on_release.call(at))
		return
	get_tree().create_timer(0.42).timeout.connect(func():
		if not _destroyed:
			on_release.call(Vector2(_raw.x, _raw.y - 18)))


## Quick hop towards the target and back (mobs and unarmed attackers).
func lunge(dx: float, dy: float) -> void:
	var length := sqrt(dx * dx + dy * dy)
	if length == 0.0:
		length = 1.0
	var to := Vector2(dx / length * 4.0, dy / length * 4.0)
	var t := create_tween().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	t.tween_method(_set_offset, Vector2.ZERO, to, 0.07)
	t.tween_method(_set_offset, to, Vector2.ZERO, 0.07)


func _set_offset(v: Vector2) -> void:
	_offset = v
	set_position(_raw.x, _raw.y)


func play_action(name: String, duration_ms: int) -> void:
	if set.kind != "image" or not set.has_anim(name):
		return
	sprite.play(name)
	_action_until = Time.get_ticks_msec() + duration_ms


func rise(height: float, duration_ms: float) -> void:
	var t := create_tween().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	t.tween_method(_set_offset, _offset, Vector2(_offset.x, -height), duration_ms / 1000.0)


func land() -> void:
	var t := create_tween().set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	t.tween_method(_set_offset, _offset, Vector2(_offset.x, 0), 0.13)


# ---- Animation ----

func set_animation(dir: int, moving: bool) -> void:
	_facing = dir
	if _seated:
		return
	match set.kind:
		"image":
			if dir == Dir.LEFT:
				sprite.flip_h = true
			elif dir == Dir.RIGHT:
				sprite.flip_h = false
			_apply_origin()
			_layout_rig()
			var now := Time.get_ticks_msec()
			if moving:
				_moved_at = now
			if now < _action_until:
				return
			_play("walk" if now - _moved_at < WALK_HOLD_MS and set.has_anim("walk") else "idle")
			return
		"chest", "portal":
			return
		"slime":
			sprite.speed_scale = 2.5 if moving else 1.0
			return
	if dir == Dir.LEFT:
		sprite.flip_h = true
	elif dir == Dir.RIGHT:
		sprite.flip_h = false
	if set.kind == "wolf" or set.kind == "rabbit":
		if moving:
			_play("side")
		else:
			_play(_idle_name(Dir.RIGHT))
		_apply_origin()
		return
	var anim := "up" if dir == Dir.UP else ("down" if dir == Dir.DOWN else "side")
	if dir == Dir.UP or dir == Dir.DOWN:
		sprite.flip_h = false
	_apply_origin()
	_moving = moving
	if _horse:
		# The horse is drawn from the side only: going up or down, horse and rider keep facing the
		# way they last went across.
		if dir == Dir.LEFT or dir == Dir.RIGHT:
			_ride_left = dir == Dir.LEFT
		_horse.flip_h = _ride_left
		sprite.flip_h = _ride_left
		var gait := "run" if moving else "idle"
		if _horse.animation != gait or not _horse.is_playing():
			_horse.play(gait)
		_play(_idle_name(Dir.RIGHT))
		set_position(_raw.x, _raw.y)
		return
	if moving:
		_play(anim)
	else:
		_play(_idle_name(dir))
	set_position(_raw.x, _raw.y)


## The standing frame for a facing: "idle_down" / "idle_up" / "idle_side" (wolves, rabbits: "idle_side").
func _idle_name(dir: int) -> String:
	var side := "up" if dir == Dir.UP else ("down" if dir == Dir.DOWN else "side")
	if set.kind == "wolf" or set.kind == "rabbit":
		side = "side"
	for name in ["idle_" + side, "idle_down", "idle", "frame0"]:
		if set.frames.has_animation(name):
			return name
	return set.frames.get_animation_names()[0]


# ---- Health bar ----

## A mob's nameplate over its head, always shown: its name on a bar that empties with its health.
func set_plate(plate_name: String, frame_color: Color) -> void:
	_plate_name = plate_name
	_plate_color = frame_color
	_hp_visible = true
	_hp_bar.visible = _visible
	_hp_bar.queue_redraw()
	set_position(_raw.x, _raw.y)


func set_health(hp: float, max_hp: float, visible: bool) -> void:
	if not _plate_name.is_empty():
		visible = true
	_hp_visible = visible
	_hp_bar.visible = visible and _visible
	if visible:
		_hp_ratio = clampf(hp / max_hp, 0.0, 1.0) if max_hp > 0 else 0.0
		_hp_bar.queue_redraw()
	set_position(_raw.x, _raw.y)


func _paint_hp(ci: CanvasItem) -> void:
	if not _plate_name.is_empty():
		_paint_plate(ci)
		return
	ci.draw_rect(Rect2(-1, -1, HP_BAR_WIDTH + 2, 4), Color(0, 0, 0, 0.8))
	ci.draw_rect(Rect2(0, 0, HP_BAR_WIDTH, 2), Depth.c(0x5a1a1a))
	ci.draw_rect(Rect2(0, 0, ceilf(HP_BAR_WIDTH * _hp_ratio), 2), Depth.c(0x4cd964) if _hp_ratio > 0.3 else Depth.c(0xe74c3c))


## A cast bar under the plate: `interruptible` yellow (an interrupt stops it), else grey (only a
## stun does). It fills over `cast_ms`.
func start_cast(cast_name: String, cast_ms: float, interruptible: bool) -> void:
	if _destroyed:
		return
	_cast_name = cast_name
	_cast_color = CAST_YELLOW if interruptible else CAST_GREY
	_cast_start = Time.get_ticks_msec()
	_cast_ms = maxf(1.0, cast_ms)
	_cast_flash_until = 0
	set_process(true)


## The cast is over: done (the bar goes), or stopped (it shows "Kesildi" a moment).
func end_cast(interrupted: bool) -> void:
	if _cast_ms <= 0.0 or _destroyed or not is_instance_valid(_hp_bar):
		_cast_ms = 0.0
		return
	_cast_ms = 0.0
	_cast_flash_until = Time.get_ticks_msec() + CAST_FLASH_MS if interrupted else 0
	_hp_bar.queue_redraw()


## The plate: a dark frame, the health in red, the name in the middle (white, outlined).
func _paint_plate(ci: CanvasItem) -> void:
	var font := Fonts.names()
	var text_w := font.get_string_size(_plate_name, HORIZONTAL_ALIGNMENT_LEFT, -1, PLATE_FONT_SIZE).x
	var w := maxf(26.0, ceilf(text_w) + 8.0)
	var h := PLATE_HEIGHT
	var casting := _cast_ms > 0.0 or Time.get_ticks_msec() < _cast_flash_until
	var cast_label := "Kesildi" if _cast_ms <= 0.0 else _cast_name
	if casting:
		# The cast bar gets as wide as its spell's name needs.
		w = maxf(w, ceilf(font.get_string_size(cast_label, HORIZONTAL_ALIGNMENT_LEFT, -1, CAST_FONT_SIZE).x) + 8.0)
	var x0 := -roundf(w / 2.0)
	# Casting: the plate moves up and the cast bar takes its place over the head.
	var y0 := -h - ((CAST_BAR_HEIGHT + 2.0) if casting else 0.0)
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2(PLATE_SCALE, PLATE_SCALE))
	ci.draw_rect(Rect2(x0 - 1, y0 - 1, w + 2, h + 2), Color(_plate_color, 0.9) if _plate_color != Color.WHITE else Color(0, 0, 0, 0.85))
	ci.draw_rect(Rect2(x0, y0, w, h), Color(0.08, 0.06, 0.07, 0.82))
	ci.draw_rect(Rect2(x0, y0, roundf(w * _hp_ratio), h), Color(0.62, 0.12, 0.12, 0.92))
	ci.draw_rect(Rect2(x0, y0, roundf(w * _hp_ratio), 2), Color(0.82, 0.25, 0.22, 0.92))
	var base := Vector2(-roundf(text_w / 2.0), y0 + roundf((h + font.get_ascent(PLATE_FONT_SIZE) - font.get_descent(PLATE_FONT_SIZE)) / 2.0))
	ci.draw_string_outline(font, base, _plate_name, HORIZONTAL_ALIGNMENT_LEFT, -1, PLATE_FONT_SIZE, 2, Color(0, 0, 0, 0.95))
	ci.draw_string(font, base, _plate_name, HORIZONTAL_ALIGNMENT_LEFT, -1, PLATE_FONT_SIZE, Color(1, 1, 1))
	if casting:
		_paint_cast(ci, font, x0, y0 + h + 2.0, w, cast_label)


## The cast bar, as wide as the plate, just under it: the spell's name on it, filling as it goes.
func _paint_cast(ci: CanvasItem, font: Font, x0: float, y0: float, w: float, label: String) -> void:
	var now := Time.get_ticks_msec()
	var flashing := _cast_ms <= 0.0
	var h := CAST_BAR_HEIGHT
	var progress := 1.0 if flashing else clampf((now - _cast_start) / _cast_ms, 0.0, 1.0)
	var fill := Color(0.85, 0.2, 0.18) if flashing else _cast_color
	ci.draw_rect(Rect2(x0 - 1, y0 - 1, w + 2, h + 2), Color(0, 0, 0, 0.85))
	ci.draw_rect(Rect2(x0, y0, w, h), Color(0.08, 0.06, 0.07, 0.82))
	ci.draw_rect(Rect2(x0, y0, roundf(w * progress), h), Color(fill, 0.95))
	ci.draw_rect(Rect2(x0, y0, roundf(w * progress), 1), Color(fill.lightened(0.35), 0.95))
	var size := CAST_FONT_SIZE
	var text_w := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	var base := Vector2(-roundf(text_w / 2.0), y0 + roundf((h + font.get_ascent(size) - font.get_descent(size)) / 2.0))
	ci.draw_string_outline(font, base, label, HORIZONTAL_ALIGNMENT_LEFT, -1, size, 2, Color(0, 0, 0, 0.95))
	ci.draw_string(font, base, label, HORIZONTAL_ALIGNMENT_LEFT, -1, size, Color(1, 1, 1))


# ---- Tints, lighting, flashes ----

## Night lighting: how much lamp light falls on it (0..1) and which way (a unit vector away from
## the light): a warm tint and a shadow stretched away from the lamp.
func set_lighting(amount: float, dx: float, dy: float) -> void:
	var lit := amount > 0.03
	var k := minf(1.0, amount)
	var tint: Variant = _mix(0xffffff, 0xffbe78, minf(1.0, k * 1.1)) if lit else null
	if tint != _light_tint:
		_light_tint = tint
		_restore_tint()
	if not lit or (dx == 0.0 and dy == 0.0):
		if _shadow:
			_shadow.visible = false
		return
	if _shadow == null:
		_shadow = Depth.Painter.new(func(ci: CanvasItem): Depth.fill_ellipse(ci, 0, 0, _shadow_len, 5, Color.BLACK))
		_shadow_w = Depth.wrap(layer, _shadow)
	_shadow_len = 9.0 + 13.0 * k
	_shadow.visible = sprite.visible
	_shadow.rotation = atan2(dy * 0.6, dx)
	_shadow.modulate.a = 0.45 * k
	_shadow.queue_redraw()
	var feet := Vector2(roundf(_raw.x), roundf(_raw.y))
	Depth.place(_shadow_w, feet.x + dx * _shadow_len * 0.5, feet.y - 1.0 + dy * _shadow_len * 0.3, feet.y - 0.05)


static func _mix(a: int, b: int, t: float) -> int:
	var out := 0
	for shift: int in [16, 8, 0]:
		var ca: int = (a >> shift) & 255
		var cb: int = (b >> shift) & 255
		out |= int(round(ca + (cb - ca) * t)) << shift
	return out


## Persistent tint (an enraged boss, stunned, rooted...), restored after hit flashes; null clears.
func set_base_tint(tint: Variant) -> void:
	_base_tint = tint
	_restore_tint()


func _restore_tint() -> void:
	if _destroyed:
		return
	var tint: Variant = _base_tint if _base_tint != null else _light_tint
	var a := sprite.modulate.a
	sprite.modulate = Depth.c(int(tint)) if tint != null else Color.WHITE
	sprite.modulate.a = a
	_material.set_shader_parameter("flash", 0.0)
	_layout_rig()


## A brief white flash when hit (art sheets also flinch).
func flash() -> void:
	if set.kind == "image" and set.has_anim("hurt") and Time.get_ticks_msec() >= _action_until:
		play_action("hurt", 260)
	_material.set_shader_parameter("flash", 1.0)
	get_tree().create_timer(0.07).timeout.connect(_restore_tint)


func set_visible(visible: bool) -> void:
	_visible = visible
	sprite.visible = visible
	hurtbox.input_pickable = visible
	if _horse:
		_horse.visible = visible
	if _crown:
		_crown.visible = visible
	if _gm:
		_gm.visible = visible
	if _label:
		_label.visible = visible
	_hp_bar.visible = visible and _hp_visible
	if _weapon:
		_weapon.set_visible(visible and not _weapon_hidden)
	if _rig:
		_rig.set_visible(visible)


func set_dimmed(dimmed: bool) -> void:
	_dimmed = dimmed
	_apply_alpha()


func set_ghost(ghost: bool) -> void:
	_ghost = ghost
	_apply_alpha()


func set_alpha(alpha: float) -> void:
	sprite.modulate.a = alpha
	if _weapon:
		_weapon.set_alpha(alpha)
	_layout_rig()
	if _horse:
		_horse.modulate.a = alpha


func _apply_alpha() -> void:
	set_alpha(0.4 if _dimmed else (0.55 if _ghost else 1.0))


func destroy(fade := false) -> void:
	if _destroyed:
		return
	_destroyed = true
	for w in [_shadow_w, _gallop_w, _horse_w, _crown_w, _gm_w, _label_w, _hp_w]:
		if w:
			w.queue_free()
	if _weapon:
		_weapon.destroy()
	if _rig:
		if fade:
			_rig.drop()
		else:
			_rig.destroy()
		_rig = null
	hurtbox.input_pickable = false
	if fade and set.kind == "image" and set.has_anim("dead"):
		# Art sheets play their death animation before fading out.
		_action_until = 1 << 62
		sprite.play("dead")
		var t := sprite.create_tween()
		t.tween_interval(1.5 + set.frames.get_frame_count("dead") / maxf(1.0, set.frames.get_animation_speed("dead")))
		t.tween_property(sprite, "modulate:a", 0.0, 0.8)
		t.tween_callback(_free_all)
		return
	if not fade:
		_free_all()
		return
	var tw := sprite.create_tween()
	tw.tween_property(sprite, "modulate:a", 0.0, 0.4)
	tw.tween_callback(_free_all)


func _free_all() -> void:
	if is_instance_valid(_sprite_w):
		_sprite_w.queue_free()
	queue_free()
