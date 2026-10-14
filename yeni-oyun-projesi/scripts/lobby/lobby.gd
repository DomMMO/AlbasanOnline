class_name Lobby
extends Node2D

## Login -> character select -> join: client/src/ui/lobby.ts and scenes/LobbyScene.ts. The
## characters stand in front of the keep in Ana Merkez in full gear (Metin2 style); the panels
## hold the details and the buttons. Emits `entered` with the joined room.

signal entered(room: ColyseusRoom, character_id: int, zone: String)

const TURN_ORDER := [0, 2, 1, 3]  # down, left, up, right
const TURN_MS := 1.8

var zone_view: ZoneView
var sorted: Node2D
var camera: Camera2D
var ui_layer: CanvasLayer
var ui_root: Control

var username := ""
var characters: Array = []
var selected_id := -1
var look := {}
var tunic := 0
var mode := "idle"
var standing: Array = []  # [{view, id}]
var preview: EntityView
var preview_key := ""
var facing := 0
var _ring: Depth.Painter
var _ring_w: Node2D
var _turn_timer := 0.0

var _auth: PanelContainer
var _user: LineEdit
var _pass: LineEdit
var _auth_error: Label
var _chars: PanelContainer
var _account: Label
var _info: GridContainer
var _info_values := {}
var _no_chars: Label
var _play: Button
var _new: Button
var _delete: Button
var _delete_box: VBoxContainer
var _delete_name: Label
var _delete_input: LineEdit
var _chars_error: Label
var _create: PanelContainer
var _char_name: LineEdit
var _gender_row: HBoxContainer
var _hair_name: Label
var _swatches := {}
var _create_error: Label


func _ready() -> void:
	sorted = Node2D.new()
	sorted.y_sort_enabled = true
	zone_view = ZoneView.new()
	add_child(zone_view)
	add_child(sorted)
	zone_view.build("town", sorted)
	RenderingServer.set_default_clear_color(GameData.rgb(zone_view.background) if zone_view.background != null else UiTheme.BG)
	camera = Camera2D.new()
	add_child(camera)
	camera.make_current()
	_ring = Depth.Painter.new()
	_ring.visible = false
	_ring_w = Depth.wrap(sorted, _ring)
	# Dusk over the castle: a warm-to-dark wash so the characters stand out.
	var dusk_layer := CanvasLayer.new()
	dusk_layer.layer = 1
	add_child(dusk_layer)
	var dusk := Depth.Painter.new()
	dusk.painter = func(ci: CanvasItem):
		var vp := ci.get_viewport_rect().size
		ci.draw_polygon(PackedVector2Array([Vector2.ZERO, Vector2(vp.x, 0), Vector2(vp.x, vp.y * 0.5), Vector2(0, vp.y * 0.5)]), PackedColorArray([Color(0.102, 0.055, 0.024, 0.35), Color(0.102, 0.055, 0.024, 0.35), Color(0, 0, 0, 0.05), Color(0, 0, 0, 0.05)]))
		ci.draw_rect(Rect2(Vector2.ZERO, vp), Color(0, 0, 0, 0.18))
	dusk_layer.add_child(dusk)
	get_viewport().size_changed.connect(func():
		dusk.queue_redraw()
		_layout_camera())
	ui_layer = CanvasLayer.new()
	ui_layer.layer = 10
	add_child(ui_layer)
	ui_root = Control.new()
	ui_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	ui_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui_root.theme = UiTheme.get_theme()
	ui_layer.add_child(ui_root)
	_build_auth()
	_build_characters()
	_build_create()
	look = GameData.get_value("DEFAULT_LOOK", {}).duplicate()
	tunic = int(GameData.get_value("TUNIC_COLORS", [0xd94141])[0])
	_layout_camera()
	if not Net.token.is_empty():
		var r: Dictionary = await Net.me()
		if r.ok:
			show_characters(String(r.data.username))
			return
	show_auth()


