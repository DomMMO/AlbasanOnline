class_name Sprites
extends RefCounted

## Character and creature sprites: client/src/gfx/humanoid.ts and textures.ts ported pixel for
## pixel (the 12x16 humanoid templates with hair styles, gender, worn armour and class headwear;
## wolf, slime, chest and portal), plus the art sheets (art/licensed/mobs, built by
## tools/build_sprites.py) with their code-drawn look-alikes when a sheet is missing
## (imageSprites.ts FALLBACK_LOOKS).
##
## Sprites.sprite_set(appearance) -> SpriteSet with a SpriteFrames for an AnimatedSprite2D.

const HUMANOID_DOWN := 0
const HUMANOID_UP := 3
const HUMANOID_SIDE := 6


class SpriteSet:
	var key := ""
	var kind := ""
	var appearance := {}
	var frames: SpriteFrames
	var width := 0
	var height := 0
	## Phaser origin (fractions of the frame): the feet.
	var origin := Vector2(0.5, 1.0)
	## Image sheets: art sheet key (animations "idle", "walk", "attack", ...).
	var sheet := ""
	## The whole sheet (paper doll, previews).
	var texture: Texture2D

	func has_anim(name: String) -> bool:
		return frames.has_animation(name)


static var _cache := {}
static var _sheet_meta := {}
static var _hitboxes: Variant = null


# ---- Templates (textures.ts / humanoid.ts) -----------------------------------------------------

const WOLF_BODY := [
	"............k.k.",
	"...........kfkfk",
	"..........kffffk",
	"kk.......kfffefk",
	".kfkkkkkkffffffk",
	"..kffffffffffkkk",
	"..kfffffffffffk.",
	"..kddddddddddk..",
]

const SLIME_FRAMES := [
	["............", "............", "....kkkk....", "...kffffk...", "..kfwfffffk.", ".kfwffffffk.", ".kffeffeffk.", ".kffffffffk.", ".kdffffffdk.", "..kkkkkkkk.."],
	["............", "............", "............", "....kkkk....", "..kkffffkk..", ".kfwfffffffk", "kfffeffefffk", "kffffffffffk", "kdffffffffdk", ".kkkkkkkkkk."],
]

const CHEST_FRAMES := [
	["..kkkkkkkk..", ".kddddddddk.", ".kmmmmmmmmk.", "kkkkkggkkkkk", "kmmmmggmmmmk", "kmmmmmmmmmmk", "kddddddddddk", "kkkkkkkkkkkk"],
]

const CAVE_ENTRANCE_FRAMES := [
	["....kkkkkkkk....", "..kkrrrrrrrrkk..", ".krrlrrrrrrlrrk.", ".krrkkkkkkkkrrk.", "krrkxxxxxxxxkrrk", "krkxxxxxxxxxxkrk", "krkxxxxxxxxxxkrk", "krkxxxxxxxxxxkrk", "krkxxxxxxxxxxkrk", "krkxxxxxxxxxxkrk", "krkxxxxxxxxxxkrk", "kkkxxxxxxxxxxkkk"],
]

const EXIT_PORTAL_A := ["....kkkk....", "..kkbbbbkk..", ".kbbccccbbk.", ".kbcwwwwcbk.", "kbcwccccwcbk", "kbcwcwwcwcbk", "kbcwcwwcwcbk", "kbcwccccwcbk", ".kbcwwwwcbk.", ".kbbccccbbk.", "..kkbbbbkk..", "....kkkk...."]

const GATE_ENERGY := ["bccccccb", "bcwccwcb", "bccwcccb", "bcccwccb", "bcwcccwb", "bccccwcb", "bwcccccb", "bccwcccb", "bcccwccb", "bwccccwb", "bccwcccb", "bcccccwb", "bcwccccb", "bccccwcb"]

const SHORT := {
	"down": ["...kkkkkk...", "..khhhhhhk..", ".khhhhhhhhk.", ".khsssssshk.", ".ksessssesk.", ".kssssssssk.", "..kssssssk.."],
	"up": ["...kkkkkk...", "..khhhhhhk..", ".khhhhhhhhk.", ".khhhhhhhhk.", ".khhhhhhhhk.", ".kshhhhhhsk.", "..kssssssk.."],
	"side": ["....kkkkk...", "...khhhhhk..", "..khhhhhhhk.", "..khhssssk..", "..khsssesk..", "..kssssssk..", "...kssssk..."],
}

