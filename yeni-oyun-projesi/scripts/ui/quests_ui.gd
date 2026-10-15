class_name QuestsUi
extends RefCounted

## NPC conversations, quests, the quest log and the tracker.

const COMPASS := ["doğuda", "güneydoğuda", "güneyde", "güneybatıda", "batıda", "kuzeybatıda", "kuzeyde", "kuzeydoğuda"]

var ui: GameUi
var dialog: GameWindow
var log_window: GameWindow
var tracker: VBoxContainer
var log := {}  # questId -> {id, status, kills}
var npc := {}
var viewing := ""
var completing := ""
var showing_completion := false
var fortune: Variant = null
var answer := ""
var confirming := ""
var quiz_options: Variant = null


func _init(owner_ui: GameUi, parent: Control, hud_root: Control) -> void:
	ui = owner_ui
	dialog = GameWindow.new("npc-dialog", "", 380)
	dialog.set_default_anchor(Control.PRESET_CENTER_LEFT)
	dialog.on_close = func(): _reset_npc()
	parent.add_child(dialog)
	log_window = GameWindow.new("quest-log", "Görev Günlüğü", 360)
	log_window.set_default_anchor(Control.PRESET_TOP_LEFT)
	parent.add_child(log_window)
	tracker = VBoxContainer.new()
	tracker.add_theme_constant_override("separation", 2)
	tracker.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tracker.custom_minimum_size = Vector2(230, 0)
	tracker.visible = false
	hud_root.add_child(tracker)
	if Settings.touch:
		# Phones: under the menu buttons, in the middle.
		tracker.set_anchors_preset(Control.PRESET_CENTER_TOP)
		tracker.offset_left = -100
		tracker.offset_right = 100
		tracker.offset_top = 76
		tracker.custom_minimum_size = Vector2(200, 0)
	else:
		tracker.set_anchors_preset(Control.PRESET_TOP_RIGHT)
		tracker.offset_left = -240
		tracker.offset_right = -10
		tracker.offset_top = 236


# ---- Shared rules (quests.ts / classes.ts / directions.ts) ----

func quests_of_npc(npc_id: String) -> Array:
	var out: Array = []
	for q in GameData.QUESTS.values():
		if q.get("giver") == npc_id or q.get("turnIn") == npc_id:
			out.append(q)
	return out


func quest_available(quest: Dictionary, level: int) -> bool:
	var entry = log.get(quest.id)
	if entry and entry.status == "active":
		return false
	if entry and entry.status == "done" and not quest.get("repeatable", false):
		return false
	if level < int(quest.get("minLevel", 1)):
		return false
	var requires = quest.get("requires")
	return requires == null or (log.has(requires) and log[requires].status == "done")


func quest_ready(quest: Dictionary, entry: Dictionary) -> bool:
	var cls := ui.player_class()
	var objectives: Array = quest.get("objectives", [])
	var kills: Array = entry.get("kills", [])
	for i in objectives.size():
		var o: Dictionary = objectives[i]
		var k: int = int(kills[i]) if i < kills.size() and kills[i] != null else 0
		match String(o.type):
			"kill":
				if k < int(o.count):
					return false
			"path":
				if cls == "" or cls == "novice":
					return false
			"talk":
				if k < 1:
					return false
			_:
				if ui.count_item(String(o.item)) < int(o.count):
					return false
	return true


static func class_reset_price(level: int) -> int:
	return 100 * level


func class_quest_items(quest: Dictionary) -> Array:
	var cls := GameData.class_of(ui.player_class())
	var items = quest.get("reward", {}).get("classItems")
	if not (items is Dictionary):
		return []
	if items.has(cls.id):
		return items[cls.id]
	if cls.get("rewardsLike") and items.has(cls.rewardsLike):
		return items[cls.rewardsLike]
	return []


