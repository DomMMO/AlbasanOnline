class_name BarberWindow
extends GameWindow

## Berber Cemil: try hair styles and colours on a preview of your character, then pay
## BARBER_PRICE for the new look.

var ui: GameUi
var npc := {}
var draft := {}
var confirming := false
var _preview: Doll
var _controls: VBoxContainer


func _init(owner_ui: GameUi) -> void:
	super._init("barber-window", "Berber Cemil", 460)
	ui = owner_ui
	set_default_anchor(Control.PRESET_CENTER_LEFT)
	on_close = func(): npc = {}
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	body.add_child(row)
	_preview = Doll.new()
	_preview.custom_minimum_size = Vector2(150, 150)
	row.add_child(_preview)
	_controls = VBoxContainer.new()
	_controls.add_theme_constant_override("separation", 6)
	_controls.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(_controls)


func open_for(target: Dictionary) -> void:
	npc = target
	draft = current()
	confirming = false
	open()
	render()


func refresh() -> void:
	if visible:
		render()


## The look we have now (Doll keys: gender, hairStyle, hair, skin).
func current() -> Dictionary:
	return ui.world.look_appearance(ui.world.local.state) if ui.world and ui.world.local else {}


func render() -> void:
	if npc.is_empty():
		return
	var now := current()
	# The preview leaves the helmet off so the hair shows.
	var equipment: Dictionary = (ui.inventory_state().get("equipment", {}) if ui.inventory_state() else {}).duplicate()
	equipment.erase("head")
	_preview.equipment = equipment
	_preview.set_look(int(World.f(ui.world.local.state, "color", 0xffffff)), ui.player_class(), draft)
	for c in _controls.get_children():
		c.queue_free()
	_controls.add_child(UiTheme.label("Saç modeli", 14, UiTheme.GOLD_LIGHT, true))
	var styles := HFlowContainer.new()
	styles.add_theme_constant_override("h_separation", 4)
	styles.add_theme_constant_override("v_separation", 4)
	var names: Dictionary = GameData.get_value("HAIR_STYLE_NAMES", {})
	for style in GameData.get_value("HAIR_STYLES", []):
		styles.add_child(UiTheme.button(String(names.get(style, style)), "" if draft.get("hairStyle") == style else "DarkButton", func(): _pick("hairStyle", style)))
	_controls.add_child(styles)
	_controls.add_child(UiTheme.label("Saç rengi", 14, UiTheme.GOLD_LIGHT, true))
	var colors := HFlowContainer.new()
	colors.add_theme_constant_override("h_separation", 4)
	colors.add_theme_constant_override("v_separation", 4)
	for color in GameData.get_value("HAIR_COLORS", []):
		var swatch := Button.new()
		swatch.focus_mode = Control.FOCUS_NONE
		swatch.custom_minimum_size = Vector2(24, 24)
		var picked := int(draft.get("hair", -1)) == int(color)
		var s := StyleBoxFlat.new()
		s.bg_color = GameData.rgb(color)
		s.border_color = UiTheme.GOLD_LIGHT if picked else Color.BLACK
		s.set_border_width_all(2 if picked else 1)
		for st in ["normal", "hover", "pressed", "focus"]:
			swatch.add_theme_stylebox_override(st, s)
		swatch.pressed.connect(func(): _pick("hair", int(color)))
		colors.add_child(swatch)
	_controls.add_child(colors)
	var unchanged: bool = draft.get("hairStyle") == now.get("hairStyle") and int(draft.get("hair", -1)) == int(now.get("hair", -2))
	var price := int(GameData.get_value("BARBER_PRICE", 50000))
	_controls.add_child(UiTheme.label("Kesende: %s altın" % InventoryWindow._thousands(ui.gold()), 13, UiTheme.GOLD_LIGHT, true))
	var actions := HBoxContainer.new()
	if confirming:
		actions.add_child(UiTheme.label("%s altın. Emin misin?" % InventoryWindow._thousands(price), 12))
		actions.add_child(UiTheme.button("Eminim", "", func():
			confirming = false
			ui.send("barberStyle", {"npcId": npc.id, "hairStyle": draft.hairStyle, "hairColor": int(draft.hair)})))
		actions.add_child(UiTheme.button("Vazgeç", "DarkButton", func():
			confirming = false
			render()))
	else:
		var undo := UiTheme.button("Geri al", "DarkButton", func():
			draft = current()
			render())
		undo.disabled = unchanged
		actions.add_child(undo)
		var apply := UiTheme.button("Uygula (%s altın)" % InventoryWindow._thousands(price), "", func():
			confirming = true
			render())
		apply.disabled = unchanged or ui.gold() < price
		actions.add_child(apply)
	_controls.add_child(actions)
	_controls.add_child(UiTheme.muted("Önizlemeye tıklayınca karakterin döner.", 12))


func _pick(key: String, value: Variant) -> void:
	draft = draft.duplicate()
	draft[key] = value
	confirming = false
	render()