const BODY_FRONT := [".kdttttttdk.", "ksttttttttsk", "ksdttttttdsk", ".kdttttttdk.", ".kddddddddk.", "..kppkkppk.."]
const BODY_SIDE := ["..kdttttdk..", "..kttttttk..", "..ktttsttk..", "..kdttttdk..", "..kddddddk..", "...kppppk..."]
const LEGS_FRONT := [
	["..kppkkppk..", "..kbbkkbbk..", "..kkk..kkk.."],
	["..kppkkppk..", "..kkk.kbbk..", ".......kkk.."],
	["..kppkkppk..", "..kbbk.kkk..", "..kkk......."],
]
const LEGS_SIDE := [
	["...kpppk....", "...kbbbk....", "...kkkkk...."],
	["..kppkppk...", ".kbbk..kbbk.", ".kkk....kkk."],
	["...kpppk....", "..kbbkbbk...", "..kkk.kkk..."],
]


static func _with_rows(rows: Array, changes: Dictionary) -> Array:
	var out := []
	for i in rows.size():
		out.append(changes[i] if changes.has(i) else rows[i])
	return out


static func _heads() -> Dictionary:
	return {
		"short": SHORT,
		"spiky": {
			"down": _with_rows(SHORT.down, {0: "..khkhhkhk..", 1: ".khhhhhhhhk."}),
			"up": _with_rows(SHORT.up, {0: "..khkhhkhk..", 1: ".khhhhhhhhk."}),
			"side": _with_rows(SHORT.side, {0: "...khkhkhk..", 1: "..khhhhhhk.."}),
		},
		"long": {
			"down": _with_rows(SHORT.down, {3: "khhsssssshhk", 4: "khsesssseshk", 5: "khsssssssshk", 6: ".hksssssskh."}),
			"up": _with_rows(SHORT.up, {5: "khhhhhhhhhhk", 6: ".hkhhhhhhkh."}),
			"side": _with_rows(SHORT.side, {4: ".khhsssesk..", 5: ".khssssssk..", 6: "..khssssk..."}),
			"bodyDown": ["hkdttttttdkh"],
			"bodyUp": ["hkdhhhhhhdkh", "khhhhhhhhhhk"],
			"bodySide": ["..khttttdk.."],
		},
		"ponytail": {
			"down": SHORT.down,
			"up": _with_rows(SHORT.up, {6: "..ksshhssk.."}),
			"side": _with_rows(SHORT.side, {4: ".hkhsssesk..", 5: "khkssssssk.."}),
			"bodyUp": [".kdtthhttdk.", "ksttthhtttsk"],
		},
		"bun": {
			"down": _with_rows(SHORT.down, {0: "....khhk....", 1: "..kkhhhhkk..", 2: ".khhhhhhhhk."}),
			"up": _with_rows(SHORT.up, {0: "....khhk....", 1: "..kkhhhhkk..", 2: ".khhhhhhhhk."}),
			"side": _with_rows(SHORT.side, {0: "..khhkkkk...", 1: "..khhhhhhk.."}),
		},
		"bald": {
			"down": _with_rows(SHORT.down, {1: "..kSSSSSSk..", 2: ".kSSSSSSSSk.", 3: ".kSssssssSk."}),
			"up": ["...kkkkkk...", "..kSSSSSSk..", ".kSSSSSSSSk.", ".kSSSSSSSSk.", ".kSSSSSSSSk.", ".kSSSSSSSSk.", "..kssssssk.."],
			"side": _with_rows(SHORT.side, {1: "...kSSSSSk..", 2: "..kSSSSSSSk.", 3: "..kSSssssk..", 4: "..kSsssesk.."}),
		},
	}


static func _paint_at(row: String, x: int, ch: String) -> String:
	if row[x] != "s":
		return row
	return row.substr(0, x) + ch + row.substr(x + 1)


static var _humanoid_cache := {}