func _process(delta: float) -> void:
	_turn_timer += delta
	if _turn_timer >= TURN_MS:
		_turn_timer = 0.0
		_turn()


# ---- Camera and the characters in front of the keep ----

func _zoom() -> float:
	return maxf(2.0, floorf(get_viewport_rect().size.y / 260.0))


func _layout_camera() -> void:
	var lobby: Dictionary = GameData.get_value("TOWN_LOBBY", {})
	var target: Dictionary = lobby.get("preview") if mode == "create" else lobby.get("slots", [{}, {"tx": 70, "ty": 40}])[1]
	var z := _zoom()
	camera.zoom = Vector2(z, z)
	var vp := get_viewport_rect().size
	var panel := 360.0 if vp.x > 900 else (vp.x * 0.45 if Settings.touch else 0.0)
	camera.position = Vector2(roundf((float(target.tx) + 0.5) * 16 - panel / 2.0 / z), roundf((float(target.ty) - 3.2) * 16))


func _clear() -> void:
	for s in standing:
		s.view.destroy()
	standing = []
	if preview:
		preview.destroy()
	preview = null
	preview_key = ""
	_ring.visible = false


static func summary_appearance(c: Dictionary) -> Dictionary:
	var lk: Dictionary = c.get("look", {})
	var a := {"type": "humanoid", "tunic": int(c.get("color", 0x495057)), "gender": lk.get("gender", "male"), "hairStyle": lk.get("hairStyle", "short"), "hair": int(lk.get("hairColor", 0x5a3825)), "skin": int(lk.get("skin", 0xf0c49a))}
	var headwear = GameData.class_of(String(c.get("class", "novice"))).get("headwear")
	if headwear != null:
		a.headwear = headwear
	var gear := {}
	var g: Dictionary = c.get("gear", {})
	for part in ["head", "chest", "legs", "feet"]:
		if not String(g.get(part, "")).is_empty():
			gear[part] = String(g[part])
	a.gear = gear
	return a


func _show_standing() -> void:
	mode = "select"
	_clear()
	_layout_camera()
	var slots: Array = GameData.get_value("TOWN_LOBBY", {}).get("slots", [])
	var max_chars := int(GameData.get_value("MAX_CHARACTERS_PER_ACCOUNT", 3))
	for i in slots.size():
		var slot: Dictionary = slots[i]
		var x := float(slot.tx) * 16
		var y := float(slot.ty) * 16
		if i >= characters.size():
			if i >= max_chars:
				continue
			var ghost := EntityView.new(sorted, x, y, {"type": "humanoid", "tunic": 0x444444, "hair": 0x333333, "skin": 0x555555}, "Boş", Color("#9a8a70"), 3)
			add_child(ghost)
			ghost.set_alpha(0.28)
			ghost.set_base_tint(0x111111)
			ghost.clicked.connect(func(_v, _e): show_create())
			standing.append({"view": ghost, "id": -1})
			continue
		var c: Dictionary = characters[i]
		var view := EntityView.new(sorted, x, y, summary_appearance(c), String(c.name), Color.WHITE, 3)
		add_child(view)
		view.set_weapon(String(c.get("gear", {}).get("weapon", "")), int(c.get("gear", {}).get("weaponPlus", 0)))
		view.set_animation(0, false)
		var id := int(c.id)
		view.clicked.connect(func(_v, _e): select(id))
		view.hovered.connect(func(_v, inside): Input.set_default_cursor_shape(Input.CURSOR_POINTING_HAND if inside else Input.CURSOR_ARROW))
		standing.append({"view": view, "id": id})
	_select_view(selected_id)


