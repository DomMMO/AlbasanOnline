extends SceneTree

## End-to-end network check against a running server:
##   godot --headless --path . -s res://tools/net_smoke.gd -- --server=http://localhost:2567
## Registers (or logs in) a test account, makes a character if needed, joins its zone, decodes
## the state, walks a few steps and checks the server moved us. Exit code 0 = all good.

var _failures := 0


func _check(ok: bool, what: String) -> void:
	print(("  ok   " if ok else "  FAIL ") + what)
	if not ok:
		_failures += 1


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	# Autoloads are not loaded with -s: make them by hand.
	var game_data = load("res://scripts/autoload/game_data.gd").new()
	game_data.name = "GameData"
	root.add_child(game_data)
	var net = load("res://scripts/autoload/net.gd").new()
	net.name = "Net"
	root.add_child(net)
	await process_frame
	print("server: ", net.server)
	var user := "godottest%d" % (Time.get_unix_time_from_system() as int % 100000)
	var r: Dictionary = await net.register(user, "secret123")
	_check(r.ok, "register %s (%s)" % [user, r.error])
	if not r.ok:
		return _finish()
	r = await net.list_characters()
	_check(r.ok and r.data is Array, "list characters")
	r = await net.create_character("Godottest", {"gender": "male", "hairStyle": "short", "hairColor": 0x5a3825, "skin": 0xf0c49a}, 0xd94141)
	_check(r.ok, "create character (%s)" % r.error)
	if not r.ok:
		return _finish()
	var character: Dictionary = r.data
	var zone: String = game_data.login_zone(character.get("zone", "town"))
	var joined: Dictionary = await net.join_zone(zone, {"token": net.token, "characterId": int(character.id)})
	_check(joined.has("room"), "join %s (%s)" % [zone, joined.get("error", "")])
	if not joined.has("room"):
		return _finish()
	var room: ColyseusRoom = joined.room
	var state: Schema.Struct = room.state
	_check(state != null and state.values.has("players"), "state decoded: fields %s" % [state.values.keys() if state else []])
	var players: Schema.MapRef = state.get_field("players")
	_check(players != null and players.items.has(room.session_id), "own player in state (%d players)" % (players.size() if players else 0))
	var me: Schema.Struct = players.items.get(room.session_id)
	if me == null:
		return _finish()
	print("  me: ", JSON.stringify(me.values))
	print("  zone=%s clock=%s mobs=%d nodes=%d" % [state.get_field("zone"), state.get_field("clock"), (state.get_field("mobs") as Schema.MapRef).size(), (state.get_field("nodes") as Schema.MapRef).size()])
	var messages := {}
	room.on_message("*", func(type, data): messages[type] = data)
	for t in ["inventory", "questLog", "skillRanks", "notice", "chatMessage", "pong", "auras", "lifeSkills", "horseState", "friendList", "partyUpdate"]:
		room.on_message(t, func(data): messages[t] = data)
	room.send("requestInventory")
	room.send("ping", 123.0)
	var start := Vector2(float(me.get_field("x")), float(me.get_field("y")))
	# Walk right for 10 ticks.
	for i in 10:
		room.send("input", {"seq": i + 1, "dx": 1, "dy": 0})
		await create_timer(0.05).timeout
	await create_timer(0.6).timeout
	var end := Vector2(float(me.get_field("x")), float(me.get_field("y")))
	print("  moved from %s to %s, lastSeq=%s" % [start, end, me.get_field("lastSeq")])
	_check(int(me.get_field("lastSeq", 0)) == 10, "server applied all inputs")
	_check(end.x > start.x or end == start, "position patch decoded")
	_check(messages.has("inventory"), "inventory message (msgpack) received")
	if messages.has("inventory"):
		var inv: Dictionary = messages.inventory
		print("  inventory: gold=%s slots=%d equipment=%s" % [inv.get("gold"), (inv.get("slots", []) as Array).size(), (inv.get("equipment", {}) as Dictionary).keys()])
	_check(messages.has("pong"), "pong received")
	print("  messages: ", messages.keys())
	room.leave()
	await create_timer(0.3).timeout
	_finish()


func _finish() -> void:
	print("RESULT: %s" % ("PASS" if _failures == 0 else "%d FAILED" % _failures))
	quit(0 if _failures == 0 else 1)