## humanoid.ts humanoidFrames(): 9 frames, down 0-2, up 3-5, side (facing right) 6-8.
static func humanoid_frames(gender := "male", hair_style := "short") -> Array:
	var key := "%s:%s" % [gender, hair_style]
	if _humanoid_cache.has(key):
		return _humanoid_cache[key]
	var heads := _heads()
	var head: Dictionary = heads.get(hair_style, SHORT)
	var female := gender == "female"
	var down: Array = head.down
	var side: Array = head.side
	if female:
		down = _with_rows(down, {5: _paint_at(_paint_at(down[5], 5, "r"), 6, "r")})
		side = _with_rows(side, {5: _paint_at(side[5], 8, "r")})
	var front := _with_rows(BODY_FRONT, {3: "..kdttttdk.."}) if female else BODY_FRONT
	var body_side_base := _with_rows(BODY_SIDE, {3: "...kdttdk..."}) if female else BODY_SIDE
	var body_down := _with_rows(front, _index_rows(head.get("bodyDown", [])))
	var body_up := _with_rows(front, _index_rows(head.get("bodyUp", [])))
	var body_side := _with_rows(body_side_base, _index_rows(head.get("bodySide", [])))
	var frames := []
	for legs in LEGS_FRONT:
		frames.append(down + body_down + legs)
	for legs in LEGS_FRONT:
		frames.append(head.up + body_up + legs)
	for legs in LEGS_SIDE:
		frames.append(side + body_side + legs)
	_humanoid_cache[key] = frames
	return frames


static func _index_rows(rows: Array) -> Dictionary:
	var out := {}
	for i in rows.size():
		out[i] = rows[i]
	return out


static func _gate_frame(shift: int) -> Array:
	var rows := ["....kkkkkkkk....", "..kkllllllllkk..", ".kllkkkkkkkkllk.", "kllk" + "bbbbbbbb" + "kllk"]
	for i in GATE_ENERGY.size():
		rows.append("kslk" + GATE_ENERGY[(i + shift) % GATE_ENERGY.size()] + "klsk")
	rows.append("kssk" + "bbbbbbbb" + "kssk")
	rows.append("kkkk" + "........" + "kkkk")
	return rows


static func _wolf_frames() -> Array:
	return [
		WOLF_BODY + ["..kfkkfk..kfkfk.", "..kfkkfk..kfkfk.", "..kk.kk...kk.kk."],
		WOLF_BODY + ["..kfk.kfk.kfk...", ".kfk...kfkfk....", ".kk.....kkkk...."],
	]


static func _exit_frames() -> Array:
	var b := []
	for row in EXIT_PORTAL_A:
		var swapped := ""
		for ch in row:
			swapped += "c" if ch == "b" else ("b" if ch == "c" else ch)
		b.append(swapped)
	return [EXIT_PORTAL_A, b]


static func frames_for(a: Dictionary) -> Array:
	match String(a.get("type", "humanoid")):
		"humanoid":
			return humanoid_frames(String(a.get("gender", "male")), String(a.get("hairStyle", "short")))
		"wolf":
			return _wolf_frames()
		"chest":
			return CHEST_FRAMES
		"portal":
			var style := String(a.get("style", "exit"))
			if style == "cave":
				return CAVE_ENTRANCE_FRAMES
			return [_gate_frame(0), _gate_frame(3)] if style == "gate" else _exit_frames()
		"slime":
			return SLIME_FRAMES
	return SLIME_FRAMES


## textures.ts css(): a channel scaled by `factor` (floored, capped at 255).
static func css(color: int, factor := 1.0) -> Color:
	var r := mini(255, int(floor(((color >> 16) & 0xff) * factor)))
	var g := mini(255, int(floor(((color >> 8) & 0xff) * factor)))
	var b := mini(255, int(floor((color & 0xff) * factor)))
	return Color8(r, g, b)


