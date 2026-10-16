class_name ZoneMap
extends RefCounted

## A zone's tile map for collision and client-side prediction: shared/src/map.ts (WorldMap,
## blocksRect) and shared/src/movement.ts, ported line by line. The movement must stay exactly
## the server's, or reconciliation would snap the player around.

const QUARTER := 8.0
## map.ts BLOCKING (used when shared.json predates BLOCKING_TILES).
const FALLBACK_BLOCKING := [3, 4, 7, 11, 12, 16, 17, 19, 22, 23, 26, 27]
## map.ts OPAQUE: tiles that block sight.
const OPAQUE := [4, 7, 11, 12, 19, 22]

enum Dir { DOWN = 0, UP = 1, LEFT = 2, RIGHT = 3 }

var id := ""
var width := 0
var height := 0
var tiles := PackedInt32Array()
## Map editor: tiles blocked by quarters, key y * width + x -> bits (1 TL, 2 TR, 4 BL, 8 BR).
var block_mask := {}
## Maps made in Godot (map.ts WorldMap.shapesOnly): only `shapes` block, not tiles.
var shapes_only := false
## Blocking shapes (map.ts BlockShape) by the tiles they touch: {x, y, w, h, points
## (PackedFloat64Array, empty for a box), walk, sight}.
var shapes_by_tile := {}
var spawn := Vector2.ZERO
var blocking := {}
var hitbox_half_width := 5.0
var hitbox_height := 6.0


static func from_zone_data(zone: Dictionary) -> ZoneMap:
	var m := ZoneMap.new()
	m.id = String(zone.get("id", ""))
	m.width = int(zone.width)
	m.height = int(zone.height)
	var raw: Array = zone.tiles
	m.tiles.resize(raw.size())
	for i in raw.size():
		m.tiles[i] = int(raw[i])
	for entry in zone.get("blockMask", []):
		m.block_mask[int(entry[0])] = int(entry[1])
	for r in zone.get("rects", []):
		m._add_shape({"x": float(r[0]), "y": float(r[1]), "w": float(r[2]), "h": float(r[3]), "points": PackedFloat64Array(), "walk": true, "sight": true})
	var s: Dictionary = zone.get("spawn", {"x": 0, "y": 0})
	m.spawn = Vector2(float(s.x), float(s.y))
	var list: Array = GameData.get_value("BLOCKING_TILES", FALLBACK_BLOCKING)
	for t in list:
		m.blocking[int(t)] = true
	var hb: Dictionary = GameData.get_value("PLAYER_HITBOX", {"halfWidth": 5, "height": 6})
	m.hitbox_half_width = float(hb.halfWidth)
	m.hitbox_height = float(hb.height)
	return m