func _select_view(id: int) -> void:
	facing = 0
	var chosen = null
	for s in standing:
		if s.id == -1:
			continue
		var on: bool = s.id == id
		s.view.set_name_color(Color("#ffd34d") if on else Color("#cfc6b4"))
		s.view.set_base_tint(0x8a8478 if (not on and id != -1) else null)
		s.view.set_animation(0, false)
		if on:
			chosen = s
	_ring.visible = chosen != null
	if chosen:
		_ring.painter = func(ci: CanvasItem):
			Depth.stroke_ellipse(ci, 0, 0, 44, 14, Color(1, 0.827, 0.302, 0.95), 1)
			Depth.stroke_ellipse(ci, 0, 0, 52, 18, Color(1, 0.827, 0.302, 0.4), 1)
		_ring.queue_redraw()
		Depth.place(_ring_w, roundf(chosen.view.x), roundf(chosen.view.y) - 1, chosen.view.y - 1)


func _show_preview() -> void:
	if mode != "create":
		mode = "create"
		_clear()
		_layout_camera()
		facing = 0
	var appearance := summary_appearance({"class": "novice", "color": tunic, "look": look})
	var key := JSON.stringify(appearance)
	var weapon := String(GameData.class_of("novice").get("starterEquipment", {}).get("weapon", ""))
	var p: Dictionary = GameData.get_value("TOWN_LOBBY", {}).get("preview", {"tx": 70, "ty": 40})
	if preview == null:
		preview = EntityView.new(sorted, float(p.tx) * 16, float(p.ty) * 16, appearance, "", Color.WHITE, 4)
		add_child(preview)
		_ring.painter = func(ci: CanvasItem): Depth.stroke_ellipse(ci, 0, 0, 58, 18, Color(1, 0.827, 0.302, 0.9), 1)
		_ring.queue_redraw()
		_ring.visible = true
		Depth.place(_ring_w, roundf(preview.x), roundf(preview.y) - 1, preview.y - 1)
	elif key != preview_key:
		preview.set_look(appearance)
	preview_key = key
	preview.set_weapon(weapon, 0)
	preview.set_animation(TURN_ORDER[facing], false)


func _turn() -> void:
	facing = (facing + 1) % TURN_ORDER.size()
	if mode == "create" and preview:
		preview.set_animation(TURN_ORDER[facing], false)
	elif mode == "select":
		for s in standing:
			if s.id == selected_id and s.id != -1:
				s.view.set_animation(TURN_ORDER[facing], false)


# ---- Panels ----

func _panel(width := 320.0) -> PanelContainer:
	var p := PanelContainer.new()
	p.theme_type_variation = "WindowPanel"
	p.custom_minimum_size = Vector2(width, 0)
	p.visible = false
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	p.add_child(box)
	ui_root.add_child(p)
	return p


func _place_panel(p: PanelContainer, left := false) -> void:
	_do_place(p, left)
	# Once more after the layout pass: wrapped text only knows its height then.
	_do_place.call_deferred(p, left)


func _do_place(p: PanelContainer, left: bool) -> void:
	p.reset_size()
	var vp := get_viewport_rect().size
	var k := minf(1.0, minf((vp.y - 16) / maxf(1.0, p.size.y), (vp.x - 16) / maxf(1.0, p.size.x)))
	p.scale = Vector2(k, k)
	var at_left := left and (vp.x > 900 or Settings.touch)
	if k < 1.0:
		p.position = Vector2(8 if at_left else (vp.x - p.size.x * k) / 2.0, (vp.y - p.size.y * k) / 2.0)
		return
	if at_left:
		p.position = Vector2(24 if vp.x > 900 else 8, maxf(8, (vp.y - p.size.y) / 2.0))
	else:
		p.position = (vp - p.size) / 2.0


func _heading(text: String) -> Label:
	var h := UiTheme.title_label(text, 40)
	h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return h


