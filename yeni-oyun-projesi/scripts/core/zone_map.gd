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
	var s: Dictionary = zone.get("spawn", {"x": 0, "y": 0})
	m.spawn = Vector2(float(s.x), float(s.y))
	var list: Array = GameData.get_value("BLOCKING_TILES", FALLBACK_BLOCKING)
	for t in list:
		m.blocking[int(t)] = true
	var hb: Dictionary = GameData.get_value("PLAYER_HITBOX", {"halfWidth": 5, "height": 6})
	m.hitbox_half_width = float(hb.halfWidth)
	m.hitbox_height = float(hb.height)
	return m


func tile_at(tx: int, ty: int) -> int:
	if tx < 0 or ty < 0 or tx >= width or ty >= height:
		return -1
	return tiles[ty * width + tx]


## map.ts isBlockedTile()
func is_blocked_tile(tx: int, ty: int) -> bool:
	if tx < 0 or ty < 0 or tx >= width or ty >= height:
		return true
	var key := ty * width + tx
	if block_mask.has(key):
		return block_mask[key] == 15
	return blocking.has(tiles[key])


## map.ts blocksRect(): whether [x0, x1) x [y0, y1) touches a blocked part of tile (tx, ty).
func blocks_rect(tx: int, ty: int, x0: float, y0: float, x1: float, y1: float) -> bool:
	if tx < 0 or ty < 0 or tx >= width or ty >= height:
		return true
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
		if t in OPAQUE and block_mask.get(ty * width + tx, -1) != 0:
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
	return false


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