static func direction_to(from: Vector2, place: Vector2) -> Dictionary:
	var d := place - from
	var steps := int(round(d.length() / GameData.TILE_SIZE))
	var sector := int(round(atan2(d.y, d.x) / (PI / 4.0)))
	return {"compass": COMPASS[(sector + 8) % 8], "steps": steps}


# ---- State ----

func set_log(event: Dictionary) -> void:
	log = {}
	for q in event.get("quests", []):
		log[String(q.id)] = q
	quiz_options = null
	if not completing.is_empty() and (not log.has(completing) or log[completing].status != "active"):
		var quest: Dictionary = GameData.QUESTS.get(completing, {})
		completing = ""
		if not npc.is_empty() and not quest.is_empty():
			_show_completion(quest)
	else:
		var quiz = GameData.QUESTS.get(completing, {}).get("quiz") if not completing.is_empty() else null
		completing = ""
		if quiz:
			viewing = ""
			answer = String(quiz.wrongText)
		if not showing_completion:
			render_dialog()
	refresh()


func refresh() -> void:
	_render_tracker()
	if log_window.visible:
		_render_log()
	if not npc.is_empty() and completing.is_empty() and not showing_completion and viewing.is_empty():
		render_dialog()


func npc_marker(npc_id: String) -> Variant:
	var marker: Variant = null
	if not _pending_talks(npc_id).is_empty():
		marker = {"text": "?", "color": "#9ad5ff"}
	for quest in quests_of_npc(npc_id):
		var entry = log.get(quest.id)
		if quest.get("turnIn") == npc_id and entry and entry.status == "active":
			if quest_ready(quest, entry):
				return {"text": "?", "color": "#ffd34d"}
			if marker == null:
				marker = {"text": "?", "color": "#9a9a9a"}
		if quest.get("giver") == npc_id and quest_available(quest, ui.player_level()):
			if marker == null or marker.color != "#ffd34d":
				marker = {"text": "!", "color": "#ffd34d"}
	return marker


func open_dialog(target: Dictionary) -> bool:
	var talks: bool = target.get("role") == "guard" or target.get("role") == "master" or not _quest_talks(String(target.id)).is_empty()
	if quests_of_npc(String(target.id)).is_empty() and not target.get("fortuneTeller", false) and not talks:
		return false
	npc = target
	fortune = null
	answer = ""
	confirming = ""
	viewing = ""
	completing = ""
	showing_completion = false
	dialog.title_label.text = String(target.name)
	dialog.open()
	render_dialog()
	return true


func show_fortune(text: String, good: bool) -> void:
	fortune = {"text": text, "good": good}
	if not npc.is_empty() and npc.get("fortuneTeller", false) and dialog.visible:
		viewing = ""
		render_dialog()


func close_dialog() -> void:
	dialog.close_window()


func _reset_npc() -> void:
	npc = {}
	viewing = ""
	completing = ""
	showing_completion = false
	ui.tooltip.hide_tip()


# ---- Building blocks ----

func _clear() -> VBoxContainer:
	for c in dialog.body.get_children():
		c.queue_free()
	return dialog.body


func _text(text: String, color := UiTheme.TEXT, size := 14, italic := false) -> Label:
	var l := UiTheme.label(text, size, color)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(340, 0)
	if italic:
		l.add_theme_font_override("font", UiTheme._italic())
	return l


func _button(text: String, cb: Callable, variant := "") -> Button:
	var b := UiTheme.button(text, variant, cb)
	b.alignment = HORIZONTAL_ALIGNMENT_CENTER
	return b


func _quest_row(mark: String, title: String, state: String, extra: String, cb: Callable) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.theme_type_variation = "DarkButton"
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	var mark_color: String = {"available": "#ffd34d", "ready": "#ffd34d", "active": "#9a9a9a", "locked": "#6b6b6b"}.get(state, "#ffd34d")
	b.text = "%s  %s%s" % [mark, title, ("   " + extra) if not extra.is_empty() else ""]
	b.add_theme_color_override("font_color", Color(mark_color) if state == "locked" else UiTheme.GOLD_LIGHT)
	b.pressed.connect(cb)
	return b


