class_name UiTheme
extends RefCounted

## The UI look of client/src/style.css: dark wood panels with a gold-dark border and gold
## corner brackets, gold buttons for the main action and dark ones with gold text otherwise,
## Cloister Black titles and a serif body.

const BG := Color("#0e0a07")
const TEXT := Color("#ecdfc2")
const ACCENT := Color("#e0b04f")
const ERROR := Color("#e05a5a")
const GOLD := Color("#c9a24a")
const GOLD_LIGHT := Color("#f2d58c")
const GOLD_DARK := Color("#6e5320")
const WOOD := Color("#2a1e13")
const WOOD_DARK := Color("#160f09")
const MUTED := Color("#b3a385")
const RARITY := {"common": Color("#9d9d9d"), "uncommon": Color("#1eff00"), "rare": Color("#3d8bff"), "epic": Color("#b65cff"), "legendary": Color("#ff8000")}

static var _theme: Theme


## Wood panel: vertical gradient, gold-dark border, inner lines, optional gold corner brackets.
class WoodBox extends StyleBox:
	var top := WOOD
	var bottom := WOOD_DARK
	var border := GOLD_DARK
	var border_width := 2.0
	var brackets := false
	var shadow := true
	var radius := 3.0

	func _init() -> void:
		content_margin_left = 12
		content_margin_right = 12
		content_margin_top = 10
		content_margin_bottom = 12

	func _draw(to_canvas_item: RID, rect: Rect2) -> void:
		var rs := RenderingServer
		if shadow:
			rs.canvas_item_add_rect(to_canvas_item, Rect2(rect.position + Vector2(0, 6), rect.size).grow(4), Color(0, 0, 0, 0.18))
			rs.canvas_item_add_rect(to_canvas_item, Rect2(rect.position + Vector2(0, 4), rect.size).grow(2), Color(0, 0, 0, 0.3))
		var pts := PackedVector2Array([rect.position, Vector2(rect.end.x, rect.position.y), rect.end, Vector2(rect.position.x, rect.end.y)])
		var cols := PackedColorArray([top, top, bottom, bottom])
		rs.canvas_item_add_polygon(to_canvas_item, pts, cols)
		# A faint highlight over the top, as the CSS sheen.
		var sheen := Rect2(rect.position, Vector2(rect.size.x, rect.size.y * 0.4))
		rs.canvas_item_add_polygon(to_canvas_item, PackedVector2Array([sheen.position, Vector2(sheen.end.x, sheen.position.y), sheen.end, Vector2(sheen.position.x, sheen.end.y)]), PackedColorArray([Color(1, 1, 1, 0.03), Color(1, 1, 1, 0.03), Color(1, 1, 1, 0), Color(1, 1, 1, 0)]))
		var b := border_width
		if b > 0:
			_frame(to_canvas_item, rect, b, border)
			_frame(to_canvas_item, rect.grow(-b), 1, Color(0, 0, 0, 0.6))
			_frame(to_canvas_item, rect.grow(-b - 1), 1, Color(GOLD, 0.2))
		if brackets:
			var c := GOLD
			var o := rect.grow(5)
			for corner in [[o.position, 1, 1], [Vector2(o.end.x, o.position.y), -1, 1], [Vector2(o.position.x, o.end.y), 1, -1], [o.end, -1, -1]]:
				var p: Vector2 = corner[0]
				var sx: float = corner[1]
				var sy: float = corner[2]
				rs.canvas_item_add_rect(to_canvas_item, _norm(Rect2(p.x, p.y, 14 * sx, 3 * sy)), c)
				rs.canvas_item_add_rect(to_canvas_item, _norm(Rect2(p.x, p.y, 3 * sx, 14 * sy)), c)

	static func _norm(r: Rect2) -> Rect2:
		return r.abs()

	static func _frame(ci: RID, r: Rect2, w: float, color: Color) -> void:
		var rs := RenderingServer
		rs.canvas_item_add_rect(ci, Rect2(r.position, Vector2(r.size.x, w)), color)
		rs.canvas_item_add_rect(ci, Rect2(Vector2(r.position.x, r.end.y - w), Vector2(r.size.x, w)), color)
		rs.canvas_item_add_rect(ci, Rect2(r.position, Vector2(w, r.size.y)), color)
		rs.canvas_item_add_rect(ci, Rect2(Vector2(r.end.x - w, r.position.y), Vector2(w, r.size.y)), color)


