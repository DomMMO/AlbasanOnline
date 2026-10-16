@tool
class_name DriftingClouds
extends Node2D

## Clouds under a floating island: every child sprite drifts east and comes back round from the
## west edge of the map. Faster ones (higher `speed` meta) are nearer.

@export var map_width := 2400.0


func _ready() -> void:
	set_process(not Engine.is_editor_hint())
	var rng := RandomNumberGenerator.new()
	rng.seed = 777
	for child in get_children():
		if child is Node2D and not child.has_meta("speed"):
			child.set_meta("speed", 3.0 + rng.randf() * 7.0)


func _process(delta: float) -> void:
	for child in get_children():
		if not child is Node2D:
			continue
		child.position.x += float(child.get_meta("speed", 5.0)) * delta
		if child.position.x > map_width + 160:
			var w := 160.0
			if child is Sprite2D and child.texture:
				w = child.texture.get_width()
			child.position.x = -160 - w
