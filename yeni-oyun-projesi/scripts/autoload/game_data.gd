extends Node

## The game's static data (autoload "GameData"): everything shared/src exports as plain data,
## baked into data/shared.json by tools/godot/bake.mjs. Re-bake when shared/ changes.
## The few shared functions the client needs are ported below (with their source noted).

var data := {}
var cursors := {}

var ITEMS: Dictionary
var MOBS: Dictionary
var SKILLS: Dictionary
var CLASSES: Dictionary
var NPCS: Dictionary
var ZONES: Dictionary
var NODES: Dictionary
var HORSE_BREEDS: Dictionary
var QUESTS: Dictionary

# constants.ts
var TILE_SIZE := 16
var TICK_RATE := 20
var TICK_MS := 50.0
var PLAYER_SPEED := 80.0
var MOUNT_SPEED_MULTIPLIER := 1.6
var GALLOP_SPEED_MULTIPLIER := 1.4
var MELEE_RANGE := 26.0
var TAB_TARGET_RANGE := 160.0
var LOOT_RANGE := 32.0
var NPC_RANGE := 48.0
var PORTAL_RANGE := 32.0
var AUTO_GATE_RANGE := 10.0
var STALL_RANGE := 48.0
var GATHER_RANGE := 32.0
var HOME_ZONE := "town"


func _ready() -> void:
	var text := FileAccess.get_file_as_string("res://data/shared.json")
	if text.is_empty():
		push_error("data/shared.json missing: run `node tools/godot/bake.mjs` in the repository")
		return
	data = JSON.parse_string(text)
	ITEMS = data.get("ITEMS", {})
	MOBS = data.get("MOBS", {})
	SKILLS = data.get("SKILLS", {})
	CLASSES = data.get("CLASSES", {})
	NPCS = data.get("NPCS", {})
	ZONES = data.get("ZONES", {})
	NODES = data.get("NODES", {})
	HORSE_BREEDS = data.get("HORSE_BREEDS", {})
	QUESTS = data.get("QUESTS", {})
	TILE_SIZE = int(data.get("TILE_SIZE", 16))
	TICK_RATE = int(data.get("TICK_RATE", 20))
	TICK_MS = float(data.get("TICK_MS", 50))
	PLAYER_SPEED = float(data.get("PLAYER_SPEED", 80))
	MOUNT_SPEED_MULTIPLIER = float(data.get("MOUNT_SPEED_MULTIPLIER", 1.6))
	GALLOP_SPEED_MULTIPLIER = float(data.get("GALLOP_SPEED_MULTIPLIER", 1.4))
	MELEE_RANGE = float(data.get("MELEE_RANGE", 26))
	TAB_TARGET_RANGE = float(data.get("TAB_TARGET_RANGE", 160))
	LOOT_RANGE = float(data.get("LOOT_RANGE", 32))
	NPC_RANGE = float(data.get("NPC_RANGE", 48))
	PORTAL_RANGE = float(data.get("PORTAL_RANGE", 32))
	AUTO_GATE_RANGE = float(data.get("AUTO_GATE_RANGE", 10))
	STALL_RANGE = float(data.get("STALL_RANGE", 48))
	GATHER_RANGE = float(data.get("GATHER_RANGE", 32))
	HOME_ZONE = String(data.get("HOME_ZONE", "town"))
	var cursor_text := FileAccess.get_file_as_string("res://data/cursors.json")
	if not cursor_text.is_empty():
		cursors = JSON.parse_string(cursor_text)


func get_value(name: String, fallback: Variant = null) -> Variant:
	return data.get(name, fallback)


func zone(id: String) -> Dictionary:
	return ZONES.get(id, {})


func item(id: String) -> Dictionary:
	return ITEMS.get(id, {})


func mob(id: String) -> Dictionary:
	return MOBS.get(id, {})


func npc(id: String) -> Dictionary:
	return NPCS.get(id, {})


func skill(id: String) -> Dictionary:
	return SKILLS.get(id, {})


## classes.ts classOf(): unknown ids are novices.
func class_of(id: String) -> Dictionary:
	return CLASSES.get(id, CLASSES.get("novice", {}))


