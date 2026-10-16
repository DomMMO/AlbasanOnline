@tool
class_name GameMap
extends Node2D

## The root of a map scene (maps/<zone>.tscn). Under it, as in any Godot 2D level:
##   TileMapLayers  the ground (tilesets/ground.tres): paint it with the TileMap editor; tiles the
##                  TileSet gives a collision polygon block (physics layer "engel" blocks walking,
##                  "görüş" also blocks ranged attacks and spells)
##   Esyalar        props (props/*.tscn) dragged in from the FileSystem, y-sorted with the characters
##   any StaticBody2D  walls and hitboxes of their own: CollisionShape2D or CollisionPolygon2D,
##                  any shape (collision layer 1 = walking, 2 = sight)
##   MapSpot        where NPCs stand, portals open, players spawn and mobs live
##   MapLight       lamp light at night
## Saving the scene writes shared/maps/<zone>.json for the server (MapExport).

## Zone id (shared/src/zones.ts).
@export var zone := ""
## Size in tiles.
@export var width := 64:
	set(value):
		width = maxi(value, 1)
		queue_redraw()
@export var height := 64:
	set(value):
		height = maxi(value, 1)
		queue_redraw()
## What an empty cell is (a Tile id, shared/src/map.ts): 17 = open sky, which nobody walks on.
@export var empty_tile := 17
## Whether empty cells block walking (open sky round a floating island).
@export var empty_blocks := true
## The colour behind everything (the sky under the island), or transparent for none.
@export var background := Color(0, 0, 0, 0)


func _draw() -> void:
	if Engine.is_editor_hint():
		draw_rect(Rect2(0, 0, width * 16, height * 16), Color(1, 1, 1, 0.5), false, 2.0)