func _buttons_row() -> HFlowContainer:
	var row := HFlowContainer.new()
	row.add_theme_constant_override("h_separation", 6)
	row.add_theme_constant_override("v_separation", 6)
	return row


func _quest_rows(target: Dictionary) -> Array:
	var level := ui.player_level()
	var out: Array = []
	for quest in quests_of_npc(String(target.id)):
		var entry = log.get(quest.id)
		if entry and entry.status == "active":
			if quest.get("turnIn") == target.id:
				var r := quest_ready(quest, entry)
				out.append({"quest": quest, "mark": "?" if r else "…", "state": "ready" if r else "active"})
			elif quest.get("giver") == target.id:
				out.append({"quest": quest, "mark": "…", "state": "active"})
			continue
		if quest.get("giver") != target.id:
			continue
		if quest_available(quest, level):
			out.append({"quest": quest, "mark": "!", "state": "available"})
			continue
		var requires = quest.get("requires")
		var prereq_done: bool = requires == null or (log.has(requires) and log[requires].status == "done")
		if entry == null and prereq_done and level < int(quest.get("minLevel", 1)):
			out.append({"quest": quest, "mark": "!", "state": "locked"})
	return out


func render_dialog() -> void:
	if npc.is_empty():
		return
	if not viewing.is_empty():
		_render_quest(GameData.QUESTS.get(viewing, {}))
		return
	ui.tooltip.hide_tip()
	var target := npc
	if not confirming.is_empty():
		_render_confirm(target, confirming)
		return
	var body := _clear()
	body.add_child(_text(String(target.get("greeting", "")), Color("#d8cba8"), 14, true))
	if target.has("teaches"):
		body.add_child(_path_block(target))
	if fortune:
		body.add_child(_text(String(fortune.text), Color("#8ce99a") if fortune.good else Color("#ff8787")))
	if not answer.is_empty():
		body.add_child(_text(answer, UiTheme.GOLD_LIGHT))
	if target.get("role") == "guard":
		body.add_child(UiTheme.title_label("Yol sor", 18))
		body.add_child(_way_buttons(target))
	for t in _quest_talks(String(target.id)):
		var quest: Dictionary = t.quest
		var objective: Dictionary = t.objective
		body.add_child(_quest_row("?", "%s (%s)" % [objective.ask, quest.title], "active", "", func():
			answer = String(objective.reply)
			ui.send("questTalk", {"questId": quest.id, "npcId": target.id})
			render_dialog()))
	for r in _quest_rows(target):
		var quest: Dictionary = r.quest
		var state: String = r.state
		var extra := ""
		if state == "locked":
			extra = "Sv %d" % int(quest.minLevel)
		if quest.get("repeatable", false):
			extra += " tekrar"
		body.add_child(_quest_row(r.mark, String(quest.title), state, extra, func():
			if state == "locked":
				return
			viewing = String(quest.id)
			render_dialog()))
	var buttons := _buttons_row()
	match String(target.get("role", "")):
		"merchant":
			buttons.add_child(_button("Alışveriş", func(): ui.open_npc_window_from_dialog(target)))
		"blacksmith":
			buttons.add_child(_button("Eşya Yükselt", func(): ui.open_npc_window_from_dialog(target)))
		"storage", "stable", "pet", "barber":
			buttons.add_child(_button("Aç", func(): ui.open_npc_window_from_dialog(target)))
	if target.get("fortuneTeller", false) and fortune == null:
		buttons.add_child(_button("Falıma bak", func(): ui.send("readFortune", {"npcId": target.id})))
	var advice: Array = target.get("advice", [])
	if not advice.is_empty():
		buttons.add_child(_button("Bir öğüt daha" if not answer.is_empty() else "Öğüt iste", func(): _give_advice(target)))
	if target.has("teaches") and ui.player_class() == "novice":
		buttons.add_child(_button("Yolunu seç: %s" % GameData.class_of(String(target.teaches)).get("name", ""), func(): _ask("choose")))
	if target.get("fortuneTeller", false) and ui.player_class() != "novice":
		buttons.add_child(_button("Yolumu sıfırla (%d altın)" % class_reset_price(ui.player_level()), func(): _ask("reset"), "DarkButton"))
	buttons.add_child(_button("Hoşça kal", close_dialog, "DarkButton"))
	body.add_child(buttons)