static func palette_for(a: Dictionary) -> Dictionary:
	match String(a.get("type", "humanoid")):
		"humanoid":
			var skin_value := int(a.get("skin", 0xf0c49a))
			var skin := css(skin_value)
			var tunic := int(a.get("tunic", 0x495057))
			return {
				"k": Color("#1a1420"), "e": Color("#1a1420"),
				"h": css(int(a.get("hair", 0x5a3825))),
				"s": skin, "S": skin,
				"r": css(skin_value, 0.78),
				"t": css(tunic), "d": css(tunic, 0.65),
				"p": Color("#4a3b2c"),
				# Players without boots are barefoot; NPCs and mobs keep their default boots.
				"b": skin if a.get("gear") is Dictionary else Color("#3b2a20"),
			}
		"wolf":
			var fur := int(a.get("fur", 0x868e96))
			return {"k": Color("#1a1420"), "e": Color("#e8c33a"), "f": css(fur), "d": css(fur, 0.7)}
		"slime":
			var c := int(a.get("color", 0x51cf66))
			return {"k": css(c, 0.35), "e": Color("#1a1420"), "f": css(c), "d": css(c, 0.7), "w": css(c, 1.5)}
		"chest":
			return {"k": Color("#2a1a10"), "d": Color("#5c3a1c"), "m": Color("#8b5a2b"), "g": Color("#e8c33a")}
		"portal":
			match String(a.get("style", "exit")):
				"cave":
					return {"k": Color("#2a2420"), "r": Color("#6b6157"), "l": Color("#8a8073"), "x": Color("#050405")}
				"cursed":
					return {"k": Color("#3a1a05"), "b": Color("#d2691e"), "c": Color("#ffb347"), "w": Color("#fff3d0")}
				"pvp":
					return {"k": Color("#3a0508"), "b": Color("#c92a2a"), "c": Color("#ff6b6b"), "w": Color("#ffe3e3")}
				"gate":
					return {"k": Color("#1a1a24"), "s": Color("#5c5f6b"), "l": Color("#8a8d99"), "b": Color("#3b2a8f"), "c": Color("#6f5bd9"), "w": Color("#c8f0ff")}
			return {"k": Color("#0b1f3a"), "b": Color("#2f7fe0"), "c": Color("#7fd8ff"), "w": Color("#ffffff")}
	return {}


## textures.ts humanoidPixel(): worn armour and class headwear over the base palette (null = keep).
static func humanoid_pixel(a: Dictionary, ch: String, x: int, y: int) -> Variant:
	var gear = a.get("gear")
	if not (gear is Dictionary):
		return null
	var head := _item(gear.get("head"))
	var hair_layer := ch == "h" or ch == "S"
	if not head.is_empty() and hair_layer and y <= 3:
		var shine: bool = head.get("look") == "plate" and y == 1 and x % 3 == 0
		return css(int(head.icon.color), 1.5 if shine else (0.7 if y == 3 else (1.2 if y == 0 else 1.0)))
	var headwear = a.get("headwear") if head.is_empty() else null
	if headwear is Dictionary and hair_layer:
		if headwear.style == "hat" and y <= 3:
			return css(int(headwear.color), 0.55 if y == 3 else (1.3 if y == 0 else 1.0))
		if headwear.style == "hood":
			return css(int(headwear.color), 0.85 if y >= 4 else 1.0)
	if headwear is Dictionary and headwear.style == "hat" and ch == "k" and y == 0 and (x == 5 or x == 6):
		return css(int(headwear.color), 1.3)
	var chest := _item(gear.get("chest"))
	if not chest.is_empty() and (ch == "t" or ch == "d"):
		var ring_shade := 0.8 if (chest.get("look") == "mail" and (x + y) % 2 == 0) else 1.0
		return css(int(chest.icon.color), (0.65 if ch == "d" else 1.0) * ring_shade)
	var legs := _item(gear.get("legs"))
	if not legs.is_empty() and ch == "p":
		return css(int(legs.icon.color), 0.75 if x % 4 == 3 else 1.0)
	var feet := _item(gear.get("feet"))
	if not feet.is_empty() and ch == "b":
		return css(int(feet.icon.color), 0.6 if y == 15 else 1.0)
	return null


static func _item(id: Variant) -> Dictionary:
	if id == null or String(id).is_empty():
		return {}
	return GameData.item(String(id))


