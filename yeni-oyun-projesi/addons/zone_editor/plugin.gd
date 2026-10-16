@tool
extends EditorPlugin

## Keeps the server's maps (shared/maps/<zone>.json) in step with the map scenes: saving a map
## (maps/*.tscn) writes its file; saving a prop scene (props/*.tscn) or a TileSet writes every map
## again, since their hitboxes and tile collisions are part of the maps. Nothing to click.
##
## Files changed outside the editor (by the tools/ scripts) come in by themselves too: whoever
## changed them writes their res:// paths, one per line, to RELOAD_REQUEST. The editor then scans,
## reimports, refreshes those resources and reloads the open scenes that use them. A scene with
## unsaved changes is left alone (a toast says so); an empty request reloads every open scene.

const RELOAD_REQUEST := "res://.godot/yeniden_yukle"

var _watch: Timer
var _seen := 0
var _pending := PackedStringArray()
var _waiting := false


func _enter_tree() -> void:
	scene_saved.connect(_on_scene_saved)
	resource_saved.connect(_on_resource_saved)
	_seen = FileAccess.get_modified_time(RELOAD_REQUEST)
	_watch = Timer.new()
	_watch.wait_time = 1.0
	_watch.timeout.connect(_on_watch)
	add_child(_watch)
	_watch.start()


func _exit_tree() -> void:
	scene_saved.disconnect(_on_scene_saved)
	resource_saved.disconnect(_on_resource_saved)
	if _watch:
		_watch.queue_free()


func _on_watch() -> void:
	var fs := EditorInterface.get_resource_filesystem()
	if _waiting:
		if not fs.is_scanning() and not fs.is_importing():
			_waiting = false
			_reload(_pending)
		return
	var time := FileAccess.get_modified_time(RELOAD_REQUEST)
	if time == 0 or time == _seen:
		return
	_seen = time
	_pending = PackedStringArray()
	for line in FileAccess.get_file_as_string(RELOAD_REQUEST).split("\n", false):
		if line.strip_edges().begins_with("res://"):
			_pending.append(line.strip_edges())
	_waiting = true
	fs.scan()


func _reload(changed: PackedStringArray) -> void:
	for path in changed:
		if (path.ends_with(".tscn") or path.ends_with(".tres")) and ResourceLoader.exists(path):
			ResourceLoader.load(path, "", ResourceLoader.CACHE_MODE_REPLACE)
	var unsaved := EditorInterface.get_unsaved_scenes()
	var done := []
	var kept := []
	for scene in EditorInterface.get_open_scenes():
		if not changed.is_empty() and not _uses(scene, changed, {}):
			continue
		if scene in unsaved:
			kept.append(scene.get_file())
			continue
		EditorInterface.reload_scene_from_path(scene)
		done.append(scene.get_file())
	var text := "Dışarıdan gelen değişiklikler yüklendi"
	if not done.is_empty():
		text += ": " + ", ".join(done)
	if not kept.is_empty():
		text += " — kaydedilmemiş değişiklik olduğu için yeniden yüklenmedi: " + ", ".join(kept)
	print("[harita] ", text)
	EditorInterface.get_editor_toaster().push_toast(text, EditorToaster.SEVERITY_WARNING if not kept.is_empty() else EditorToaster.SEVERITY_INFO)


## Whether the resource at path is one of changed or uses one of them, however deep.
func _uses(path: String, changed: PackedStringArray, seen: Dictionary) -> bool:
	if path in changed:
		return true
	if seen.has(path):
		return false
	seen[path] = true
	for dep in ResourceLoader.get_dependencies(path):
		var dep_path := dep.get_slice("::", dep.get_slice_count("::") - 1)
		if not dep_path.begins_with("res://") and dep.begins_with("uid://"):
			dep_path = ResourceUID.uid_to_path(dep.get_slice("::", 0))
		if dep_path.begins_with("res://") and _uses(dep_path, changed, seen):
			return true
	return false


func _on_scene_saved(path: String) -> void:
	if path.begins_with("res://maps/"):
		var root := EditorInterface.get_edited_scene_root()
		if root is GameMap and root.scene_file_path == path:
			_report([_write(root)])
	elif path.begins_with("res://props/"):
		_write_all()


func _on_resource_saved(resource: Resource) -> void:
	if resource is TileSet:
		_write_all()


## Every map, from its saved scene.
func _write_all() -> void:
	var results := []
	for name in DirAccess.get_files_at("res://maps"):
		if not name.ends_with(".tscn"):
			continue
		var packed: PackedScene = ResourceLoader.load("res://maps/" + name, "", ResourceLoader.CACHE_MODE_REPLACE)
		var root := packed.instantiate() if packed else null
		if root is GameMap:
			results.append(_write(root))
		if root:
			root.free()
	_report(results)


func _write(root: GameMap) -> String:
	var error := MapExport.write(root)
	return error if not error.is_empty() else "shared/maps/%s.json" % root.zone


func _report(results: Array) -> void:
	if results.is_empty():
		return
	var text := "Harita sunucuya yazıldı: " + ", ".join(results)
	print("[harita] ", text)
	EditorInterface.get_editor_toaster().push_toast(text)
