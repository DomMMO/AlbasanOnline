class_name GameMenu
extends PanelContainer

## The Esc menu: resume, settings, controls, key
## bindings, switch character, log out.

var ui: GameUi
var _pages := {}
var _capturing := ""
var _key_list: VBoxContainer


func _init(owner_ui: GameUi) -> void:
	ui = owner_ui
	theme_type_variation = "WindowPanel"
	custom_minimum_size = Vector2(340, 0)
	visible = false
	z_index = 50
	set_anchors_preset(Control.PRESET_CENTER)
	var stack := VBoxContainer.new()
	add_child(stack)
	_pages.main = _page(stack, "Menü", [
		["Devam et", "TitleButton", close],
		["Ayarlar", "TitleDarkButton", func(): show_page("settings")],
		["Kontroller", "TitleDarkButton", func(): show_page("controls")],
		["Tuş Atamaları", "TitleDarkButton", func(): show_page("keys")],
		["Karakter değiştir", "TitleDarkButton", func():
			close()
			ui.switch_character.emit()],
		["Çıkış yap", "TitleDarkButton", func():
			close()
			ui.logout.emit()],
	])
	_build_settings(stack)
	_build_controls(stack)
	_build_keys(stack)
	show_page("main")


func _page(parent: Control, title: String, buttons: Array) -> VBoxContainer:
	var page := VBoxContainer.new()
	page.add_theme_constant_override("separation", 8)
	var h := UiTheme.title_label(title, 40)
	h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	page.add_child(h)
	for spec in buttons:
		page.add_child(UiTheme.button(spec[0], spec[1], spec[2]))
	parent.add_child(page)
	return page


func _back_button() -> Button:
	return UiTheme.button("Geri", "TitleDarkButton", func(): show_page("main"))


func _build_settings(parent: Control) -> void:
	var page := _page(parent, "Ayarlar", [])
	var zoom_row := HBoxContainer.new()
	var zl := UiTheme.label("Kamera yakınlığı", 13)
	zl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	zoom_row.add_child(zl)
	var zoom := OptionButton.new()
	zoom.focus_mode = Control.FOCUS_NONE
	var values := ["auto", "2", "3", "4"]
	for label in ["Otomatik", "Uzak (2x)", "Orta (3x)", "Yakın (4x)"]:
		zoom.add_item(label)
	zoom.select(maxi(0, values.find(String(Settings.get_value("zoom")))))
	zoom.item_selected.connect(func(i): Settings.update({"zoom": values[i]}))
	zoom_row.add_child(zoom)
	page.add_child(zoom_row)
	for spec in [["damageNumbers", "Hasar sayılarını göster"], ["speechBubbles", "Konuşma balonlarını göster"], ["helpText", "Alttaki kısayol satırını göster"], ["damageMeter", "Hasar ölçeri göster"], ["bossMusic", "Boss müziği"]]:
		var cb := CheckBox.new()
		cb.text = spec[1]
		cb.focus_mode = Control.FOCUS_NONE
		cb.button_pressed = bool(Settings.get_value(spec[0]))
		cb.toggled.connect(func(on): Settings.update({spec[0]: on}))
		page.add_child(cb)
	page.add_child(UiTheme.muted("Ayarlar bu bilgisayarda saklanır.", 12))
	page.add_child(_back_button())
	_pages.settings = page


func _build_controls(parent: Control) -> void:
	var page := _page(parent, "Kontroller", [])
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 14)
	for row in [["WASD / oklar", "Yürü"], ["Tık", "Hedef al ve saldır"], ["Tab", "Sıradaki düşman"], ["1 - 9, 0", "Skill barı (Tuş Atamaları'ndan değiştirilebilir)"], ["Q R", "İksirler"], ["K · P · T", "Yetenekler · Pasif ağaç · Şehir portalı"], ["F", "Hedefe saldır"], ["E", "Sandık al, NPC ile konuş, portal, tezgâha bak"], ["I / C", "Karakter ve envanter"], ["J", "Görev günlüğü"], ["O", "Arkadaşlar"], ["H · Shift", "Ata bin / in · atta basılı tut: dörtnala"], ["L", "PvP sıralaması"], ["M", "Mini harita aç/kapat"], ["Enter", "Sohbet"], ["Esc", "Pencereyi kapat / hedefi bırak / menü"], ["/f İsim mesaj", "Fısıltı"], ["/p mesaj", "Grup sohbeti"], ["/davet İsim", "Gruba davet et"], ["/ayril · /at İsim", "Gruptan ayrıl · at (lider)"], ["/duello İsim", "Yanındaki oyuncuyu düelloya davet et"], ["/arkadas İsim", "Arkadaşlık isteği gönder"]]:
		grid.add_child(UiTheme.label(row[0], 13, UiTheme.GOLD, true))
		var l := UiTheme.label(row[1], 13)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size = Vector2(200, 0)
		grid.add_child(l)
	page.add_child(grid)
	page.add_child(_back_button())
	_pages.controls = page


func _build_keys(parent: Control) -> void:
	var page := _page(parent, "Tuş Atamaları", [])
	page.add_child(UiTheme.muted("Bir eyleme tıkla, sonra istediğin tuşa bas (Esc: vazgeç). Tuş başka bir eylemdeyse oradan alınır.", 12))
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(320, 360)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_key_list = VBoxContainer.new()
	_key_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_key_list)
	page.add_child(scroll)
	page.add_child(UiTheme.button("Varsayılana dön", "TitleDarkButton", func():
		Keys.reset()
		_render_keys()))
	page.add_child(_back_button())
	_pages.keys = page
	_render_keys()


func _render_keys() -> void:
	for c in _key_list.get_children():
		c.queue_free()
	var bindings := Keys.bindings()
	for group in Keys.BINDABLE:
		_key_list.add_child(UiTheme.title_label(group[0], 17))
		for pair in group[1]:
			var row := HBoxContainer.new()
			var l := UiTheme.label(pair[1], 13)
			l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			row.add_child(l)
			var keys: Array = bindings.get(pair[0], [])
			var names: Array = []
			for k in keys:
				names.append(OS.get_keycode_string(int(k)))
			var b := UiTheme.button("Bir tuşa bas…" if _capturing == pair[0] else (" / ".join(names) if not names.is_empty() else "—"), "DarkButton", func():
				_capturing = pair[0]
				_render_keys())
			b.custom_minimum_size = Vector2(110, 0)
			row.add_child(b)
			_key_list.add_child(row)


func _input(event: InputEvent) -> void:
	if not visible or _capturing.is_empty():
		return
	if event is InputEventKey and event.pressed and not event.echo:
		get_viewport().set_input_as_handled()
		if event.keycode != KEY_ESCAPE and event.keycode != KEY_ENTER:
			Keys.bind_key(_capturing, event.keycode)
		_capturing = ""
		_render_keys()


func show_page(name: String) -> void:
	_capturing = ""
	for key in _pages:
		_pages[key].visible = key == name
	reset_size()
	position = (get_viewport_rect().size - size) / 2.0 if is_inside_tree() else position


func open() -> void:
	visible = true
	show_page("main")


func close() -> void:
	_capturing = ""
	visible = false


## Esc inside the menu: from a sub-page back to the main page, from there out of the menu.
func back() -> void:
	if _pages.main.visible:
		close()
	else:
		show_page("main")
