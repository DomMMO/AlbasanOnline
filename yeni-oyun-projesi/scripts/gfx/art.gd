class_name Art
extends RefCounted

## Baked pictures (tools/godot/bake.mjs): item and skill icons, held weapons, gathering nodes,
## horses, cursors. All lookups return null when the file is missing.

static var _cache := {}


static func tex(path: String) -> Texture2D:
	if _cache.has(path):
		return _cache[path]
	var t: Texture2D = null
	if ResourceLoader.exists(path):
		t = load(path)
	_cache[path] = t
	return t


static func item_icon(def_id: String, rarity := "") -> Texture2D:
	# Weapons: the Pixel Crawler pack's own (tools/weapon_art.py) before the baked drawing.
	var pack := tex("res://art/items_paket/%s.png" % def_id)
	if pack:
		return pack
	if not rarity.is_empty():
		var jewel := tex("res://art/items/%s@%s.png" % [def_id, rarity])
		if jewel:
			return jewel
	return tex("res://art/items/%s.png" % def_id)


static func skill_icon(skill_id: String) -> Texture2D:
	return tex("res://art/skills/%s.png" % skill_id)


static func node_texture(kind: String) -> Texture2D:
	return tex("res://art/nodes/%s.png" % kind)


static func decor(hash: String) -> Texture2D:
	return tex("res://art/decor/%s.png" % hash)


## Held item sprite: frame 0 as drawn, frame 1 mirrored. Weapons from the pack (tools/weapon_art.py)
## first, else the baked drawing (weapons.ts ensureItemTexture).
static func held(def_id: String) -> Texture2D:
	var pack := tex("res://art/held_paket/%s.png" % def_id)
	return pack if pack else tex("res://art/held/%s.png" % def_id)


static var _pack_grips = null


## Where the hand holds a weapon (share of its frame): the pack weapon's grip when it has one.
static func weapon_grip(def_id: String) -> Variant:
	if _pack_grips == null:
		_pack_grips = {}
		var text := FileAccess.get_file_as_string("res://art/held_paket/grips.json")
		var parsed = JSON.parse_string(text) if not text.is_empty() else null
		if parsed is Dictionary:
			_pack_grips = parsed
	if _pack_grips.has(def_id):
		return _pack_grips[def_id]
	return GameData.get_value("WEAPON_GRIPS", {}).get(def_id)


## A horse sheet (horse.ts): 11 frames of 39x30, side 0 + walk 1-4, front 5-7, back 8-10.
static func horse(breed: String) -> Texture2D:
	var t := tex("res://art/horses/%s.png" % breed)
	return t if t else tex("res://art/horses/village.png")


static func horse_icon(breed: String) -> Texture2D:
	return tex("res://art/horses/%s_icon.png" % breed)


## Applies a baked cursor (cursors.ts) as the mouse cursor.
static func set_cursor(kind: String) -> void:
	var t := tex("res://art/cursors/%s.png" % kind)
	if t == null:
		Input.set_custom_mouse_cursor(null)
		return
	var spot: Array = GameData.cursors.get(kind, [0, 0])
	Input.set_custom_mouse_cursor(t, Input.CURSOR_ARROW, Vector2(float(spot[0]), float(spot[1])))
