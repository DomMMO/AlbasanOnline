class_name ShopWindow
extends GameWindow

## A merchant's wares: click to buy (Shift: five), drop a bag item on
## the window or right click it in the bag to sell.

var ui: GameUi
var npc := {}
var _list: VBoxContainer
var _rows := {}


func _init(owner_ui: GameUi) -> void:
	super._init("shop-window", "", 320)
	ui = owner_ui
	set_default_anchor(Control.PRESET_CENTER_LEFT)
	on_close = func():
		npc = {}
		ui.tooltip.hide_tip()
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(300, 360)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	body.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_list.add_theme_constant_override("separation", 3)
	scroll.add_child(_list)
	body.add_child(UiTheme.muted("Satmak için envanterde sağ tıkla ya da item'ı buraya sürükle.", 12))


func _can_drop_data(_at: Vector2, data: Variant) -> bool:
	return not npc.is_empty() and data is Dictionary and data.get("type") == "item" and data.ref.get("area") == "inv"


func _drop_data(_at: Vector2, data: Variant) -> void:
	ui.send("sell", {"npcId": npc.id, "index": int(data.ref.index)})


func open_for(target: Dictionary) -> void:
	npc = target
	title_label.text = String(target.name)
	for c in _list.get_children():
		c.queue_free()
	_rows.clear()
	for item_id in target.get("shop", []):
		var def := GameData.item(String(item_id))
		if def.is_empty():
			continue
		var row := Button.new()
		row.focus_mode = Control.FOCUS_NONE
		row.theme_type_variation = "DarkButton"
		row.custom_minimum_size = Vector2(0, 34)
		row.mouse_filter = Control.MOUSE_FILTER_STOP
		var h := HBoxContainer.new()
		h.set_anchors_preset(Control.PRESET_FULL_RECT)
		h.offset_left = 6
		h.offset_right = -8
		h.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(h)
		var icon := TextureRect.new()
		icon.texture = Art.item_icon(String(item_id))
		icon.custom_minimum_size = Vector2(26, 26)
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
		h.add_child(icon)
		var name := UiTheme.label(String(def.name), 13, Items.rarity_color(String(def.get("rarity", "common"))), true)
		name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name.mouse_filter = Control.MOUSE_FILTER_IGNORE
		h.add_child(name)
		var price := UiTheme.label("%d ●" % int(def.get("buyPrice", 0)), 13, Color("#ffd34d"), true)
		price.mouse_filter = Control.MOUSE_FILTER_IGNORE
		h.add_child(price)
		row.gui_input.connect(func(ev):
			if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
				var qty := 5 if ev.shift_pressed and int(def.get("maxStack", 1)) > 1 else 1
				ui.send("buy", {"npcId": npc.id, "itemId": item_id, "qty": qty}))
		row.mouse_entered.connect(func():
			ui.tooltip.show_item(def, {"playerLevel": ui.player_level(), "affixHint": "1 rastgele stat (dükkân malı)", "footer": [{"text": "Fiyat: %d altın" % int(def.get("buyPrice", 0)), "color": "#ffd34d"}, {"text": "Tık: 1 al · Shift+tık: 5 al" if int(def.get("maxStack", 1)) > 1 else "Tık: satın al"}]}, row))
		row.mouse_exited.connect(func(): ui.tooltip.hide_tip())
		_list.add_child(row)
		_rows[item_id] = row
	refresh()
	open()


func refresh() -> void:
	if npc.is_empty():
		return
	var gold := ui.gold()
	for item_id in _rows:
		_rows[item_id].modulate.a = 0.5 if int(GameData.item(String(item_id)).get("buyPrice", 0)) > gold else 1.0
