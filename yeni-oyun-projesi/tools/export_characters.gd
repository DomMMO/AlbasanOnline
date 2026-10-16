extends Node

## Writes every character the game has as real Godot assets under res://characters/:
##   players/<gender>_<hair>.png        base player sheets (9 frames: down 0-2, up 3-5, side 6-8)
##   classes/<class>_<gender>.png       class looks (headwear, starter armour)
##   npcs/<npc>.png, mobs/<mob>.png     every NPC and every code-drawn mob
##   */<id>.tres                        SpriteFrames (down / up / side walks, idle frames; art
##                                      sheets: idle / walk / attack / hurt / dead ...)
##   */<id>.tscn                        a ready character: AnimatedSprite2D + Hurtbox (opaque
##                                      pixels, layer 1) + Feet (server collision box, layer 2)
##   hitboxes.json                      the same boxes as data (frame size, origin, hurtbox, feet)
##
## Two passes, because the .tres files point at imported PNGs:
##   godot --headless --path . res://tools/export_characters.tscn -- --phase=png
##   godot --headless --path . --import
##   godot --headless --path . res://tools/export_characters.tscn -- --phase=res
## The game loads characters/npcs/<id>.tres and characters/mobs/<id>.tres when they exist, so
## a redrawn PNG shows up in game as is.

const OUT := "res://characters"

var game_data: Node
var phase := "png"


func _ready() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--phase="):
			phase = arg.substr(8)
	game_data = GameData
	_run.call_deferred()


func _entries() -> Array:
	var out: Array = []
	var genders: Array = game_data.get_value("GENDERS", ["male", "female"])
	var hairs: Array = game_data.get_value("HAIR_STYLES", ["short"])
	var look: Dictionary = game_data.get_value("DEFAULT_LOOK", {})
	var tunic := int(game_data.get_value("TUNIC_COLORS", [0xd94141])[0])
	for g in genders:
		for h in hairs:
			out.append({"dir": "players", "id": "%s_%s" % [g, h], "appearance": {"type": "humanoid", "tunic": tunic, "gender": g, "hairStyle": h, "hair": int(look.get("hairColor", 0x5a3825)), "skin": int(look.get("skin", 0xf0c49a)), "gear": {}}})
	for cls_id in game_data.CLASSES:
		var cls: Dictionary = game_data.CLASSES[cls_id]
		for g in genders:
			var a := {"type": "humanoid", "tunic": tunic, "gender": g, "hairStyle": "long" if g == "female" else "short", "hair": int(look.get("hairColor", 0x5a3825)), "skin": int(look.get("skin", 0xf0c49a))}
			if cls.get("headwear") != null:
				a.headwear = cls.headwear
			var gear := {}
			var starter: Dictionary = cls.get("starterEquipment", {})
			for part in ["head", "chest", "legs", "feet"]:
				if starter.has(part):
					gear[part] = starter[part]
			a.gear = gear
			out.append({"dir": "classes", "id": "%s_%s" % [cls_id, g], "appearance": a, "weapon": starter.get("weapon", "")})
	for npc_id in game_data.NPCS:
		out.append({"dir": "npcs", "id": npc_id, "appearance": game_data.NPCS[npc_id].appearance})
	for mob_id in game_data.MOBS:
		out.append({"dir": "mobs", "id": mob_id, "appearance": game_data.MOBS[mob_id].appearance, "scale": float(game_data.MOBS[mob_id].get("scale", 1))})
	return out


func _run() -> void:
	DirAccess.make_dir_recursive_absolute(OUT)
	var boxes := {}
	for e in _entries():
		var dir := "%s/%s" % [OUT, e.dir]
		DirAccess.make_dir_recursive_absolute(dir)
		var a: Dictionary = Sprites.with_fallback(e.appearance)
		var sheet_path := ""
		var frame_w := 0
		var frame_h := 0
		var origin := Vector2(0.5, 1.0)
		var anims := {}
		if String(a.get("type", "")) == "image":
			var meta := Sprites.sheet_meta(String(a.key))
			sheet_path = Sprites._sheet_paths(String(a.key))[0]
			frame_w = int(meta.frameWidth)
			frame_h = int(meta.frameHeight)
			origin = Vector2(float(meta.originX), float(meta.originY))
			anims = meta.get("anims", {})
		else:
			var frames: Array = Sprites.frames_for(a)
			frame_w = String(frames[0][0]).length()
			frame_h = frames[0].size()
			sheet_path = "%s/%s.png" % [dir, e.id]
			if phase == "png":
				Sprites.sheet_image(a).save_png(ProjectSettings.globalize_path(sheet_path))
			match String(a.get("type", "")):
				"humanoid":
					anims = {"down": [0, 1, 0, 2], "up": [3, 4, 3, 5], "side": [6, 7, 6, 8], "idle_down": [0], "idle_up": [3], "idle_side": [6]}
				"wolf":
					anims = {"side": [0, 1], "idle_side": [0]}
				"slime":
					anims = {"idle": [0, 1]}
				_:
					anims = {"idle": range(frames.size())}
		var hurt := _opaque_box(sheet_path, frame_w, frame_h, anims)
		var scale := float(e.get("scale", 1.0))
		var feet: Dictionary = game_data.get_value("PLAYER_HITBOX", {"halfWidth": 5, "height": 6})
		boxes["%s/%s" % [e.dir, e.id]] = {
			"sheet": sheet_path, "frame": [frame_w, frame_h], "origin": [origin.x, origin.y], "scale": scale,
			# Relative to the feet, in world pixels: x, y (top-left), width, height.
			"hurtbox": [(hurt.position.x - origin.x * frame_w) * scale, (hurt.position.y - origin.y * frame_h) * scale, hurt.size.x * scale, hurt.size.y * scale],
			"feet": [-float(feet.halfWidth), -float(feet.height), float(feet.halfWidth) * 2.0, float(feet.height)],
			"anims": anims,
		}
		if phase == "res":
			_write_resources(e, dir, sheet_path, frame_w, frame_h, origin, anims, boxes["%s/%s" % [e.dir, e.id]], a)
	if phase == "png":
		var f := FileAccess.open("%s/hitboxes.json" % OUT, FileAccess.WRITE)
		f.store_string(JSON.stringify(boxes, "\t"))
	print("characters: %d (%s)" % [boxes.size(), phase])
	get_tree().quit()


