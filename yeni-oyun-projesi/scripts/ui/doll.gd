class_name Doll
extends Control

## The character preview in the inventory: the character in what they
## wear, the weapon in hand, behind a red curtain; click to turn them round.

const SIZE := 28
const FEET := Vector2(14, 25)
const TURN := [0, 2, 1, 3]  # down, left, up, right

var tunic := 0xffffff
var look := {}
var cls := "novice"
var facing := 0
var equipment := {}
var _body: ImageTexture
var _weapon: Texture2D
var _weapon_rect := Rect2()
var _weapon_mirror := false
var _flash_until := 0


func _init() -> void:
	custom_minimum_size = Vector2(196, 196)
	mouse_filter = Control.MOUSE_FILTER_STOP
	texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		facing = TURN[(TURN.find(facing) + 1) % TURN.size()]
		render()
		accept_event()


func set_look(color: int, class_id: String, chosen: Dictionary) -> void:
	tunic = color
	look = chosen
	cls = class_id
	render()


func update_equipment(next: Dictionary) -> void:
	var put_on := false
	for slot in next:
		var before = equipment.get(slot)
		if next[slot] != null and (before == null or String(before.get("uid", "")) != String(next[slot].get("uid", ""))):
			put_on = true
	if put_on and not equipment.is_empty():
		_flash_until = Time.get_ticks_msec() + 300
	equipment = next
	render()


func appearance() -> Dictionary:
	var a := {"type": "humanoid", "tunic": tunic}
	a.merge(look)
	var headwear = GameData.class_of(cls).get("headwear")
	if headwear != null:
		a.headwear = headwear
	var gear := {}
	for part in ["head", "chest", "legs", "feet"]:
		if equipment.get(part) != null:
			gear[part] = String(equipment[part].defId)
	a.gear = gear
	return a


func render() -> void:
	var a := appearance()
	var frames := Sprites.frames_for(a)
	var w: int = String(frames[0][0]).length()
	var h: int = frames[0].size()
	var frame := Sprites.HUMANOID_UP if facing == 1 else (Sprites.HUMANOID_DOWN if facing == 0 else Sprites.HUMANOID_SIDE)
	var image := Image.create_empty(SIZE, SIZE, false, Image.FORMAT_RGBA8)
	var cell := Image.create_empty(w, h, false, Image.FORMAT_RGBA8)
	Sprites.paint_frame(cell, a, frame, 0, 0)
	if facing == 2:
		cell.flip_x()
	image.blit_rect(cell, Rect2i(0, 0, w, h), Vector2i(int(FEET.x - w / 2.0), int(FEET.y - h)))
	_body = ImageTexture.create_from_image(image)
	_weapon = null
	var weapon = equipment.get("weapon")
	if weapon != null:
		var tex := Art.held(String(weapon.defId))
		if tex:
			var mirrored := facing == 2 or facing == 0
			var hand: Vector2 = WeaponView.HAND[facing]
			var grip = GameData.get_value("WEAPON_GRIPS", {}).get(String(weapon.defId), {"x": 1.5 / 12.0, "y": 10.5 / 12.0})
			var fw := tex.get_width() / 2.0
			var fh := float(tex.get_height())
			var at := AtlasTexture.new()
			at.atlas = tex
			at.region = Rect2(fw if mirrored else 0.0, 0, fw, fh)
			_weapon = at
			var gx := (1.0 - float(grip.x)) if mirrored else float(grip.x)
			_weapon_rect = Rect2(roundf(FEET.x + hand.x - gx * fw), roundf(FEET.y + hand.y - float(grip.y) * fh), fw, fh)
	queue_redraw()


func _draw() -> void:
	var r := Rect2(Vector2.ZERO, size)
	# Curtain backdrop.
	draw_rect(r, Color("#1a0d0a"))
	draw_rect(Rect2(0, 0, 14, r.size.y), Color("#6b1414"))
	draw_rect(Rect2(r.size.x - 14, 0, 14, r.size.y), Color("#6b1414"))
	draw_rect(Rect2(0, 0, r.size.x, 10), Color("#5a1010"))
	for i in range(0, int(r.size.x), 12):
		draw_rect(Rect2(i, 0, 6, 12), Color("#7a1818"))
	draw_circle(Vector2(r.size.x / 2.0, r.size.y * 0.92), r.size.x * 0.32, Color(0, 0, 0, 0.35))
	var scale := minf(r.size.x, r.size.y) / SIZE
	var behind := facing == 1
	if _weapon and behind:
		draw_texture_rect(_weapon, Rect2(_weapon_rect.position * scale, _weapon_rect.size * scale), false)
	if _body:
		var tint := Color(2, 2, 2) if Time.get_ticks_msec() < _flash_until else Color.WHITE
		draw_texture_rect(_body, Rect2(Vector2.ZERO, Vector2(SIZE, SIZE) * scale), false, tint)
	if _weapon and not behind:
		draw_texture_rect(_weapon, Rect2(_weapon_rect.position * scale, _weapon_rect.size * scale), false)
	draw_rect(r, UiTheme.GOLD_DARK, false, 2.0)
	if Time.get_ticks_msec() < _flash_until:
		queue_redraw()