func _build_auth() -> void:
	_auth = _panel(320)
	var box: VBoxContainer = _auth.get_child(0)
	var logo := TextureRect.new()
	logo.texture = load("res://art/ui/logo.png") if ResourceLoader.exists("res://art/ui/logo.png") else null
	logo.custom_minimum_size = Vector2(88, 88)
	logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	logo.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	if logo.texture:
		box.add_child(logo)
	box.add_child(_heading("Albasan Online"))
	box.add_child(UiTheme.label("Kullanıcı adı", 13, UiTheme.MUTED))
	_user = LineEdit.new()
	_user.max_length = 16
	box.add_child(_user)
	box.add_child(UiTheme.label("Şifre", 13, UiTheme.MUTED))
	_pass = LineEdit.new()
	_pass.secret = true
	_pass.max_length = 72
	_pass.text_submitted.connect(func(_t): _authenticate("login"))
	_user.text_submitted.connect(func(_t): _pass.grab_focus())
	box.add_child(_pass)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var login := UiTheme.button("Giriş yap", "TitleButton", func(): _authenticate("login"))
	login.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(login)
	var register := UiTheme.button("Kayıt ol", "TitleDarkButton", func(): _authenticate("register"))
	register.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(register)
	box.add_child(row)
	_auth_error = UiTheme.label("", 13, UiTheme.ERROR)
	_auth_error.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_auth_error.custom_minimum_size = Vector2(280, 0)
	_auth_error.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(_auth_error)
	var server := UiTheme.muted("Sunucu: %s" % Net.server, 11)
	server.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(server)


func _set_busy(panel: Control, busy: bool) -> void:
	for node in panel.find_children("*", "BaseButton", true, false):
		node.disabled = busy
	for node in panel.find_children("*", "LineEdit", true, false):
		node.editable = not busy


func show_auth(error := "") -> void:
	_chars.visible = false
	_create.visible = false
	_auth.visible = true
	_auth_error.text = error
	mode = "idle"
	_clear()
	_layout_camera()
	_place_panel(_auth)
	(_pass if not _user.text.is_empty() else _user).grab_focus.call_deferred()


func _authenticate(kind: String) -> void:
	var name := _user.text.strip_edges()
	var password := _pass.text
	if kind == "register":
		var invalid := GameData.validate_username(name)
		if invalid.is_empty():
			invalid = GameData.validate_password(password)
		if not invalid.is_empty():
			_auth_error.text = invalid
			return
	_set_busy(_auth, true)
	_auth_error.text = ""
	var r: Dictionary
	if kind == "login":
		r = await Net.login(name, password)
	else:
		r = await Net.register(name, password)
	_set_busy(_auth, false)
	if not r.ok:
		_auth_error.text = r.error
		return
	_pass.text = ""
	show_characters(String(r.data.username))


