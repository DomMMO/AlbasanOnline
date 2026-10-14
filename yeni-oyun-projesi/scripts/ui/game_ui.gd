class_name GameUi
extends RefCounted

## Everything in the game UI besides the HUD bars: the windows (Karakter, dükkân, demirci,
## yetenekler, görevler), the Esc menu, invites, party frames, the fish and stall buttons, the
## ping wheel. The World talks to the UI only through this class.

signal switch_character
signal logout

const PING_STYLES := {
	"alert": ["Dikkat!", "!", "#ffd43b"],
	"attack": ["Saldır!", "⚔", "#ff6b6b"],
	"help": ["Yardım lazım!", "✚", "#74c0fc"],
	"move": ["Buraya gel!", "➜", "#8ce99a"],
}

var hud: Hud
var world: World
var tooltip: Tooltip
var inventory: InventoryWindow
var shop: ShopWindow
var upgrade: UpgradeWindow
var skills: SkillsWindow
var quests: QuestsUi
var extra: ExtraWindows
var menu: GameMenu

var _invites := {}
var _party_box: VBoxContainer
var _fish_button: Button
var _stall_button: Button
var _ping_wheel: Control
var _pvp_stats: Label
var _killfeed: VBoxContainer


func _init(the_hud: Hud) -> void:
	hud = the_hud
	var w := hud.windows
	tooltip = Tooltip.new()
	inventory = InventoryWindow.new(self)
	w.add_child(inventory)
	shop = ShopWindow.new(self)
	w.add_child(shop)
	upgrade = UpgradeWindow.new(self)
	w.add_child(upgrade)
	skills = SkillsWindow.new(self)
	w.add_child(skills)
	quests = QuestsUi.new(self, w, hud.root)
	extra = ExtraWindows.new(self, w, hud.root)
	_build_invites()
	_build_party()
	_build_buttons()
	_build_pvp()
	# Windows over every HUD widget; the menu and the tooltip over the windows.
	hud.root.move_child(hud.windows, -1)
	menu = GameMenu.new(self)
	hud.root.add_child(menu)
	hud.root.add_child(tooltip)


# ---- Wiring ----

func bind_world(w: World) -> void:
	world = w


func send(type: String, message: Variant = null) -> void:
	if world and world.room:
		world.room.send(type, message)


func player_level() -> int:
	return int(World.f(world.local.state, "level", 1)) if world and world.local else 1


func player_class() -> String:
	return String(World.f(world.local.state, "cls", "novice")) if world and world.local else "novice"


func inventory_state() -> Variant:
	return inventory.state


func stats() -> Variant:
	return inventory.state.get("stats") if inventory.state else null


func gold() -> int:
	return int(inventory.state.get("gold", 0)) if inventory.state else 0


func count_item(def_id: String) -> int:
	return inventory.count_item(def_id)


func skill_rank(id: String) -> int:
	return skills.rank(id)


func has_fishing_rod() -> bool:
	if inventory.state == null:
		return false
	for s in inventory.state.get("slots", []):
		if s != null and GameData.item(String(s.defId)).get("fishingRod", false):
			return true
	return false


# ---- Inventory and NPC windows ----

func update_inventory(event: Dictionary) -> void:
	inventory.update(event)
	extra.update_inventory(event)
	shop.refresh()
	upgrade.refresh()
	quests.refresh()


func set_doll_look(color: int, cls: String, look: Dictionary) -> void:
	inventory.doll.set_look(color, cls, look)


func toggle_inventory(force: Variant = null) -> void:
	inventory.toggle(force)
	if not inventory.visible:
		tooltip.hide_tip()


