class_name NightGlow
extends Sprite2D

## A picture that only shows while the lamps burn (lit windows, flames, lamp halos): the night
## layer sets its alpha to `base` x lamp level, flickering by `flicker`.

@export_range(0.0, 1.0, 0.01) var base := 0.8
@export_range(0.0, 1.0, 0.01) var flicker := 0.12


func _ready() -> void:
	if not Engine.is_editor_hint():
		modulate.a = 0.0