func _way_buttons(guard: Dictionary) -> HFlowContainer:
	var grid := _buttons_row()
	var in_town: bool = String(guard.id) in GameData.zone("town").get("npcs", [])
	var from := Vector2(float(guard.x), float(guard.y))
	if not in_town:
		var spot: Dictionary = GameData.get_value("TOWN_SPOTS", {}).get("fromKeep", {"x": 0, "y": 0})
		from = Vector2(float(spot.x), float(spot.y))
	for place in GameData.get_value("TOWN_PLACES", []):
		if not in_town and place.id == "keep":
			continue
		grid.add_child(_button("%s nerede?" % place.name, func():
			var d := direction_to(from, Vector2(float(place.x), float(place.y)))
			var where := "Hemen şurada, birkaç adım ötede." if int(d.steps) <= 3 else "%s %s, aşağı yukarı %d adım." % ["Buradan" if in_town else "Kaleden çıkınca", d.compass, int(d.steps)]
			answer = "%s: %s %s" % [place.name, where, place.get("hint", "")]
			render_dialog()
			ui.show_way(place), "DarkButton"))
	return grid


func _path_block(master: Dictionary) -> VBoxContainer:
	var def := GameData.class_of(String(master.teaches))
	var block := VBoxContainer.new()
	block.add_child(UiTheme.title_label(String(def.name), 20, Color(String(def.get("color", "#ffffff")))))
	block.add_child(_text(String(def.get("description", "")), UiTheme.MUTED, 13))
	var mine := ui.player_class()
	if mine == String(master.teaches):
		block.add_child(_text("Senin ustan.", UiTheme.GOLD_LIGHT, 13))
	elif mine != "novice":
		block.add_child(_text("Sen %s yolundasın. Değiştirmek istersen Ayşe Teyze'ye git." % GameData.class_of(mine).get("name", ""), UiTheme.GOLD_LIGHT, 13))
	return block


func _ask(kind: String) -> void:
	confirming = kind
	answer = ""
	render_dialog()


func _render_confirm(target: Dictionary, kind: String) -> void:
	var body := _clear()
	var price := class_reset_price(ui.player_level())
	if kind == "choose":
		var def := GameData.class_of(String(target.teaches))
		body.add_child(UiTheme.title_label("%s olmak istiyorsun." % def.name, 20, Color(String(def.get("color", "#ffffff")))))
		body.add_child(_text("\"Benim yolumu seçersen geri dönüşü kolay değil. Bir kez öğrencim olursan başka bir ustaya ancak Ayşe Teyze fincanını ters çevirirse gidebilirsin; o da bedava değil.\"", Color("#d8cba8"), 14, true))
		body.add_child(_text("Emin misin? Değiştirmek istersen bedeli şu an %d altın (seviyenle artar)." % price, UiTheme.MUTED, 13))
	else:
		body.add_child(UiTheme.title_label("Yolunu sıfırlamak istiyorsun.", 20))
		body.add_child(_text("\"Fincanı ters çevirirsem %s yolun kapanır, yeniden Acemi olursun evladım. Seviyen ve eşyaların sende kalır; yalnızca o yola ait giydiklerin çantana döner.\"" % GameData.class_of(ui.player_class()).get("name", ""), Color("#d8cba8"), 14, true))
		body.add_child(_text("Bedeli %d altın. Emin misin?" % price, UiTheme.MUTED, 13))
	var buttons := _buttons_row()
	buttons.add_child(_button("Eminim, seç" if kind == "choose" else "Eminim, sıfırla", func():
		confirming = ""
		ui.send("chooseClass" if kind == "choose" else "resetClass", {"npcId": target.id})
		render_dialog()))
	buttons.add_child(_button("Vazgeç", func():
		confirming = ""
		render_dialog(), "DarkButton"))
	body.add_child(buttons)