## textures.ts paintFrame(): one frame into `image` at (ox, oy).
static func paint_frame(image: Image, a: Dictionary, frame: int, ox: int, oy: int) -> void:
	var palette := palette_for(a)
	var rows: Array = frames_for(a)[frame]
	var humanoid := String(a.get("type", "humanoid")) == "humanoid"
	for y in rows.size():
		var row: String = rows[y]
		for x in row.length():
			var ch := row[x]
			var color = humanoid_pixel(a, ch, x, y) if humanoid else null
			if color == null:
				color = palette.get(ch)
			if color == null:
				continue
			image.set_pixel(ox + x, oy + y, color)


## A whole sheet image: every frame side by side.
static func sheet_image(a: Dictionary) -> Image:
	var frames := frames_for(a)
	var w: int = String(frames[0][0]).length()
	var h: int = frames[0].size()
	var image := Image.create_empty(w * frames.size(), h, false, Image.FORMAT_RGBA8)
	for f in frames.size():
		paint_frame(image, a, f, f * w, 0)
	return image


# ---- Art sheets (imageSprites.ts) -------------------------------------------------------------

const MOB_FPS := {"idle": 8, "walk": 14, "attack": 18, "hurt": 16, "dead": 14}
const MOB_ONCE := ["attack", "hurt", "dead"]
const JACK_FPS := {"walk": 12, "run": 14, "jump": 9, "slide": 16, "dead": 12}
const JACK_ONCE := ["jump", "dead"]

## imageSprites.ts FALLBACK_LOOKS: drawn stand-ins for sheets that aren't on this machine.
static func _fallback_looks() -> Array:
	return [
		["golem", {"type": "humanoid", "tunic": 0x6f695e, "skin": 0x8a8478, "hair": 0x5e584f, "hairStyle": "bald"}],
		["minotaur", {"type": "humanoid", "tunic": 0x5b3a1e, "skin": 0x8b5a2b, "hair": 0x2a1a0e, "gear": {"chest": "chainmail"}}],
		["satyr", {"type": "humanoid", "tunic": 0x6b4423, "skin": 0xc68a5a, "hair": 0x3a2a1a, "hairStyle": "spiky"}],
		["wraith", {"type": "humanoid", "tunic": 0x3b2a5a, "skin": 0x9a8fb0, "hair": 0x1a1a1a, "headwear": {"color": 0x2b1f40, "style": "hood"}}],
		["jack", {"type": "humanoid", "tunic": 0x2b2b33, "skin": 0xff922b, "hair": 0x2f9e44, "headwear": {"color": 0x2f9e44, "style": "hat"}}],
		["goblin", {"type": "humanoid", "tunic": 0x7a5a2e, "skin": 0x7cb342, "hair": 0x2d2d2d}],
		["orc", {"type": "humanoid", "tunic": 0x4a3a2a, "skin": 0x5a7a3a, "hair": 0x1a1a1a, "gear": {"head": "iron_helm", "legs": "wolf_hide_leggings"}}],
		["ogre", {"type": "humanoid", "tunic": 0x2a1a0a, "skin": 0x4a6a2a, "hair": 0x1a1a1a, "hairStyle": "bald", "gear": {"legs": "wolf_hide_leggings"}}],
		["skeleton", {"type": "humanoid", "tunic": 0x4a4a4a, "skin": 0xe8e4d8, "hair": 0xe8e4d8, "hairStyle": "bald", "gear": {"chest": "chainmail"}}],
		["zombie", {"type": "humanoid", "tunic": 0x5a5a3a, "skin": 0x8a9a6a, "hair": 0x3a3a2a}],
		["oracle", {"type": "humanoid", "tunic": 0x212529, "skin": 0xc8bfa8, "hair": 0x1a1a1a, "headwear": {"color": 0x343a40, "style": "hood"}}],
		["knight", {"type": "humanoid", "tunic": 0x495057, "skin": 0xd9a07a, "hair": 0x1a1a1a, "gear": {"head": "iron_helm", "chest": "chainmail"}}],
		["demon", {"type": "humanoid", "tunic": 0x7a0a0a, "skin": 0xd9480f, "hair": 0x1a1a1a, "hairStyle": "spiky"}],
		["dragon", {"type": "wolf", "fur": 0x7048e8}],
		["small_dragon", {"type": "wolf", "fur": 0x7048e8}],
		["lizard", {"type": "humanoid", "tunic": 0x5c7a3a, "skin": 0xd9c33a, "hair": 0x8a7a1a, "hairStyle": "bald"}],
		["medusa", {"type": "humanoid", "tunic": 0x2f6b4a, "skin": 0x9ad07a, "hair": 0x2f9e44, "hairStyle": "long", "gender": "female"}],
		["jinn", {"type": "humanoid", "tunic": 0x1c7ed6, "skin": 0x4dabf7, "hair": 0xf1f3f5, "headwear": {"color": 0xf1f3f5, "style": "hat"}}],
		["wizard", {"type": "humanoid", "tunic": 0x3b2a5a, "skin": 0xd9a07a, "hair": 0x1a1a1a, "headwear": {"color": 0x3b2a5a, "style": "hood"}}],
		["tribal", {"type": "humanoid", "tunic": 0x8a5a2b, "skin": 0xc68a5a, "hair": 0x2a1a0a, "gear": {"head": "chieftain_helm", "legs": "wolf_hide_leggings"}}],
		["bandit", {"type": "humanoid", "tunic": 0x5a4a3a, "skin": 0xd8a47a, "hair": 0x3a2a1a, "gear": {"head": "leather_cap", "chest": "leather_vest"}}],
	]


