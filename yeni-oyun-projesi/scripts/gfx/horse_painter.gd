class_name HorsePainter
extends RefCounted

## The riding horse painted pixel by pixel: client/src/gfx/horse.ts (and the Pix helpers of
## pixelArt.ts), ported so any coat / mane / blanket / saddle colours from the stable draw
## exactly as in the web client. Frames 39x30: side 0 + walk 1-4, front 5-7, back 8-10.

const W := 39
const H := 30
const OUTLINE := 0x1a1420
const HOOF := 0x2a2420
const BLAZE := 0xf0e6d0
const GOLD_TRIM := 0xe8c33a

static var _sheets := {}
static var _icons := {}


## JavaScript Math.round (halves round up).
static func jr(v: float) -> int:
	return int(floor(v + 0.5))


## pixelArt.ts tone(): towards white (amount > 0) or black.
static func tone(color: int, amount: float) -> int:
	var t := 255.0 if amount > 0 else 0.0
	var k := absf(amount)
	var out := 0
	for shift in [16, 8, 0]:
		var c := float((color >> shift) & 255)
		out |= jr(c + (t - c) * k) << shift
	return out


## pixelArt.ts shade(): lights lean warm, shadows cool.
static func shade(color: int, amount: float) -> int:
	var base := tone(color, amount)
	var r := float((base >> 16) & 255)
	var g := float((base >> 8) & 255)
	var b := float(base & 255)
	var warm := amount * 18.0 if amount > 0 else amount * 10.0
	var clamp := func(v: float) -> int: return clampi(jr(v), 0, 255)
	return (clamp.call(r + warm) << 16) | (clamp.call(g + warm * 0.5) << 8) | clamp.call(b - warm)


class Pix:
	var image: Image
	var w: int
	var h: int

	func _init(width: int, height: int) -> void:
		w = width
		h = height
		image = Image.create_empty(width, height, false, Image.FORMAT_RGBA8)

	func px(x: float, y: float, c: int) -> void:
		rect(x, y, 1, 1, c)

	func rect(x: float, y: float, rw: float, rh: float, c: int) -> void:
		if rw <= 0 or rh <= 0:
			return
		var x0 := HorsePainter.jr(x)
		var y0 := HorsePainter.jr(y)
		var color := Color8((c >> 16) & 255, (c >> 8) & 255, c & 255)
		for yy in range(y0, y0 + HorsePainter.jr(rh)):
			for xx in range(x0, x0 + HorsePainter.jr(rw)):
				if xx >= 0 and yy >= 0 and xx < w and yy < h:
					image.set_pixel(xx, yy, color)

	## Every pixel of an ellipse coloured by painter(nx, ny) (null = skip).
	func ellipse(cx: float, cy: float, rx: float, ry: float, painter: Callable) -> void:
		for y in range(int(floor(cy - ry)), int(ceil(cy + ry)) + 1):
			for x in range(int(floor(cx - rx)), int(ceil(cx + rx)) + 1):
				var nx := (x + 0.5 - cx) / rx
				var ny := (y + 0.5 - cy) / ry
				if nx * nx + ny * ny > 1.0:
					continue
				var c = painter.call(nx, ny)
				if c != null:
					px(x, y, int(c))

	## A 1px outline round everything painted so far.
	func outline(c: int) -> void:
		var solid := func(x: int, y: int) -> bool: return x >= 0 and y >= 0 and x < w and y < h and image.get_pixel(x, y).a8 > 40
		var edge: Array = []
		for y in h:
			for x in w:
				if solid.call(x, y):
					continue
				if solid.call(x - 1, y) or solid.call(x + 1, y) or solid.call(x, y - 1) or solid.call(x, y + 1):
					edge.append(Vector2i(x, y))
		for e in edge:
			px(e.x, e.y, c)


static func colours(look: Dictionary) -> Dictionary:
	var coat := int(look.coat)
	var mane := int(look.mane)
	return {
		"coat": {"high": shade(coat, 0.32), "light": shade(coat, 0.15), "mid": coat, "dark": shade(coat, -0.3)},
		"mane": {"light": shade(mane, 0.2), "mid": mane, "dark": shade(mane, -0.35)},
		"blanket": int(look.blanket),
		"saddle": int(look.saddle),
	}


static func coat_dome(p: Pix, c: Dictionary, cx: float, cy: float, rx: float, ry: float, dim := 0.0) -> void:
	p.ellipse(cx, cy, rx, ry, func(nx: float, ny: float):
		var t := -(nx * -0.5 + ny * -0.85) - dim
		return c.high if t > 0.65 else (c.light if t > 0.15 else (c.mid if t > -0.45 else c.dark)))