## Right click / double click on a bag item: whatever the open window wants with it.
func activate_inventory(index: int) -> void:
	if extra.is_trade_open():
		extra.add_to_trade(index)
		return
	var keeper := extra.storage_npc()
	if not keeper.is_empty():
		send("storageQuick", {"npcId": keeper.id, "from": {"area": "inv", "index": index}})
		return
	if upgrade.visible and not upgrade.npc.is_empty():
		if not upgrade.select(index):
			hud.show_message("Bu item yükseltilemez")
		return
	if extra.is_stall_setup_open():
		extra.add_to_stall(index)
		return
	if shop.visible and not shop.npc.is_empty():
		send("sell", {"npcId": shop.npc.id, "index": index})
	else:
		send("useItem", {"index": index})


func activate_hint(index: int) -> String:
	var slots: Array = inventory.state.get("slots", []) if inventory.state else []
	var item = slots[index] if index < slots.size() else null
	if item == null:
		return ""
	var def := Items.def(item.defId)
	if def.is_empty():
		return ""
	var price := Items.sell_price(def, item.get("affixes")) * int(item.get("qty", 1))
	if extra.is_trade_open():
		return "Görev eşyası takas edilemez" if def.get("questItem", false) else "Sağ tık: takasa koy"
	if not extra.storage_npc().is_empty():
		return "Sağ tık: depoya koy"
	if upgrade.visible and not upgrade.npc.is_empty():
		return "Sağ tık: yükseltmeye koy" if Items.is_upgradeable(def) else "Yükseltilemez"
	if extra.is_stall_setup_open():
		return "Sağ tık: tezgâha koy"
	if shop.visible and not shop.npc.is_empty():
		return "Sağ tık: sat (%d altın)" % price
	if def.get("fishingRod", false):
		return "Sağ tık: balık tut (suyun kenarında)" if world and world.zone.get("fishing", false) else "Liman'da balık tutmak için"
	if def.has("slot"):
		return "Sağ tık: kuşan"
	if def.has("jewel"):
		return "Sağ tık: pasif ağaca tak (P)"
	if def.has("heal") or def.has("mana") or def.has("recall"):
		return "Sağ tık: kullan"
	return "Satış değeri: %d altın" % price


func hotbar_tooltip(index: int, slot: Control, hotbar: Array, w: World) -> void:
	if index < 0 or index >= hotbar.size() or hotbar[index].kind == "empty" or w.local == null:
		tooltip.hide_tip()
		return
	var entry: Dictionary = hotbar[index]
	tooltip.show_skill(entry.skill, {"rank": skill_rank(String(entry.skill.id)), "playerLevel": player_level(), "playerClass": player_class(), "stats": stats()}, slot)


func close_npc_windows() -> void:
	shop.close_window()
	upgrade.close_window()
	extra.close_storage()
	extra.close_stable()
	quests.close_dialog()


func close_npc_dialog() -> void:
	quests.close_dialog()


func open_npc_dialog(npc: Dictionary) -> bool:
	return quests.open_dialog(npc)


## The NPC's own window (shop, forge, storage, stable); false if it has none.
func open_npc_window(npc: Dictionary) -> bool:
	match String(npc.get("role", "")):
		"merchant":
			shop.open_for(npc)
		"blacksmith":
			upgrade.open_for(npc)
		"storage":
			extra.open_storage(npc)
		"stable":
			extra.open_stable(npc)
		_:
			return false
	return true


func open_npc_window_from_dialog(npc: Dictionary) -> void:
	quests.close_dialog()
	if open_npc_window(npc):
		toggle_inventory(true)


## Walking away from an NPC closes its window.
func close_far_npc_windows(at: Vector2) -> void:
	var limit := GameData.NPC_RANGE + GameData.TILE_SIZE
	var far := func(npc: Dictionary) -> bool: return not npc.is_empty() and at.distance_to(Vector2(float(npc.x), float(npc.y))) > limit
	if shop.visible and far.call(shop.npc):
		shop.close_window()
	if upgrade.visible and far.call(upgrade.npc):
		upgrade.close_window()
	if far.call(extra.storage_npc()):
		extra.close_storage()
	if far.call(extra.stable_npc()):
		extra.close_stable()
	if quests.dialog.visible and far.call(quests.npc):
		quests.close_dialog()


