extends SceneTree

## Writes shared/maps/<zone>.json from every map scene (what the editor plugin does on save):
##   godot --headless --path . -s res://tools/export_maps.gd [-- zone zone ...]


func _initialize() -> void:
	var only := OS.get_cmdline_user_args()
	for name in DirAccess.get_files_at("res://maps"):
		if not name.ends_with(".tscn"):
			continue
		var zone := name.get_basename()
		if not only.is_empty() and not only.has(zone):
			continue
		var root: GameMap = load("res://maps/" + name).instantiate()
		var error := MapExport.write(root)
		print("%s: %s" % [zone, error if not error.is_empty() else "shared/maps/%s.json" % zone])
		root.free()
	quit()
