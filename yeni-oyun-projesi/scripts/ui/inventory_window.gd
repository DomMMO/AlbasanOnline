class_name InventoryWindow
extends GameWindow

## Karakter: the paper doll, the eight equipment slots, the stats,
## the 32 bag slots and the gold. Drag to move or equip, right click / double click to use,
## equip, sell or put away (whatever window is open next to it), sort button. A bag item dragged
## out over the world is dropped on the ground, one dragged onto the bin is destroyed (both ask first).

const EQUIP_LAYOUT := [["earring", "head"], ["weapon", "chest"], ["neck", "legs"], ["ring", "feet"]]

var ui: GameUi
var state: Variant = null  # InventoryEvent
var doll: Doll
var _equip := {}
var _bag: Array[ItemSlot] = []
var _stats: GridContainer
var _gold: Label
var _confirm: ConfirmationDialog


func _init(owner_ui: GameUi) -> void:
	super._init("inventory-window", "Karakter", 360)
	ui = owner_ui
	set_default_anchor(Control.PRESET_CENTER_RIGHT)
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 10)
	body.add_child(top)
	doll = Doll.new()
	top.add_child(doll)
	var equip := GridContainer.new()
	equip.columns = 2
	equip.add_theme_constant_override("h_separation", 6)
	equip.add_theme_constant_override("v_separation", 8)
	top.add_child(equip)
	var names: Dictionary = GameData.get_value("EQUIP_SLOT_NAMES", {})
	for row in EQUIP_LAYOUT:
		for slot in row:
			var s := ItemSlot.new({"area": "equip", "slot": slot}, 40, String(names.get(slot, slot)))
			_wire(s)
			equip.add_child(s)
			_equip[slot] = s
	_stats = GridContainer.new()
	_stats.columns = 2
	_stats.add_theme_constant_override("h_separation", 24)
	body.add_child(_stats)
	var grid := GridContainer.new()
	grid.columns = 8
	grid.add_theme_constant_override("h_separation", 4)
	grid.add_theme_constant_override("v_separation", 4)
	body.add_child(grid)
	for i in int(GameData.get_value("INVENTORY_SIZE", 32)):
		var s := ItemSlot.new({"area": "inv", "index": i}, 38)
		_wire(s)
		grid.add_child(s)
		_bag.append(s)
	var gold_row := HBoxContainer.new()
	body.add_child(gold_row)
	var coin := UiTheme.label("●", 14, Color("#ffd34d"))
	gold_row.add_child(coin)
	_gold = UiTheme.label("0", 15, UiTheme.GOLD_LIGHT, true)
	_gold.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	gold_row.add_child(_gold)
	var sort := UiTheme.button("⇅", "DarkButton", func(): ui.send("sortInventory"))
	sort.tooltip_text = "Düzenle: eşyaları türüne göre sıralar, yarım yığınları birleştirir"
	gold_row.add_child(sort)
	var bin := ItemSlot.new({"area": "bin"}, 30, "Çöp")
	bin.tooltip_text = "Yok etmek için bir eşyayı buraya sürükle"
	bin.accepts = func(data): return data.ref.get("area") == "inv"
	bin.dropped_on.connect(func(from): _ask("destroyItem", int(from.index)))
	gold_row.add_child(bin)
	_confirm = ConfirmationDialog.new()
	_confirm.cancel_button_text = "Vazgeç"
	add_child(_confirm)


func _wire(s: ItemSlot) -> void:
	s.activated.connect(func():
		if s.ref.area == "inv":
			ui.activate_inventory(int(s.ref.index))
		else:
			ui.send("unequip", {"slot": s.ref.slot}))
	s.dropped_on.connect(func(from): ui.send("moveItem", {"from": from, "to": s.ref}))
	if s.ref.area == "inv":
		s.dropped_outside.connect(func(): _ask("dropItem", int(s.ref.index)))
	s.hovered.connect(func(inside):
		if not inside or s.item == null:
			ui.tooltip.hide_tip()
			return
		var d := Items.def(s.item.defId)
		var hint := ui.activate_hint(int(s.ref.index)) if s.ref.area == "inv" else "Sağ tık: çıkar"
		ui.tooltip.show_item(d, {"qty": s.item.get("qty", 1), "enhance": s.item.get("enhance", 0), "affixes": s.item.get("affixes"), "playerLevel": ui.player_level(), "equipped": s.ref.area == "equip", "footer": [{"text": hint}]}, s))


