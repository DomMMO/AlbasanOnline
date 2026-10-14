extends Node

## Key bindings (autoload "Keys"): client/src/input/InputManager.ts DEFAULT_BINDINGS and
## keybindings.ts. Actions are registered in the InputMap at start; a player's own bindings
## override the defaults (user://keybindings.cfg). Esc and Enter stay reserved.

const FILE := "user://keybindings.cfg"

## Action -> default keys.
const DEFAULTS := {
	"move_up": [KEY_W, KEY_UP],
	"move_down": [KEY_S, KEY_DOWN],
	"move_left": [KEY_A, KEY_LEFT],
	"move_right": [KEY_D, KEY_RIGHT],
	"target_next": [KEY_TAB],
	"clear_target": [KEY_ESCAPE],
	"attack": [KEY_F],
	"skill_1": [KEY_1],
	"skill_2": [KEY_2],
	"skill_3": [KEY_3],
	"skill_4": [KEY_4],
	"skill_5": [KEY_5],
	"skill_6": [KEY_6],
	"skill_7": [KEY_7],
	"skill_8": [KEY_8],
	"skill_9": [KEY_9],
	"skill_10": [KEY_0],
	"skills": [KEY_K],
	"potion_1": [KEY_Q],
	"potion_2": [KEY_R],
	"inventory": [KEY_I, KEY_C],
	"interact": [KEY_E],
	"leaderboard": [KEY_L],
	"quest_log": [KEY_J],
	"passive_tree": [KEY_P],
	"town_portal": [KEY_T],
	"minimap": [KEY_M],
	"mount": [KEY_H],
	"sprint": [KEY_SHIFT],
	"friends": [KEY_O],
	"chat": [KEY_ENTER],
}

## Rebindable actions, grouped for the settings page, with their Turkish names (keybindings.ts BINDABLE).
const BINDABLE := [
	["Skill barı", [["skill_1", "Slot 1"], ["skill_2", "Slot 2"], ["skill_3", "Slot 3"], ["skill_4", "Slot 4"], ["skill_5", "Slot 5"], ["skill_6", "Slot 6"], ["skill_7", "Slot 7"], ["skill_8", "Slot 8"], ["skill_9", "Slot 9"], ["skill_10", "Slot 10"], ["potion_1", "İksir 1"], ["potion_2", "İksir 2"]]],
	["Hareket ve savaş", [["move_up", "Yukarı"], ["move_down", "Aşağı"], ["move_left", "Sola"], ["move_right", "Sağa"], ["target_next", "Sıradaki hedef"], ["attack", "Hedefe saldır"], ["interact", "Etkileşim (al, konuş, portal)"], ["town_portal", "Şehir portalı"], ["mount", "Ata bin / in"], ["sprint", "Dörtnala koş (atta basılı tut)"]]],
	["Pencereler", [["inventory", "Karakter ve envanter"], ["skills", "Yetenekler"], ["passive_tree", "Pasif ağaç"], ["quest_log", "Görev günlüğü"], ["friends", "Arkadaşlar"], ["leaderboard", "PvP sıralaması"], ["minimap", "Mini harita"]]],
]

const HOTBAR := ["skill_1", "skill_2", "skill_3", "skill_4", "skill_5", "skill_6", "skill_7", "skill_8", "skill_9", "skill_10"]
const RESERVED := [KEY_ESCAPE, KEY_ENTER]

signal changed

var _overrides := {}


func _ready() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(FILE) == OK:
		for action in (cfg.get_section_keys("keys") if cfg.has_section("keys") else PackedStringArray()):
			_overrides[action] = cfg.get_value("keys", action, [])
	_apply()


func bindings() -> Dictionary:
	var out := {}
	for action in DEFAULTS:
		out[action] = _overrides.get(action, DEFAULTS[action])
	return out


func _apply() -> void:
	var all := bindings()
	for action in all:
		if InputMap.has_action(action):
			InputMap.action_erase_events(action)
		else:
			InputMap.add_action(action, 0.2)
		for code in all[action]:
			var ev := InputEventKey.new()
			ev.keycode = int(code)
			InputMap.action_add_event(action, ev)
	changed.emit()


## Puts `keycode` on `action` (its only key) and takes it off every other action.
func bind_key(action: String, keycode: int) -> void:
	if keycode in RESERVED:
		return
	var all := bindings()
	for other in all:
		if other != action and keycode in all[other]:
			var keys: Array = all[other].duplicate()
			keys.erase(keycode)
			_overrides[other] = keys
	_overrides[action] = [keycode]
	_save()


func reset() -> void:
	_overrides.clear()
	_save()


func _save() -> void:
	var cfg := ConfigFile.new()
	for action in _overrides:
		cfg.set_value("keys", action, _overrides[action])
	cfg.save(FILE)
	_apply()


## Short label of an action's first key ("1", "Q", "Shift").
func label(action: String) -> String:
	var keys: Array = bindings().get(action, [])
	if keys.is_empty():
		return ""
	var name := OS.get_keycode_string(int(keys[0]))
	return {"Space": "Space", "Shift": "Shift", "Up": "↑", "Down": "↓", "Left": "←", "Right": "→"}.get(name, name)