## A map made in Godot, from its MapExport (the same data the server reads, shared/maps/<zone>.json).
static func from_export(file: Dictionary) -> ZoneMap:
	var m := ZoneMap.new()
	m.id = String(file.zone)
	m.width = int(file.width)
	m.height = int(file.height)
	m.shapes_only = true
	m.tiles.resize(m.width * m.height)
	for y in m.height:
		var row: String = file.tiles[y]
		for x in m.width:
			var c := row.unicode_at(x)
			m.tiles[y * m.width + x] = c - 48 if c <= 57 else c - 87
	m.spawn = Vector2(float(file.spawn.x), float(file.spawn.y))
	for s in file.shapes:
		var f := int(s.f)
		var shape := {"points": PackedFloat64Array(), "walk": (f & 1) != 0, "sight": (f & 2) != 0}
		if s.has("r"):
			shape.merge({"x": float(s.r[0]), "y": float(s.r[1]), "w": float(s.r[2]), "h": float(s.r[3])})
		else:
			var pts := PackedFloat64Array()
			var x0 := INF
			var y0 := INF
			var x1 := -INF
			var y1 := -INF
			for k in s.p.size():
				var v := float(s.p[k])
				pts.append(v)
				if k % 2 == 0:
					x0 = minf(x0, v)
					x1 = maxf(x1, v)
				else:
					y0 = minf(y0, v)
					y1 = maxf(y1, v)
			shape.merge({"x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0, "points": pts}, true)
		m._add_shape(shape)
	var hb: Dictionary = GameData.get_value("PLAYER_HITBOX", {"halfWidth": 5, "height": 6})
	m.hitbox_half_width = float(hb.halfWidth)
	m.hitbox_height = float(hb.height)
	return m


func _add_shape(s: Dictionary) -> void:
	var ts := float(GameData.TILE_SIZE)
	for ty in range(int(floor(s.y / ts)), int(floor((s.y + s.h - 0.001) / ts)) + 1):
		for tx in range(int(floor(s.x / ts)), int(floor((s.x + s.w - 0.001) / ts)) + 1):
			var key := ty * width + tx
			if not shapes_by_tile.has(key):
				shapes_by_tile[key] = []
			shapes_by_tile[key].append(s)


func tile_at(tx: int, ty: int) -> int:
	if tx < 0 or ty < 0 or tx >= width or ty >= height:
		return -1
	return tiles[ty * width + tx]


## map.ts isBlockedTile()
func is_blocked_tile(tx: int, ty: int) -> bool:
	if tx < 0 or ty < 0 or tx >= width or ty >= height:
		return true
	if shapes_only:
		var ts := float(GameData.TILE_SIZE)
		return shapes_block(tx * ts, ty * ts, (tx + 1) * ts, (ty + 1) * ts)
	var key := ty * width + tx
	if block_mask.has(key):
		return block_mask[key] == 15
	return blocking.has(tiles[key])


## map.ts blocksRect(): whether [x0, x1) x [y0, y1) touches a blocked part of tile (tx, ty).
func blocks_rect(tx: int, ty: int, x0: float, y0: float, x1: float, y1: float) -> bool:
	if tx < 0 or ty < 0 or tx >= width or ty >= height:
		return true
	if shapes_only:
		return false
	var key := ty * width + tx
	if not block_mask.has(key):
		return blocking.has(tiles[key])
	var mask: int = block_mask[key]
	var ts := float(GameData.TILE_SIZE)
	for q in 4:
		if not (mask & (1 << q)):
			continue
		var qx := tx * ts + (q & 1) * QUARTER
		var qy := ty * ts + (q >> 1) * QUARTER
		if qx < x1 and qx + QUARTER > x0 and qy < y1 and qy + QUARTER > y0:
			return true
	return false


## map.ts boxHitsPolygon(): separating axes; touching is not overlapping.
static func _box_hits_polygon(p: PackedFloat64Array, x0: float, y0: float, x1: float, y1: float) -> bool:
	var n := p.size() / 2
	for i in n:
		var ax := p[i * 2]
		var ay := p[i * 2 + 1]
		var bx := p[((i + 1) % n) * 2]
		var by := p[((i + 1) % n) * 2 + 1]
		var nx := by - ay
		var ny := ax - bx
		var pmin := INF
		var pmax := -INF
		for k in n:
			var d := p[k * 2] * nx + p[k * 2 + 1] * ny
			if d < pmin:
				pmin = d
			if d > pmax:
				pmax = d
		var c0 := x0 * nx + y0 * ny
		var c1 := x1 * nx + y0 * ny
		var c2 := x0 * nx + y1 * ny
		var c3 := x1 * nx + y1 * ny
		var bmin := minf(minf(c0, c1), minf(c2, c3))
		var bmax := maxf(maxf(c0, c1), maxf(c2, c3))
		if bmax <= pmin or pmax <= bmin:
			return false
	return true


## map.ts shapesBlock(): whether [x0, x1) x [y0, y1) overlaps a shape blocking walking (or sight).
func shapes_block(x0: float, y0: float, x1: float, y1: float, sight := false) -> bool:
	if shapes_by_tile.is_empty():
		return false
	var ts := float(GameData.TILE_SIZE)
	for ty in range(int(floor(y0 / ts)), int(floor((y1 - 0.001) / ts)) + 1):
		for tx in range(int(floor(x0 / ts)), int(floor((x1 - 0.001) / ts)) + 1):
			for s in shapes_by_tile.get(ty * width + tx, []):
				if not (s.sight if sight else s.walk):
					continue
				if not (s.x < x1 and s.x + s.w > x0 and s.y < y1 and s.y + s.h > y0):
					continue
				if s.points.is_empty() or _box_hits_polygon(s.points, x0, y0, x1, y1):
					return true
	return false


## map.ts hasLineOfSight()
func has_line_of_sight(a: Vector2, b: Vector2) -> bool:
	var ts := float(GameData.TILE_SIZE)
	var ax := a.x
	var ay := a.y - 6.0
	var dx := b.x - ax
	var dy := b.y - 6.0 - ay
	var steps := int(ceil(sqrt(dx * dx + dy * dy) / 6.0))
	for i in range(1, steps):
		var tx := int(floor((ax + dx * i / steps) / ts))
		var ty := int(floor((ay + dy * i / steps) / ts))
		var t := tile_at(tx, ty)
		if not shapes_only and t in OPAQUE and block_mask.get(ty * width + tx, -1) != 0:
			return false
		if not shapes_by_tile.is_empty():
			var px := ax + dx * i / steps
			var py := ay + dy * i / steps
			if shapes_block(px, py, px + 0.001, py + 0.001, true):
				return false
	return true


# ---- movement.ts ----------------------------------------------------------------------------

## Collision box at the feet; (x, y) is the bottom centre.
func collides(x: float, y: float) -> bool:
	var ts := float(GameData.TILE_SIZE)
	var x0 := x - hitbox_half_width
	var x1 := x + hitbox_half_width
	var y0 := y - hitbox_height
	var left := int(floor(x0 / ts))
	var right := int(floor((x1 - 0.001) / ts))
	var top := int(floor(y0 / ts))
	var bottom := int(floor((y - 0.001) / ts))
	for ty in range(top, bottom + 1):
		for tx in range(left, right + 1):
			if blocks_rect(tx, ty, x0, y0, x1, y):
				return true
	# Collision shapes of maps made in Godot.
	return shapes_block(x0, y0, x1, y)


## Moves along (vx, vy), a unit vector, by `distance`, sliding along walls (each axis alone).
func move_with_collision(x: float, y: float, vx: float, vy: float, distance: float) -> Vector2:
	var nx := x + vx * distance
	if not collides(nx, y):
		x = nx
	var ny := y + vy * distance
	if not collides(x, ny):
		y = ny
	return Vector2(x, y)


func step_movement(x: float, y: float, dx: int, dy: int, dt_seconds: float, mounted := false, gallop := false, horse_bonus := 0.0) -> Vector2:
	var vx := float(dx)
	var vy := float(dy)
	if vx != 0.0 and vy != 0.0:
		vx *= 0.7071067811865476
		vy *= 0.7071067811865476
	var speed := GameData.PLAYER_SPEED
	if mounted:
		speed = GameData.PLAYER_SPEED * GameData.MOUNT_SPEED_MULTIPLIER * (1.0 + horse_bonus) * (GameData.GALLOP_SPEED_MULTIPLIER if gallop else 1.0)
	return move_with_collision(x, y, vx, vy, speed * dt_seconds)


static func direction_from(dx: int, dy: int, previous: int) -> int:
	if dx < 0:
		return Dir.LEFT
	if dx > 0:
		return Dir.RIGHT
	if dy < 0:
		return Dir.UP
	if dy > 0:
		return Dir.DOWN
	return previous


static func direction_toward(dx: float, dy: float, previous: int) -> int:
	if dx == 0.0 and dy == 0.0:
		return previous
	if absf(dx) >= absf(dy):
		return Dir.LEFT if dx < 0.0 else Dir.RIGHT
	return Dir.UP if dy < 0.0 else Dir.DOWN
