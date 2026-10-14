class_name SnapshotBuffer
extends RefCounted

## Snapshot interpolation for entities we don't control.
## Remote entities are drawn INTERPOLATION_DELAY_MS in the past so there are always two
## snapshots to blend between.

const INTERPOLATION_DELAY_MS := 100.0

var _snaps: Array = []  # [{t, x, y, dir}]


static func now_ms() -> float:
	return Time.get_ticks_usec() / 1000.0


func push(x: float, y: float, dir: int) -> void:
	var now := now_ms()
	if not _snaps.is_empty():
		var last: Dictionary = _snaps[-1]
		# After standing still there's a gap: anchor the old position one tick back.
		if now - float(last.t) > GameData.TICK_MS * 2.0:
			_snaps.append({"t": now - GameData.TICK_MS, "x": last.x, "y": last.y, "dir": last.dir})
	_snaps.append({"t": now, "x": x, "y": y, "dir": dir})


## {x, y, dir} at `render_time`, or an empty Dictionary before the first snapshot.
func sample(render_time: float) -> Dictionary:
	while _snaps.size() > 2 and float(_snaps[1].t) <= render_time:
		_snaps.pop_front()
	if _snaps.is_empty():
		return {}
	var a: Dictionary = _snaps[0]
	if _snaps.size() < 2 or render_time <= float(a.t):
		return a
	var b: Dictionary = _snaps[1]
	var t := minf(1.0, (render_time - float(a.t)) / (float(b.t) - float(a.t)))
	return {"x": a.x + (b.x - a.x) * t, "y": a.y + (b.y - a.y) * t, "dir": a.dir if t < 1.0 else b.dir}