static func leg_side(p: Pix, c: Dictionary, x: float, top: float, lift: float, bend: float, far: bool) -> void:
	var shade_c: int = c.dark if far else c.mid
	var lit_c: int = c.mid if far else c.light
	var ground := 28.0 - lift
	var y := top
	while y < ground:
		var t := (y - top) / (ground - top)
		var lx := jr(x + bend * t)
		var w := 4 if t < 0.45 else 3
		p.rect(lx, y, w, 1, shade_c)
		p.px(lx, y, lit_c)
		y += 1
	var hx := jr(x + bend)
	p.rect(hx - 1 + (1 if bend > 0 else 0), ground, 4, 2, HOOF)
	p.rect(hx, ground - 3, 3, 1, c.dark if far else c.high)


static func paint_side(p: Pix, c: Dictionary, phase: int) -> void:
	var swing: Array = [0, 0, 0, 0] if phase < 0 else [[2, -2, -2, 2], [0, 0, 0, 0], [-2, 2, 2, -2], [0, 0, 0, 0]][phase]
	var lift: Array = [0, 0, 0, 0] if phase < 0 else [[1, 0, 0, 1], [0, 1, 1, 0], [0, 1, 1, 0], [1, 0, 0, 1]][phase]
	var bob := 1 if phase == 1 or phase == 3 else 0
	leg_side(p, c.coat, 11, 18 + bob, lift[1], swing[1], true)
	leg_side(p, c.coat, 24, 18 + bob, lift[3], swing[3], true)
	for i in 12:
		var x := jr(6 - i * 0.35 + sin(i * 0.6 + (0.0 if phase < 0 else float(phase))) * 0.8)
		var y := 11 + bob + i
		p.rect(x - 1, y, 3, 1, c.mane.light if i % 3 == 0 else c.mane.mid)
		p.px(x + 1, y, c.mane.dark)
	coat_dome(p, c.coat, 17, 15 + bob, 11.5, 6.5)
	coat_dome(p, c.coat, 9, 14 + bob, 5.5, 5.5)
	coat_dome(p, c.coat, 25, 14 + bob, 5, 5.5)
	p.rect(9, 19 + bob, 16, 1, c.coat.dark)
	for i in range(0, 9):
		coat_dome(p, c.coat, 25 + i * 0.75, 13 + bob - i * 0.8, 4 - i * 0.05, 3.8)
	coat_dome(p, c.coat, 32.5, 6 + bob, 4.4, 3.2)
	coat_dome(p, c.coat, 35.6, 8 + bob, 2.6, 2.3, 0.2)
	p.px(37, 7 + bob, OUTLINE)
	p.rect(35, 10 + bob, 3, 1, c.coat.dark)
	p.rect(29, 1 + bob, 2, 3, c.coat.mid)
	p.px(29, 1 + bob, c.coat.high)
	p.px(33, 5 + bob, OUTLINE)
	p.px(32, 5 + bob, 0xffffff)
	for i in range(0, 10):
		var x := jr(23.5 + i * 0.72)
		var y := jr(10 + bob - i * 0.8)
		p.rect(x - 1, y, 2, 3, c.mane.mid if i % 2 else c.mane.light)
		p.px(x - 2, y + 2, c.mane.dark)
	p.rect(28, 3 + bob, 3, 2, c.mane.mid)
	p.rect(13, 10 + bob, 10, 6, c.blanket)
	p.rect(13, 10 + bob, 10, 1, tone(c.blanket, 0.25))
	p.rect(13, 15 + bob, 10, 1, GOLD_TRIM)
	p.rect(14, 8 + bob, 7, 3, c.saddle)
	p.rect(14, 8 + bob, 7, 1, tone(c.saddle, 0.3))
	p.rect(20, 7 + bob, 2, 2, c.saddle)
	p.rect(17, 11 + bob, 1, 6, 0x3a2a1a)
	p.rect(16, 17 + bob, 3, 1, 0x9a9aa8)
	leg_side(p, c.coat, 8, 17 + bob, lift[0], swing[0], false)
	leg_side(p, c.coat, 22, 17 + bob, lift[2], swing[2], false)


static func paint_front(p: Pix, c: Dictionary, phase: int) -> void:
	var lifts: Array = [0, 0] if phase < 0 else ([1, 0] if phase == 0 else [0, 1])
	var cx := 19.5
	for pair in [[14, lifts[0]], [22, lifts[1]]]:
		var x: int = pair[0]
		var lift: int = pair[1]
		p.rect(x, 19, 3, 9 - lift, c.coat.mid)
		p.rect(x, 19, 1, 9 - lift, c.coat.light)
		p.rect(x - 1, 27 - lift, 5, 2, HOOF)
	coat_dome(p, c.coat, cx, 17, 9, 6)
	p.rect(cx - 12, 13, 4, 6, c.blanket)
	p.rect(cx + 8, 13, 4, 6, tone(c.blanket, -0.2))
	p.rect(cx - 12, 18, 4, 1, GOLD_TRIM)
	p.rect(cx + 8, 18, 4, 1, GOLD_TRIM)
	coat_dome(p, c.coat, cx, 10, 4, 7.5)
	var rcx := jr(cx)
	p.rect(rcx - 1, 6, 2, 9, BLAZE)
	coat_dome(p, c.coat, cx, 16, 3, 2.2, 0.25)
	p.px(rcx - 2, 16, OUTLINE)
	p.px(rcx + 1, 16, OUTLINE)
	p.px(rcx - 4, 8, OUTLINE)
	p.px(rcx + 3, 8, OUTLINE)
	p.rect(rcx - 5, 1, 2, 4, c.coat.mid)
	p.rect(rcx + 3, 1, 2, 4, c.coat.dark)
	p.rect(rcx - 2, 3, 4, 3, c.mane.mid)
	p.px(rcx - 1, 3, c.mane.light)


