class_name Depth
extends RefCounted

## Phaser draws by `depth` (characters at their feet y, overlays at 100000+, the night at 1e7).
## Godot y-sorts by position, so every depth-sorted thing sits in a wrapper Node2D placed at
## (x, depth) inside the y-sorted world layer, with the visible node offset to its real y.
## Same depth -> creation order, as in Phaser.


static func wrap(layer: Node, child: Node2D) -> Node2D:
	var w := Node2D.new()
	w.add_child(child)
	layer.add_child(w)
	return w


## Puts the wrapper's child at (x, y) and the wrapper in the sort at `depth`.
static func place(w: Node2D, x: float, y: float, depth: float) -> void:
	w.position = Vector2(x, depth)
	var child := w.get_child(0) as Node2D
	if child:
		child.position = Vector2(0, y - depth)


## A node drawn by a Callable (the Phaser Graphics objects): painter.call(node).
class Painter extends Node2D:
	var painter: Callable

	func _init(p: Callable = Callable()) -> void:
		painter = p

	func _draw() -> void:
		if painter.is_valid():
			painter.call(self)


## Ellipse helper for painters (Phaser fillEllipse / strokeEllipse take the full width/height).
static func ellipse_points(cx: float, cy: float, w: float, h: float, n := 32) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for i in n:
		var a := TAU * i / n
		pts.append(Vector2(cx + cos(a) * w * 0.5, cy + sin(a) * h * 0.5))
	return pts


static func fill_ellipse(ci: CanvasItem, cx: float, cy: float, w: float, h: float, color: Color) -> void:
	if w <= 0.0 or h <= 0.0:
		return
	ci.draw_colored_polygon(ellipse_points(cx, cy, w, h), color)


static func stroke_ellipse(ci: CanvasItem, cx: float, cy: float, w: float, h: float, color: Color, width := 1.0) -> void:
	if w <= 0.0 or h <= 0.0:
		return
	var pts := ellipse_points(cx, cy, w, h)
	pts.append(pts[0])
	ci.draw_polyline(pts, color, width)


## 0xRRGGBB (+ alpha) to Color.
static func c(rgb: int, alpha := 1.0) -> Color:
	return Color8((rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255, int(round(alpha * 255)))
