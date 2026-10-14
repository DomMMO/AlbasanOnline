class_name TradeWindow
extends GameWindow

## Takas (client/src/ui/trade.ts): both offers side by side, lock, then confirm.

var ui: GameUi
var trade: Variant = null
var _mine: Array[ItemSlot] = []
var _theirs: Array[ItemSlot] = []
var _mine_status: Label
var _theirs_status: Label
var _partner: Label
var _gold: LineEdit
var _theirs_gold: Label
var _hint: Label
var _action: Button


func _init(owner_ui: GameUi) -> void:
	super._init("trade-window", "Takas", 520)
	ui = owner_ui
	on_close = func(): ui.send("tradeCancel")
	var sides := HBoxContainer.new()
	sides.add_theme_constant_override("separation", 16)
	body.add_child(sides)
	var slots := int(GameData.get_value("TRADE_SLOTS", 8))
	for mine in [true, false]:
		var side := VBoxContainer.new()
		var head := HBoxContainer.new()
		var title := UiTheme.label("Senin teklifin" if mine else "", 14, UiTheme.GOLD_LIGHT, true)
		head.add_child(title)
		var status := UiTheme.label("", 12, Color("#8ce99a"), true)
		head.add_child(status)
		side.add_child(head)
		var grid := GridContainer.new()
		grid.columns = 4
		grid.add_theme_constant_override("h_separation", 4)
		grid.add_theme_constant_override("v_separation", 4)
		side.add_child(grid)
		for i in slots:
			var s := ItemSlot.new({"area": "trade", "index": i}, 40)
			s.hovered.connect(func(inside):
				if not inside or s.item == null:
					ui.tooltip.hide_tip()
					return
				var footer := [{"text": "Tık: tekliften çıkar"}] if mine and trade and not trade.mine.locked else []
				ui.tooltip.show_item(Items.def(s.item.defId), {"qty": s.item.get("qty", 1), "enhance": s.item.get("enhance", 0), "affixes": s.item.get("affixes"), "playerLevel": ui.player_level(), "footer": footer}, s))
			if mine:
				s.gui_input.connect(func(ev):
					if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT and trade and s.item and not trade.mine.locked:
						ui.tooltip.hide_tip()
						var uids: Array = []
						for it in trade.mine.items:
							if it.uid != s.item.uid:
								uids.append(it.uid)
						_send_offer(uids))
				s.accepts = func(data): return data.ref.get("area") == "inv"
				s.dropped_on.connect(func(from): add(int(from.index)))
				_mine.append(s)
			else:
				_theirs.append(s)
			grid.add_child(s)
		var gold_row := HBoxContainer.new()
		gold_row.add_child(UiTheme.label("●", 14, Color("#ffd34d")))
		if mine:
			_gold = LineEdit.new()
			_gold.text = "0"
			_gold.custom_minimum_size = Vector2(110, 0)
			_gold.text_submitted.connect(func(_t): _resend())
			_gold.focus_exited.connect(_resend)
			gold_row.add_child(_gold)
			_mine_status = status
		else:
			_theirs_gold = UiTheme.label("0", 14, UiTheme.GOLD_LIGHT, true)
			gold_row.add_child(_theirs_gold)
			_theirs_status = status
			_partner = title
		side.add_child(gold_row)
		sides.add_child(side)
	_hint = UiTheme.muted("", 12)
	body.add_child(_hint)
	var buttons := HBoxContainer.new()
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	_action = UiTheme.button("Teklifi Kilitle", "", _on_action)
	buttons.add_child(_action)
	buttons.add_child(UiTheme.button("İptal", "DarkButton", func(): ui.send("tradeCancel")))
	body.add_child(buttons)


func _offered_gold() -> int:
	var t := _gold.text.strip_edges()
	return maxi(0, int(t)) if t.is_valid_int() else 0


func _send_offer(uids: Array) -> void:
	ui.send("tradeOffer", {"items": uids, "gold": _offered_gold()})


func _resend() -> void:
	if trade and not trade.mine.locked:
		_send_offer(trade.mine.items.map(func(i): return i.uid))


func _on_action() -> void:
	if trade == null:
		return
	if not trade.mine.locked:
		_send_offer(trade.mine.items.map(func(i): return i.uid))
		ui.send("tradeLock")
	elif trade.theirs.locked and not trade.mine.confirmed:
		ui.send("tradeConfirm")


func add(index: int) -> bool:
	var slots: Array = ui.inventory_state().get("slots", []) if ui.inventory_state() else []
	var item = slots[index] if index < slots.size() else null
	if trade == null or item == null:
		return false
	if trade.mine.locked:
		_set_hint("Teklifini kilitledin, artık değiştiremezsin.", true)
		return false
	var uids: Array = trade.mine.items.map(func(i): return i.uid)
	if item.uid in uids:
		return true
	var max_slots := int(GameData.get_value("TRADE_SLOTS", 8))
	if uids.size() >= max_slots:
		_set_hint("En fazla %d item koyabilirsin." % max_slots, true)
		return false
	uids.append(item.uid)
	_send_offer(uids)
	return true


func _set_hint(text: String, error := false) -> void:
	_hint.text = text
	_hint.add_theme_color_override("font_color", UiTheme.ERROR if error else UiTheme.MUTED)


static func _status(side: Dictionary) -> String:
	return "✓ onayladı" if side.get("confirmed", false) else ("kilitledi" if side.get("locked", false) else "")


func refresh() -> void:
	if trade != null:
		_render()


func _render() -> void:
	var mine: Dictionary = trade.mine
	var theirs: Dictionary = trade.theirs
	title_label.text = "Takas: %s" % trade.partner
	_partner.text = "%s teklifi" % trade.partner
	for i in _mine.size():
		_mine[i].set_item(mine.items[i] if i < mine.items.size() else null)
	for i in _theirs.size():
		_theirs[i].set_item(theirs.items[i] if i < theirs.items.size() else null)
	_mine_status.text = _status(mine)
	_theirs_status.text = _status(theirs)
	_gold.editable = not mine.locked
	if mine.locked or not _gold.has_focus():
		_gold.text = str(int(mine.gold))
	_theirs_gold.text = InventoryWindow._thousands(int(theirs.gold))
	_action.disabled = false
	if not mine.locked:
		_action.text = "Teklifi Kilitle"
		_set_hint("Envanterde sağ tıkla ya da item'ı buraya sürükle. Altın yazıp kilitle.")
	elif not theirs.locked:
		_action.text = "Karşı taraf bekleniyor"
		_action.disabled = true
		_set_hint("%s teklifini kilitleyince takası onaylayabilirsin." % trade.partner)
	elif not mine.confirmed:
		_action.text = "Takası Tamamla"
		_set_hint("İki teklif de kilitli. Karşı tarafın teklifini kontrol et ve onayla.")
	else:
		_action.text = "Onay bekleniyor"
		_action.disabled = true
		_set_hint("%s onaylayınca takas tamamlanır." % trade.partner)


func on_state(event: Dictionary) -> void:
	var opening: bool = trade == null and event.get("trade") != null
	trade = event.get("trade")
	if trade == null:
		hide_window()
		ui.tooltip.hide_tip()
		return
	if opening:
		_gold.text = "0"
	open()
	_render()
