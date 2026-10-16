@tool
class_name MapLight
extends Marker2D

## A lamp's light at night (fx/night_layer.gd): a warm circle that brightens the darkness and
## the characters near it. `lamp` lights follow the lamps (lit from 18:00 to 06:00); others
## (fires, glowing lava) always shine.

@export var radius := 60.0:
	set(value):
		radius = value
		queue_redraw()
@export var color := Color8(0xff, 0xc0, 0x70)
## How much it flickers (0 = steady).
@export_range(0.0, 0.5, 0.01) var flicker := 0.06
@export var lamp := true


func _draw() -> void:
	if Engine.is_editor_hint():
		draw_arc(Vector2.ZERO, radius, 0, TAU, 48, Color(color, 0.6), 1.0)