static func _sheet_paths(key: String) -> Array:
	if key == "jack":
		return ["res://art/licensed/bosses/jack.png", "res://art/licensed/bosses/jack.json"]
	return ["res://art/licensed/mobs/%s.png" % key, "res://art/licensed/mobs/%s.json" % key]


static func sheet_meta(key: String) -> Dictionary:
	if _sheet_meta.has(key):
		return _sheet_meta[key]
	var paths := _sheet_paths(key)
	var meta := {}
	if ResourceLoader.exists(paths[0]) and FileAccess.file_exists(paths[1]):
		var parsed = JSON.parse_string(FileAccess.get_file_as_string(paths[1]))
		if parsed is Dictionary:
			meta = parsed
	_sheet_meta[key] = meta
	return meta


static func has_sheet(key: String) -> bool:
	return not sheet_meta(key).is_empty()


## imageSprites.ts withFallback(): an image appearance whose sheet is missing becomes a drawn look-alike.
static func with_fallback(a: Dictionary) -> Dictionary:
	if String(a.get("type", "")) != "image" or has_sheet(String(a.key)):
		return a
	var look := {"type": "humanoid", "tunic": 0x495057}
	for entry in _fallback_looks():
		if String(a.key).begins_with(entry[0]):
			look = entry[1]
	if not a.has("tint"):
		return look
	look = look.duplicate(true)
	if look.type == "wolf":
		look.fur = int(a.tint)
	else:
		look.tunic = int(a.tint)
	return look


## The exported character assets (tools/export_characters.gd): characters/hitboxes.json.
static func hitboxes() -> Dictionary:
	if _hitboxes == null:
		var text := FileAccess.get_file_as_string("res://characters/hitboxes.json")
		var parsed = JSON.parse_string(text) if not text.is_empty() else null
		_hitboxes = parsed if parsed is Dictionary else {}
	return _hitboxes


