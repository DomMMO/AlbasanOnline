class_name ShopWindow
extends GameWindow

## A merchant's wares: click to buy (Shift: five), drop a bag item on
## the window or right click it in the bag to sell (rare or upgraded items ask first). The
## "Geri Al" tab sells back what you sold lately, for what you got for it.

var ui: GameUi
var npc := {}
var tab := "wares"
var _wares: VBoxContainer
var _buyback: VBoxContainer
var _rows := {}
var _tabs: HBoxContainer
var _confirm: ConfirmationDialog


func _init(owner_ui: GameUi) -> void:
	super._init("shop-window", "", 320)
	ui = owner_ui
	set_default_anchor(Control.PRESET_CENTER_LEFT)
	on_close = func():
		npc = {}
		ui.tooltip.hide_tip()
	_tabs = HBoxContainer.new()
	body.add_child(_tabs)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(300, 360)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	body.add_child(scroll)
	var lists := VBoxContainer.new()
	lists.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(lists)
	_wares = VBoxContainer.new()
	_wares.add_theme_constant_override("separation", 3)
	lists.add_child(_wares)
	_buyback = VBoxContainer.new()
	_buyback.add_theme_constant_override("separation", 3)
	lists.add_child(_buyback)
	body.add_child(UiTheme.muted("Satmak için envanterde sağ tıkla ya da item'ı buraya sürükle.", 12))
	_confirm = ConfirmationDialog.new()
	_confirm.ok_button_text = "Sat"
	_confirm.cancel_button_text = "Vazgeç"
	add_child(_confirm)


func _can_drop_data(_at: Vector2, data: Variant) -> bool:
	return not npc.is_empty() and data is Dictionary and data.get("type") == "item" and data.ref.get("area") in ["inv", "prof"]


func _drop_data(_at: Vector2, data: Variant) -> void:
	sell(int(data.ref.index), String(data.ref.area))


## Sells a bag slot ("prof": a profession bag slot); a valuable item (Items.is_valuable) asks first.
func sell(index: int, area := "inv") -> void:
	if npc.is_empty():
		return
	var key := "profession" if area == "prof" else "slots"
	var slots: Array = ui.inventory_state().get(key, []) if ui.inventory_state() else []
	var item = slots[index] if index < slots.size() else null
	if item == null:
		return
	var d := Items.def(item.defId)
	if not Items.is_valuable(d, item):
		ui.send("sell", {"npcId": npc.id, "index": index, "area": area})
		return
	var r := Items.rarity(d, item.get("affixes"))
	var enhance := int(item.get("enhance", 0))
	var label := String(d.get("name", "?")) + (" +%d" % enhance if enhance > 0 else "")
	var price := Items.sell_price(d, item.get("affixes")) * int(item.get("qty", 1))
	_confirm.dialog_text = "%s (%s) satılsın mı? %s altın.\nPişman olursan Geri Al sekmesinden aynı fiyata geri alabilirsin." % [label, GameData.get_value("RARITY_NAMES", {}).get(r, r), InventoryWindow._thousands(price)]
	var uid := String(item.get("uid", ""))
	var merchant := String(npc.id)
	for c in _confirm.confirmed.get_connections():
		_confirm.confirmed.disconnect(c.callable)
	_confirm.confirmed.connect(func():
		# Only if the same item is still in that slot and we are still at this merchant.
		var now: Array = ui.inventory_state().get(key, []) if ui.inventory_state() else []
		if not npc.is_empty() and String(npc.id) == merchant and index < now.size() and now[index] != null and String(now[index].get("uid", "")) == uid:
			ui.send("sell", {"npcId": merchant, "index": index, "area": area}), CONNECT_ONE_SHOT)
	_confirm.popup_centered()


