class_name StorageWindow
extends GameWindow

## Depo (client/src/ui/storage.ts): the character's storage at the Depocu. Right click or drag
## between bag and storage; gold in and out.

var ui: GameUi
var npc := {}
var _slots: Array[ItemSlot] = []
var _items: Array = []
var _gold: Label
var _input: LineEdit


func _init(owner_ui: GameUi) -> void:
	super._init("storage-window", "Depo", 360)
	ui = owner_ui
	set_default_anchor(Control.PRESET_CENTER_LEFT)
	on_close = func():
		npc = {}
		ui.tooltip.hide_tip()
	var grid := GridContainer.new()
	grid.columns = 8
	grid.add_theme_constant_override("h_separation", 4)
	grid.add_theme_constant_override("v_separation", 4)
	body.add_child(grid)
	for i in int(GameData.get_value("STORAGE_SIZE", 48)):
		var s := ItemSlot.new({"area": "storage", "index": i}, 38)
		s.activated.connect(func():
			if not npc.is_empty() and s.item != null:
				ui.send("storageQuick", {"npcId": npc.id, "from": {"area": "storage", "index": i}}))
		s.dropped_on.connect(func(from): ui.send("moveItem", {"from": from, "to": s.ref}))
		s.hovered.connect(func(inside):
			if inside and s.item != null:
				ui.tooltip.show_item(Items.def(s.item.defId), {"qty": s.item.get("qty", 1), "enhance": s.item.get("enhance", 0), "affixes": s.item.get("affixes"), "playerLevel": ui.player_level(), "footer": [{"text": "Sağ tık: envantere al"}]}, s)
			else:
				ui.tooltip.hide_tip())
		grid.add_child(s)
		_slots.append(s)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	body.add_child(row)
	row.add_child(UiTheme.label("●", 14, Color("#ffd34d")))
	_gold = UiTheme.label("0", 15, UiTheme.GOLD_LIGHT, true)
	_gold.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(_gold)
	_input = LineEdit.new()
	_input.placeholder_text = "Miktar"
	_input.custom_minimum_size = Vector2(90, 0)
	row.add_child(_input)
	row.add_child(UiTheme.button("Koy", "", func(): _send_gold(1)))
	row.add_child(UiTheme.button("Al", "", func(): _send_gold(-1)))
	body.add_child(UiTheme.muted("Sağ tık ya da sürükle: envanter ↔ depo. Depo bu karaktere aittir, eşyaların burada güvende.", 12))


func _send_gold(sign: int) -> void:
	var amount := int(_input.text.strip_edges())
	if npc.is_empty() or amount <= 0:
		return
	ui.send("storageGold", {"npcId": npc.id, "amount": sign * amount})
	_input.text = ""
	_input.release_focus()


func _can_drop_data(_at: Vector2, data: Variant) -> bool:
	return not npc.is_empty() and data is Dictionary and data.get("type") == "item" and data.ref.get("area") == "inv"


func _drop_data(_at: Vector2, data: Variant) -> void:
	ui.send("storageQuick", {"npcId": npc.id, "from": {"area": "inv", "index": int(data.ref.index)}})


func update(event: Dictionary) -> void:
	var storage: Dictionary = event.get("storage", {})
	_items = storage.get("slots", [])
	for i in _slots.size():
		_slots[i].set_item(_items[i] if i < _items.size() else null)
	_gold.text = InventoryWindow._thousands(int(storage.get("gold", 0)))


func open_for(target: Dictionary) -> void:
	npc = target
	open()