func update(event: Dictionary) -> void:
	state = event
	var equipment: Dictionary = event.get("equipment", {})
	for slot in _equip:
		_equip[slot].set_item(equipment.get(slot))
	var slots: Array = event.get("slots", [])
	for i in _bag.size():
		_bag[i].set_item(slots[i] if i < slots.size() else null)
	_gold.text = _thousands(int(event.get("gold", 0)))
	doll.update_equipment(equipment)
	for c in _stats.get_children():
		c.queue_free()
	var st: Dictionary = event.get("stats", {})
	var attrs: Dictionary = st.get("attributes", {})
	var names: Dictionary = GameData.get_value("ATTRIBUTE_NAMES", {})
	var help: Dictionary = GameData.get_value("ATTRIBUTE_HELP", {})
	var entries := [
		["Saldırı", str(int(st.get("attack", 0)))], ["Savunma", str(int(st.get("defense", 0)))],
		["Can", str(int(st.get("maxHp", 0)))], ["Hız", "%.2f sn" % (float(st.get("attackSpeedMs", 0)) / 1000.0)],
		["Kritik", "%%%.1f" % (float(st.get("critChance", 0)) * 100.0)], ["Can Çalma", "%%%d" % int(round(float(st.get("lifeSteal", 0)) * 100.0))],
	]
	for id in GameData.get_value("ATTRIBUTE_IDS", []):
		entries.append([String(names.get(id, id)), str(int(attrs.get(id, 0))), String(help.get(id, ""))])
	for e in entries:
		var row := HBoxContainer.new()
		var l := UiTheme.label(String(e[0]) + " ", 13, UiTheme.MUTED)
		var v := UiTheme.label(String(e[1]), 13, UiTheme.TEXT, true)
		row.add_child(l)
		row.add_child(v)
		if e.size() > 2:
			row.tooltip_text = e[2]
			row.mouse_filter = Control.MOUSE_FILTER_PASS
		_stats.add_child(row)


static func _thousands(n: int) -> String:
	var s := str(absi(n))
	var out := ""
	while s.length() > 3:
		out = "." + s.substr(s.length() - 3) + out
		s = s.substr(0, s.length() - 3)
	return ("-" if n < 0 else "") + s + out


## "Yere at" / "Yok et" a bag slot, after the player says yes.
func _ask(action: String, index: int) -> void:
	var slots: Array = state.get("slots", []) if state else []
	var item = slots[index] if index < slots.size() else null
	if item == null:
		return
	var d := Items.def(item.defId)
	if action == "dropItem" and d.get("questItem", false):
		ui.hud.show_message("Görev eşyası yere atılamaz")
		return
	var qty := int(item.get("qty", 1))
	var label := String(d.get("name", "?")) + (" x%d" % qty if qty > 1 else "")
	var uid := String(item.get("uid", ""))
	_confirm.dialog_text = ("%s yere atılsın mı?" if action == "dropItem" else "%s kalıcı olarak yok edilsin mi?") % label
	_confirm.ok_button_text = "Yere at" if action == "dropItem" else "Yok et"
	for c in _confirm.confirmed.get_connections():
		_confirm.confirmed.disconnect(c.callable)
	_confirm.confirmed.connect(func():
		# The bags may have changed while the dialog was open: only act on the same item.
		var now: Array = state.get("slots", []) if state else []
		if index < now.size() and now[index] != null and String(now[index].get("uid", "")) == uid:
			ui.send(action, {"index": index}), CONNECT_ONE_SHOT)
	_confirm.popup_centered()


func count_item(def_id: String) -> int:
	if state == null:
		return 0
	var total := 0
	for slot in state.get("slots", []):
		if slot != null and String(slot.defId) == def_id:
			total += int(slot.get("qty", 1))
	return total
