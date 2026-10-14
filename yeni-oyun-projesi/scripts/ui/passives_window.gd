class_name PassivesWindow
extends GameWindow

## Pasif Ağaç: 20 big sockets on a ring that turns the selected
## one to the top, its five small sockets in the middle, the totals of everything socketed.

const SOCKETS := 20
const GREATER := [0, 5, 10, 15]
const MINOR_OFFSETS := [Vector2(0, -1), Vector2(-1, 0), Vector2(1, 0), Vector2(0, 1), Vector2(0, 0)]
const RING := 128.0
const INNER := 42.0

var ui: GameUi
var state: Variant = null
var selected := 0
var rotation_deg := 0.0
var _shown_rotation := 0.0
var _ring: Control
var _majors: Array[ItemSlot] = []
var _minors: Array[ItemSlot] = []
var _summary: VBoxContainer
var _info: VBoxContainer


func _init(owner_ui: GameUi) -> void:
	super._init("passive-window", "Pasif Ağaç", 420)
	ui = owner_ui
	on_close = func(): ui.tooltip.hide_tip()
	_summary = VBoxContainer.new()
	body.add_child(_summary)
	_ring = Control.new()
	_ring.custom_minimum_size = Vector2(340, 340)
	_ring.draw.connect(_draw_ring)
	body.add_child(_ring)
	for s in SOCKETS:
		var slot := ItemSlot.new({"area": "passive", "socket": s, "minor": null}, 40 if s in GREATER else 34)
		_wire(slot, func(): return s, null)
		slot.gui_input.connect(func(ev): if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT: select(s))
		_ring.add_child(slot)
		_majors.append(slot)
	for m in 5:
		var slot := ItemSlot.new({"area": "passive", "socket": 0, "minor": m}, 30)
		_wire(slot, func(): return selected, m)
		_ring.add_child(slot)
		_minors.append(slot)
	_info = VBoxContainer.new()
	body.add_child(_info)


func _wire(slot: ItemSlot, socket_of: Callable, minor: Variant) -> void:
	slot.accepts = func(data): return data.ref.get("area") == "inv"
	slot.dropped_on.connect(func(from):
		ui.send("moveItem", {"from": from, "to": {"area": "passive", "socket": socket_of.call(), "minor": minor}}))
	slot.activated.connect(func():
		ui.send("moveItem", {"from": {"area": "passive", "socket": socket_of.call(), "minor": minor}, "to": {"area": "inv", "index": _first_free()}}))
	slot.hovered.connect(func(inside):
		if inside and slot.item != null:
			ui.tooltip.show_item(Items.def(slot.item.defId), {"affixes": slot.item.get("affixes"), "playerLevel": ui.player_level(), "footer": [{"text": "Sağ tık: çıkar"}]}, slot)
		else:
			ui.tooltip.hide_tip())


func _first_free() -> int:
	var slots: Array = ui.inventory_state().get("slots", []) if ui.inventory_state() else []
	var i := slots.find(null)
	return 0 if i == -1 else i


static func base_angle(i: int) -> float:
	return -90.0 + (360.0 / SOCKETS) * i


static func unlock_level(i: int) -> int:
	return i + 2


func select(s: int) -> void:
	var wanted := -90.0 - base_angle(s)
	var delta := fmod(wanted - rotation_deg, 360.0)
	if delta > 180.0:
		delta -= 360.0
	if delta < -180.0:
		delta += 360.0
	rotation_deg += delta
	selected = s
	if state:
		update(state)


func _process(delta: float) -> void:
	if not visible:
		return
	if not is_equal_approx(_shown_rotation, rotation_deg):
		_shown_rotation = move_toward(_shown_rotation, rotation_deg, delta * 360.0)
	_layout()
	_ring.queue_redraw()


func _layout() -> void:
	var center := _ring.size / 2.0
	for s in SOCKETS:
		var a := deg_to_rad(base_angle(s) + _shown_rotation)
		var slot := _majors[s]
		var scale := 1.3 if s == selected else 1.0
		slot.scale = Vector2(scale, scale)
		slot.pivot_offset = slot.size / 2.0
		slot.position = center + Vector2(cos(a), sin(a)) * RING - slot.size / 2.0
	for m in 5:
		var slot := _minors[m]
		slot.position = center + MINOR_OFFSETS[m] * INNER - slot.size / 2.0


