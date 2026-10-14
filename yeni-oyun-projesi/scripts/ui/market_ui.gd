class_name MarketUi
extends RefCounted

## Player market stalls: setting up your stall on the market square
## with prices, and browsing someone else's.

var ui: GameUi
var setup: GameWindow
var browse: GameWindow
var drafts: Array = []  # [{uid, price}]
var my_stall: Variant = null
var browsing: Variant = null
var _title: LineEdit
var _setup_list: VBoxContainer
var _setup_total: Label
var _setup_hint: Label
var _setup_action: Button
var _browse_seller: Label
var _browse_list: VBoxContainer


func _init(owner_ui: GameUi, parent: Control) -> void:
	ui = owner_ui
	setup = GameWindow.new("stall-setup", "Pazar Tezgâhı", 360)
	setup.set_default_anchor(Control.PRESET_CENTER_LEFT)
	parent.add_child(setup)
	_title = LineEdit.new()
	_title.placeholder_text = "Tezgâh adı (ör. Ucuz iksir!)"
	_title.max_length = int(GameData.get_value("STALL_TITLE_MAX", 24))
	setup.body.add_child(_title)
	_setup_list = VBoxContainer.new()
	setup.body.add_child(_setup_list)
	_setup_total = UiTheme.label("", 13, UiTheme.GOLD_LIGHT, true)
	setup.body.add_child(_setup_total)
	_setup_hint = UiTheme.muted("", 12)
	setup.body.add_child(_setup_hint)
	_setup_action = UiTheme.button("Pazarı Aç", "", _on_action)
	setup.body.add_child(_setup_action)
	browse = GameWindow.new("stall-browse", "", 360)
	browse.on_close = func():
		browsing = null
		ui.tooltip.hide_tip()
	parent.add_child(browse)
	_browse_seller = UiTheme.muted("", 12)
	browse.body.add_child(_browse_seller)
	_browse_list = VBoxContainer.new()
	browse.body.add_child(_browse_list)
	browse.body.add_child(UiTheme.muted("Fiyatlar birim başınadır. Adet yazıp Al'a bas.", 12))


func reset() -> void:
	drafts = []
	my_stall = null
	setup.hide_window()
	close_browse()


func _hint(text: String, error := false) -> void:
	_setup_hint.text = text
	_setup_hint.add_theme_color_override("font_color", UiTheme.ERROR if error else UiTheme.MUTED)


func _on_action() -> void:
	if my_stall != null:
		ui.send("stallClose")
		return
	var items: Array = []
	var max_price := int(GameData.get_value("STALL_MAX_PRICE", 100000000))
	for d in drafts:
		var price := int(String(d.price)) if String(d.price).is_valid_int() else 0
		if price < 1 or price > max_price:
			_hint("Her item için geçerli bir fiyat yaz.", true)
			return
		items.append({"uid": d.uid, "price": price})
	if items.is_empty():
		_hint("Önce envanterden item koy.", true)
		return
	ui.send("stallOpen", {"title": _title.text, "items": items})


func open_setup() -> void:
	setup.open()
	_render_setup()


func is_setup_open() -> bool:
	return setup.visible and my_stall == null


func _inventory_item(uid: String) -> Variant:
	var state = ui.inventory_state()
	if state == null:
		return null
	for s in state.get("slots", []):
		if s != null and String(s.uid) == uid:
			return s
	return null


func add(index: int) -> bool:
	if my_stall != null:
		return false
	var slots: Array = ui.inventory_state().get("slots", []) if ui.inventory_state() else []
	var item = slots[index] if index < slots.size() else null
	if item == null:
		return false
	for d in drafts:
		if d.uid == item.uid:
			return true
	var max_slots := int(GameData.get_value("STALL_SLOTS", 8))
	if drafts.size() >= max_slots:
		_hint("En fazla %d item koyabilirsin." % max_slots, true)
		return false
	drafts.append({"uid": String(item.uid), "price": ""})
	_render_setup()
	return true


func refresh() -> void:
	if my_stall == null:
		drafts = drafts.filter(func(d): return _inventory_item(d.uid) != null)
	if setup.visible:
		_render_setup()
	if browsing != null:
		_render_browse()


func _item_row(item: Dictionary, extra: Array) -> HBoxContainer:
	var def := Items.def(item.defId)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	var icon := TextureRect.new()
	icon.texture = Art.item_icon(String(item.defId))
	icon.custom_minimum_size = Vector2(26, 26)
	icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon.mouse_filter = Control.MOUSE_FILTER_STOP
	icon.mouse_entered.connect(func(): ui.tooltip.show_item(def, {"qty": item.get("qty", 1), "enhance": item.get("enhance", 0), "affixes": item.get("affixes"), "playerLevel": ui.player_level()}, icon))
	icon.mouse_exited.connect(func(): ui.tooltip.hide_tip())
	row.add_child(icon)
	var name := "%s%s%s" % [def.get("name", "?"), (" +%d" % int(item.enhance)) if int(item.get("enhance", 0)) > 0 else "", (" x%d" % int(item.qty)) if int(item.get("qty", 1)) > 1 else ""]
	var label := UiTheme.label(name, 13, Items.rarity_color(Items.rarity(def, item.get("affixes"))), true)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(label)
	for e in extra:
		row.add_child(e)
	return row