func _build_characters() -> void:
	_chars = _panel(460)
	var box: VBoxContainer = _chars.get_child(0)
	box.add_child(_heading("Karakterler"))
	_account = UiTheme.muted("", 12, 400)
	_account.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(_account)
	var info_panel := PanelContainer.new()
	var s := StyleBoxFlat.new()
	s.bg_color = Color(0, 0, 0, 0.2)
	s.border_color = Color(UiTheme.GOLD_DARK, 0.8)
	s.set_border_width_all(1)
	s.content_margin_left = 10
	s.content_margin_right = 10
	s.content_margin_top = 8
	s.content_margin_bottom = 8
	info_panel.add_theme_stylebox_override("panel", s)
	_info = GridContainer.new()
	_info.columns = 2
	_info.add_theme_constant_override("h_separation", 20)
	info_panel.add_child(_info)
	for pair in [["name", "İsim"], ["class", "Sınıf"], ["level", "Seviye"], ["zone", "Bölge"], ["time", "Oyun süresi"]]:
		var l := UiTheme.label(pair[1], 14, UiTheme.MUTED)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_info.add_child(l)
		var v := UiTheme.label("", 14, UiTheme.GOLD_LIGHT, true)
		v.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.custom_minimum_size = Vector2(140, 0)
		_info.add_child(v)
		_info_values[pair[0]] = v
	box.add_child(info_panel)
	_no_chars = UiTheme.muted("Henüz karakterin yok. Boş yere tıkla ya da yeni bir karakter yarat.", 12, 400)
	box.add_child(_no_chars)
	var hint := UiTheme.muted("Karakterine tıklayarak seç.", 12, 400)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(hint)
	_play = UiTheme.button("Başla", "TitleButton", _enter)
	box.add_child(_play)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_new = UiTheme.button("Yeni Karakter", "DarkButton", show_create)
	_new.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(_new)
	_delete = UiTheme.button("Sil", "DarkButton", func():
		var c := _selected()
		if c.is_empty():
			return
		_delete_name.text = "Bu karakter KALICI OLARAK silinecek. Onaylamak için adını yaz: %s" % c.name
		_delete_input.text = ""
		_delete_box.visible = true
		_delete_input.grab_focus())
	_delete.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(_delete)
	box.add_child(row)
	_delete_box = VBoxContainer.new()
	_delete_box.visible = false
	_delete_name = UiTheme.label("", 13)
	_delete_name.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_delete_name.custom_minimum_size = Vector2(400, 0)
	_delete_box.add_child(_delete_name)
	_delete_input = LineEdit.new()
	_delete_input.max_length = 16
	_delete_input.text_submitted.connect(func(_t): _confirm_delete())
	_delete_box.add_child(_delete_input)
	var drow := HBoxContainer.new()
	drow.add_child(UiTheme.button("Sil", "RedButton", _confirm_delete))
	drow.add_child(UiTheme.button("Vazgeç", "DarkButton", func(): _delete_box.visible = false))
	_delete_box.add_child(drow)
	box.add_child(_delete_box)
	_chars_error = UiTheme.label("", 13, UiTheme.ERROR)
	_chars_error.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_chars_error.custom_minimum_size = Vector2(400, 0)
	box.add_child(_chars_error)
	var footer := HBoxContainer.new()
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	footer.add_child(UiTheme.button("Çıkış yap", "LinkButton2", func():
		await Net.logout()
		show_auth()))
	footer.add_child(spacer)
	box.add_child(footer)


func _selected() -> Dictionary:
	for c in characters:
		if int(c.id) == selected_id:
			return c
	return {}


static func _play_time(seconds: int) -> String:
	var minutes := seconds / 60
	if minutes < 60:
		return "%d dakika" % minutes
	return "%d saat %d dakika" % [minutes / 60, minutes % 60]


func show_characters(name: String, select_id := -1) -> void:
	username = name
	_auth.visible = false
	_create.visible = false
	_chars.visible = true
	_account.text = "Hesap: %s" % name
	_chars_error.text = ""
	_delete_box.visible = false
	var r: Dictionary = await Net.list_characters()
	if not r.ok:
		show_auth(r.error)
		return
	characters = r.data
	if characters.is_empty():
		show_create()
		return
	var keep := select_id if select_id != -1 else selected_id
	selected_id = int(characters[0].id)
	for c in characters:
		if int(c.id) == keep:
			selected_id = keep
	_show_standing()
	_render_selection()
	_place_panel(_chars, true)


func select(id: int) -> void:
	selected_id = id
	_delete_box.visible = false
	_chars_error.text = ""
	_select_view(id)
	_render_selection()


func _render_selection() -> void:
	var c := _selected()
	_info.get_parent().visible = not c.is_empty()
	_no_chars.visible = characters.is_empty()
	_play.disabled = c.is_empty()
	_delete.disabled = c.is_empty()
	_new.visible = characters.size() < int(GameData.get_value("MAX_CHARACTERS_PER_ACCOUNT", 3))
	if c.is_empty():
		return
	_info_values.name.text = String(c.name)
	_info_values["class"].text = String(GameData.class_of(String(c.get("class", "novice"))).get("name", ""))
	_info_values.level.text = str(int(c.level))
	_info_values.zone.text = String(GameData.zone(GameData.login_zone(c.get("zone"))).get("name", ""))
	_info_values.time.text = _play_time(int(c.get("playSeconds", 0)))