func _opaque_box(sheet_path: String, w: int, h: int, anims: Dictionary) -> Rect2:
	var image: Image
	if FileAccess.file_exists(sheet_path) and not ResourceLoader.exists(sheet_path):
		image = Image.load_from_file(ProjectSettings.globalize_path(sheet_path))
	elif ResourceLoader.exists(sheet_path):
		var tex: Texture2D = load(sheet_path)
		image = tex.get_image()
	else:
		image = Image.load_from_file(ProjectSettings.globalize_path(sheet_path))
	if image == null:
		return Rect2(0, 0, w, h)
	if image.is_compressed():
		image.decompress()
	var cols := maxi(1, image.get_width() / w)
	var first: Array = anims.get("idle", anims.get("idle_down", anims.get("idle_side", [0])))
	var union := Rect2()
	var have := false
	for f in first:
		var i := int(f)
		var used := image.get_region(Rect2i((i % cols) * w, (i / cols) * h, w, h)).get_used_rect()
		if used.size.x == 0:
			continue
		union = Rect2(used) if not have else union.merge(Rect2(used))
		have = true
	return union if have else Rect2(0, 0, w, h)


func _write_resources(e: Dictionary, dir: String, sheet_path: String, w: int, h: int, origin: Vector2, anims: Dictionary, box: Dictionary, appearance: Dictionary) -> void:
	var tex: Texture2D = load(sheet_path)
	if tex == null:
		push_error("missing %s (run the png phase and --import first)" % sheet_path)
		return
	var cols := maxi(1, tex.get_width() / w)
	var frames := SpriteFrames.new()
	frames.remove_animation("default")
	var fps := {"down": 8, "up": 8, "side": 8, "idle": 3 if String(appearance.get("type", "")) == "slime" else 8, "walk": 14, "attack": 18, "hurt": 16, "dead": 14}
	var once := ["attack", "hurt", "dead", "jump"]
	# Sheets that know their own frame rates (the pack's mobs) keep them.
	if String(appearance.get("type", "")) == "image":
		var own: Dictionary = Sprites.sheet_meta(String(appearance.key)).get("fps", {})
		for name in own:
			fps[name] = float(own[name])
	for name in anims:
		frames.add_animation(name)
		frames.set_animation_speed(name, fps.get(name, 10))
		frames.set_animation_loop(name, not (name in once) and not String(name).begins_with("idle_"))
		for f in anims[name]:
			var i := int(f)
			var at := AtlasTexture.new()
			at.atlas = tex
			at.region = Rect2((i % cols) * w, (i / cols) * h, w, h)
			frames.add_frame(name, at)
	var tres_path := "%s/%s.tres" % [dir, e.id]
	ResourceSaver.save(frames, tres_path)
	frames = load(tres_path)
	# The scene: sprite (feet at the node's origin) + hurtbox + feet box.
	var root := Node2D.new()
	root.name = String(e.id).to_pascal_case()
	var sprite := AnimatedSprite2D.new()
	sprite.name = "Sprite"
	sprite.sprite_frames = frames
	sprite.centered = false
	sprite.offset = Vector2(-origin.x * w, -origin.y * h)
	var scale := float(box.scale)
	sprite.scale = Vector2(scale, scale)
	var start: String = "idle" if anims.has("idle") else ("idle_down" if anims.has("idle_down") else String(anims.keys()[0]))
	sprite.animation = start
	sprite.autoplay = start
	root.add_child(sprite)
	sprite.owner = root
	var hurtbox := Area2D.new()
	hurtbox.name = "Hurtbox"
	hurtbox.collision_layer = 1
	hurtbox.collision_mask = 0
	hurtbox.input_pickable = true
	root.add_child(hurtbox)
	hurtbox.owner = root
	var hshape := CollisionShape2D.new()
	hshape.name = "Shape"
	var hr := RectangleShape2D.new()
	var hb: Array = box.hurtbox
	hr.size = Vector2(hb[2], hb[3])
	hshape.shape = hr
	hshape.position = Vector2(hb[0] + hb[2] / 2.0, hb[1] + hb[3] / 2.0)
	hshape.debug_color = Color(0.2, 0.6, 1.0, 0.35)
	hurtbox.add_child(hshape)
	hshape.owner = root
	var feet := Area2D.new()
	feet.name = "Feet"
	feet.collision_layer = 2
	feet.collision_mask = 0
	feet.input_pickable = false
	root.add_child(feet)
	feet.owner = root
	var fshape := CollisionShape2D.new()
	fshape.name = "Shape"
	var fr := RectangleShape2D.new()
	var fb: Array = box.feet
	fr.size = Vector2(fb[2], fb[3])
	fshape.shape = fr
	fshape.position = Vector2(fb[0] + fb[2] / 2.0, fb[1] + fb[3] / 2.0)
	fshape.debug_color = Color(1, 0.3, 0.2, 0.45)
	feet.add_child(fshape)
	fshape.owner = root
	var packed := PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, "%s/%s.tscn" % [dir, e.id])
	root.free()