## A vertical gradient with a 1px border (buttons, bars, inputs).
class GradientBox extends StyleBox:
	var colors: PackedColorArray = PackedColorArray([Color.WHITE, Color.GRAY])
	var stops: PackedFloat32Array = PackedFloat32Array([0.0, 1.0])
	var border := Color.BLACK
	var border_width := 1.0
	var inner_top := Color(1, 1, 1, 0)
	var drop := Color(0, 0, 0, 0)

	func _init() -> void:
		content_margin_left = 10
		content_margin_right = 10
		content_margin_top = 4
		content_margin_bottom = 5

	func _draw(to_canvas_item: RID, rect: Rect2) -> void:
		var rs := RenderingServer
		if drop.a > 0:
			rs.canvas_item_add_rect(to_canvas_item, Rect2(rect.position + Vector2(0, 2), rect.size), drop)
		for i in range(stops.size() - 1):
			var y0 := rect.position.y + rect.size.y * stops[i]
			var y1 := rect.position.y + rect.size.y * stops[i + 1]
			rs.canvas_item_add_polygon(to_canvas_item, PackedVector2Array([Vector2(rect.position.x, y0), Vector2(rect.end.x, y0), Vector2(rect.end.x, y1), Vector2(rect.position.x, y1)]), PackedColorArray([colors[i], colors[i], colors[i + 1], colors[i + 1]]))
		if inner_top.a > 0:
			rs.canvas_item_add_rect(to_canvas_item, Rect2(rect.position + Vector2(border_width, border_width), Vector2(rect.size.x - border_width * 2, 1)), inner_top)
		if border_width > 0:
			WoodBox._frame(to_canvas_item, rect, border_width, border)


static func wood(brackets := false) -> WoodBox:
	var box := WoodBox.new()
	box.brackets = brackets
	return box


static func gradient(colors: Array, stops: Array, border: Color, inner_top := Color(1, 1, 1, 0), drop := Color(0, 0, 0, 0)) -> GradientBox:
	var box := GradientBox.new()
	box.colors = PackedColorArray(colors)
	box.stops = PackedFloat32Array(stops)
	box.border = border
	box.inner_top = inner_top
	box.drop = drop
	return box


static func gold_button_box(bright := 1.0) -> GradientBox:
	var c := func(hex: String) -> Color: return Color(hex) * Color(bright, bright, bright, 1)
	return gradient([c.call("#f2d58c"), c.call("#c9a24a"), c.call("#8a6a28")], [0.0, 0.45, 1.0], Color("#2a1a08"), Color(1, 1, 1, 0.4), Color.BLACK)


static func dark_button_box(bright := 1.0) -> GradientBox:
	return gradient([Color("#3a2a18") * Color(bright, bright, bright, 1), Color("#1f150c") * Color(bright, bright, bright, 1)], [0.0, 1.0], GOLD_DARK, Color(1, 1, 1, 0), Color.BLACK)


static func red_button_box(bright := 1.0) -> GradientBox:
	return gradient([Color("#d9534f") * Color(bright, bright, bright, 1), Color("#8a1f1a") * Color(bright, bright, bright, 1)], [0.0, 1.0], Color("#2a1a08"), Color(1, 1, 1, 0.3), Color.BLACK)


static func input_box(focus := false) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = Color("#0c0805")
	s.border_color = GOLD if focus else GOLD_DARK
	s.set_border_width_all(1)
	s.set_corner_radius_all(2)
	s.content_margin_left = 6
	s.content_margin_right = 6
	s.content_margin_top = 4
	s.content_margin_bottom = 4
	return s


static func slot_box(highlight := false) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = Color("#140e08")
	s.border_color = GOLD if highlight else Color(GOLD_DARK, 0.6)
	s.set_border_width_all(1)
	s.set_corner_radius_all(2)
	return s