func refresh_dialog() -> void:
	if not npc.is_empty() and viewing.is_empty() and completing.is_empty() and not showing_completion:
		render_dialog()


func _give_advice(master: Dictionary) -> void:
	var lines: Array = master.advice.filter(func(l): return l != answer)
	answer = String(lines[randi() % lines.size()]) if not lines.is_empty() else String(master.advice[0])
	render_dialog()


func _quest_talks(npc_id: String) -> Array:
	var out: Array = []
	for entry in log.values():
		var quest: Dictionary = GameData.QUESTS.get(String(entry.id), {})
		if entry.status != "active" or quest.is_empty():
			continue
		var objectives: Array = quest.get("objectives", [])
		for i in objectives.size():
			var o: Dictionary = objectives[i]
			if o.type == "talk" and o.get("npc") == npc_id:
				out.append({"quest": quest, "objective": o, "index": i})
	return out


func _pending_talks(npc_id: String) -> Array:
	return _quest_talks(npc_id).filter(func(t):
		var kills: Array = log.get(t.quest.id, {}).get("kills", [])
		return (int(kills[t.index]) if t.index < kills.size() and kills[t.index] != null else 0) < 1)


static func _shuffled(items: Array) -> Array:
	var copy := items.duplicate()
	copy.shuffle()
	return copy


func _quiz_block(target: Dictionary, quest: Dictionary) -> VBoxContainer:
	var quiz: Dictionary = quest.quiz
	if quiz_options == null or quiz_options.questId != quest.id:
		var wrong := _shuffled(quiz.wrong).slice(0, 3)
		quiz_options = {"questId": quest.id, "options": _shuffled([quiz.correct] + wrong)}
	var block := VBoxContainer.new()
	block.add_child(_text(String(quiz.question), Color("#d8cba8"), 14, true))
	var options: Array = quiz_options.options
	for i in options.size():
		var option: String = options[i]
		block.add_child(_quest_row("abcd"[i] + ")", option, "available", "", func():
			completing = String(quest.id)
			ui.send("questTurnIn", {"questId": quest.id, "npcId": target.id, "answer": option})))
	return block


func _objective_lines(quest: Dictionary, entry: Variant) -> Array:
	var out: Array = []
	var objectives: Array = quest.get("objectives", [])
	if objectives.is_empty():
		out.append(_text("%s ile konuş" % GameData.npc(String(quest.turnIn)).get("name", ""), UiTheme.TEXT, 13))
		return out
	var kills: Array = entry.get("kills", []) if entry else []
	for i in objectives.size():
		var o: Dictionary = objectives[i]
		var k: int = int(kills[i]) if i < kills.size() and kills[i] != null else 0
		var done := false
		var text := ""
		match String(o.type):
			"path":
				var chosen := ui.player_class() != "novice"
				done = chosen
				text = ("Yolunu seçtin: %s" % GameData.class_of(ui.player_class()).get("name", "")) if chosen else "Kaledeki ustalardan birini seç"
			"talk":
				done = k >= 1
				text = String(o.label)
			_:
				var have := k if o.type == "kill" else ui.count_item(String(o.item))
				var name := String(o.label) if o.type == "kill" else String(GameData.item(String(o.item)).get("name", o.item))
				var verb := "öldür" if o.type == "kill" else "topla"
				var shown := ("%d/%d" % [mini(have, int(o.count)), int(o.count)]) if entry else str(int(o.count))
				done = entry != null and have >= int(o.count)
				text = "%s %s: %s" % [name, verb, shown]
		out.append(_text(("✔ " if done else "• ") + text, Color("#8ce99a") if done else UiTheme.TEXT, 13))
	return out