## progression.ts xpToNextLevel()
func xp_to_next_level(level: int) -> int:
	return int(round(50.0 * pow(level, 1.6)))


## upgrade.ts glowTier()
func glow_tier(enhance: int) -> int:
	if enhance >= 10:
		return 10
	if enhance >= 7:
		return enhance
	return 0


## horses.ts horseSpeedBonus()
func horse_speed_bonus(breed: String) -> float:
	return float(HORSE_BREEDS.get(breed, {}).get("speedBonus", 0.0))


## daynight.ts darkness()
func darkness(minute: float) -> float:
	var h := minute / 60.0
	if h >= 7.5 and h < 18.5:
		return 0.0
	if h >= 18.5 and h < 20.0:
		return (h - 18.5) / 1.5
	if h >= 6.0 and h < 7.5:
		return 1.0 - (h - 6.0) / 1.5
	return 1.0


## daynight.ts lampLevel()
func lamp_level(minute: float) -> float:
	var h := fmod(minute / 60.0, 24.0)
	var smooth := func(t: float) -> float: return t * t * (3.0 - 2.0 * t)
	if h >= 18.0 and h < 18.75:
		return smooth.call((h - 18.0) / 0.75)
	if h >= 5.25 and h < 6.0:
		return 1.0 - smooth.call((h - 5.25) / 0.75)
	return 1.0 if (h >= 18.75 or h < 5.25) else 0.0


## daynight.ts formatClock()
func format_clock(minute: float) -> String:
	var m := int(floor(minute)) % 1440
	return "%02d:%02d" % [m / 60, m % 60]


## hud.ts levelColor()
func level_color(target_level: int, player_level: int) -> Color:
	var diff := target_level - player_level
	if diff >= 5:
		return Color("#ff4040")
	if diff >= 3:
		return Color("#ff8c1a")
	if diff >= -2:
		return Color("#ffe14d")
	if diff >= -4:
		return Color("#4cd964")
	return Color("#9a9a9a")


## appearance.ts sanitizeLook()
func sanitize_look(look: Dictionary) -> Dictionary:
	var genders: Array = data.get("GENDERS", ["male", "female"])
	var hairs: Array = data.get("HAIR_STYLES", ["short"])
	var hair_colors: Array = data.get("HAIR_COLORS", [])
	var skins: Array = data.get("SKIN_COLORS", [])
	var default: Dictionary = data.get("DEFAULT_LOOK", {"gender": "male", "hairStyle": "short", "hairColor": 0x5a3825, "skin": 0xf0c49a})
	var out := default.duplicate()
	if look.get("gender") in genders:
		out.gender = look.gender
	if look.get("hairStyle") in hairs:
		out.hairStyle = look.hairStyle
	if _has_number(hair_colors, look.get("hairColor")):
		out.hairColor = int(look.hairColor)
	if _has_number(skins, look.get("skin")):
		out.skin = int(look.skin)
	return out


static func _has_number(list: Array, value: Variant) -> bool:
	if value == null:
		return false
	for v in list:
		if int(v) == int(value):
			return true
	return false


## api.ts validateUsername()
func validate_username(username: String) -> String:
	var re := RegEx.create_from_string("^[A-Za-z0-9_]{3,16}$")
	return "" if re.search(username) else "Kullanıcı adı 3-16 karakter olmalı (harf, rakam, _)"


## api.ts validatePassword()
func validate_password(password: String) -> String:
	if password.length() < 6:
		return "Şifre en az 6 karakter olmalı"
	if password.to_utf8_buffer().size() > 72:
		return "Şifre çok uzun"
	return ""


## api.ts validateCharacterName()
func validate_character_name(name: String) -> String:
	var re := RegEx.create_from_string("^\\p{L}{3,16}$")
	return "" if re.search(name) else "Karakter adı 3-16 harf olmalı (boşluk ve rakam yok)"


## zones.ts loginZone()
func login_zone(saved: Variant) -> String:
	if saved is String and ZONES.has(saved) and ZONES[saved].get("persistent", false):
		return saved
	return HOME_ZONE


## Colour from a 0xRRGGBB number.
static func rgb(value: Variant) -> Color:
	var n := int(value)
	return Color8((n >> 16) & 255, (n >> 8) & 255, n & 255)
