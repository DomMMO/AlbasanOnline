extends SceneTree

## godot --headless --path . -s res://tools/check_scripts.gd
## Loads (compiles) every script under res://scripts and reports the ones that fail.

func _initialize() -> void:
	var failed := 0
	var files := _scan("res://scripts")
	for path in files:
		var script = load(path)
		if script == null or (script is GDScript and not script.can_instantiate() and not _is_static_only(script)):
			print("FAIL ", path)
			failed += 1
	print("checked %d scripts, %d failed" % [files.size(), failed])
	quit(1 if failed > 0 else 0)


func _is_static_only(script: GDScript) -> bool:
	return script.get_instance_base_type() != ""


func _scan(dir: String) -> PackedStringArray:
	var out := PackedStringArray()
	var d := DirAccess.open(dir)
	for f in d.get_files():
		if f.ends_with(".gd"):
			out.append(dir.path_join(f))
	for sub in d.get_directories():
		out.append_array(_scan(dir.path_join(sub)))
	return out