## `asset`: "npcs/<id>" or "mobs/<id>"; when characters/<asset>.tres exists (a designer may have
## redrawn its PNG) it is used instead of the drawn one.
static func sprite_set(appearance: Dictionary, asset := "") -> SpriteSet:
	if not asset.is_empty():
		var path := "res://characters/%s.tres" % asset
		var box: Dictionary = hitboxes().get(asset, {})
		# The sheet may be third-party art missing on this machine (art/licensed): then draw it.
		if not box.is_empty() and ResourceLoader.exists(path) and ResourceLoader.exists(String(box.get("sheet", ""))):
			var cache_key := "asset:" + asset
			if _cache.has(cache_key):
				return _cache[cache_key]
			var a := with_fallback(appearance)
			var s := SpriteSet.new()
			s.key = cache_key
			s.appearance = a
			s.kind = String(a.get("type", "humanoid"))
			s.frames = load(path)
			s.width = int(box.frame[0])
			s.height = int(box.frame[1])
			s.origin = Vector2(float(box.origin[0]), float(box.origin[1]))
			if s.kind == "image":
				s.sheet = String(a.key)
			var first := s.frames.get_frame_texture(s.frames.get_animation_names()[0], 0) if s.frames.get_animation_names().size() > 0 else null
			s.texture = first.atlas if first is AtlasTexture else first
			_cache[cache_key] = s
			return s
	var a := with_fallback(appearance)
	var key := JSON.stringify(a)
	if _cache.has(key):
		return _cache[key]
	var set := SpriteSet.new()
	set.key = key
	set.appearance = a
	set.kind = String(a.get("type", "humanoid"))
	set.frames = SpriteFrames.new()
	set.frames.remove_animation("default")
	if set.kind == "image":
		_build_sheet(set, String(a.key))
	else:
		_build_template(set, a)
	_cache[key] = set
	return set


static func _atlas(texture: Texture2D, x: int, y: int, w: int, h: int) -> AtlasTexture:
	var at := AtlasTexture.new()
	at.atlas = texture
	at.region = Rect2(x, y, w, h)
	return at


static func _add_anim(frames: SpriteFrames, name: String, textures: Array, fps: float, loop: bool) -> void:
	frames.add_animation(name)
	frames.set_animation_speed(name, fps)
	frames.set_animation_loop(name, loop)
	for t in textures:
		frames.add_frame(name, t)


static func _build_template(set: SpriteSet, a: Dictionary) -> void:
	var rows: Array = frames_for(a)
	set.width = String(rows[0][0]).length()
	set.height = rows[0].size()
	var image := sheet_image(a)
	var tex := ImageTexture.create_from_image(image)
	set.texture = tex
	var cells := []
	for f in rows.size():
		cells.append(_atlas(tex, f * set.width, 0, set.width, set.height))
	# "frame<N>": every single frame, for idle poses.
	for f in cells.size():
		_add_anim(set.frames, "frame%d" % f, [cells[f]], 1, false)
	match set.kind:
		"humanoid":
			for pair in [["down", HUMANOID_DOWN], ["up", HUMANOID_UP], ["side", HUMANOID_SIDE]]:
				var first: int = pair[1]
				_add_anim(set.frames, pair[0], [cells[first], cells[first + 1], cells[first], cells[first + 2]], 8, true)
				_add_anim(set.frames, "idle_" + pair[0], [cells[first]], 1, false)
		"wolf":
			_add_anim(set.frames, "side", [cells[0], cells[1]], 8, true)
			_add_anim(set.frames, "idle_side", [cells[0]], 1, false)
		"slime":
			_add_anim(set.frames, "idle", [cells[0], cells[1]], 3, true)
		"portal":
			if String(a.get("style", "")) != "cave":
				_add_anim(set.frames, "idle", [cells[0], cells[1]], 4, true)


static func _build_sheet(set: SpriteSet, key: String) -> void:
	var meta := sheet_meta(key)
	var tex: Texture2D = load(_sheet_paths(key)[0])
	set.sheet = key
	set.texture = tex
	set.width = int(meta.frameWidth)
	set.height = int(meta.frameHeight)
	set.origin = Vector2(float(meta.originX), float(meta.originY))
	var cols := maxi(1, tex.get_width() / set.width)
	var fps: Dictionary = JACK_FPS if key == "jack" else MOB_FPS
	var once: Array = JACK_ONCE if key == "jack" else MOB_ONCE
	var anims: Dictionary = meta.get("anims", {})
	for name in anims.keys():
		var cells := []
		for f in anims[name]:
			var i := int(f)
			cells.append(_atlas(tex, (i % cols) * set.width, (i / cols) * set.height, set.width, set.height))
		_add_anim(set.frames, name, cells, float(fps.get(name, 10)), not (name in once))
	if not set.frames.has_animation("idle") and set.frames.get_animation_names().size() > 0:
		var first: String = set.frames.get_animation_names()[0]
		_add_anim(set.frames, "idle", [set.frames.get_frame_texture(first, 0)], 1, true)
