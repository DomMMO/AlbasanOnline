class_name PetWindow
extends GameWindow

## Petçi Nuri: buy a pet (pets.ts), call one out or send it home.

var ui: GameUi
var npc := {}
var pets := {"owned": [], "active": ""}
var confirming := ""
var _content: VBoxContainer


func _init(owner_ui: GameUi) -> void:
	super._init("pet-window", "Petçi Nuri", 420)
	ui = owner_ui
	set_default_anchor(Control.PRESET_CENTER_LEFT)
	on_close = func(): npc = {}
	_content = VBoxContainer.new()
	_content.add_theme_constant_override("separation", 8)
	body.add_child(_content)


func set_state(event: Dictionary) -> void:
	pets = event
	confirming = ""
	refresh()


func open_for(target: Dictionary) -> void:
	npc = target
	confirming = ""
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
	_content.add_child(UiTheme.label("Kesende: %s altın" % InventoryWindow._thousands(purse), 13, UiTheme.GOLD_LIGHT, true))
	var defs: Dictionary = GameData.get_value("PETS", {})
	for id in GameData.get_value("PET_IDS", []):
		_content.add_child(_row(String(id), defs[id], purse))
	_content.add_child(UiTheme.muted("Sahada peti /pet ile çağırıp eve gönderebilirsin. Yerdeki ganimeti senin alabileceğin kadar toplar; çanta doluysa bırakır.", 12))


func _row(id: String, def: Dictionary, purse: int) -> HBoxContainer:
	var owned: bool = id in pets.get("owned", [])
	var out: bool = pets.get("active", "") == id
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var img := TextureRect.new()
	var set := Sprites.sprite_set(def.appearance)
	img.texture = set.frames.get_frame_texture("idle_side", 0)
	img.texture_filter = CanvasItem.TEXTURE_FILTER_NEAREST
	img.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	img.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	img.custom_minimum_size = Vector2(set.width, set.height) * 4
	row.add_child(img)
	var text := VBoxContainer.new()
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.add_child(UiTheme.title_label(String(def.name), 18))
	text.add_child(UiTheme.label("Ganimet toplar", 12, Color("#8ce99a")))
	var desc := UiTheme.label(String(def.get("description", "")), 12, UiTheme.MUTED)
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.custom_minimum_size = Vector2(190, 0)
	text.add_child(desc)
	row.add_child(text)
	var side := VBoxContainer.new()
	side.custom_minimum_size = Vector2(110, 0)
	var price := int(def.get("price", 0))
	if confirming == id:
		side.add_child(UiTheme.label("%s altın. Emin misin?" % InventoryWindow._thousands(price), 12))
		side.add_child(UiTheme.button("Eminim, al", "", func():
			confirming = ""
			ui.send("petBuy", {"npcId": npc.id, "pet": id})))
		side.add_child(UiTheme.button("Vazgeç", "DarkButton", func():
			confirming = ""
			render()))
	elif out:
		side.add_child(UiTheme.label("Yanında", 13, UiTheme.GOLD_LIGHT, true))
		side.add_child(UiTheme.button("Eve gönder", "DarkButton", func(): ui.send("petSummon", {"pet": ""})))
	elif owned:
		side.add_child(UiTheme.button("Çağır", "", func(): ui.send("petSummon", {"pet": id})))
	else:
		side.add_child(UiTheme.label("%s altın" % InventoryWindow._thousands(price), 13, Color("#ffd34d"), true))
		var buy := UiTheme.button("Satın al", "", func():
			confirming = id
			render())
		buy.disabled = purse < price
		side.add_child(buy)
	row.add_child(side)
	return row