func _reward_block(quest: Dictionary) -> VBoxContainer:
	var block := VBoxContainer.new()
	block.add_child(UiTheme.label("Ödül:", 13, UiTheme.MUTED))
	var reward: Dictionary = quest.get("reward", {})
	var parts: Array = []
	if reward.get("xp"):
		parts.append("%d XP" % int(reward.xp))
	if reward.get("gold"):
		parts.append("%d altın" % int(reward.gold))
	if not parts.is_empty():
		block.add_child(UiTheme.label(" · ".join(parts), 13, UiTheme.GOLD_LIGHT, true))
	var items := HFlowContainer.new()
	items.add_theme_constant_override("h_separation", 8)
	for r in reward.get("items", []) + class_quest_items(quest):
		var def := GameData.item(String(r.item))
		if def.is_empty():
			continue
		var row := HBoxContainer.new()
		row.mouse_filter = Control.MOUSE_FILTER_STOP
		var icon := TextureRect.new()
		icon.texture = Art.item_icon(String(def.id))
		icon.custom_minimum_size = Vector2(24, 24)
		icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		row.add_child(icon)
		var qty := int(r.get("qty", 1))
		var name := UiTheme.label("%s%s" % [def.name, (" x%d" % qty) if qty > 1 else ""], 13, Items.rarity_color(String(def.get("rarity", "common"))))
		row.add_child(name)
		row.mouse_entered.connect(func(): ui.tooltip.show_item(def, {"qty": qty, "playerLevel": ui.player_level()}, row))
		row.mouse_exited.connect(func(): ui.tooltip.hide_tip())
		items.add_child(row)
	if items.get_child_count() > 0:
		block.add_child(items)
	return block


func _render_quest(quest: Dictionary) -> void:
	if npc.is_empty() or quest.is_empty():
		return
	var target := npc
	ui.tooltip.hide_tip()
	var entry = log.get(quest.id)
	var active: bool = entry != null and entry.status == "active"
	var is_ready := active and quest_ready(quest, entry)
	var turn_in_here: bool = quest.get("turnIn") == target.id
	var text := String(quest.get("text", ""))
	if active and turn_in_here and not is_ready:
		text = String(quest.get("progressText", quest.text))
	if active and turn_in_here and is_ready:
		if (quest.get("objectives", []) as Array).is_empty():
			text = String(quest.get("completeText", ""))
		elif quest.has("quiz"):
			text = "Döndün mü? Anlat bakalım!"
		else:
			text = "İşini bitirmişsin. Gel, karşılığını vereyim."
	if active and not turn_in_here:
		text = "%s\n\nİş bitince %s ile konuş." % [quest.get("progressText", quest.text), GameData.npc(String(quest.turnIn)).get("name", "")]
	var body := _clear()
	body.add_child(UiTheme.label(String(quest.get("chain", "")), 12, UiTheme.MUTED))
	body.add_child(UiTheme.title_label(String(quest.title), 22))
	body.add_child(_text(text, Color("#d8cba8")))
	body.add_child(UiTheme.label("Görev:", 13, UiTheme.MUTED))
	for line in _objective_lines(quest, entry):
		body.add_child(line)
	body.add_child(_reward_block(quest))
	var buttons := _buttons_row()
	if not active and quest.get("giver") == target.id and quest_available(quest, ui.player_level()):
		buttons.add_child(_button("Kabul Et", func(): ui.send("questAccept", {"questId": quest.id, "npcId": target.id})))
	if is_ready and turn_in_here and quest.has("quiz"):
		body.add_child(_quiz_block(target, quest))
	elif is_ready and turn_in_here:
		buttons.add_child(_button("Tamamla", func():
			completing = String(quest.id)
			ui.send("questTurnIn", {"questId": quest.id, "npcId": target.id})))
	buttons.add_child(_button("Geri", func():
		viewing = ""
		render_dialog(), "DarkButton"))
	body.add_child(buttons)