func _enter() -> void:
	var c := _selected()
	if c.is_empty():
		return
	_set_busy(_chars, true)
	_chars_error.text = ""
	var zone := GameData.login_zone(c.get("zone"))
	var r: Dictionary = await Net.join_zone(zone, {"token": Net.token, "characterId": int(c.id)})
	_set_busy(_chars, false)
	if r.has("error"):
		_chars_error.text = String(r.error)
		return
	entered.emit(r.room, int(c.id), zone)


func _confirm_delete() -> void:
	var c := _selected()
	if c.is_empty():
		return
	_set_busy(_chars, true)
	var r: Dictionary = await Net.delete_character(int(c.id), _delete_input.text.strip_edges())
	_set_busy(_chars, false)
	if not r.ok:
		_chars_error.text = r.error
		return
	selected_id = -1
	show_characters(username)


func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and (event.keycode == KEY_ENTER or event.keycode == KEY_KP_ENTER):
		if _chars.visible and not _delete_box.visible and not _play.disabled:
			get_viewport().set_input_as_handled()
			_enter()


# ---- Character creation ----

func _build_create() -> void:
	_create = _panel(380)
	var box: VBoxContainer = _create.get_child(0)
	box.add_child(_heading("Karakter Yarat"))
	box.add_child(UiTheme.label("İsim", 13, UiTheme.MUTED))
	_char_name = LineEdit.new()
	_char_name.max_length = 16
	_char_name.placeholder_text = "3-16 harf"
	_char_name.text_submitted.connect(func(_t): _create_character())
	box.add_child(_char_name)
	box.add_child(UiTheme.muted("Sınıfını oyunda seçeceksin: kalenin büyük salonunda yedi usta seni bekliyor.", 12))
	box.add_child(UiTheme.label("Cinsiyet", 13, UiTheme.MUTED))
	_gender_row = HBoxContainer.new()
	box.add_child(_gender_row)
	box.add_child(UiTheme.label("Saç modeli", 13, UiTheme.MUTED))
	var stepper := HBoxContainer.new()
	stepper.alignment = BoxContainer.ALIGNMENT_CENTER
	stepper.add_child(UiTheme.button("‹", "DarkButton", func(): _step_hair(-1)))
	_hair_name = UiTheme.label("", 14, UiTheme.GOLD_LIGHT, true)
	_hair_name.custom_minimum_size = Vector2(140, 0)
	_hair_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	stepper.add_child(_hair_name)
	stepper.add_child(UiTheme.button("›", "DarkButton", func(): _step_hair(1)))
	box.add_child(stepper)
	for spec in [["hair", "Saç rengi"], ["skin", "Ten rengi"], ["tunic", "Kıyafet rengi"]]:
		box.add_child(UiTheme.label(spec[1], 13, UiTheme.MUTED))
		var row := HFlowContainer.new()
		row.add_theme_constant_override("h_separation", 4)
		box.add_child(row)
		_swatches[spec[0]] = row
	var turn := HBoxContainer.new()
	turn.alignment = BoxContainer.ALIGNMENT_CENTER
	turn.add_child(UiTheme.button("⟲", "DarkButton", func(): _rotate(-1)))
	turn.add_child(UiTheme.button("Rastgele", "DarkButton", _randomize))
	turn.add_child(UiTheme.button("⟳", "DarkButton", func(): _rotate(1)))
	box.add_child(turn)
	var row2 := HBoxContainer.new()
	row2.add_theme_constant_override("separation", 8)
	var ok := UiTheme.button("Oluştur", "TitleButton", _create_character)
	ok.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row2.add_child(ok)
	var back := UiTheme.button("Geri", "TitleDarkButton", func():
		if not characters.is_empty():
			show_characters(username)
		else:
			_create_error.text = "Oynamak için önce bir karakter yarat.")
	back.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row2.add_child(back)
	box.add_child(row2)
	_create_error = UiTheme.label("", 13, UiTheme.ERROR)
	_create_error.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_create_error.custom_minimum_size = Vector2(340, 0)
	box.add_child(_create_error)