static func get_theme() -> Theme:
	if _theme:
		return _theme
	var t := Theme.new()
	t.default_font = Fonts.serif()
	t.default_font_size = 14
	t.set_color("font_color", "Label", TEXT)
	# Panels.
	t.set_stylebox("panel", "PanelContainer", wood())
	t.set_stylebox("panel", "Panel", wood())
	t.set_type_variation("WindowPanel", "PanelContainer")
	t.set_stylebox("panel", "WindowPanel", wood(true))
	t.set_type_variation("FramePanel", "PanelContainer")
	var frame := wood()
	frame.content_margin_left = 8
	frame.content_margin_right = 8
	frame.content_margin_top = 6
	frame.content_margin_bottom = 7
	t.set_stylebox("panel", "FramePanel", frame)
	# Buttons: gold.
	for state in ["normal", "focus"]:
		t.set_stylebox(state, "Button", gold_button_box())
	t.set_stylebox("hover", "Button", gold_button_box(1.12))
	t.set_stylebox("pressed", "Button", gold_button_box(0.92))
	var disabled := gold_button_box(0.6)
	t.set_stylebox("disabled", "Button", disabled)
	t.set_font("font", "Button", Fonts.serif(true))
	t.set_font_size("font_size", "Button", 14)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		t.set_color(c, "Button", Color("#2a1a08"))
	t.set_color("font_disabled_color", "Button", Color("#2a1a08", 0.6))
	# Dark buttons (secondary).
	t.set_type_variation("DarkButton", "Button")
	for state in ["normal", "focus"]:
		t.set_stylebox(state, "DarkButton", dark_button_box())
	t.set_stylebox("hover", "DarkButton", dark_button_box(1.3))
	t.set_stylebox("pressed", "DarkButton", dark_button_box(0.9))
	t.set_stylebox("disabled", "DarkButton", dark_button_box(0.7))
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color", "font_hover_pressed_color"]:
		t.set_color(c, "DarkButton", GOLD_LIGHT)
	t.set_color("font_disabled_color", "DarkButton", Color(GOLD_LIGHT, 0.5))
	# Red buttons (decline, duel).
	t.set_type_variation("RedButton", "Button")
	for state in ["normal", "focus"]:
		t.set_stylebox(state, "RedButton", red_button_box())
	t.set_stylebox("hover", "RedButton", red_button_box(1.15))
	t.set_stylebox("pressed", "RedButton", red_button_box(0.9))
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		t.set_color(c, "RedButton", Color.WHITE)
	# Big title-font buttons (login, menu, play).
	t.set_type_variation("TitleButton", "Button")
	t.set_font("font", "TitleButton", Fonts.title())
	t.set_font_size("font_size", "TitleButton", 21)
	t.set_type_variation("TitleDarkButton", "DarkButton")
	t.set_font("font", "TitleDarkButton", Fonts.title())
	t.set_font_size("font_size", "TitleDarkButton", 21)
	# Link-like buttons.
	t.set_type_variation("LinkButton2", "Button")
	var empty := StyleBoxEmpty.new()
	for state in ["normal", "hover", "pressed", "focus", "disabled"]:
		t.set_stylebox(state, "LinkButton2", empty)
	for c in ["font_color", "font_focus_color", "font_pressed_color"]:
		t.set_color(c, "LinkButton2", MUTED)
	t.set_color("font_hover_color", "LinkButton2", GOLD_LIGHT)
	t.set_font("font", "LinkButton2", Fonts.serif())
	# Inputs.
	t.set_stylebox("normal", "LineEdit", input_box())
	t.set_stylebox("focus", "LineEdit", input_box(true))
	t.set_color("font_color", "LineEdit", TEXT)
	t.set_color("caret_color", "LineEdit", GOLD_LIGHT)
	t.set_color("selection_color", "LineEdit", Color(GOLD, 0.4))
	t.set_color("font_placeholder_color", "LineEdit", Color(MUTED, 0.6))
	# Labels.
	t.set_type_variation("TitleLabel", "Label")
	t.set_font("font", "TitleLabel", Fonts.title())
	t.set_font_size("font_size", "TitleLabel", 22)
	t.set_color("font_color", "TitleLabel", GOLD_LIGHT)
	t.set_color("font_shadow_color", "TitleLabel", Color.BLACK)
	t.set_constant("shadow_offset_y", "TitleLabel", 2)
	t.set_constant("shadow_offset_x", "TitleLabel", 0)
	t.set_type_variation("HeadingLabel", "TitleLabel")
	t.set_font_size("font_size", "HeadingLabel", 40)
	t.set_constant("shadow_offset_y", "HeadingLabel", 3)
	t.set_type_variation("MutedLabel", "Label")
	t.set_color("font_color", "MutedLabel", MUTED)
	t.set_font("font", "MutedLabel", _italic())
	t.set_type_variation("ErrorLabel", "Label")
	t.set_color("font_color", "ErrorLabel", ERROR)
	# Tooltips.
	t.set_stylebox("panel", "TooltipPanel", wood())
	t.set_color("font_color", "TooltipLabel", TEXT)
	# Scroll bars: thin gold.
	var grabber := StyleBoxFlat.new()
	grabber.bg_color = GOLD_DARK
	grabber.set_corner_radius_all(2)
	t.set_stylebox("grabber", "VScrollBar", grabber)
	var grabber_hl := grabber.duplicate()
	grabber_hl.bg_color = GOLD
	t.set_stylebox("grabber_highlight", "VScrollBar", grabber_hl)
	t.set_stylebox("grabber_pressed", "VScrollBar", grabber_hl)
	var scroll := StyleBoxFlat.new()
	scroll.bg_color = Color(0, 0, 0, 0.3)
	scroll.content_margin_left = 3
	scroll.content_margin_right = 3
	t.set_stylebox("scroll", "VScrollBar", scroll)
	# Check boxes: no button frame, just the box and the text.
	for state in ["normal", "hover", "pressed", "focus", "disabled", "hover_pressed"]:
		t.set_stylebox(state, "CheckBox", StyleBoxEmpty.new())
	t.set_color("font_color", "CheckBox", TEXT)
	t.set_color("font_pressed_color", "CheckBox", TEXT)
	t.set_color("font_hover_pressed_color", "CheckBox", GOLD_LIGHT)
	t.set_color("font_focus_color", "CheckBox", TEXT)
	t.set_color("font_disabled_color", "CheckBox", Color(MUTED, 0.6))
	t.set_color("font_hover_color", "CheckBox", GOLD_LIGHT)
	t.set_stylebox("normal", "OptionButton", dark_button_box())
	t.set_stylebox("hover", "OptionButton", dark_button_box(1.3))
	t.set_stylebox("pressed", "OptionButton", dark_button_box(0.9))
	t.set_stylebox("focus", "OptionButton", dark_button_box())
	t.set_color("font_color", "OptionButton", GOLD_LIGHT)
	t.set_color("font_hover_color", "OptionButton", GOLD_LIGHT)
	_theme = t
	return t


static func _italic() -> Font:
	return Fonts._system(PackedStringArray(["Georgia", "Palatino Linotype", "serif"]), false, false, true)


## A label in the title font.
static func title_label(text: String, size := 22, color := GOLD_LIGHT) -> Label:
	var l := Label.new()
	l.text = text
	l.theme_type_variation = "TitleLabel"
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l


static func label(text: String, size := 14, color := TEXT, bold := false) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	if bold:
		l.add_theme_font_override("font", Fonts.serif(true))
	return l


## Grey italic hint text, wrapped at `width` (a wrapped label needs a width, or containers
## size it as one character per line).
static func muted(text: String, size := 13, width := 280.0) -> Label:
	var l := Label.new()
	l.text = text
	l.theme_type_variation = "MutedLabel"
	l.add_theme_font_size_override("font_size", size)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(width, 0)
	return l


static func button(text: String, variation := "", callback := Callable()) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	if not variation.is_empty():
		b.theme_type_variation = variation
	if callback.is_valid():
		b.pressed.connect(callback)
	return b
