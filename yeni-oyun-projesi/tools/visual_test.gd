extends Node

## Plays the real game against a server and saves screenshots:
##   godot --path . res://tools/visual_test.tscn -- --server=http://localhost:2567 --user=NAME --pass=PASS --out=C:/shots
## Logs in through the lobby, enters with the first character, walks, opens the windows.

var out := "user://shots"
var user := ""
var password := ""
var main: Node
var combat := false
var windows := false
var skills := false
var portal := false


func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--user="):
			user = arg.substr(7)
		elif arg.begins_with("--pass="):
			password = arg.substr(7)
		elif arg.begins_with("--out="):
			out = arg.substr(6)
		elif arg == "--combat":
			combat = true
		elif arg == "--windows":
			windows = true
		elif arg == "--skills":
			skills = true
		elif arg == "--portal":
			portal = true
	DirAccess.make_dir_recursive_absolute(out)
	main = load("res://scripts/main.gd").new()
	add_child(main)
	_run.call_deferred()


func shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var image := get_viewport().get_texture().get_image()
	image.save_png(out.path_join(name + ".png"))
	print("shot ", name)


func wait(seconds: float) -> void:
	await get_tree().create_timer(seconds).timeout


func key(code: Key) -> void:
	for pressed in [true, false]:
		var ev := InputEventKey.new()
		ev.keycode = code
		ev.physical_keycode = code
		ev.pressed = pressed
		Input.parse_input_event(ev)
		await get_tree().process_frame


func hold(action: String, seconds: float) -> void:
	Input.action_press(action)
	await wait(seconds)
	Input.action_release(action)


func _combat() -> void:
	var w: World = main.world
	# Put on the helmet from the bag.
	var slots: Array = w.ui.inventory.state.get("slots", []) if w.ui.inventory.state else []
	for i in slots.size():
		if slots[i] != null and String(slots[i].defId) == "iron_helm":
			w.room.send("useItem", {"index": i})
	await wait(1.0)
	await shot("10-night-gear")
	w.room.send("mount")
	await wait(0.8)
	await hold("move_right", 1.0)
	await shot("11-mounted")
	w.room.send("mount")
	await wait(1.6)
	# Nearest mob: target it and walk over; the server swings once in range.
	var best := ""
	var best_d := INF
	for id in w.mobs:
		var d: float = w.local.view.position.distance_to(w.mobs[id].view.position)
		if d < best_d:
			best_d = d
			best = id
	print("nearest mob ", best, " at ", best_d)
	if best.is_empty():
		return
	w.select_target(best, true)
	w.walk_to(func(): return w.mobs[best].view.position if w.mobs.has(best) else null, GameData.MELEE_RANGE - 6, func(): pass)
	for i in 8:
		await wait(1.0)
		if i == 3 or i == 6:
			await shot("12-combat-%d" % i)
	await shot("13-after")


func _windows() -> void:
	var w: World = main.world
	var ui: GameUi = w.ui
	w.debug_keep_npc_windows = true
	# A quest giver's conversation, then the first quest's page.
	var giver := {}
	for id in GameData.NPCS:
		if not ui.quests.quests_of_npc(id).is_empty():
			giver = GameData.NPCS[id]
			break
	ui.open_npc_dialog(giver)
	await wait(0.6)
	await shot("20-npc-dialog")
	var quests: Array = ui.quests.quests_of_npc(String(giver.id))
	ui.quests.viewing = String(quests[0].id)
	ui.quests.render_dialog()
	await wait(0.6)
	await shot("21-quest-page")
	ui.close_npc_dialog()
	ui.shop.open_for(GameData.NPCS["weaponsmith"])
	ui.toggle_inventory(true)
	await wait(0.6)
	await shot("22-shop")
	ui.close_npc_windows()
	ui.upgrade.open_for(GameData.NPCS["blacksmith"])
	var slots: Array = ui.inventory.state.get("slots", [])
	for i in slots.size():
		if slots[i] != null and Items.is_upgradeable(Items.def(slots[i].defId)):
			ui.upgrade.select(i)
			break
	await wait(0.6)
	await shot("23-upgrade")
	ui.close_npc_windows()
	ui.toggle_inventory(false)
	ui.extra.open_stable(GameData.NPCS["stable_master"])
	await wait(0.6)
	await shot("24-stable")
	ui.extra.stable.tab = "style"
	ui.extra.stable.render()
	await wait(0.6)
	await shot("25-stable-style")
	ui.close_npc_windows()
	ui.extra.open_storage(GameData.NPCS["storekeeper"])
	ui.toggle_friends()
	await wait(0.6)
	await shot("26-storage-friends")
	ui.close_npc_windows()
	ui.toggle_friends()
	ui.toggle_leaderboard()
	await wait(1.2)
	await shot("27-leaderboard")
	ui.toggle_leaderboard()
	w.hud.chat.add_message({"channel": "global", "from": "Godottest", "fromClass": "warrior", "text": "Merhaba Godot!"})
	w.hud.chat.add_message({"channel": "system", "text": "Sunucuya hoş geldin."})
	w.hud.chat.add_message({"channel": "whisper", "from": "Ayse", "text": "Gizli mesaj"})
	w.room.send("chat", {"text": "Selam herkes"})
	await wait(1.0)
	await shot("28-chat")