func _draw_ring() -> void:
	var center := _ring.size / 2.0
	_ring.draw_arc(center, RING, 0, TAU, 96, Color(UiTheme.GOLD_DARK, 0.9), 2.0)
	for s in SOCKETS:
		var a := deg_to_rad(base_angle(s) + _shown_rotation)
		var end := center + Vector2(cos(a), sin(a)) * RING
		var on := s == selected
		_ring.draw_line(center + Vector2(cos(a), sin(a)) * (INNER + 18), end, Color(UiTheme.GOLD, 0.9) if on else Color(UiTheme.GOLD_DARK, 0.35), 3.0 if on else 1.0)
	_ring.draw_circle(center, INNER + 20, Color(0.1, 0.07, 0.04, 0.9))
	_ring.draw_arc(center, INNER + 20, 0, TAU, 64, UiTheme.GOLD, 1.5)


func update(event: Dictionary) -> void:
	state = event
	var level := ui.player_level()
	var passives: Array = event.get("passives", [])
	for s in SOCKETS:
		var entry = passives[s] if s < passives.size() else null
		var slot := _majors[s]
		slot.set_item(entry.get("major") if entry else null)
		var locked := level < unlock_level(s)
		slot.placeholder = ("Sv %d" % unlock_level(s)) if locked else ""
		slot.modulate.a = 0.5 if locked else 1.0
		slot.highlight = s in GREATER
	var sel = passives[selected] if selected < passives.size() else null
	var sel_locked := level < unlock_level(selected)
	for m in 5:
		var slot := _minors[m]
		var minors: Array = sel.get("minors", []) if sel else []
		slot.set_item(minors[m] if m < minors.size() else null)
		slot.ref = {"area": "passive", "socket": selected, "minor": m}
		slot.modulate.a = 0.4 if sel_locked or (sel and sel.get("major") == null) else 1.0
	for c in _info.get_children():
		c.queue_free()
	var greater: bool = selected in GREATER
	_info.add_child(UiTheme.title_label("%d. %s" % [selected + 1, "Kadim Yuva" if greater else "Yuva"], 18, Color("#ffb347") if greater else UiTheme.GOLD_LIGHT))
	if sel_locked:
		_info.add_child(UiTheme.muted("Seviye %d'de açılır" % unlock_level(selected), 12, 380))
	elif sel == null or sel.get("major") == null:
		_info.add_child(UiTheme.muted("%s tak: envanterden sürükle ya da sağ tıkla" % ("Kadim ya da Büyük Mücevher" if greater else "Büyük Mücevher"), 12, 380))
	else:
		for affix in sel.major.get("affixes", []):
			_info.add_child(UiTheme.label(Items.affix_label(affix), 13, Color("#ffb347"), true))
		var smalls: Array = []
		for item in sel.get("minors", []):
			if item:
				for affix in item.get("affixes", []):
					smalls.append(Items.affix_label(affix))
		if smalls.is_empty():
			_info.add_child(UiTheme.muted("Küçük slotlara Küçük Mücevher tak", 12, 380))
		else:
			_info.add_child(UiTheme.label("\n".join(smalls), 13))
	_render_summary(event)


func _render_summary(event: Dictionary) -> void:
	for c in _summary.get_children():
		c.queue_free()
	var totals := {}
	for entry in event.get("passives", []):
		for item in [entry.get("major")] + entry.get("minors", []):
			if item == null:
				continue
			for affix in item.get("affixes", []):
				totals[affix.id] = int(totals.get(affix.id, 0)) + int(affix.value)
	var attrs := HBoxContainer.new()
	attrs.add_theme_constant_override("separation", 14)
	var names: Dictionary = GameData.get_value("ATTRIBUTE_NAMES", {})
	var help: Dictionary = GameData.get_value("ATTRIBUTE_HELP", {})
	var values: Dictionary = event.get("stats", {}).get("attributes", {})
	var ids: Array = GameData.get_value("ATTRIBUTE_IDS", [])
	for id in ids:
		var l := UiTheme.label("%s %d" % [names.get(id, id), int(values.get(id, 0))], 13, UiTheme.TEXT, true)
		l.tooltip_text = String(help.get(id, ""))
		l.mouse_filter = Control.MOUSE_FILTER_PASS
		attrs.add_child(l)
	_summary.add_child(attrs)
	var effects: Array = []
	for id in totals:
		if id in ids:
			continue
		effects.append(Items.affix_label({"id": id, "value": totals[id]}))
	var open := clampi(ui.player_level() - 1, 0, SOCKETS)
	var info := UiTheme.label(" · ".join(effects) if not effects.is_empty() else "Açık slot: %d/%d. Mücevherler yaratıklardan düşer." % [open, SOCKETS], 12, UiTheme.MUTED)
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.custom_minimum_size = Vector2(380, 0)
	_summary.add_child(info)


func toggle_window(force: Variant = null) -> void:
	var want: bool = (not visible) if force == null else bool(force)
	if want:
		open()
		if state:
			update(state)
	else:
		close_window()