func open_for(target: Dictionary) -> void:
	npc = target
	tab = "wares"
	title_label.text = String(target.name)
	for c in _wares.get_children():
		c.queue_free()
	_rows.clear()
	for item_id in target.get("shop", []):
		var def := GameData.item(String(item_id))
		if def.is_empty():
			continue
		var row := _row(Art.item_icon(String(item_id)), String(def.name), Items.rarity_color(String(def.get("rarity", "common"))), int(def.get("buyPrice", 0)))
		row.gui_input.connect(func(ev):
			if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
				var qty := 5 if ev.shift_pressed and int(def.get("maxStack", 1)) > 1 else 1
				ui.send("buy", {"npcId": npc.id, "itemId": item_id, "qty": qty}))
		row.mouse_entered.connect(func():
			ui.tooltip.show_item(def, {"playerLevel": ui.player_level(), "affixHint": "1 rastgele stat (dükkân malı)", "footer": [{"text": "Fiyat: %d altın" % int(def.get("buyPrice", 0)), "color": "#ffd34d"}, {"text": "Tık: 1 al · Shift+tık: 5 al" if int(def.get("maxStack", 1)) > 1 else "Tık: satın al"}]}, row))
		row.mouse_exited.connect(func(): ui.tooltip.hide_tip())
		_wares.add_child(row)
		_rows[item_id] = row
	refresh()
	open()


func refresh() -> void:
	if npc.is_empty():
		return
	var gold := ui.gold()
	for item_id in _rows:
		_rows[item_id].modulate.a = 0.5 if int(GameData.item(String(item_id)).get("buyPrice", 0)) > gold else 1.0
	var sold: Array = ui.inventory_state().get("buyback", []) if ui.inventory_state() else []
	_render_tabs(sold.size())
	_render_buyback(sold, gold)
	_wares.visible = tab == "wares"
	_buyback.visible = tab == "buyback"


func _render_tabs(sold_count: int) -> void:
	for c in _tabs.get_children():
		c.queue_free()
	for pair in [["wares", "Satın Al"], ["buyback", "Geri Al (%d)" % sold_count]]:
		_tabs.add_child(UiTheme.button(pair[1], "" if tab == pair[0] else "DarkButton", func():
			tab = pair[0]
			ui.tooltip.hide_tip()
			refresh()))


func _render_buyback(sold: Array, gold: int) -> void:
	for c in _buyback.get_children():
		c.queue_free()
	if sold.is_empty():
		_buyback.add_child(UiTheme.muted("Son sattığın eşyalar burada durur; sattığın fiyata geri alabilirsin.", 12))
		return
	for item in sold:
		var d := Items.def(item.defId)
		var r := Items.rarity(d, item.get("affixes"))
		var enhance := int(item.get("enhance", 0))
		var qty := int(item.get("qty", 1))
		var name := String(d.get("name", "?")) + (" +%d" % enhance if enhance > 0 else "") + (" x%d" % qty if qty > 1 else "")
		var price := int(item.price)
		var row := _row(Art.item_icon(String(item.defId), r if d.has("jewel") else ""), name, Items.rarity_color(r), price)
		row.modulate.a = 0.5 if price > gold else 1.0
		var uid := String(item.uid)
		row.gui_input.connect(func(ev):
			if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
				ui.tooltip.hide_tip()
				ui.send("buyback", {"npcId": npc.id, "uid": uid}))
		row.mouse_entered.connect(func():
			ui.tooltip.show_item(d, {"qty": qty, "enhance": enhance, "affixes": item.get("affixes"), "playerLevel": ui.player_level(), "footer": [{"text": "Geri alma: %d altın" % price, "color": "#ffd34d"}, {"text": "Tık: geri al"}]}, row))
		row.mouse_exited.connect(func(): ui.tooltip.hide_tip())
		_buyback.add_child(row)


## A list row: icon, name in its rarity colour, price.
func _row(icon_texture: Texture2D, text: String, color: Color, price: int) -> Button:
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
	icon.texture = icon_texture
	icon.custom_minimum_size = Vector2(26, 26)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	icon.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(icon)
	var name := UiTheme.label(text, 13, color, true)
	name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(name)
	var price_label := UiTheme.label("%d ●" % price, 13, Color("#ffd34d"), true)
	price_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(price_label)
	return row
