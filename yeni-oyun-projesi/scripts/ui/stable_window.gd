class_name StableWindow
extends GameWindow

## Seyis Yusuf · At Çiftliği: buy a faster breed, ride another one,
## restyle the ridden horse's colours.

const PART_NAMES := {"coat": "Don", "mane": "Yele", "blanket": "Örtü", "saddle": "Eyer"}

var ui: GameUi
var npc := {}
var horses := {"owned": ["village"], "active": "village", "looks": {}}
var tab := "breeds"
var draft: Variant = null
var confirming: Variant = null
var _content: VBoxContainer


func _init(owner_ui: GameUi) -> void:
	super._init("stable-window", "Seyis Yusuf · At Çiftliği", 440)
	ui = owner_ui
	set_default_anchor(Control.PRESET_CENTER_LEFT)
	on_close = func(): npc = {}
	_content = VBoxContainer.new()
	_content.add_theme_constant_override("separation", 6)
	body.add_child(_content)


func set_state(event: Dictionary) -> void:
	horses = event
	draft = null
	confirming = null
	if visible:
		render()


func look_of(breed: String) -> Dictionary:
	var looks: Dictionary = horses.get("looks", {})
	return looks[breed] if looks.has(breed) else HorsePainter.breed_look(breed)


func active_look() -> Dictionary:
	return look_of(String(horses.get("active", "village")))


func open_for(target: Dictionary) -> void:
	npc = target
	tab = "breeds"
	draft = null
	confirming = null
	open()
	render()


func refresh() -> void:
	if visible:
		render()


func render() -> void:
	if npc.is_empty():
		return
	for c in _content.get_children():
		c.queue_free()
	var purse := ui.gold()
	var tabs := HBoxContainer.new()
	for pair in [["breeds", "Atlar"], ["style", "Düzenle"]]:
		tabs.add_child(UiTheme.button(pair[1], "" if tab == pair[0] else "DarkButton", func():
			tab = pair[0]
			confirming = null
			render()))
	_content.add_child(tabs)
	_content.add_child(UiTheme.label("Kesende: %s altın" % InventoryWindow._thousands(purse), 13, UiTheme.GOLD_LIGHT, true))
	if tab == "breeds":
		_breeds(purse)
	else:
		_style(purse)


func _breeds(purse: int) -> void:
	for id in GameData.get_value("HORSE_BREED_IDS", []):
		var breed: Dictionary = GameData.HORSE_BREEDS[id]
		var owned: bool = id in horses.get("owned", [])
		var riding: bool = horses.get("active") == id
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		var img := TextureRect.new()
		img.texture = HorsePainter.icon(look_of(id), 3)
		img.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
		img.custom_minimum_size = Vector2(80, 60)
		row.add_child(img)
		var text := VBoxContainer.new()
		text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		text.add_child(UiTheme.title_label(String(breed.name), 18))
		var speed := float(breed.get("speedBonus", 0))
		text.add_child(UiTheme.label(("+%%%d binek hızı" % int(round(speed * 100))) if speed > 0 else "Normal binek hızı", 12, Color("#8ce99a")))
		var desc := UiTheme.label(String(breed.get("description", "")), 12, UiTheme.MUTED)
		desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		desc.custom_minimum_size = Vector2(200, 0)
		text.add_child(desc)
		row.add_child(text)
		var side := VBoxContainer.new()
		side.custom_minimum_size = Vector2(110, 0)
		var price := int(breed.get("price", 0))
		if confirming != null and confirming.kind == "buy" and confirming.breed == id:
			side.add_child(UiTheme.label("%s altın. Emin misin?" % InventoryWindow._thousands(price), 12))
			side.add_child(UiTheme.button("Eminim, al", "", func():
				confirming = null
				ui.send("horseBuy", {"npcId": npc.id, "breed": id})))
			side.add_child(UiTheme.button("Vazgeç", "DarkButton", func():
				confirming = null
				render()))
		elif riding:
			side.add_child(UiTheme.label("Binilen", 13, UiTheme.GOLD_LIGHT, true))
		elif owned:
			side.add_child(UiTheme.button("Bin", "", func(): ui.send("horseSelect", {"npcId": npc.id, "breed": id})))
		else:
			side.add_child(UiTheme.label("%s altın" % InventoryWindow._thousands(price), 13, Color("#ffd34d"), true))
			var buy := UiTheme.button("Satın al", "", func():
				confirming = {"kind": "buy", "breed": id}
				render())
			buy.disabled = purse < price
			side.add_child(buy)
		row.add_child(side)
		_content.add_child(row)


func _style(purse: int) -> void:
	var current := active_look()
	if draft == null:
		draft = current.duplicate()
	var look: Dictionary = draft
	_content.add_child(UiTheme.title_label(String(GameData.HORSE_BREEDS.get(horses.get("active", "village"), {}).get("name", "")), 18))
	var preview := TextureRect.new()
	preview.texture = HorsePainter.icon(look, 5)
	preview.stretch_mode = TextureRect.STRETCH_KEEP_CENTERED
	preview.custom_minimum_size = Vector2(0, 110)
	_content.add_child(preview)
	var palette: Dictionary = GameData.get_value("HORSE_PALETTE", {})
	for part in ["coat", "mane", "blanket", "saddle"]:
		var row := HBoxContainer.new()
		var name := UiTheme.label(PART_NAMES[part], 13)
		name.custom_minimum_size = Vector2(50, 0)
		row.add_child(name)
		for color in palette.get(part, []):
			var swatch := Button.new()
			swatch.focus_mode = Control.FOCUS_NONE
			swatch.custom_minimum_size = Vector2(22, 22)
			var s := StyleBoxFlat.new()
			s.bg_color = GameData.rgb(color)
			s.border_color = UiTheme.GOLD_LIGHT if int(look[part]) == int(color) else Color.BLACK
			s.set_border_width_all(2 if int(look[part]) == int(color) else 1)
			for st in ["normal", "hover", "pressed", "focus"]:
				swatch.add_theme_stylebox_override(st, s)
			swatch.pressed.connect(func():
				var next: Dictionary = look.duplicate()
				next[part] = int(color)
				draft = next
				confirming = null
				render())
			row.add_child(swatch)
		_content.add_child(row)
	var unchanged := true
	for part in look:
		if int(look[part]) != int(current.get(part, -1)):
			unchanged = false
	var price := int(GameData.get_value("HORSE_STYLE_PRICE", 1000000))
	var actions := HBoxContainer.new()
	if confirming != null and confirming.kind == "style":
		actions.add_child(UiTheme.label("Bu düzenleme %s altın tutar. Emin misin?" % InventoryWindow._thousands(price), 12))
		actions.add_child(UiTheme.button("Eminim, düzenle", "", func():
			confirming = null
			var payload := {}
			for part in look:
				payload[part] = int(look[part])
			ui.send("horseStyle", {"npcId": npc.id, "look": payload})))
		actions.add_child(UiTheme.button("Vazgeç", "DarkButton", func():
			confirming = null
			render()))
	else:
		var undo := UiTheme.button("Geri al", "DarkButton", func():
			draft = null
			render())
		undo.disabled = unchanged
		actions.add_child(undo)
		var apply := UiTheme.button("Düzenle (%s altın)" % InventoryWindow._thousands(price), "", func():
			confirming = {"kind": "style"}
			render())
		apply.disabled = unchanged or purse < price
		actions.add_child(apply)
	_content.add_child(actions)
	_content.add_child(UiTheme.muted("Renkler yalnızca bindiğin ata uygulanır. Başka bir atını düzenlemek için önce ona bin.", 12))
