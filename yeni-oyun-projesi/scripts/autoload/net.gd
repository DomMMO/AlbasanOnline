extends Node

## Server access (autoload "Net"): the REST API for accounts and characters (client/src/net/api.ts)
## and joining zone rooms.
##
## The server address: "--server=..." on the command line (or user://settings.cfg
## [net] server=...), otherwise the local dev server when run from the editor and the
## live server in exported builds.

const DEFAULT_SERVER := "https://albasanonline.com"
const LOCAL_SERVER := "http://localhost:2567"
const SESSION_FILE := "user://session.cfg"

var server := LOCAL_SERVER if OS.has_feature("editor") else DEFAULT_SERVER
var token := ""


func _ready() -> void:
	# In the browser the game is served by the game server itself: talk to the page's origin.
	if OS.has_feature("web"):
		var origin = JavaScriptBridge.eval("location.origin", true)
		if origin is String and origin.begins_with("http"):
			server = origin
	var cfg := ConfigFile.new()
	if cfg.load("user://settings.cfg") == OK:
		server = String(cfg.get_value("net", "server", server))
	for arg in OS.get_cmdline_user_args() + OS.get_cmdline_args():
		if arg.begins_with("--server="):
			server = arg.substr(9)
	server = server.trim_suffix("/")
	var session := ConfigFile.new()
	if session.load(SESSION_FILE) == OK and session.get_value("auth", "server", "") == server:
		token = String(session.get_value("auth", "token", ""))


func _set_token(value: String) -> void:
	token = value
	var session := ConfigFile.new()
	session.set_value("auth", "token", value)
	session.set_value("auth", "server", server)
	session.save(SESSION_FILE)


func _api(method: String, path: String, body: Variant = null) -> Dictionary:
	var headers := PackedStringArray()
	if not token.is_empty():
		headers.append("Authorization: Bearer %s" % token)
	var result := await Http.request_json(self, method, "%s/api%s" % [server, path], body, headers)
	if result.status == 401:
		_set_token("")
	return result


func register(username: String, password: String) -> Dictionary:
	var r := await _api("POST", "/register", {"username": username, "password": password})
	if r.ok:
		_set_token(r.data.token)
	return r


func login(username: String, password: String) -> Dictionary:
	var r := await _api("POST", "/login", {"username": username, "password": password})
	if r.ok:
		_set_token(r.data.token)
	return r


func logout() -> void:
	await _api("POST", "/logout")
	_set_token("")


func me() -> Dictionary:
	return await _api("GET", "/me")


func list_characters() -> Dictionary:
	return await _api("GET", "/characters")


func create_character(name: String, look: Dictionary, color: int) -> Dictionary:
	return await _api("POST", "/characters", {"name": name, "look": look, "color": color})


func delete_character(id: int, name: String) -> Dictionary:
	return await _api("DELETE", "/characters/%d" % id, {"name": name})


func leaderboard() -> Dictionary:
	return await _api("GET", "/leaderboard")


## Fetches the map editor's changes for a zone ({edits: null} when there are none).
func zone_edits(zone: String) -> Dictionary:
	return await _api("GET", "/maps/%s" % zone)


# ---- Rooms ---------------------------------------------------------------------------------

## Joins a zone's room: shared zones are joined, instanced ones created, unless `room_id`
## names the instance your party is already in. Returns {"room": ColyseusRoom} or {"error": String}.
func join_zone(zone: String, options: Dictionary, room_id := "") -> Dictionary:
	var method := "joinOrCreate"
	var target := zone
	if not room_id.is_empty():
		method = "joinById"
		target = room_id
	elif GameData.zone(zone).get("instanced", false):
		method = "create"
	var r := await Http.request_json(self, "POST", "%s/matchmake/%s/%s" % [server, method, target], options)
	if not r.ok or not (r.data is Dictionary) or r.data.has("error"):
		var message: String = r.error
		if r.data is Dictionary and r.data.has("error"):
			message = String(r.data.error)
		return {"error": message if not message.is_empty() else "Oyuna girilemedi"}
	var reservation: Dictionary = r.data
	var room_info: Dictionary = reservation.room
	var room := ColyseusRoom.new()
	room.name = "Room_%s" % zone
	room.room_id = String(room_info.roomId)
	room.room_name = String(room_info.get("name", zone))
	room.session_id = String(reservation.sessionId)
	add_child(room)
	var query := "sessionId=%s" % room.session_id.uri_encode()
	if reservation.has("reconnectionToken"):
		query += "&reconnectionToken=%s" % String(reservation.reconnectionToken).uri_encode()
	var endpoint := _ws_base()
	if room_info.has("publicAddress") and room_info.publicAddress != null:
		endpoint = ("wss://" if server.begins_with("https") else "ws://") + String(room_info.publicAddress)
	room.connect_to("%s/%s/%s?%s" % [endpoint, room_info.processId, room.room_id, query])
	var outcome := await _wait_join(room)
	if outcome != "":
		room.queue_free()
		return {"error": outcome}
	# The full state follows the join acknowledgement: wait for it so the world can bind at once.
	if room.decoder == null or room.state.values.is_empty():
		await room.state_patched
	return {"room": room}


func _wait_join(room: ColyseusRoom) -> String:
	var result := {"done": false, "error": ""}
	var on_joined := func(): result.done = true
	var on_failed := func(_code: int, message: String):
		result.done = true
		result.error = message if not message.is_empty() else "Oyuna girilemedi"
	room.joined.connect(on_joined, CONNECT_ONE_SHOT)
	room.join_failed.connect(on_failed, CONNECT_ONE_SHOT)
	while not result.done:
		await get_tree().process_frame
	if room.joined.is_connected(on_joined):
		room.joined.disconnect(on_joined)
	if room.join_failed.is_connected(on_failed):
		room.join_failed.disconnect(on_failed)
	return result.error


func _ws_base() -> String:
	if server.begins_with("https://"):
		return "wss://" + server.substr(8)
	if server.begins_with("http://"):
		return "ws://" + server.substr(7)
	return server
