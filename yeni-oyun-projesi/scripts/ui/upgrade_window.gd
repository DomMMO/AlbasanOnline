class_name UpgradeWindow
extends GameWindow

## The blacksmith's forge: +N upgrades with the chance, scroll, cost,
## the burn risk above +3 and protection charms.

const OUTCOME := {"success": ["BAŞARILI!", "#8ce99a"], "failed": ["Başarısız", "#ffb347"], "protected": ["Başarısız, item korundu", "#74c0fc"], "burned": ["İTEM YANDI!", "#ff5a5a"]}

var ui: GameUi
var npc := {}
var fortune_bonus := 0.0
var selected_uid := ""
var _cooldown_until := 0
var _slot: ItemSlot
var _info: VBoxContainer
var _protect: CheckBox
var _button: Button
var _result: Label


func _init(owner_ui: GameUi) -> void:
	super._init("upgrade-window", "", 330)
	ui = owner_ui
	set_default_anchor(Control.PRESET_CENTER_LEFT)
	on_close = func():
		npc = {}
		selected_uid = ""
		ui.tooltip.hide_tip()
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	body.add_child(row)
	_slot = ItemSlot.new({"area": "upgrade"}, 48)
	_slot.accepts = func(data): return data.ref.get("area") == "inv"
	_slot.dropped_on.connect(func(from): select(int(from.index)))
	_slot.activated.connect(func():
		selected_uid = ""
		refresh())
	row.add_child(_slot)
	_info = VBoxContainer.new()
	_info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(_info)
	_protect = CheckBox.new()
	_protect.focus_mode = Control.FOCUS_NONE
	_protect.toggled.connect(func(_on): refresh())
	body.add_child(_protect)
	_button = UiTheme.button("Yükselt", "TitleButton", _on_upgrade)
	body.add_child(_button)
	_result = UiTheme.title_label("", 24)
	_result.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	body.add_child(_result)


func open_for(target: Dictionary) -> void:
	npc = target
	title_label.text = String(target.name)
	_result.text = ""
	open()
	refresh()


func select(index: int) -> bool:
	var slots: Array = ui.inventory_state().get("slots", []) if ui.inventory_state() else []
	var item = slots[index] if index < slots.size() else null
	if item == null or not Items.is_upgradeable(Items.def(item.defId)):
		return false
	selected_uid = String(item.uid)
	_result.text = ""
	refresh()
	return true


func _on_upgrade() -> void:
	if npc.is_empty() or selected_uid.is_empty() or _button.disabled:
		return
	_cooldown_until = Time.get_ticks_msec() + 600
	_button.disabled = true
	get_tree().create_timer(0.65).timeout.connect(refresh)
	ui.send("upgrade", {"npcId": npc.id, "uid": selected_uid, "protect": _protect.button_pressed})


func _row(text: String, color := UiTheme.TEXT, bold := false) -> Label:
	var l := UiTheme.label(text, 13, color, bold)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(220, 0)
	_info.add_child(l)
	return l


func refresh() -> void:
	if npc.is_empty():
		return
	for c in _info.get_children():
		c.queue_free()
	var state = ui.inventory_state()
	var item = null
	if state:
		for s in state.get("slots", []):
			if s != null and String(s.uid) == selected_uid:
				item = s
	if item == null:
		selected_uid = ""
	_slot.set_item(item)
	var protection := String(GameData.get_value("PROTECTION_ITEM", "protection_charm"))
	var charms := ui.count_item(protection)
	_protect.text = "Koruma Tılsımı kullan (%d)" % charms
	if item == null or state == null:
		_row("Yükseltmek istediğin ekipmanı envanterden sağ tıkla ya da buraya sürükle.", UiTheme.MUTED)
		_button.disabled = true
		_protect.disabled = true
		return
	var def := Items.def(item.defId)
	var enhance := int(item.get("enhance", 0))
	var max_enhance := int(GameData.get_value("MAX_ENHANCE", 10))
	var color := Items.rarity_color(Items.rarity(def, item.get("affixes")))
	if enhance >= max_enhance:
		_row("%s +%d" % [def.name, enhance], color, true)
		_row("Bu item en yüksek seviyede.", UiTheme.MUTED)
		_button.disabled = true
		_protect.disabled = true
		return
	var target := enhance + 1
	var scroll_id := "upgrade_scroll_low" if target <= 4 else ("upgrade_scroll_mid" if target <= 7 else "upgrade_scroll_high")
	var scroll := GameData.item(scroll_id)
	var scrolls := ui.count_item(scroll_id)
	var cost := 5 * target * target + 5
	var chances: Array = GameData.get_value("UPGRADE_SUCCESS_CHANCE", [])
	var chance := int(round(minf(1.0, float(chances[target]) + fortune_bonus) * 100))
	var risky := target > int(GameData.get_value("SAFE_UPGRADE_LEVEL", 3))
	var now := Items.enhanced_stats(def, enhance)
	var next := Items.enhanced_stats(def, target)
	var names := {"attack": "Saldırı", "defense": "Savunma", "maxHp": "Can"}
	var stat_parts: Array = []
	for key in ["attack", "defense", "maxHp"]:
		if now.has(key):
			stat_parts.append("%s %d → %d" % [names[key], now[key], next[key]])
	_row("%s +%d → +%d" % [def.name, enhance, target], color, true)
	_row(" · ".join(stat_parts), UiTheme.MUTED)
	_row("Başarı şansı: %%%d%s" % [chance, (" (+%%%d fal)" % int(round(fortune_bonus * 100))) if fortune_bonus > 0 else ""], UiTheme.TEXT, true)
	_row("%s (%d)" % [scroll.get("name", scroll_id), scrolls], UiTheme.TEXT if scrolls > 0 else UiTheme.ERROR)
	_row("Ücret: %d altın" % cost, Color("#ffd34d") if int(state.get("gold", 0)) >= cost else UiTheme.ERROR)
	if risky:
		if _protect.button_pressed and charms > 0:
			_row("Başarısız olursa item korunur, seviyesi düşmez.", Color("#8ce99a"))
		else:
			_row("Başarısız olursa item YANAR!", Color("#ff5a5a"), true)
	else:
		_row("Güvenli seviye: başarısız olsa da item yanmaz.", Color("#8ce99a"))
	_protect.disabled = not risky or charms == 0
	if _protect.disabled:
		_protect.set_pressed_no_signal(false)
	_button.disabled = scrolls == 0 or int(state.get("gold", 0)) < cost or Time.get_ticks_msec() < _cooldown_until


func show_result(event: Dictionary) -> void:
	var spec: Array = OUTCOME.get(String(event.outcome), ["?", "#ffffff"])
	_result.text = ("%s +%d" % [spec[0], int(event.enhance)]) if event.outcome == "success" else String(spec[0])
	_result.add_theme_color_override("font_color", Color(spec[1]))
	_result.scale = Vector2(1.4, 1.4)
	_result.pivot_offset = _result.size / 2.0
	_result.create_tween().tween_property(_result, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