static func paint_back(p: Pix, c: Dictionary, phase: int) -> void:
	var lifts: Array = [0, 0] if phase < 0 else ([1, 0] if phase == 0 else [0, 1])
	var cx := 19.5
	var rcx := jr(cx)
	p.rect(rcx - 4, 1, 2, 4, c.coat.mid)
	p.rect(rcx + 2, 1, 2, 4, c.coat.dark)
	p.rect(rcx - 2, 3, 4, 4, c.mane.mid)
	for pair in [[13, lifts[0]], [23, lifts[1]]]:
		var x: int = pair[0]
		var lift: int = pair[1]
		p.rect(x, 19, 4, 9 - lift, c.coat.mid)
		p.rect(x, 19, 1, 9 - lift, c.coat.light)
		p.rect(x - 1, 27 - lift, 5, 2, HOOF)
	coat_dome(p, c.coat, cx, 15, 9.5, 7)
	p.rect(rcx - 10, 8, 20, 5, c.blanket)
	p.rect(rcx - 10, 12, 20, 1, GOLD_TRIM)
	p.rect(rcx - 5, 6, 10, 3, c.saddle)
	p.rect(rcx - 5, 6, 10, 1, tone(c.saddle, 0.3))
	for i in 12:
		var x := jr(cx - 1 + sin(i * 0.5 + (0.0 if phase < 0 else float(phase))) * 0.8)
		p.rect(x, 13 + i, 3, 1, c.mane.light if i % 3 == 0 else c.mane.mid)


static func encode(look: Dictionary) -> String:
	return "%x,%x,%x,%x" % [int(look.coat), int(look.mane), int(look.blanket), int(look.saddle)]


static func decode(text: String) -> Variant:
	var parts := text.split(",")
	if parts.size() != 4:
		return null
	return {"coat": parts[0].hex_to_int(), "mane": parts[1].hex_to_int(), "blanket": parts[2].hex_to_int(), "saddle": parts[3].hex_to_int()}


## The 11-frame sheet for a look (cached).
static func sheet(look: Dictionary) -> ImageTexture:
	var key := encode(look)
	if _sheets.has(key):
		return _sheets[key]
	var c := colours(look)
	var image := Image.create_empty(W * 11, H, false, Image.FORMAT_RGBA8)
	var draws := [
		func(p): paint_side(p, c, -1), func(p): paint_side(p, c, 0), func(p): paint_side(p, c, 1), func(p): paint_side(p, c, 2), func(p): paint_side(p, c, 3),
		func(p): paint_front(p, c, -1), func(p): paint_front(p, c, 0), func(p): paint_front(p, c, 1),
		func(p): paint_back(p, c, -1), func(p): paint_back(p, c, 0), func(p): paint_back(p, c, 1),
	]
	for i in draws.size():
		var p := Pix.new(W, H)
		draws[i].call(p)
		p.outline(OUTLINE)
		image.blit_rect(p.image, Rect2i(0, 0, W, H), Vector2i(i * W, 0))
	var tex := ImageTexture.create_from_image(image)
	_sheets[key] = tex
	return tex


## A standing side view (horseIconUrl), `scale` x 0.67 of the frame size.
static func icon(look: Dictionary, scale := 2.0) -> ImageTexture:
	var key := "%s@%s" % [encode(look), scale]
	if _icons.has(key):
		return _icons[key]
	var p := Pix.new(W, H)
	paint_side(p, colours(look), -1)
	p.outline(OUTLINE)
	var image := p.image
	image.resize(jr(W * scale * 0.67), jr(H * scale * 0.67), Image.INTERPOLATE_NEAREST)
	var tex := ImageTexture.create_from_image(image)
	_icons[key] = tex
	return tex


static func breed_look(breed: String) -> Dictionary:
	var b: Dictionary = GameData.HORSE_BREEDS.get(breed, GameData.HORSE_BREEDS.get("village", {}))
	return b.get("look", {"coat": 0x8b5a2b, "mane": 0x2a1a10, "blanket": 0x3b5f8a, "saddle": 0x9c2a2a})