func npc_marker(npc_id: String) -> Variant:
	return quests.npc_marker(npc_id)


func set_quest_log(event: Dictionary) -> void:
	quests.set_log(event)


func refresh_quests() -> void:
	quests.refresh()
	quests.refresh_dialog()
	if world:
		world.refresh_npc_markers()


func show_fortune(text: String, good: bool) -> void:
	quests.show_fortune(text, good)


func show_way(place: Dictionary) -> void:
	if world:
		world.show_way(place)


func toggle_quest_log() -> void:
	quests.toggle_log()


func set_upgrade_fortune(bonus: float) -> void:
	upgrade.fortune_bonus = bonus


func show_upgrade_result(event: Dictionary) -> void:
	upgrade.show_result(event)


func set_skill_ranks(event: Dictionary) -> void:
	skills.set_ranks(event)


func set_life_skills(event: Dictionary) -> void:
	skills.set_life(event)


func toggle_skills() -> void:
	skills.toggle_window()


# ---- The rest of the windows (ExtraWindows) ----

func toggle_passives() -> void:
	extra.toggle_passives()


func toggle_friends() -> void:
	extra.toggle_friends()


func toggle_leaderboard() -> void:
	extra.toggle_leaderboard()


func set_friend_list(event: Dictionary) -> void:
	extra.set_friend_list(event)


func is_friend_or_pending(name: String) -> bool:
	return extra.is_friend_or_pending(name)


func set_horse_state(event: Dictionary) -> void:
	extra.set_horse_state(event)


func on_trade_state(event: Dictionary) -> void:
	extra.on_trade_state(event)


func is_trade_open() -> bool:
	return extra.is_trade_open()


func on_my_stall(event: Dictionary) -> void:
	extra.on_my_stall(event)


func show_stall_contents(event: Dictionary) -> void:
	extra.show_stall_contents(event)


func on_stall_closed(seller_id: String) -> void:
	extra.on_stall_closed(seller_id)


func browsing_seller() -> String:
	return extra.browsing_seller()


func close_browse() -> void:
	extra.close_browse()


func record_combat(event: Dictionary, w: World) -> void:
	extra.record_combat(event, w)


# ---- Invites (party, duel, trade, dungeon) ----

func _build_invites() -> void:
	var y := 120
	for kind in ["party", "duel", "trade", "dungeon"]:
		var panel := PanelContainer.new()
		panel.theme_type_variation = "WindowPanel"
		panel.visible = false
		var box := VBoxContainer.new()
		panel.add_child(box)
		var text := UiTheme.label("", 14)
		text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		text.custom_minimum_size = Vector2(260, 0)
		box.add_child(text)
		var row := HBoxContainer.new()
		row.alignment = BoxContainer.ALIGNMENT_CENTER
		box.add_child(row)
		var msg: String = {"party": "partyRespond", "duel": "duelRespond", "trade": "tradeRespond", "dungeon": "dungeonRespond"}[kind]
		var answer := func(accept: bool):
			panel.visible = false
			send(msg, {"accept": accept})
		row.add_child(UiTheme.button("Katıl" if kind == "dungeon" else "Kabul", "", func(): answer.call(true)))
		row.add_child(UiTheme.button("Reddet", "RedButton", func(): answer.call(false)))
		hud.root.add_child(panel)
		panel.set_anchors_preset(Control.PRESET_CENTER_TOP)
		panel.offset_top = y
		panel.offset_left = -150
		panel.offset_right = 150
		_invites[kind] = {"panel": panel, "text": text, "timer": null}


func show_invite(kind: String, from: String, dungeon := "") -> void:
	var inv: Dictionary = _invites[kind]
	var texts := {
		"party": "%s seni gruba davet ediyor." % from,
		"duel": "%s seni düelloya davet ediyor." % from,
		"trade": "%s seninle takas yapmak istiyor." % from,
		"dungeon": "%s %s zindanına girdi. Sen de gelir misin?" % [from, dungeon],
	}
	inv.text.text = texts[kind]
	inv.panel.visible = true
	var panel: Control = inv.panel
	hud.get_tree().create_timer(30.0).timeout.connect(func(): if is_instance_valid(panel): panel.visible = false)


