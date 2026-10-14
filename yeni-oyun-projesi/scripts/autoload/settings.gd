extends Node

## Player preferences (autoload "Settings"). Kept on this machine
## (user://settings.cfg [game]); nothing here affects the server.

signal changed

const FILE := "user://settings.cfg"
const DEFAULTS := {"zoom": "auto", "damageNumbers": true, "speechBubbles": true, "helpText": true, "damageMeter": true, "bossMusic": true}

var values := DEFAULTS.duplicate()
## A phone or tablet (or ?touch / --touch to try the touch layout on a computer).
var touch := false


func _ready() -> void:
	touch = OS.has_feature("mobile") or OS.has_feature("web_android") or OS.has_feature("web_ios") or "--touch" in OS.get_cmdline_user_args()
	if OS.has_feature("web"):
		# As a string: comparing whatever the bridge hands back with a bool can fail.
		var coarse := str(JavaScriptBridge.eval("String(matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch'))", true))
		touch = touch or coarse == "true"
	var cfg := ConfigFile.new()
	if cfg.load(FILE) == OK:
		for key in DEFAULTS:
			values[key] = cfg.get_value("game", key, DEFAULTS[key])


func get_value(key: String) -> Variant:
	return values.get(key, DEFAULTS.get(key))


func update(patch: Dictionary) -> void:
	for key in patch:
		values[key] = patch[key]
	var cfg := ConfigFile.new()
	cfg.load(FILE)
	for key in values:
		cfg.set_value("game", key, values[key])
	cfg.save(FILE)
	changed.emit()
