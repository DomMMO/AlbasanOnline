class_name ItemSlot
extends Control

## An item slot (.item-slot): the icon, stack count, +N, rarity edge and the +7..+10 glow;
## an empty equipment slot shows its name. Drag and drop moves items (SlotRef dictionaries),
## right click / double click activates, hovering shows the tooltip.

signal activated
signal hovered(inside: bool)
signal dropped_on(from: Dictionary)

const GLOW := {7: Color(0.65, 0.3, 1.0, 0.35), 8: Color(0.65, 0.3, 1.0, 0.5), 9: Color(0.7, 0.35, 1.0, 0.65), 10: Color(0.75, 0.4, 1.0, 0.8)}

var ref := {}  # SlotRef: {area: "inv", index} | {area: "equip", slot} | ...
var item: Variant = null  # ItemView dictionary
var placeholder := ""
var accepts: Callable
var highlight := false
var _icon: Texture2D


func _init(slot_ref: Dictionary, slot_size := 36.0, label := "") -> void:
	ref = slot_ref
	placeholder = label
	custom_minimum_size = Vector2(slot_size, slot_size)
	mouse_filter = Control.MOUSE_FILTER_STOP
	mouse_entered.connect(func(): hovered.emit(true))
	mouse_exited.connect(func(): hovered.emit(false))


func set_item(value: Variant) -> void:
	item = value
	_icon = null
	if item is Dictionary:
		var d := Items.def(item.defId)
		var rarity := ""
		if d.has("jewel"):
			rarity = Items.rarity(d, item.get("affixes"))
		_icon = Art.item_icon(String(item.defId), rarity)
	queue_redraw()


func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_RIGHT or (event.button_index == MOUSE_BUTTON_LEFT and event.double_click):
			if item != null:
				hovered.emit(false)
				activated.emit()
			accept_event()


func _get_drag_data(_at: Vector2) -> Variant:
	if item == null:
		return null
	var preview := TextureRect.new()
	preview.texture = _icon
	preview.custom_minimum_size = size
	preview.size = size
	preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	preview.modulate.a = 0.85
	set_drag_preview(preview)
	hovered.emit(false)
	return {"type": "item", "ref": ref, "defId": item.defId, "uid": item.get("uid", "")}


func _can_drop_data(_at: Vector2, data: Variant) -> bool:
	if not (data is Dictionary) or data.get("type") != "item":
		return false
	return accepts.call(data) if accepts.is_valid() else true


func _drop_data(_at: Vector2, data: Variant) -> void:
	dropped_on.emit(data.ref)


func _draw() -> void:
	var r := Rect2(Vector2.ZERO, size)
	draw_rect(r, Color("#140e08"))
	draw_rect(r.grow(-1), Color("#0c0805"))
	var tier := 0
	if item is Dictionary:
		var d := Items.def(item.defId)
		tier = GameData.glow_tier(int(item.get("enhance", 0)))
		if tier:
			draw_rect(r, GLOW.get(tier, Color.TRANSPARENT))
		if _icon:
			draw_texture_rect(_icon, r.grow(-3), false)
		var rarity := Items.rarity(d, item.get("affixes"))
		if rarity != "common":
			draw_rect(r.grow(-1), Color(Items.rarity_color(rarity), 0.7), false, 1.0)
		var font := Fonts.serif(true)
		var qty := int(item.get("qty", 1))
		if qty > 1:
			var t := str(qty)
			var w := font.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
			draw_string(font, Vector2(r.size.x - w - 1, r.size.y - 1), t, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color.BLACK)
			draw_string(font, Vector2(r.size.x - w - 2, r.size.y - 2), t, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color.WHITE)
		var enhance := int(item.get("enhance", 0))
		if enhance > 0:
			var t := "+%d" % enhance
			draw_string(font, Vector2(3, 12), t, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color.BLACK)
			draw_string(font, Vector2(2, 11), t, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("#ffd34d"))
	elif not placeholder.is_empty():
		var font := Fonts.serif()
		var w := font.get_string_size(placeholder, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
		draw_string(font, Vector2((r.size.x - w) / 2.0, r.size.y / 2.0 + 4), placeholder, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(UiTheme.MUTED, 0.47))
	draw_rect(r, Color.BLACK, false, 1.0)
	draw_rect(r.grow(-1), Color(UiTheme.GOLD if highlight else UiTheme.GOLD_DARK, 0.6 if not highlight else 1.0), false, 1.0)