# ---- Party frames (ui/party.ts) ----

func _build_party() -> void:
	_party_box = VBoxContainer.new()
	_party_box.add_theme_constant_override("separation", 4)
	_party_box.visible = false
	hud.root.add_child(_party_box)
	_party_box.position = Vector2(8, 84)


func render_party(event: Dictionary, my_name: String, my_zone: String, w: World) -> void:
	for c in _party_box.get_children():
		c.queue_free()
	_party_box.visible = event.get("partyId") != null
	if not _party_box.visible:
		return
	for m in event.get("members", []):
		if String(m.name) == my_name:
			continue
		var frame := PanelContainer.new()
		frame.theme_type_variation = "FramePanel"
		frame.custom_minimum_size = Vector2(180, 0)
		frame.modulate.a = 1.0 if m.get("online", false) else 0.5
		var box := VBoxContainer.new()
		box.add_theme_constant_override("separation", 2)
		frame.add_child(box)
		var def := GameData.class_of(String(m.cls))
		var title := HBoxContainer.new()
		var name := UiTheme.title_label(("♛ " if m.get("leader", false) else "") + String(m.name), 15, Color(String(def.get("color", "#ffffff"))))
		name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		title.add_child(name)
		var away := ""
		if m.get("online", false) and m.get("zone") and m.zone != my_zone:
			away = String(GameData.zone(String(m.zone)).get("name", m.zone))
		var info := "çevrimdışı" if not m.get("online", false) else ("ölü" if m.get("dead", false) else (away if not away.is_empty() else "Sv %d" % int(m.level)))
		title.add_child(UiTheme.label(info, 12, UiTheme.GOLD, true))
		box.add_child(title)
		var hp := Bar.new("hp", 10)
		hp.set_value(float(m.hp) if m.get("online", false) else 0.0, float(m.maxHp))
		box.add_child(hp)
		var res := Bar.new("mana" if def.get("resource") == "mana" else "rage", 6)
		res.set_value(float(m.resource) if m.get("online", false) else 0.0, float(m.maxResource))
		box.add_child(res)
		var sid = m.get("sessionId")
		frame.gui_input.connect(func(ev):
			if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT and sid and w.players.has(sid):
				w.select_target(String(sid), false))
		_party_box.add_child(frame)
	_party_box.add_child(UiTheme.button("Gruptan ayrıl", "DarkButton", func(): send("chat", {"text": "/ayril"})))


# ---- Buttons over the hotbar ----

func _build_buttons() -> void:
	_stall_button = UiTheme.button("Pazar Kur", "TitleButton", func(): extra.open_stall_setup())
	_stall_button.visible = false
	hud.root.add_child(_stall_button)
	_stall_button.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_stall_button.offset_left = -60
	_stall_button.offset_right = 60
	_stall_button.offset_top = -150
	_stall_button.offset_bottom = -116
	_fish_button = UiTheme.button("Balık Tut", "TitleButton", func(): send("fish"))
	_fish_button.visible = false
	hud.root.add_child(_fish_button)
	_fish_button.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_fish_button.offset_left = -70
	_fish_button.offset_right = 70
	_fish_button.offset_top = -196
	_fish_button.offset_bottom = -160
	if Settings.touch:
		_stall_button.offset_top = -92 - 34
		_stall_button.offset_bottom = -92
		_fish_button.offset_top = -92 - 34
		_fish_button.offset_bottom = -92


func set_stall_button_visible(on: bool) -> void:
	_stall_button.visible = on and not extra.is_stall_setup_open()


## null hides it; otherwise whether the line is in the water.
func set_fish_button(state: Variant) -> void:
	_fish_button.visible = state != null
	if state != null:
		_fish_button.text = "Oltayı Topla" if state else "Balık Tut"


