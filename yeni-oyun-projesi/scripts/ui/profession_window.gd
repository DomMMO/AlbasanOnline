class_name ProfessionWindow
extends GameWindow

## Meslek Çantası: the profession bag. Three tool slots (pickaxe, sickle, rod: a tool there
## works like one in the bags and takes no bag space) and the slots ore, herbs and fish are
## picked up into before the bags. Drag to and from the bags or the storage, right click to
## sell / put away / take out (whatever window is open), opened from the Karakter window.

const TOOL_FALLBACK := ["pickaxe", "sickle", "rod"]
const TOOL_NAMES_FALLBACK := {"pickaxe": "Kazma", "sickle": "Orak", "rod": "Olta"}

var ui: GameUi
var state: Variant = null  # InventoryEvent
var _tools := {}
var _slots: Array[ItemSlot] = []


func _init(owner_ui: GameUi) -> void:
	super._init("profession-window", "Meslek Çantası", 360)
	ui = owner_ui
	set_default_anchor(Control.PRESET_CENTER_RIGHT)
	on_close = func(): ui.tooltip.hide_tip()
	var names: Dictionary = GameData.get_value("TOOL_SLOT_NAMES", TOOL_NAMES_FALLBACK)
	var tools := HBoxContainer.new()
	tools.add_theme_constant_override("separation", 6)
	body.add_child(tools)
	tools.add_child(UiTheme.label("Aletler", 13, UiTheme.MUTED))
	for slot in GameData.get_value("TOOL_SLOTS", TOOL_FALLBACK):
		var s := ItemSlot.new({"area": "tool", "slot": slot}, 40, String(names.get(slot, slot)))
		s.accepts = func(data): return data.ref.get("area") == "inv" and String(Items.def(data.defId).get("tool", "")) == String(slot)
		s.dropped_on.connect(func(from): ui.send("moveItem", {"from": from, "to": s.ref}))
		s.activated.connect(func(): _activate_tool(String(slot)))
		s.hovered.connect(func(inside): _hover(s, inside, _tool_hint(s)))
		tools.add_child(s)
		_tools[slot] = s
	var grid := GridContainer.new()
	grid.columns = 8
	grid.add_theme_constant_override("h_separation", 4)
	grid.add_theme_constant_override("v_separation", 4)
	body.add_child(grid)
	for i in int(GameData.get_value("PROFESSION_BAG_SIZE", 24)):
		var s := ItemSlot.new({"area": "prof", "index": i}, 38)
		s.accepts = func(data): return data.ref.get("area") in ["inv", "prof", "storage"] and Items.def(data.defId).get("profession", false)
		s.dropped_on.connect(func(from): ui.send("moveItem", {"from": from, "to": s.ref}))
		s.dropped_outside.connect(func(): ui.inventory.ask("dropItem", i, "prof"))
		s.activated.connect(func(): ui.activate_profession(i))
		s.hovered.connect(func(inside): _hover(s, inside, ui.activate_profession_hint(i)))
		grid.add_child(s)
		_slots.append(s)
	body.add_child(UiTheme.muted("Maden, bitki ve balıklar önce buraya toplanır. Yuvasındaki alet çantada yer kaplamaz.", 12))


func _hover(s: ItemSlot, inside: bool, hint: String) -> void:
	if not inside or s.item == null:
		ui.tooltip.hide_tip()
		return
	ui.tooltip.show_item(Items.def(s.item.defId), {"qty": s.item.get("qty", 1), "enhance": s.item.get("enhance", 0), "affixes": s.item.get("affixes"), "playerLevel": ui.player_level(), "footer": [{"text": hint}]}, s)


## Beside the Karakter window the first time (afterwards wherever it was dragged).
func _place_default() -> void:
	super._place_default()
	var inv: Control = ui.inventory
	if inv.visible:
		var shown := size * scale
		position = Vector2(maxf(0, inv.position.x - shown.x - 8), inv.position.y + inv.size.y * inv.scale.y - shown.y)
		position.y = clampf(position.y, 6, maxf(6, get_viewport_rect().size.y - shown.y - 6))


func update(event: Dictionary) -> void:
	state = event
	var tools: Dictionary = event.get("tools", {})
	for slot in _tools:
		_tools[slot].set_item(tools.get(slot))
	var items: Array = event.get("profession", [])
	for i in _slots.size():
		_slots[i].set_item(items[i] if i < items.size() else null)


func item_at(index: int) -> Variant:
	var items: Array = state.get("profession", []) if state else []
	return items[index] if index < items.size() else null


## Right click on a tool: the rod casts (in the harbour), the others go back to the bags.
func _activate_tool(slot: String) -> void:
	var s: ItemSlot = _tools[slot]
	if s.item == null:
		return
	if Items.def(s.item.defId).get("fishingRod", false):
		ui.send("useItem", {"defId": String(s.item.defId)})
		return
	var free := ui.first_free_bag_slot()
	if free == -1:
		ui.hud.show_message("Envanter dolu")
		return
	ui.send("moveItem", {"from": s.ref, "to": {"area": "inv", "index": free}})


func _tool_hint(s: ItemSlot) -> String:
	if s.item == null:
		return ""
	if Items.def(s.item.defId).get("fishingRod", false):
		return "Sağ tık: balık tut (suyun kenarında)" if ui.world and ui.world.zone.get("fishing", false) else "Liman'da balık tutmak için"
	return "Burada dururken kullanılır · Sağ tık: çantaya al"