func _show_completion(quest: Dictionary) -> void:
	viewing = ""
	showing_completion = true
	ui.tooltip.hide_tip()
	var body := _clear()
	body.add_child(UiTheme.label("%s · Tamamlandı" % quest.get("chain", ""), 12, UiTheme.MUTED))
	body.add_child(UiTheme.title_label(String(quest.title), 22))
	body.add_child(_text(String(quest.get("completeText", "")), Color("#d8cba8")))
	var buttons := _buttons_row()
	buttons.add_child(_button("Devam", func():
		showing_completion = false
		render_dialog()))
	body.add_child(buttons)


func _render_tracker() -> void:
	for c in tracker.get_children():
		c.queue_free()
	var active: Array = log.values().filter(func(q): return q.status == "active" and GameData.QUESTS.has(String(q.id)))
	tracker.visible = not active.is_empty()
	if active.is_empty():
		return
	tracker.add_child(UiTheme.title_label("Görevler (J)", 17))
	for entry in active.slice(0, 6):
		var quest: Dictionary = GameData.QUESTS[String(entry.id)]
		var r := quest_ready(quest, entry)
		var title := UiTheme.label(String(quest.title), 13, Color("#ffd34d") if r else UiTheme.GOLD_LIGHT, true)
		title.add_theme_color_override("font_shadow_color", Color.BLACK)
		tracker.add_child(title)
		if r:
			tracker.add_child(_shadowed(_text("✔ %s ile konuş" % GameData.npc(String(quest.turnIn)).get("name", ""), Color("#8ce99a"), 12)))
		else:
			for line in _objective_lines(quest, entry):
				line.add_theme_font_size_override("font_size", 12)
				tracker.add_child(_shadowed(line))


func _shadowed(l: Label) -> Label:
	l.add_theme_color_override("font_shadow_color", Color.BLACK)
	l.custom_minimum_size = Vector2(230, 0)
	return l


func _render_log() -> void:
	for c in log_window.body.get_children():
		c.queue_free()
	var active: Array = log.values().filter(func(q): return q.status == "active" and GameData.QUESTS.has(String(q.id)))
	var done := log.values().filter(func(q): return q.status == "done").size()
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(340, mini(420, 80 + active.size() * 190))
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var list := VBoxContainer.new()
	list.add_theme_constant_override("separation", 10)
	scroll.add_child(list)
	log_window.body.add_child(scroll)
	if active.is_empty():
		list.add_child(_text("Aktif görevin yok. Başında ! olan NPC'lerle konuş.", UiTheme.MUTED, 13, true))
	for entry in active:
		var quest: Dictionary = GameData.QUESTS[String(entry.id)]
		var card := VBoxContainer.new()
		card.add_child(UiTheme.label(String(quest.get("chain", "")), 12, UiTheme.MUTED))
		card.add_child(UiTheme.label(String(quest.title), 15, Color("#ffd34d") if quest_ready(quest, entry) else UiTheme.GOLD_LIGHT, true))
		card.add_child(_text(String(quest.get("text", "")), Color("#d8cba8"), 12))
		for line in _objective_lines(quest, entry):
			card.add_child(line)
		card.add_child(_text("Teslim: %s" % GameData.npc(String(quest.turnIn)).get("name", ""), UiTheme.TEXT, 13))
		card.add_child(_reward_block(quest))
		var abandon := _button("Görevi bırak", func(): ui.send("questAbandon", {"questId": quest.id}), "DarkButton")
		abandon.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		card.add_child(abandon)
		list.add_child(card)
	list.add_child(_text("Tamamlanan görev: %d" % done, UiTheme.MUTED, 13, true))


func toggle_log(force: Variant = null) -> void:
	var open: bool = (not log_window.visible) if force == null else bool(force)
	if open:
		_render_log()
		log_window.open()
	else:
		log_window.close_window()