# ---- PvP ----

func _build_pvp() -> void:
	_pvp_stats = UiTheme.label("", 13, UiTheme.GOLD_LIGHT, true)
	_pvp_stats.visible = false
	hud.root.add_child(_pvp_stats)
	_pvp_stats.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_pvp_stats.offset_top = 70
	_pvp_stats.offset_left = -150
	_pvp_stats.offset_right = 150
	_pvp_stats.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_killfeed = VBoxContainer.new()
	_killfeed.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.root.add_child(_killfeed)
	_killfeed.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_killfeed.offset_left = -420
	_killfeed.offset_right = -160
	_killfeed.offset_top = 60


func set_pvp_stats(s: Variant) -> void:
	_pvp_stats.visible = s != null
	if s != null:
		_pvp_stats.text = "Puan %d · Öldürme %d · Ölüm %d" % [int(s.rating), int(s.kills), int(s.deaths)]


func add_kill_feed(e: Dictionary, me: String) -> void:
	var killer_color := String(GameData.class_of(String(e.get("killerClass", ""))).get("color", "#ffffff"))
	var victim_color := String(GameData.class_of(String(e.get("victimClass", ""))).get("color", "#ffffff"))
	var line := RichTextLabel.new()
	line.bbcode_enabled = true
	line.fit_content = true
	line.scroll_active = false
	line.custom_minimum_size = Vector2(260, 0)
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var gain := (" [color=#8ce99a]+%d[/color]" % int(e.ratingGain)) if int(e.get("ratingGain", 0)) > 0 else ""
	var streak := (" [color=#ffb347](%d seri)[/color]" % int(e.streak)) if int(e.get("streak", 0)) >= 3 else ""
	line.text = "[right][color=%s]%s[/color] ⚔ [color=%s]%s[/color]%s%s[/right]" % [killer_color, e.killer, victim_color, e.victim, gain, streak]
	if String(e.killer) == me or String(e.victim) == me:
		line.add_theme_color_override("default_color", UiTheme.GOLD_LIGHT)
	_killfeed.add_child(line)
	while _killfeed.get_child_count() > 5:
		_killfeed.get_child(0).free()
	hud.get_tree().create_timer(8.0).timeout.connect(func(): if is_instance_valid(line): line.queue_free())


# ---- Ping wheel (ui/pingWheel.ts) ----

func open_ping_wheel(world_point: Vector2, pick: Callable) -> void:
	if _ping_wheel:
		_ping_wheel.queue_free()
	var wheel := Control.new()
	wheel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.root.add_child(wheel)
	wheel.position = hud.root.get_viewport().get_mouse_position()
	var spots := {"alert": Vector2(0, -52), "attack": Vector2(64, 0), "help": Vector2(0, 52), "move": Vector2(-64, 0)}
	for kind in spots:
		var style: Array = PING_STYLES[kind]
		var b := UiTheme.button("%s %s" % [style[1], style[0]], "DarkButton", func():
			pick.call(kind)
			wheel.queue_free())
		b.add_theme_color_override("font_color", Color(style[2]))
		wheel.add_child(b)
		b.reset_size()
		b.position = spots[kind] - b.size / 2.0
	_ping_wheel = wheel
	hud.get_tree().create_timer(4.0).timeout.connect(func(): if is_instance_valid(wheel): wheel.queue_free())
	var _unused := world_point


# ---- Menu ----

func menu_open() -> bool:
	return menu.visible


func open_menu() -> void:
	menu.open()


func menu_back() -> void:
	menu.back()


func reset() -> void:
	for c in _party_box.get_children():
		c.queue_free()
	_party_box.visible = false
	for kind in _invites:
		_invites[kind].panel.visible = false
	_fish_button.visible = false
	_stall_button.visible = false
	menu.visible = false
	tooltip.hide_tip()
	extra.reset()
