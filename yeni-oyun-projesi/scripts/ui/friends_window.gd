class_name FriendsWindow
extends GameWindow

## Arkadaşlar (client/src/ui/friends.ts): requests in and out, friends with where they are,
## whisper and invite buttons, add by name.

var ui: GameUi
var state := {"friends": [], "incoming": [], "outgoing": []}
var _list: VBoxContainer
var _name: LineEdit
var _confirm: ConfirmationDialog


func _init(owner_ui: GameUi) -> void:
	super._init("friends-window", "Arkadaşlar", 320)
	ui = owner_ui
	set_default_anchor(Control.PRESET_CENTER_RIGHT)
	var add := HBoxContainer.new()
	body.add_child(add)
	_name = LineEdit.new()
	_name.max_length = 16
	_name.placeholder_text = "Karakter adı"
	_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_name.text_submitted.connect(func(_t): _request())
	add.add_child(_name)
	add.add_child(UiTheme.button("Ekle", "", _request))
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(300, 320)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	body.add_child(scroll)
	_list = VBoxContainer.new()
	_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_list)
	_confirm = ConfirmationDialog.new()
	_confirm.ok_button_text = "Çıkar"
	_confirm.cancel_button_text = "Vazgeç"
	add_child(_confirm)


func _request() -> void:
	var name := _name.text.strip_edges()
	if name.is_empty():
		return
	ui.send("friendRequest", {"name": name})
	_name.text = ""
	_name.release_focus()


func set_list(event: Dictionary) -> void:
	state = event
	if visible:
		render()


func is_friend_or_pending(name: String) -> bool:
	var wanted := name.to_lower()
	for key in ["friends", "incoming", "outgoing"]:
		for f in state.get(key, []):
			if String(f.name).to_lower() == wanted:
				return true
	return false


func toggle_window(force: Variant = null) -> void:
	var want: bool = (not visible) if force == null else bool(force)
	if want:
		render()
		open()
	else:
		close_window()


func _row(f: Dictionary, info: String, buttons: Array) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	var dot := UiTheme.label("●", 12, Color("#4cd964") if f.get("online", false) else Color("#6b6b6b"))
	dot.tooltip_text = "Çevrimiçi" if f.get("online", false) else "Çevrimdışı"
	row.add_child(dot)
	var text := VBoxContainer.new()
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	text.add_child(UiTheme.label(String(f.name), 14, Color(String(GameData.class_of(String(f.get("cls", ""))).get("color", "#ffffff"))), true))
	text.add_child(UiTheme.label(info, 11, UiTheme.MUTED))
	row.add_child(text)
	for b in buttons:
		row.add_child(b)
	return row


func _btn(label: String, tip: String, cb: Callable, variant := "DarkButton") -> Button:
	var b := UiTheme.button(label, variant, cb)
	b.tooltip_text = tip
	b.custom_minimum_size = Vector2(28, 0)
	return b


func render() -> void:
	for c in _list.get_children():
		c.queue_free()
	var incoming: Array = state.get("incoming", [])
	if not incoming.is_empty():
		_list.add_child(UiTheme.title_label("Gelen istekler", 17))
		for f in incoming:
			_list.add_child(_row(f, "Sv %d" % int(f.level), [
				_btn("✓", "Kabul et", func(): ui.send("friendRespond", {"characterId": f.characterId, "accept": true}), ""),
				_btn("✕", "Reddet", func(): ui.send("friendRespond", {"characterId": f.characterId, "accept": false}), "RedButton"),
			]))
	var friends: Array = state.get("friends", [])
	var online := friends.filter(func(f): return f.get("online", false)).size()
	_list.add_child(UiTheme.title_label("Arkadaşlar (%d/%d)" % [online, friends.size()], 17))
	if friends.is_empty():
		_list.add_child(UiTheme.muted("Henüz arkadaşın yok. Yukarıya bir karakter adı yaz ya da bir oyuncuyu hedefleyip \"Arkadaş ekle\"ye bas.", 12))
	for f in friends:
		var where := ""
		if f.get("online", false):
			where = String(GameData.zone(String(f.get("zone", ""))).get("name", "")) if f.get("zone") else ""
		else:
			where = "çevrimdışı"
		var buttons: Array = []
		if f.get("online", false):
			buttons.append(_btn("✉", "Fısılda", func(): ui.hud.chat.open_with("/f %s " % f.name)))
			buttons.append(_btn("+", "Gruba davet et", func(): ui.send("chat", {"text": "/davet %s" % f.name})))
		buttons.append(_btn("×", "Arkadaşlıktan çıkar", func():
			_confirm.dialog_text = "%s arkadaş listenden çıkarılsın mı?" % f.name
			for c in _confirm.confirmed.get_connections():
				_confirm.confirmed.disconnect(c.callable)
			_confirm.confirmed.connect(func(): ui.send("friendRemove", {"characterId": f.characterId}), CONNECT_ONE_SHOT)
			_confirm.popup_centered(), "RedButton"))
		_list.add_child(_row(f, "Sv %d%s" % [int(f.level), (" · " + where) if not where.is_empty() else ""], buttons))
	var outgoing: Array = state.get("outgoing", [])
	if not outgoing.is_empty():
		_list.add_child(UiTheme.title_label("Gönderilen istekler", 17))
		for f in outgoing:
			var shown: Dictionary = f.duplicate()
			shown.online = false
			_list.add_child(_row(shown, "yanıt bekleniyor", [_btn("×", "İsteği geri çek", func(): ui.send("friendRemove", {"characterId": f.characterId}), "RedButton")]))
