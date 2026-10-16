extends Node

## Every map scene against the file the server reads: shared/maps/<zone>.json must be exactly
## what saving the scene writes (the editor plugin does that; this catches a map saved without it).
##   godot --headless --path . res://tools/check_maps.tscn


func _ready() -> void:
	var failed := 0
	for name in DirAccess.get_files_at("res://maps"):
		if not name.ends_with(".tscn"):
			continue
		var root: GameMap = load("res://maps/" + name).instantiate()
		var want := MapExport.format(MapExport.export_map(root))
		var have := FileAccess.get_file_as_string(MapExport.file_path(root.zone))
		print("%s: %s" % [root.zone, "ok" if want == have else "shared/maps/%s.json is not the scene: open and save it" % root.zone])
		if want != have:
			failed += 1
		root.free()
	get_tree().quit(1 if failed > 0 else 0)