func _render_setup() -> void:
	for c in _setup_list.get_children():
		c.queue_free()
	_title.editable = my_stall == null
	if my_stall != null:
		_title.text = String(my_stall.title)
		var total := 0
		for listing in my_stall.get("items", []):
			total += int(listing.price) * int(listing.get("qty", 1))
			_setup_list.add_child(_item_row(listing, [UiTheme.label(InventoryWindow._thousands(int(listing.price)), 13, Color("#ffd34d"), true)]))
		_setup_total.text = "Kalan değer: %s altın" % InventoryWindow._thousands(total)
		_hint("Pazar açık. Satılanlar sohbete yazılır. Kapatana kadar yerinden kalkamazsın.")
		_setup_action.text = "Pazarı Kapat"
		return
	for d in drafts:
		var found = _inventory_item(d.uid)
		if found == null:
			continue
		var input := LineEdit.new()
		input.placeholder_text = "Birim fiyat"
		input.text = String(d.price)
		input.custom_minimum_size = Vector2(90, 0)
		input.text_changed.connect(func(t):
			d.price = t
			_render_total())
		var remove := UiTheme.button("×", "RedButton", func():
			drafts.erase(d)
			_render_setup())
		remove.tooltip_text = "Tezgâhtan kaldır"
		_setup_list.add_child(_item_row(found, [input, remove]))
	if drafts.is_empty():
		_setup_list.add_child(UiTheme.muted("Tezgâh boş.", 12))
	_hint("Envanterde sağ tıkla ya da item'ı buraya sürükle (en fazla %d). Fiyat birim başınadır." % int(GameData.get_value("STALL_SLOTS", 8)))
	_setup_action.text = "Pazarı Aç"
	_render_total()


func _render_total() -> void:
	if my_stall != null:
		return
	var total := 0
	for d in drafts:
		var item = _inventory_item(d.uid)
		var price := int(String(d.price)) if String(d.price).is_valid_int() else 0
		total += price * (int(item.get("qty", 1)) if item else 0)
	_setup_total.text = "Toplam: %s altın" % InventoryWindow._thousands(total)


func on_my_stall(event: Dictionary) -> void:
	var was_open := my_stall != null
	my_stall = event.get("stall")
	if my_stall != null:
		setup.open()
	elif was_open:
		drafts = []
	_render_setup()


func show_contents(event: Dictionary) -> void:
	browsing = event
	browse.open()
	_render_browse()


func _render_browse() -> void:
	if browsing == null:
		return
	browse.title_label.text = String(browsing.title)
	_browse_seller.text = "Satıcı: %s" % browsing.seller
	for c in _browse_list.get_children():
		c.queue_free()
	var items: Array = browsing.get("items", [])
	if items.is_empty():
		_browse_list.add_child(UiTheme.muted("Tezgâhta bir şey kalmadı.", 12))
		return
	var seller_id := String(browsing.sellerId)
	for listing in items:
		var extra: Array = []
		var qty_input: LineEdit = null
		if int(listing.get("qty", 1)) > 1:
			qty_input = LineEdit.new()
			qty_input.text = "1"
			qty_input.custom_minimum_size = Vector2(44, 0)
			qty_input.tooltip_text = "Adet"
			extra.append(qty_input)
		var price := UiTheme.label(InventoryWindow._thousands(int(listing.price)), 13, Color("#ffd34d"), true)
		price.tooltip_text = "Birim fiyat"
		extra.append(price)
		var input_ref := qty_input
		extra.append(UiTheme.button("Al", "", func():
			var qty := 1
			if input_ref and input_ref.text.is_valid_int():
				qty = clampi(int(input_ref.text), 1, int(listing.qty))
			ui.send("stallBuy", {"sellerId": seller_id, "uid": listing.uid, "qty": qty, "price": listing.price})))
		var row := _item_row(listing, extra)
		if int(listing.price) > ui.gold():
			row.modulate.a = 0.55
		_browse_list.add_child(row)


func on_closed(seller_id: String) -> void:
	if browsing != null and String(browsing.sellerId) == seller_id:
		close_browse()


func browsing_seller() -> String:
	return String(browsing.sellerId) if browsing != null else ""


func close_browse() -> void:
	browsing = null
	browse.hide_window()
	ui.tooltip.hide_tip()
