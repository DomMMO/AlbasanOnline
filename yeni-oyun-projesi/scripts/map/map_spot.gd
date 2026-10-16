@tool
class_name MapSpot
extends Marker2D

## A spot on a map that the server needs to know: the player spawn, an NPC's place, a portal, a
## mob or a mob spawn area. Its position is the feet position (a spawn area: its middle). In the
## editor NPCs and mobs show their own sprite (characters/), the rest a coloured pin.

const KINDS := {
	"spawn": Color(0.3, 1, 0.4),
	"spawns": Color(0.3, 1, 0.4),
	"mob": Color(1, 0.35, 0.3),
	"spawn_zone": Color(1, 0.5, 0.2),
	"npc": Color(0.4, 0.7, 1),
	"portal": Color(0.8, 0.45, 1),
	"arrival": Color(1, 0.85, 0.3),
}

## spawn: where players appear; spawns: one of several (PvP arena); npc / portal: where that NPC
## stands, that portal opens; mob: a mob that is always there; spawn_zone: an area mobs live in;
## arrival: where you stand after coming through a portal of another zone (ref = that portal's id).
@export_enum("spawn", "spawns", "mob", "spawn_zone", "npc", "portal", "arrival") var kind := "spawn":
	set(value):
		kind = value
		_refresh()
## NPC id (npc), portal id (portal, arrival), mob id (mob, spawn_zone): as in shared/src/data.
@export var ref := "":
	set(value):
		ref = value
		_refresh()
## Spawn area: how many mobs live in it.
@export var count := 1
## Spawn area: radius in tiles.
@export var radius := 3.0:
	set(value):
		radius = value
		queue_redraw()


func _ready() -> void:
	set_meta("_edit_group_", true)
	_refresh()


# Its look, in the editor only (not saved with the scene).
func _refresh() -> void:
	if not is_inside_tree() or not Engine.is_editor_hint():
		return
	for child in get_children():
		if child.name == "Look":
			remove_child(child)
			child.free()
	var path := ""
	if kind == "npc":
		path = "res://characters/npcs/%s.tscn" % ref
	elif kind == "mob" or kind == "spawn_zone":
		path = "res://characters/mobs/%s.tscn" % ref
	if not path.is_empty() and ResourceLoader.exists(path):
		var look: Node = load(path).instantiate()
		look.name = "Look"
		add_child(look)
	queue_redraw()


func _draw() -> void:
	if not Engine.is_editor_hint():
		return
	var color: Color = KINDS.get(kind, Color.WHITE)
	if kind == "spawn_zone":
		draw_circle(Vector2.ZERO, radius * 16.0, Color(color, 0.12))
		draw_arc(Vector2.ZERO, radius * 16.0, 0, TAU, 48, color, 1.0)
	if get_node_or_null("Look") == null:
		draw_circle(Vector2(0, -6), 4, color)
		draw_circle(Vector2(0, -6), 1.5, Color.BLACK)
	var label := ref if not ref.is_empty() else ("Doğuş" if kind.begins_with("spawn") else kind)
	if kind == "spawn_zone":
		label += " ×%d" % count
	var font := ThemeDB.fallback_font
	var w := font.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 8).x
	draw_string_outline(font, Vector2(-w / 2, 10), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 8, 3, Color(0, 0, 0, 0.8))
	draw_string(font, Vector2(-w / 2, 10), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 8, color)
