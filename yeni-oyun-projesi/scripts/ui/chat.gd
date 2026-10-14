class_name Chat
extends VBoxContainer

## Chat: the log at the bottom left, Enter opens the input. Names are
## clickable to whisper. Channels: global, party, whisper, system.

signal sent(text: String)

const MAX_LINES := 100

var log_label: RichTextLabel
var input: LineEdit
var active := false


func _init() -> void:
	custom_minimum_size = Vector2(380, 0)
	add_theme_constant_override("separation", 4)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	log_label = RichTextLabel.new()
	log_label.bbcode_enabled = true
	log_label.scroll_following = true
	log_label.custom_minimum_size = Vector2(380, 150)
	log_label.fit_content = false
	log_label.mouse_filter = Control.MOUSE_FILTER_PASS
	log_label.add_theme_font_override("normal_font", Fonts.serif())
	log_label.add_theme_font_override("bold_font", Fonts.serif(true))
	log_label.add_theme_font_size_override("normal_font_size", 13)
	log_label.add_theme_font_size_override("bold_font_size", 13)
	log_label.add_theme_color_override("default_color", UiTheme.TEXT)
	log_label.add_theme_color_override("font_shadow_color", Color.BLACK)
	log_label.add_theme_constant_override("shadow_offset_x", 1)
	log_label.add_theme_constant_override("shadow_offset_y", 1)
	log_label.meta_clicked.connect(_on_meta)
	add_child(log_label)
	input = LineEdit.new()
	input.max_length = 150
	input.placeholder_text = "Mesaj yaz… (/f İsim mesaj: fısıltı)"
	input.visible = false
	input.text_submitted.connect(_on_submit)
	input.focus_exited.connect(func(): if active: set_active(false))
	add_child(input)
	_restyle()


func _restyle() -> void:
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.086, 0.059, 0.035, 0.55 if active else 0.0)
	bg.content_margin_left = 6
	bg.content_margin_right = 6
	bg.content_margin_top = 4
	bg.content_margin_bottom = 4
	log_label.add_theme_stylebox_override("normal", bg)


func set_active(on: bool) -> void:
	active = on
	input.visible = on
	_restyle()
	if on:
		input.grab_focus()
	else:
		input.release_focus()


func open_with(text: String) -> void:
	set_active(true)
	input.text = text
	input.caret_column = text.length()


func _on_submit(text: String) -> void:
	text = text.strip_edges()
	if not text.is_empty():
		sent.emit(text)
	input.text = ""
	set_active(false)


func _input(event: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if active and event.keycode == KEY_ESCAPE:
			set_active(false)
			get_viewport().set_input_as_handled()
		elif not active and (event.keycode == KEY_ENTER or event.keycode == KEY_KP_ENTER):
			var focus := get_viewport().gui_get_focus_owner()
			if focus is LineEdit:
				return
			set_active(true)
			get_viewport().set_input_as_handled()


func _on_meta(meta: Variant) -> void:
	var name := String(meta)
	if name.begins_with("whisper:"):
		open_with("/f %s " % name.substr(8))


static func _esc(text: String) -> String:
	return text.replace("[", "[lb]")


func _name(name: String, color: String) -> String:
	return "[url=whisper:%s][color=%s][b]%s[/b][/color][/url]" % [name, color, _esc(name)]


func add_message(event: Dictionary) -> void:
	var channel := String(event.get("channel", "global"))
	var text := _esc(String(event.get("text", "")))
	var from := String(event.get("from", "?"))
	var cls_color := String(GameData.class_of(String(event.get("fromClass", "warrior"))).get("color", "#ffffff"))
	var line := ""
	match channel:
		"system":
			line = "[color=#e0b04f][Sistem] %s[/color]" % text
		"party":
			line = "[color=#8ce99a][lb]Grup[rb] [/color]%s: [color=#8ce99a]%s[/color]" % [_name(from, cls_color), text]
		"whisper":
			if event.has("to"):
				line = "[color=#f783ac][lb]Fısıltı → [/color]%s[color=#f783ac][rb]: %s[/color]" % [_name(String(event.to), "#f783ac"), text]
			else:
				line = "[color=#f783ac][lb]Fısıltı[rb] [/color]%s[color=#f783ac]: %s[/color]" % [_name(from, "#f783ac"), text]
		_:
			var gm := "[color=#e6c46a][b][lb]GM[rb][/b][/color] " if event.get("gm", false) else ""
			line = "%s%s: %s" % [gm, _name(from, cls_color), text]
	log_label.append_text(line + "\n")
	while log_label.get_paragraph_count() > MAX_LINES + 1:
		log_label.remove_paragraph(0)


func add_system_line(text: String) -> void:
	add_message({"channel": "system", "text": text})