func _skills() -> void:
	var w: World = main.world
	for id in ["skyLash", "thunderDrum", "ancestorSpirit"]:
		w.room.send("skillRank", {"id": id, "delta": 1})
	await wait(1.0)
	await key(KEY_K)
	await wait(0.6)
	await shot("30-skills-window")
	await key(KEY_K)
	var best := ""
	var best_d := INF
	for id in w.mobs:
		var d: float = w.local.view.position.distance_to(w.mobs[id].view.position)
		if d < best_d:
			best_d = d
			best = id
	if best.is_empty():
		return
	w.select_target(best, true)
	await wait(0.3)
	w.use_hotbar(0)
	await wait(0.12)
	await shot("31-sky-lash")
	await wait(1.4)
	w.use_hotbar(1)
	await wait(0.15)
	await shot("32-thunder-drum")
	await wait(1.4)
	w.use_hotbar(2)
	await wait(0.2)
	await shot("33-spirit")
	await wait(1.0)
	await shot("34-hotbar-cooldowns")


func _portal() -> void:
	var w: World = main.world
	var portals: Array = w.zone.get("portals", [])
	var def: Dictionary = portals[0]
	for p in portals:
		if p.to == "town":
			def = p
	print("walking to portal ", def.id, " -> ", def.to)
	w.walk_to(func(): return Vector2(float(def.x), float(def.y)), GameData.PORTAL_RANGE - 4, func(): w.use_portal(def))
	await wait(9.0)
	await shot("40-after-portal")
	print("now in ", main.world.zone_id if main.world else "?")


func _run() -> void:
	await wait(1.5)
	var lobby: Lobby = main.lobby
	if lobby._auth.visible:
		lobby._user.text = user
		lobby._pass.text = password
		await shot("01-login")
		lobby._authenticate("login")
		await wait(2.0)
	await wait(1.0)
	await shot("02-characters")
	if lobby._chars.visible:
		lobby._enter()
	await wait(4.0)
	await shot("03-world")
	if combat:
		await _combat()
		get_tree().quit()
		return
	if windows:
		await _windows()
		get_tree().quit()
		return
	if skills:
		await _skills()
		get_tree().quit()
		return
	if portal:
		await _portal()
		get_tree().quit()
		return
	await hold("move_left", 1.2)
	await hold("move_up", 0.8)
	await wait(0.5)
	await shot("04-walked")
	await key(KEY_I)
	await wait(0.8)
	await shot("05-inventory")
	await key(KEY_I)
	await key(KEY_K)
	await wait(0.8)
	await shot("06-skills")
	await key(KEY_K)
	await key(KEY_J)
	await wait(0.8)
	await shot("07-quests")
	await key(KEY_J)
	await key(KEY_ESCAPE)
	await wait(0.6)
	await shot("08-menu")
	await key(KEY_ESCAPE)
	await key(KEY_P)
	await wait(0.8)
	await shot("09-passives")
	await key(KEY_P)
	await wait(0.3)
	print("done")
	get_tree().quit()
