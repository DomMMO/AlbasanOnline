class_name Fonts
extends RefCounted

## The game's fonts. Titles and names use Cloister Black (third-party, art/licensed/fonts, kept
## out of the repository like the web client's); without it, a serif. World text (names over
## heads, damage numbers) is drawn zoomed in by the camera, so those fonts are MSDF: sharp at
## any zoom.

static var _cache := {}


static func _licensed_title() -> Font:
	for path in ["res://art/licensed/fonts/CloisterBlackTR.ttf", "res://art/licensed/fonts/CloisterBlack.ttf"]:
		if ResourceLoader.exists(path):
			var f = load(path)
			if f is FontFile:
				return f
		if FileAccess.file_exists(path):
			var ff := FontFile.new()
			if ff.load_dynamic_font(path) == OK:
				return ff
	return null


## Browsers have no system fonts for Godot: the web build uses the bundled OFL fonts
## (art/fonts: EB Garamond for the serif, Courier Prime for the monospace).
static func _bundled(names: PackedStringArray, bold: bool, msdf: bool, italic := false) -> Font:
	var mono := "Courier New" in names
	var path := "res://art/fonts/CourierPrime-Bold.ttf" if mono else ("res://art/fonts/EBGaramond-Italic.ttf" if italic else "res://art/fonts/EBGaramond.ttf")
	if not ResourceLoader.exists(path):
		return null
	var file: FontFile = (load(path) as FontFile).duplicate()
	file.multichannel_signed_distance_field = msdf
	# Symbols the text fonts lack (☀ ☾ ★ ⚔ ⇅ ♛ ⌛ ...).
	var fallbacks: Array[Font] = []
	for extra in ["res://art/fonts/NotoSansSymbols2-Regular.ttf", "res://art/fonts/NotoSansSymbols.ttf", "res://art/fonts/NotoSansMath-Regular.ttf"]:
		if ResourceLoader.exists(extra):
			fallbacks.append(load(extra))
	file.fallbacks = fallbacks
	if not bold or mono:
		return file
	var v := FontVariation.new()
	v.base_font = file
	v.variation_embolden = 0.7
	return v


static func _system(names: PackedStringArray, bold := false, msdf := false, italic := false) -> Font:
	if OS.has_feature("web"):
		var bundled := _bundled(names, bold, msdf, italic)
		if bundled:
			return bundled
	var f := SystemFont.new()
	f.font_italic = italic
	f.font_names = names
	f.font_weight = 700 if bold else 400
	f.multichannel_signed_distance_field = msdf
	f.antialiasing = TextServer.FONT_ANTIALIASING_GRAY
	return f


## Title font (window titles, names, buttons): Cloister Black, Turkish letters it lacks from a serif.
static func title(msdf := false) -> Font:
	var key := "title:%s" % msdf
	if _cache.has(key):
		return _cache[key]
	var serif := _system(PackedStringArray(["Georgia", "Times New Roman", "serif"]), true, msdf)
	var font: Font = serif
	var licensed := _licensed_title()
	if licensed:
		var f: FontFile = licensed.duplicate()
		f.multichannel_signed_distance_field = msdf
		f.fallbacks = [serif]
		font = f
	_cache[key] = font
	return font


## Body text (serif, as the web UI).
static func serif(bold := false) -> Font:
	var key := "serif:%s" % bold
	if not _cache.has(key):
		_cache[key] = _system(PackedStringArray(["Georgia", "Palatino Linotype", "Times New Roman", "serif"]), bold)
	return _cache[key]


## Courier New bold (floating damage numbers, NPC quest markers, speech bubbles).
static func mono(msdf := true) -> Font:
	var key := "mono:%s" % msdf
	if not _cache.has(key):
		_cache[key] = _system(PackedStringArray(["Courier New", "Consolas", "monospace"]), true, msdf)
	return _cache[key]


## Names over heads and on nameplates: Pixelify Sans (OFL, art/fonts), a clear pixel font that
## has every Turkish letter; MSDF so it stays sharp at the camera's zoom.
static func names(msdf := true) -> Font:
	var key := "names:%s" % msdf
	if _cache.has(key):
		return _cache[key]
	var font: Font = null
	if ResourceLoader.exists("res://art/fonts/PixelifySans.ttf"):
		var f: FontFile = (load("res://art/fonts/PixelifySans.ttf") as FontFile).duplicate()
		f.multichannel_signed_distance_field = msdf
		f.antialiasing = TextServer.FONT_ANTIALIASING_GRAY
		font = f
	else:
		font = title(msdf)
	_cache[key] = font
	return font


static func label_settings(font: Font, size: int, color: Color, outline := 0, outline_color := Color.BLACK) -> LabelSettings:
	var s := LabelSettings.new()
	s.font = font
	s.font_size = size
	s.font_color = color
	s.outline_size = outline
	s.outline_color = outline_color
	return s