func show_create() -> void:
	_chars.visible = false
	_auth.visible = false
	_create.visible = true
	_create_error.text = ""
	_char_name.text = ""
	_render_create()
	_place_panel(_create, true)
	_char_name.grab_focus.call_deferred()


func _swatch_row(key: String, colors: Array, current: int, choose: Callable) -> void:
	var row: HFlowContainer = _swatches[key]
	for c in row.get_children():
		c.queue_free()
	for color in colors:
		var b := Button.new()
		b.focus_mode = Control.FOCUS_NONE
		b.custom_minimum_size = Vector2(24, 24)
		var s := StyleBoxFlat.new()
		s.bg_color = GameData.rgb(color)
		var active := int(color) == current
		s.border_color = UiTheme.GOLD_LIGHT if active else Color.BLACK
		s.set_border_width_all(3 if active else 1)
		s.set_corner_radius_all(3)
		for st in ["normal", "hover", "pressed", "focus"]:
			b.add_theme_stylebox_override(st, s)
		b.pressed.connect(func():
			choose.call(int(color))
			_render_create())
		row.add_child(b)


func _render_create() -> void:
	for c in _gender_row.get_children():
		c.queue_free()
	var names: Dictionary = GameData.get_value("GENDER_NAMES", {})
	for g in GameData.get_value("GENDERS", ["male", "female"]):
		var b := UiTheme.button(String(names.get(g, g)), "" if look.gender == g else "DarkButton", func(): _set_gender(g))
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_gender_row.add_child(b)
	_hair_name.text = String(GameData.get_value("HAIR_STYLE_NAMES", {}).get(look.hairStyle, look.hairStyle))
	_swatch_row("hair", GameData.get_value("HAIR_COLORS", []), int(look.hairColor), func(c): look.hairColor = c)
	_swatch_row("skin", GameData.get_value("SKIN_COLORS", []), int(look.skin), func(c): look.skin = c)
	_swatch_row("tunic", GameData.get_value("TUNIC_COLORS", []), tunic, func(c): tunic = c)
	_show_preview()


func _set_gender(g: String) -> void:
	if g == look.gender:
		return
	look.gender = g
	look.hairStyle = "long" if g == "female" else "short"
	_render_create()


func _step_hair(step: int) -> void:
	var styles: Array = GameData.get_value("HAIR_STYLES", ["short"])
	var i := styles.find(look.hairStyle)
	look.hairStyle = styles[(i + step + styles.size()) % styles.size()]
	_render_create()


func _rotate(step: int) -> void:
	facing = (facing + step + TURN_ORDER.size()) % TURN_ORDER.size()
	_turn_timer = 0.0
	if preview:
		preview.set_animation(TURN_ORDER[facing], false)


func _randomize() -> void:
	var pick := func(list: Array): return list[randi() % list.size()]
	look = {"gender": pick.call(GameData.get_value("GENDERS", ["male"])), "hairStyle": pick.call(GameData.get_value("HAIR_STYLES", ["short"])), "hairColor": int(pick.call(GameData.get_value("HAIR_COLORS", [0]))), "skin": int(pick.call(GameData.get_value("SKIN_COLORS", [0])))}
	tunic = int(pick.call(GameData.get_value("TUNIC_COLORS", [0])))
	_render_create()


func _create_character() -> void:
	var name := _char_name.text.strip_edges()
	var invalid := GameData.validate_character_name(name)
	if not invalid.is_empty():
		_create_error.text = invalid
		return
	_set_busy(_create, true)
	_create_error.text = ""
	var payload := {"gender": look.gender, "hairStyle": look.hairStyle, "hairColor": int(look.hairColor), "skin": int(look.skin)}
	var r: Dictionary = await Net.create_character(name, payload, tunic)
	_set_busy(_create, false)
	if not r.ok:
		_create_error.text = r.error
		return
	look = GameData.get_value("DEFAULT_LOOK", {}).duplicate()
	show_characters(username, int(r.data.id))
