extends Node

## The game's flow (client/src/main.ts): lobby (login / character select), then into the world;
## portals leave one zone's room and join the next with the server's ticket; switching
## character or logging out goes back to the lobby.

const CLOSE_LOGGED_IN_ELSEWHERE := 4001

var lobby: Lobby
var world: World
var hud: Hud
var ui: GameUi
var room: ColyseusRoom
var character_id := 0
var transferring := false
var _overlay: CanvasLayer
var _loading: PanelContainer
var _loading_text: Label
var _disconnected: PanelContainer
var _disconnected_text: Label


func _ready() -> void:
	get_window().title = "Albasan Online"
	if OS.has_feature("web"):
		get_window().content_scale_factor = maxf(1.0, DisplayServer.screen_get_scale())
	elif not Settings.touch:
		get_window().min_size = Vector2i(960, 600)
	_build_overlay()
	play()


func _build_overlay() -> void:
	_overlay = CanvasLayer.new()
	_overlay.layer = 50
	add_child(_overlay)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = UiTheme.get_theme()
	_overlay.add_child(root)
	_loading = PanelContainer.new()
	_loading.theme_type_variation = "WindowPanel"
	_loading.visible = false
	_loading_text = UiTheme.title_label("", 34)
	_loading.add_child(_loading_text)
	root.add_child(_loading)
	_loading.set_anchors_preset(Control.PRESET_CENTER)
	_disconnected = PanelContainer.new()
	_disconnected.theme_type_variation = "WindowPanel"
	_disconnected.visible = false
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	_disconnected.add_child(box)
	_disconnected_text = UiTheme.label("Sunucuyla bağlantı koptu.", 15)
	_disconnected_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(_disconnected_text)
	box.add_child(UiTheme.button("Yeniden bağlan", "TitleButton", func():
		_disconnected.visible = false
		leave_game(false)))
	root.add_child(_disconnected)
	_disconnected.set_anchors_preset(Control.PRESET_CENTER)


func _center(c: Control) -> void:
	c.reset_size()
	c.position = (c.get_viewport_rect().size - c.size) / 2.0


## Lobby, then into the world. Runs again after a character switch or logout.
func play() -> void:
	lobby = Lobby.new()
	lobby.name = "Lobby"
	add_child(lobby)
	lobby.entered.connect(func(r: ColyseusRoom, id: int, zone: String):
		character_id = id
		lobby.queue_free()
		lobby = null
		_start_game()
		enter_zone(r, zone, false), CONNECT_ONE_SHOT)


func _start_game() -> void:
	hud = Hud.new()
	hud.name = "Hud"
	add_child(hud)
	ui = GameUi.new(hud)
	ui.switch_character.connect(func(): leave_game(false))
	ui.logout.connect(func(): leave_game(true))


## Back to character select (or the login screen). Leaving saves the character on the server.
func leave_game(logout: bool) -> void:
	transferring = true
	if room:
		room.leave()
		await get_tree().create_timer(0.2).timeout
		room.queue_free()
	room = null
	transferring = false
	if world:
		world.queue_free()
		world = null
	if hud:
		hud.queue_free()
		hud = null
	ui = null
	if logout:
		await Net.logout()
	play()


func enter_zone(r: ColyseusRoom, zone: String, arrived: bool) -> void:
	room = r
	r.left.connect(func(code: int):
		if transferring or room != r:
			return
		_disconnected_text.text = "Bu karaktere başka bir yerden giriş yapıldı." if code == CLOSE_LOGGED_IN_ELSEWHERE else "Sunucuyla bağlantı koptu."
		_disconnected.visible = true
		_center(_disconnected))
	if world:
		world.queue_free()
	hud.reset()
	ui.reset()
	world = World.new()
	world.name = "World"
	world.setup(r, zone, hud, ui, arrived)
	world.transfer.connect(func(event): transfer(r, event))
	add_child(world)
	move_child(world, 0)


## Portal used: leave this zone's room and join the destination with the server-issued ticket.
func transfer(current: ColyseusRoom, event: Dictionary) -> void:
	if transferring:
		return
	transferring = true
	_loading_text.text = "%s yükleniyor…" % GameData.zone(String(event.zone)).get("name", event.zone)
	_loading.visible = true
	_center(_loading)
	current.leave()
	var options := {"token": Net.token, "characterId": character_id, "ticket": event.ticket}
	var r: Dictionary = await Net.join_zone(String(event.zone), options, String(event.get("roomId", "")) if event.get("roomId") != null else "")
	current.queue_free()
	_loading.visible = false
	transferring = false
	if r.has("error"):
		_disconnected_text.text = "Geçiş başarısız: %s" % r.error
		_disconnected.visible = true
		_center(_disconnected)
		return
	enter_zone(r.room, String(event.zone), true)
