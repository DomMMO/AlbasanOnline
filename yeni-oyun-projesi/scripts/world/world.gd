class_name World
extends Node2D

## One zone, live. The ground and decor (baked), every player,
## mob, NPC, portal, chest and gathering node from the room state, our own movement predicted at
## the server's tick rate and reconciled, remote ones interpolated, targeting, skills, effects,
## and the wiring between the room's messages and the UI. A fresh World per zone.

signal transfer(event: Dictionary)

const Dir := ZoneMap.Dir
const FRIENDLY_COLOR := Color("#4cd964")
const HOSTILE_COLOR := Color("#ffe14d")
const ENEMY_PLAYER_COLOR := Color("#ff5a5a")
## A correction bigger than this is a teleport (respawn), not a prediction error.
const TELEPORT_DISTANCE := 32.0
const PING_INTERVAL := 2.0
const CASTER_BOLT := {"priest": 0xffe066, "necromancer": 0x69db7c, "shaman": 0x74c0fc, "druid": 0x8ce99a}
const FACING := {"up": Dir.UP, "down": Dir.DOWN, "left": Dir.LEFT, "right": Dir.RIGHT}
const HOTBAR_SLOTS := 10


class LocalPlayer:
	var state: Schema.Struct
	var view: EntityView
	var prev := Vector2.ZERO
	var curr := Vector2.ZERO
	var dir := 0
	var moving := false


class Remote:
	var state: Schema.Struct
	var view: EntityView
	var buffer := SnapshotBuffer.new()


var room: ColyseusRoom
var zone_id := ""
var zone := {}
var map: ZoneMap
var hud: Hud
var ui: GameUi
var arrived := false

var zone_view: ZoneView
var sorted: Node2D
var camera: Camera2D
var night: NightLayer
var entities: Node

var local: LocalPlayer
var players := {}  # sessionId -> Remote
var mobs := {}  # mobId -> Remote
var minions := {}
## Owner sessionId -> Remote of their pet.
var pets := {}
var town_portals := {}  # id -> {state, view}
var loot := {}  # id -> {state, view}
var nodes := {}  # id -> {state, node (wrapper), def}
var npc_views := {}  # npcId -> EntityView
var npc_markers: Array = []  # [{npc, label, wrapper}]
var portals: Array = []  # [{def, view}]
var boss_id := ""
var target_id := ""
var _target_ring: Depth.Painter
var _target_ring_w: Node2D
var _ring_color := HOSTILE_COLOR
var party := {"id": null, "sessions": {}}
var duel_opponent := ""
var hotbar_layout: Array = []
var hotbar: Array = []
var pending_inputs: Array = []
var next_seq := 1
var tick_acc := 0.0
var leaving := false
var gates_armed := false
var was_in_market := false
var approach: Variant = null
var dash_glide: Variant = null
var guide: Variant = null
var pings: Array = []
var cast_glows := {}  # sessionId -> wrapper
var shield_bubbles := {}  # sessionId -> wrapper
var last_casts := {}  # mobId -> BossCastEvent
var stalls := {}  # sessionId -> {title, back, sign}
var _ping_timer := 0.0
var _minimap_timer := 0.0
var _offs: Array[Callable] = []
var _hovered: Variant = null
## Tests only (tools/visual_test.gd): keep NPC windows open however far away their NPC is.
var debug_keep_npc_windows := false
var boss_music: BossMusic


static func f(s: Schema.Struct, field: String, fallback: Variant = 0) -> Variant:
	if s == null:
		return fallback
	var v = s.values.get(field)
	return fallback if v == null else v


static func pos_of(s: Schema.Struct) -> Vector2:
	return Vector2(float(f(s, "x", 0.0)), float(f(s, "y", 0.0)))


func setup(the_room: ColyseusRoom, the_zone: String, the_hud: Hud, the_ui: GameUi, came_through_portal := false) -> void:
	room = the_room
	zone_id = the_zone
	zone = GameData.zone(zone_id)
	hud = the_hud
	ui = the_ui
	arrived = came_through_portal


func _ready() -> void:
	get_viewport().physics_object_picking = true
	get_viewport().physics_object_picking_sort = true
	get_viewport().physics_object_picking_first_only = true
	sorted = Node2D.new()
	sorted.name = "Sorted"
	sorted.y_sort_enabled = true
	zone_view = ZoneView.new()
	zone_view.name = "Zone"
	add_child(zone_view)
	add_child(sorted)
	zone_view.build(zone_id, sorted)
	map = zone_view.map
	entities = Node.new()
	entities.name = "Entities"
	add_child(entities)
	RenderingServer.set_default_clear_color(GameData.rgb(zone_view.background) if zone_view.background != null else UiTheme.BG)
	camera = Camera2D.new()
	camera.limit_left = 0
	camera.limit_top = 0
	camera.limit_right = map.width * GameData.TILE_SIZE
	camera.limit_bottom = map.height * GameData.TILE_SIZE
	add_child(camera)
	camera.make_current()
	_fit_zoom()
	get_viewport().size_changed.connect(_fit_zoom)
	Settings.changed.connect(_fit_zoom)
	boss_music = BossMusic.new()
	add_child(boss_music)
	night = NightLayer.new()
	night.zone = zone_view
	night.camera = camera
	night.set_darkness(float(zone.get("dim", 0.0)))
	add_child(night)
	hud.minimap.set_zone(map, String(zone.get("name", zone_id)))
	ui.world_map.set_zone(hud.minimap.ground, hud.minimap.map_size, String(zone.get("name", zone_id)))
	hud.set_death_text(String(zone.get("respawnText", "")))
	_target_ring = Depth.Painter.new(func(ci: CanvasItem): Depth.stroke_ellipse(ci, 0, 0, 18, 7, _ring_color, 1))
	_target_ring.visible = false
	_target_ring_w = Depth.wrap(sorted, _target_ring)
	Art.set_cursor("default")
	_build_npcs()
	_build_portals()
	_bind_ui()
	_bind_state()
	_bind_messages()
	room.send("requestInventory")
	room.send("ping", Time.get_ticks_usec() / 1000.0)


func _exit_tree() -> void:
	for off in _offs:
		off.call()
	if Settings.changed.is_connected(_fit_zoom):
		Settings.changed.disconnect(_fit_zoom)


func _fit_zoom() -> void:
	if camera == null:
		return
	var zoom_setting := String(Settings.get_value("zoom"))
	var width := get_viewport().get_visible_rect().size.x
	var z := maxf(2.0, floorf(width / 480.0)) if zoom_setting == "auto" else float(zoom_setting)
	camera.zoom = Vector2(z, z)


# ---- NPCs and portals ----

func _build_npcs() -> void:
	for npc_id in zone.get("npcs", []):
		var npc := GameData.npc(String(npc_id))
		if npc.is_empty():
			continue
		var view := EntityView.new(sorted, float(npc.x), float(npc.y), npc.appearance, String(npc.name), Color("#7fe3ff"), 1.0, "npcs/%s" % npc.id)
		entities.add_child(view)
		npc_views[npc.id] = view
		if npc.has("facing"):
			view.set_animation(FACING.get(npc.facing, Dir.DOWN), false)
		if npc.get("seated", false):
			view.set_seated(true)
		view.clicked.connect(func(_v, ev: InputEventMouseButton):
			if not ev.alt_pressed:
				walk_to(func(): return Vector2(float(npc.x), float(npc.y)), GameData.NPC_RANGE - 4, func(): talk_to(npc)))
		view.hovered.connect(func(_v, inside): Art.set_cursor("talk" if inside else "default"))
		var marker := Label.new()
		marker.label_settings = Fonts.label_settings(Fonts.mono(), 8, Color("#ffd34d"), 4, Color.BLACK)
		marker.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		marker.size = Vector2(20, 10)
		marker.position = Vector2(-10, -10)
		var holder := Node2D.new()
		holder.add_child(marker)
		var w := Depth.wrap(sorted, holder)
		var my := roundf(view.head_y) - 7.0
		Depth.place(w, roundf(float(npc.x)), my, 100001.0 + float(npc.y))
		var t := holder.create_tween().set_loops().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
		t.tween_property(holder, "position:y", holder.position.y - 2, 0.6)
		t.tween_property(holder, "position:y", holder.position.y, 0.6)
		npc_markers.append({"npc": npc, "label": marker})


func _build_portals() -> void:
	for def in zone.get("portals", []):
		var label := String(def.label)
		if def.get("minLevel"):
			label = "%s (Sv %d+)" % [label, int(def.minLevel)]
		var view := EntityView.new(sorted, float(def.x), float(def.y), {"type": "portal", "style": def.style}, label, Color("#ffb347"))
		entities.add_child(view)
		view.clicked.connect(func(_v, ev: InputEventMouseButton):
			if not ev.alt_pressed:
				walk_to(func(): return Vector2(float(def.x), float(def.y)), GameData.PORTAL_RANGE - 4, func(): use_portal(def)))
		view.hovered.connect(func(_v, inside): Art.set_cursor("portal" if inside else "default"))
		if def.style == "gate":
			_gate_aura(Vector2(float(def.x), float(def.y)))
		if def.style == "door":
			view.sprite.modulate.a = 0.0
		portals.append({"def": def, "view": view})
	# Benches round the fountain: click to walk over and sit down.
	if zone_id == GameData.HOME_ZONE:
		for bench in GameData.get_value("TOWN_BENCHES", []):
			var area := Area2D.new()
			area.input_pickable = true
			area.collision_layer = 1
			area.monitoring = false
			area.monitorable = false
			var shape := CollisionShape2D.new()
			var rect := RectangleShape2D.new()
			var w := float(bench.w) * GameData.TILE_SIZE
			rect.size = Vector2(w, GameData.TILE_SIZE + 8)
			shape.shape = rect
			area.add_child(shape)
			area.position = Vector2(float(bench.tx) * GameData.TILE_SIZE + w / 2.0, float(bench.ty) * GameData.TILE_SIZE + 4)
			add_child(area)
			area.input_event.connect(func(_vp, ev, _i):
				if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT and not ev.alt_pressed:
					sit_on(bench))
			area.mouse_entered.connect(func(): Art.set_cursor("pointer"))
			area.mouse_exited.connect(func(): Art.set_cursor("default"))


func _gate_aura(at: Vector2) -> void:
	var p := CPUParticles2D.new()
	p.amount = 14
	p.lifetime = 1.3
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	p.emission_rect_extents = Vector2(7, 8)
	p.direction = Vector2(0, -1)
	p.spread = 10
	p.gravity = Vector2.ZERO
	p.initial_velocity_min = 8
	p.initial_velocity_max = 18
	p.scale_amount_min = 0.8
	p.scale_amount_max = 0.8
	var grad := Gradient.new()
	grad.set_color(0, Color("#c8f0ff"))
	grad.set_color(1, Color("#6f5bd9", 0.0))
	p.color_ramp = grad
	var mat := CanvasItemMaterial.new()
	mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	p.material = mat
	var w := Depth.wrap(sorted, p)
	Depth.place(w, at.x, at.y - 8, at.y + 0.5)


# ---- Wiring ----

func _bind_ui() -> void:
	_offs.append(_connect(hud.chat.sent, func(text): room.send("chat", {"text": text})))
	_offs.append(_connect(hud.respawn_clicked, func(): room.send("respawn")))
	_offs.append(_connect(hud.hotbar_used, use_hotbar))
	_offs.append(_connect(hud.potion_used, use_potion))
	_offs.append(_connect(hud.mount_clicked, toggle_mount))
	_offs.append(_connect(hud.target_action, _on_target_action))
	_offs.append(_connect(hud.touch_action, do_action))
	ui.bind_world(self)


func _connect(sig: Signal, cb: Callable) -> Callable:
	sig.connect(cb)
	return func(): if sig.is_connected(cb): sig.disconnect(cb)


func send(type: String, message: Variant = null) -> void:
	room.send(type, message)


func _bind_state() -> void:
	var cb := room.callbacks
	var state := room.state
	var players_ref: Schema.MapRef = state.get_field("players")
	_offs.append(cb.on_add(players_ref, _on_player_add))
	_offs.append(cb.on_remove(players_ref, _on_player_remove))
	var mobs_ref: Schema.MapRef = state.get_field("mobs")
	_offs.append(cb.on_add(mobs_ref, _on_mob_add))
	_offs.append(cb.on_remove(mobs_ref, _on_mob_remove))
	var loot_ref: Schema.MapRef = state.get_field("loot")
	_offs.append(cb.on_add(loot_ref, _on_loot_add))
	_offs.append(cb.on_remove(loot_ref, _on_loot_remove))
	var nodes_ref: Schema.MapRef = state.get_field("nodes")
	_offs.append(cb.on_add(nodes_ref, _on_node_add))
	_offs.append(cb.on_remove(nodes_ref, _on_node_remove))
	var tp_ref: Schema.MapRef = state.get_field("townPortals")
	_offs.append(cb.on_add(tp_ref, _on_town_portal_add))
	_offs.append(cb.on_remove(tp_ref, _on_town_portal_remove))
	var minion_ref: Schema.MapRef = state.get_field("minions")
	_offs.append(cb.on_add(minion_ref, _on_minion_add))
	_offs.append(cb.on_remove(minion_ref, _on_minion_remove))
	var pet_ref: Schema.MapRef = state.get_field("pets")
	_offs.append(cb.on_add(pet_ref, _on_pet_add))
	_offs.append(cb.on_remove(pet_ref, _on_pet_remove))
	_offs.append(cb.listen(state, "cleared", func(_v, _p): _sync_portals()))
	var first_clock := [true]
	_offs.append(cb.listen(state, "clock", func(minute, _p):
		var m := float(minute)
		hud.set_clock(m)
		var outdoor: bool = zone.get("outdoor", false)
		night.set_darkness(maxf(GameData.darkness(m) if outdoor else 0.0, float(zone.get("dim", 0.0))))
		night.set_lamp_level(GameData.lamp_level(m) if outdoor else 1.0, first_clock[0])
		first_clock[0] = false))
	_sync_portals()


# ---- Appearance ----

func look_appearance(p: Schema.Struct) -> Dictionary:
	var look := GameData.sanitize_look({"gender": f(p, "gender", "male"), "hairStyle": f(p, "hairStyle", "short"), "hairColor": f(p, "hairColor", 0), "skin": f(p, "skin", 0)})
	return {"gender": look.gender, "hairStyle": look.hairStyle, "hair": look.hairColor, "skin": look.skin}


func player_appearance(p: Schema.Struct) -> Dictionary:
	var a := {"type": "humanoid", "tunic": int(f(p, "color", 0xffffff))}
	a.merge(look_appearance(p))
	var headwear = GameData.class_of(String(f(p, "cls", "novice"))).get("headwear")
	if headwear != null:
		a.headwear = headwear
	var gear := {}
	for pair in [["head", "gearHead"], ["chest", "gearChest"], ["legs", "gearLegs"], ["feet", "gearFeet"]]:
		var v := String(f(p, pair[1], ""))
		if not v.is_empty():
			gear[pair[0]] = v
	a.gear = gear
	return a


# ---- Players ----

func _on_player_add(player: Schema.Struct, session_id: String) -> void:
	var is_local := session_id == room.session_id
	var name_color := Color("#ffe08a") if is_local else (Color("#ff6b6b") if is_enemy_player(session_id) else Color.WHITE)
	var view := EntityView.new(sorted, float(f(player, "x")), float(f(player, "y")), player_appearance(player), String(f(player, "name", "")), name_color)
	entities.add_child(view)
	if is_local:
		local = LocalPlayer.new()
		local.state = player
		local.view = view
		local.prev = pos_of(player)
		local.curr = local.prev
		local.dir = int(f(player, "dir", 0))
		view.set_interactive(false)
		_offs.append(room.callbacks.on_change(player, func():
			reconcile(player)
			refresh_local_ui()))
		refresh_local_ui()
		view.set_weapon(String(f(player, "weapon", "")), int(f(player, "weaponPlus", 0)))
		ui.set_doll_look(int(f(player, "color", 0)), String(f(player, "cls", "novice")), look_appearance(player))
		rebuild_hotbar(String(f(player, "cls", "novice")))
		hud.init_potions(String(f(player, "name", "")), String(f(player, "cls", "novice")))
		if arrived:
			Fx.beam(sorted, local.curr, false, 0.7)
			_fade_in()
		sync_stall(session_id, player)
		_offs.append(room.callbacks.listen(player, "stall", func(_v, _p): sync_stall(session_id, player), false))
		var last_class := [String(f(player, "cls", "novice"))]
		_offs.append(room.callbacks.listen(player, "cls", func(cls, _p):
			if cls == last_class[0]:
				return
			last_class[0] = cls
			ui.set_doll_look(int(f(player, "color", 0)), cls, look_appearance(player))
			hotbar_layout = []
			rebuild_hotbar(cls)
			hud.init_potions(String(f(player, "name", "")), cls)
			ui.refresh_quests(), false))
	else:
		var remote := Remote.new()
		remote.state = player
		remote.view = view
		players[session_id] = remote
		view.clicked.connect(func(_v, ev: InputEventMouseButton):
			if ev.alt_pressed:
				return
			if not String(f(player, "stall", "")).is_empty():
				browse_stall(session_id)
				return
			select_target(session_id, is_enemy_player(session_id)))
		view.hovered.connect(func(_v, inside): Art.set_cursor(player_cursor(session_id, player) if inside else "default"))
		var sync := func():
			remote.buffer.push(float(f(player, "x")), float(f(player, "y")), int(f(player, "dir")))
			var dead: bool = f(player, "dead", false)
			view.set_health(float(f(player, "hp")), float(f(player, "maxHp", 1)), float(f(player, "hp")) < float(f(player, "maxHp", 1)) and not dead)
			view.set_dimmed(dead)
			view.set_ghost(f(player, "protected", false))
			view.set_base_tint(_status_tint(player, false))
			view.set_weapon(String(f(player, "weapon", "")), int(f(player, "weaponPlus", 0)))
			view.set_look(player_appearance(player))
			sync_mount(view, f(player, "mounted", false), String(f(player, "horseLook", "")), String(f(player, "horse", "village")))
			view.set_seated(f(player, "seated", false))
			view.set_gallop(f(player, "galloping", false) and f(player, "moving", false))
			view.set_gm_tag(f(player, "gm", false))
			sync_stall(session_id, player)
			if session_id == target_id:
				refresh_target_frame()
		sync.call()
		_offs.append(room.callbacks.on_change(player, sync))
	hud.set_online_count((room.state.get_field("players") as Schema.MapRef).size())


func _status_tint(p: Schema.Struct, mob: bool) -> Variant:
	if f(p, "stunned", false):
		return 0xffe066
	if f(p, "rooted", false):
		return 0x9ad5ff
	if mob:
		if f(p, "enraged", false):
			return 0xff7070
		if f(p, "empowered", false):
			return 0xc4b0ff
		return null
	return 0xffe8a8 if f(p, "buffed", false) else null


func _on_player_remove(_player: Schema.Struct, session_id: String) -> void:
	var remote: Remote = players.get(session_id)
	if remote:
		remote.view.destroy()
	players.erase(session_id)
	if cast_glows.has(session_id):
		cast_glows[session_id].queue_free()
		cast_glows.erase(session_id)
	if shield_bubbles.has(session_id):
		shield_bubbles[session_id].queue_free()
		shield_bubbles.erase(session_id)
	remove_stall_view(session_id)
	if session_id == target_id:
		select_target("", false, false)
	hud.set_online_count((room.state.get_field("players") as Schema.MapRef).size())


# ---- Mobs ----

func _on_mob_add(mob: Schema.Struct, mob_id: String) -> void:
	var def := GameData.mob(String(f(mob, "kind", "")))
	if def.is_empty():
		return
	var scale := float(def.get("scale", 1))
	var boss: bool = def.get("boss", false)
	var view := EntityView.new(sorted, float(f(mob, "x")), float(f(mob, "y")), def.appearance, String(def.name) if boss else "", Color("#ff8c1a"), scale, "mobs/%s" % f(mob, "kind", ""))
	entities.add_child(view)
	if boss:
		boss_id = mob_id
	view.clicked.connect(func(_v, ev: InputEventMouseButton):
		if ev.alt_pressed:
			room.send("mapPing", {"kind": "attack", "x": view.x, "y": view.y, "targetId": mob_id})
			return
		select_target(mob_id, true)
		if local and not GameData.class_of(String(f(local.state, "cls", "novice"))).get("autoAttack", {}).get("ranged", false):
			walk_to(func(): return mobs[mob_id].view.position if mobs.has(mob_id) else null, GameData.MELEE_RANGE - 6, func(): pass))
	view.hovered.connect(func(_v, inside): Art.set_cursor("attack" if inside else "default"))
	var remote := Remote.new()
	remote.state = mob
	remote.view = view
	mobs[mob_id] = remote
	var sync := func():
		remote.buffer.push(float(f(mob, "x")), float(f(mob, "y")), int(f(mob, "dir")))
		refresh_mob_health(mob_id)
		view.set_base_tint(_status_tint(mob, true))
		if mob_id == target_id:
			refresh_target_frame()
	sync.call()
	_offs.append(room.callbacks.on_change(mob, sync))


func _on_mob_remove(_mob: Schema.Struct, mob_id: String) -> void:
	var remote: Remote = mobs.get(mob_id)
	if remote:
		remote.view.destroy(true)
	mobs.erase(mob_id)
	if mob_id == boss_id:
		boss_id = ""
	if mob_id == target_id:
		select_target("", false, false)


# ---- Loot, nodes, town portals, minions ----

func _on_loot_add(item: Schema.Struct, loot_id: String) -> void:
	var view := EntityView.new(sorted, float(f(item, "x")), float(f(item, "y")), {"type": "chest"})
	entities.add_child(view)
	view.clicked.connect(func(_v, ev: InputEventMouseButton):
		if not ev.alt_pressed:
			walk_to(func(): return pos_of(loot[loot_id].state) if loot.has(loot_id) else null, GameData.LOOT_RANGE - 4, func(): room.send("pickupLoot", {"lootId": loot_id})))
	view.hovered.connect(func(_v, inside): Art.set_cursor("loot" if inside else "default"))
	loot[loot_id] = {"state": item, "view": view}
	var sync := func():
		var visible_now := can_loot(item)
		view.set_visible(visible_now)
	sync.call()
	loot[loot_id].sync = sync
	_offs.append(room.callbacks.on_change(item, sync))


func _on_loot_remove(_item: Schema.Struct, loot_id: String) -> void:
	if loot.has(loot_id):
		loot[loot_id].view.destroy(true)
	loot.erase(loot_id)


func _on_node_add(node: Schema.Struct, node_id: String) -> void:
	var def: Dictionary = GameData.NODES.get(String(f(node, "kind", "")), {})
	if def.is_empty():
		return
	var s := Sprite2D.new()
	s.texture = Art.node_texture(String(def.id))
	s.centered = false
	if s.texture:
		s.offset = Vector2(-s.texture.get_width() / 2.0, -s.texture.get_height())
	var w := Depth.wrap(sorted, s)
	var p := pos_of(node)
	Depth.place(w, roundf(p.x), roundf(p.y), p.y)
	var area := Area2D.new()
	area.input_pickable = true
	area.collision_layer = 1
	area.monitoring = false
	area.monitorable = false
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(16, 16)
	shape.shape = rect
	shape.position = Vector2(0, -8)
	area.add_child(shape)
	s.add_child(area)
	var skill := String(def.skill)
	area.input_event.connect(func(_vp, ev, _i):
		if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT and not ev.alt_pressed:
			walk_to(func(): return p if nodes.has(node_id) else null, GameData.GATHER_RANGE - 4, func(): room.send("gather", {"nodeId": node_id})))
	area.mouse_entered.connect(func():
		Art.set_cursor("mine" if skill == "mining" else "gather")
		var life: Dictionary = GameData.get_value("LIFE_SKILLS", {}).get(skill, {})
		hud.show_message("%s · %s %d%s" % [def.name, life.get("name", skill), int(def.level), " · sadece gece" if def.get("nightOnly", false) else ""], "info", "#d8cba8"))
	area.mouse_exited.connect(func(): Art.set_cursor("default"))
	nodes[node_id] = {"state": node, "node": w, "def": def}


func _on_node_remove(_node: Schema.Struct, node_id: String) -> void:
	if nodes.has(node_id):
		nodes[node_id].node.queue_free()
	nodes.erase(node_id)


func _on_town_portal_add(portal: Schema.Struct, portal_id: String) -> void:
	if town_portals.has(portal_id):
		town_portals[portal_id].view.destroy(true)
	var to := String(f(portal, "to", ""))
	var label := "%s → %s" % [f(portal, "owner", ""), GameData.zone(to).get("name", to)]
	var view := EntityView.new(sorted, float(f(portal, "x")), float(f(portal, "y")), {"type": "portal", "style": "exit" if f(portal, "back", false) else "gate"}, label, Color("#74c0fc"))
	entities.add_child(view)
	view.clicked.connect(func(_v, ev: InputEventMouseButton):
		if ev.alt_pressed or not town_portals.has(portal_id):
			return
		walk_to(func(): return pos_of(portal), GameData.PORTAL_RANGE - 4, func(): use_town_portal(portal_id)))
	view.hovered.connect(func(_v, inside): Art.set_cursor("portal" if inside else "default"))
	Fx.beam(sorted, pos_of(portal), false, 0.7)
	town_portals[portal_id] = {"state": portal, "view": view}


func _on_town_portal_remove(_portal: Schema.Struct, portal_id: String) -> void:
	if town_portals.has(portal_id):
		town_portals[portal_id].view.destroy(true)
	town_portals.erase(portal_id)


func _on_minion_add(minion: Schema.Struct, minion_id: String) -> void:
	var skill := GameData.skill(String(f(minion, "skill", "")))
	if skill.is_empty() or skill.effect.type != "summon":
		return
	var owner := player_state(String(f(minion, "ownerId", "")))
	var name := ("%s (%s)" % [skill.effect.name, f(owner, "name", "")]) if owner else String(skill.effect.name)
	var view := EntityView.new(sorted, float(f(minion, "x")), float(f(minion, "y")), skill.effect.appearance, name, Color("#b2f2bb"))
	entities.add_child(view)
	var remote := Remote.new()
	remote.state = minion
	remote.view = view
	minions[minion_id] = remote
	Fx.burst(sorted, pos_of(minion), Depth.c(0x495057), 10)
	var sync := func(): remote.buffer.push(float(f(minion, "x")), float(f(minion, "y")), int(f(minion, "dir")))
	sync.call()
	_offs.append(room.callbacks.on_change(minion, sync))


func _on_minion_remove(_minion: Schema.Struct, minion_id: String) -> void:
	var remote: Remote = minions.get(minion_id)
	if remote:
		Fx.bone_burst(sorted, remote.view.position, 14)
		remote.view.destroy(true)
	minions.erase(minion_id)


## A player's pet (pets.ts): the server moves it, we only draw it.
func _on_pet_add(pet: Schema.Struct, owner_id: String) -> void:
	var def: Dictionary = GameData.get_value("PETS", {}).get(String(f(pet, "kind", "")), {})
	if def.is_empty():
		return
	_on_pet_remove(pet, owner_id)
	var owner := player_state(owner_id)
	var name := ("%s (%s)" % [def.name, f(owner, "name", "")]) if owner else String(def.name)
	var view := EntityView.new(sorted, float(f(pet, "x")), float(f(pet, "y")), def.appearance, name, Color("#8ce99a"))
	entities.add_child(view)
	var remote := Remote.new()
	remote.state = pet
	remote.view = view
	pets[owner_id] = remote
	Fx.burst(sorted, pos_of(pet), Depth.c(0xf8f4ec), 8)
	var sync := func(): remote.buffer.push(float(f(pet, "x")), float(f(pet, "y")), int(f(pet, "dir")))
	sync.call()
	_offs.append(room.callbacks.on_change(pet, sync))


func _on_pet_remove(_pet: Schema.Struct, owner_id: String) -> void:
	var remote: Remote = pets.get(owner_id)
	if remote:
		Fx.burst(sorted, remote.view.position, Depth.c(0xf8f4ec), 8)
		remote.view.destroy(true)
	pets.erase(owner_id)


func _sync_portals() -> void:
	for p in portals:
		p.view.set_visible(portal_open(p.def))


# ---- Messages ----

func _on(type: String, handler: Callable) -> void:
	room.on_message(type, handler)


func _bind_messages() -> void:
	_on("pong", func(sent_at): hud.set_ping(Time.get_ticks_usec() / 1000.0 - float(sent_at)))
	_on("combat", func(e):
		show_combat_event(e)
		ui.record_combat(e, self))
	_on("attack", show_attack)
	_on("transfer", teleport)
	_on("myStall", func(e): ui.on_my_stall(e))
	_on("questLog", func(e):
		ui.set_quest_log(e)
		refresh_npc_markers())
	_on("auras", func(e): hud.set_auras(e.get("auras", [])))
	_on("lifeSkills", func(e): ui.set_life_skills(e))
	_on("gatherStart", func(e):
		var skill: Dictionary = GameData.get_value("LIFE_SKILLS", {}).get(String(e.skill), {})
		hud.start_cast_bar("%s: %s" % [skill.get("verb", "Toplanıyor"), e.name], float(e.ms), String(skill.get("color", "#8ce99a"))))
	_on("gatherEnd", func(e): hud.stop_cast_bar(bool(e.interrupted)))
	_on("pingEvent", show_ping)
	_on("skillRanks", func(e):
		ui.set_skill_ranks(e)
		if local:
			rebuild_hotbar(String(f(local.state, "cls", "novice"))))
	_on("fortune", func(e):
		ui.set_upgrade_fortune(float(e.get("upgradeBonus", 0)))
		if e.get("text"):
			ui.show_fortune(String(e.text), bool(e.get("good", false))))
	_on("stallContents", func(e): ui.show_stall_contents(e))
	_on("stallClosed", func(e): ui.on_stall_closed(String(e.sellerId)))
	_on("bossCast", show_boss_cast)
	_on("castStart", show_cast_start)
	_on("castEnd", show_cast_end)
	_on("chatMessage", show_chat)
	_on("pvpKill", func(e): ui.add_kill_feed(e, String(f(local.state, "name", "")) if local else ""))
	_on("partyInvite", func(e): ui.show_invite("party", String(e.from)))
	_on("friendList", func(e):
		ui.set_friend_list(e)
		refresh_target_frame())
	_on("horseState", func(e):
		ui.set_horse_state(e)
		hud.set_mount_icon(ui.extra.stable.active_look()))
	_on("petState", func(e): ui.set_pet_state(e))
	_on("partyUpdate", on_party_update)
	_on("duelInvite", func(e): ui.show_invite("duel", String(e.from)))
	_on("dungeonInvite", func(e): ui.show_invite("dungeon", String(e.from), String(e.get("dungeon", ""))))
	_on("fishCatch", show_catch)
	_on("tradeInvite", func(e): ui.show_invite("trade", String(e.from)))
	_on("tradeState", func(e): ui.on_trade_state(e))
	_on("duelState", func(e):
		duel_opponent = String(e.opponent) if e.get("opponent") != null else ""
		refresh_hostility())
	_on("skillUsed", func(e): hud.start_cooldown(String(e.skillId), float(e.cooldownMs), float(e.gcdMs)))
	_on("skillError", func(e): hud.show_message(String(e.message)))
	_on("notice", func(e): hud.show_message(String(e.message), "info", e.get("color")))
	_on("mapChanged", func(_e): hud.show_message("Harita güncellendi (bake tekrar çalıştırılmalı)", "info"))
	_on("inventory", func(e):
		ui.update_inventory(e)
		hud.render_potions())
	_on("upgradeResult", func(e): ui.show_upgrade_result(e))
	_on("xpGained", func(e):
		if local:
			Fx.floating_text(sorted, local.view.x, local.view.head_y - 6, "+%d XP" % int(e.amount), Color("#c49bff")))
	_on("levelUp", func(e):
		var view := view_for(String(e.sessionId), "player")
		if view:
			Fx.floating_text(sorted, view.x, view.head_y - 4, "SEVİYE ATLADI!", Color("#ffd34d"), true)
		if String(e.sessionId) == room.session_id:
			hud.show_message("Seviye %d!" % int(e.level), "level")
			ui.refresh_quests()
			ui.refresh_item_levels(int(e.level))
			refresh_target_frame())


# ---- Targeting & skills ----

func select_target(id: String, attack: bool, notify := true) -> void:
	var previous := target_id
	if local and f(local.state, "dead", false) and not id.is_empty():
		return
	target_id = id
	if notify:
		room.send("setTarget", {"targetId": id if not id.is_empty() else null, "attack": attack})
	if not previous.is_empty() and previous != id:
		refresh_mob_health(previous)
	if not id.is_empty():
		refresh_mob_health(id)
	draw_target_ring()
	refresh_target_frame()


func draw_target_ring() -> void:
	var is_player := players.has(target_id)
	_ring_color = (ENEMY_PLAYER_COLOR if is_enemy_player(target_id) else FRIENDLY_COLOR) if is_player else HOSTILE_COLOR
	_target_ring.queue_redraw()


func cycle_target() -> void:
	if local == null:
		return
	var candidates: Array = []
	for id in mobs:
		var d: float = local.view.position.distance_to(mobs[id].view.position)
		if d <= GameData.TAB_TARGET_RANGE:
			candidates.append({"id": id, "dist": d})
	for id in players:
		var p: Remote = players[id]
		if not f(p.state, "dead", false) and is_enemy_player(id):
			var d: float = local.view.position.distance_to(p.view.position)
			if d <= GameData.TAB_TARGET_RANGE:
				candidates.append({"id": id, "dist": d})
	if candidates.is_empty():
		return
	candidates.sort_custom(func(a, b): return a.dist < b.dist)
	var index := -1
	for i in candidates.size():
		if candidates[i].id == target_id:
			index = i
	select_target(candidates[(index + 1) % candidates.size()].id, false)


func _hotbar_file() -> String:
	return "user://hotbar.cfg"


func load_hotbar_layout(name: String, cls: String) -> Array:
	var skills: Array = GameData.class_of(cls).get("skills", [])
	var layout: Array = skills.duplicate()
	var cfg := ConfigFile.new()
	if cfg.load(_hotbar_file()) == OK and cfg.has_section_key("hotbar", name):
		var saved: Array = cfg.get_value("hotbar", name)
		layout = []
		for id in saved:
			layout.append(id if (id is String and id in skills) else "")
	var out := []
	for i in HOTBAR_SLOTS:
		out.append(layout[i] if i < layout.size() else "")
	return out


func save_hotbar_layout(name: String, layout: Array) -> void:
	var cfg := ConfigFile.new()
	cfg.load(_hotbar_file())
	cfg.set_value("hotbar", name, layout)
	cfg.save(_hotbar_file())


func rebuild_hotbar(cls: String) -> void:
	var name := String(f(local.state, "name", "")) if local else ""
	if hotbar_layout.is_empty():
		hotbar_layout = load_hotbar_layout(name, cls)
	hotbar = []
	for id in hotbar_layout:
		var skill := GameData.skill(String(id)) if not String(id).is_empty() else {}
		if skill.is_empty():
			hotbar.append({"kind": "empty"})
		else:
			hotbar.append({"kind": "skill", "skill": skill, "locked": ui.skill_rank(String(id)) == 0})
	hud.init_hotbar(hotbar, ui.count_item, func(index, slot): ui.hotbar_tooltip(index, slot, hotbar, self), func(index, drag):
		var skills: Array = GameData.class_of(cls).get("skills", [])
		if not (drag.skillId in skills):
			return
		var layout := hotbar_layout.duplicate()
		if drag.has("from") and drag.from != null:
			var from := int(drag.from)
			var tmp = layout[index]
			layout[index] = layout[from]
			layout[from] = tmp
		else:
			var old := layout.find(drag.skillId)
			if old != -1:
				layout[old] = ""
			layout[index] = drag.skillId
		set_hotbar_layout(cls, layout), func(index):
		var layout := hotbar_layout.duplicate()
		layout[index] = ""
		set_hotbar_layout(cls, layout))


func set_hotbar_layout(cls: String, layout: Array) -> void:
	hotbar_layout = layout
	save_hotbar_layout(String(f(local.state, "name", "")) if local else "", layout)
	rebuild_hotbar(cls)


func use_hotbar(index: int) -> void:
	if index < 0 or index >= hotbar.size():
		return
	var entry: Dictionary = hotbar[index]
	if entry.kind == "empty":
		return
	if entry.get("locked", false):
		hud.show_message("%s öğrenilmedi: Yetenekler (K)" % entry.skill.name)
		return
	hud.flash_slot(index)
	var effect: Dictionary = entry.skill.get("effect", {})
	var aimed: bool = effect.get("type") == "dash" and effect.get("mode") == "forward"
	var msg := {"skillId": entry.skill.id}
	if aimed:
		var aim := get_global_mouse_position()
		msg.aim = {"x": aim.x, "y": aim.y}
	room.send("useSkill", msg)


func use_potion(index: int) -> void:
	var def_id := hud.potion_at(index)
	if def_id.is_empty():
		return
	hud.flash_potion(index)
	room.send("useItem", {"defId": def_id})


# ---- Loot & NPCs ----

func can_loot(item: Schema.Struct) -> bool:
	var owner := String(f(item, "owner", ""))
	return owner.is_empty() or owner == room.session_id or (party.id != null and owner == "party:%s" % party.id)


func is_enemy_player(session_id: String) -> bool:
	if session_id.is_empty():
		return false
	if session_id == duel_opponent:
		return true
	return bool(zone.get("pvp", false)) and session_id != room.session_id and not party.sessions.has(session_id)


func refresh_hostility() -> void:
	for sid in players:
		players[sid].view.set_name_color(Color("#ff6b6b") if is_enemy_player(sid) else Color.WHITE)
	draw_target_ring()
	refresh_target_frame()


func on_party_update(e: Dictionary) -> void:
	var sessions := {}
	for m in e.get("members", []):
		if m.get("online", false) and m.get("zone") == zone_id and m.get("sessionId"):
			sessions[String(m.sessionId)] = true
	var changed: bool = e.get("partyId") != party.id or sessions.size() != party.sessions.size()
	for s in sessions:
		if not party.sessions.has(s):
			changed = true
	party = {"id": e.get("partyId"), "sessions": sessions}
	ui.render_party(e, String(f(local.state, "name", "")) if local else "", zone_id, self)
	if not changed:
		return
	for id in loot:
		loot[id].sync.call()
	refresh_hostility()


func talk_to(npc: Dictionary) -> void:
	if local == null or f(local.state, "dead", false):
		return
	if local.view.position.distance_to(Vector2(float(npc.x), float(npc.y))) > GameData.NPC_RANGE:
		hud.show_message("Çok uzak")
		return
	ui.close_npc_windows()
	if ui.open_npc_dialog(npc):
		return
	open_npc_window(npc)


func open_npc_window(npc: Dictionary) -> void:
	ui.close_npc_dialog()
	if ui.open_npc_window(npc):
		ui.toggle_inventory(true)


func refresh_npc_markers() -> void:
	for m in npc_markers:
		var marker: Variant = ui.npc_marker(String(m.npc.id))
		m.label.text = String(marker.text) if marker else ""
		if marker:
			m.label.label_settings.font_color = Color(String(marker.color))


func portal_open(def: Dictionary) -> bool:
	return not def.get("requiresClear", false) or bool(room.state.get_field("cleared", false))


func walk_to(target: Callable, range: float, act: Callable) -> void:
	if local == null or leaving or f(local.state, "dead", false):
		return
	var at = target.call()
	if at == null:
		return
	if local.curr.distance_to(at) <= range:
		approach = null
		act.call()
		return
	approach = {"target": target, "range": range, "act": act, "last": local.curr, "stuck": 0}


func approach_axis() -> Vector2i:
	if approach == null:
		return Vector2i.ZERO
	var at = approach.target.call()
	if at == null or f(local.state, "dead", false):
		approach = null
		return Vector2i.ZERO
	if local.curr.distance_to(at) <= approach.range:
		var act: Callable = approach.act
		approach = null
		act.call()
		return Vector2i.ZERO
	if local.curr.distance_to(approach.last) < 0.5:
		approach.stuck += 1
	else:
		approach.stuck = 0
	approach.last = local.curr
	if approach.stuck > 8:
		approach = null
		hud.show_message("Oraya yol yok")
		return Vector2i.ZERO
	var axis := func(d: float) -> int: return 1 if d > 3 else (-1 if d < -3 else 0)
	return Vector2i(axis.call(at.x - local.curr.x), axis.call(at.y - local.curr.y))


func show_ping(e: Dictionary) -> void:
	var styles := {"alert": ["#ffd43b", "!", "Dikkat"], "attack": ["#ff6b6b", "⚔", "Saldır"], "help": ["#74c0fc", "✚", "Yardım"], "move": ["#8ce99a", "➜", "Buraya"]}
	var style: Array = styles.get(String(e.kind), styles.alert)
	var color := Color(style[0])
	var at := Vector2(float(e.x), float(e.y))
	pings.append({"x": at.x, "y": at.y, "until": Time.get_ticks_msec() + 4000})
	var ring := Depth.Painter.new()
	var pulse := [0.0]
	ring.painter = func(ci: CanvasItem): Depth.stroke_ellipse(ci, 0, 0, 8 + pulse[0] * 36, 4 + pulse[0] * 18, Color(color, 1.0 - pulse[0]), 2)
	var rw := Depth.wrap(sorted, ring)
	Depth.place(rw, at.x, at.y - 2, at.y + 0.5)
	var t := ring.create_tween().set_loops(4)
	t.tween_method(func(v): pulse[0] = v; ring.queue_redraw(), 0.0, 1.0, 0.7)
	var marker := Node2D.new()
	var diamond := Depth.Painter.new(func(ci: CanvasItem):
		var pts := PackedVector2Array([Vector2(0, -10), Vector2(10, 0), Vector2(0, 10), Vector2(-10, 0)])
		ci.draw_colored_polygon(pts, Color(0.078, 0.047, 0.024, 0.85))
		pts.append(pts[0])
		ci.draw_polyline(pts, color, 1.5))
	marker.add_child(diamond)
	var icon := Label.new()
	icon.text = style[1]
	icon.label_settings = Fonts.label_settings(Fonts.serif(true), 11, color)
	icon.size = Vector2(20, 14)
	icon.position = Vector2(-10, -8)
	icon.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	marker.add_child(icon)
	var text := Label.new()
	text.text = "%s: %s%s" % [e.from, style[2], (" (%s)" % e.target) if e.get("target") else ""]
	text.label_settings = Fonts.label_settings(Fonts.title(true), 7, color, 2, Color.BLACK)
	text.size = Vector2(160, 10)
	text.position = Vector2(-80, 14)
	text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	marker.add_child(text)
	var mw := Depth.wrap(sorted, marker)
	Depth.place(mw, at.x, at.y - 22, 100000)
	var bob := marker.create_tween().set_loops(6)
	bob.tween_property(marker, "position:y", marker.position.y - 3, 0.3)
	bob.tween_property(marker, "position:y", marker.position.y, 0.3)
	get_tree().create_timer(3.6).timeout.connect(func():
		if is_instance_valid(mw):
			var fade := mw.create_tween().set_parallel()
			fade.tween_property(mw, "modulate:a", 0.0, 0.4)
			fade.tween_property(rw, "modulate:a", 0.0, 0.4)
			fade.chain().tween_callback(func(): mw.queue_free(); rw.queue_free()))
	hud.chat.add_message({"channel": "party", "text": "%s%s" % [style[2], (" (%s)" % e.target) if e.get("target") else ""], "from": e.from})


func player_cursor(session_id: String, p: Schema.Struct) -> String:
	if not String(f(p, "stall", "")).is_empty():
		return "trade"
	return "attack" if is_enemy_player(session_id) else "pointer"


func own_town_portal(portal_id: String) -> Variant:
	var portal = town_portals.get(portal_id)
	if portal and local and String(f(portal.state, "owner", "")) == String(f(local.state, "name", "")):
		return portal
	return null


func use_town_portal(portal_id: String) -> void:
	if local == null or f(local.state, "dead", false) or leaving:
		return
	var portal = own_town_portal(portal_id)
	if portal == null:
		hud.show_message("Bu portal senin değil")
		return
	if local.view.position.distance_to(pos_of(portal.state)) > GameData.PORTAL_RANGE:
		hud.show_message("Çok uzak")
		return
	room.send("useTownPortal", {"portalId": portal_id})


func use_portal(def: Dictionary) -> void:
	if local == null or f(local.state, "dead", false) or leaving or not portal_open(def):
		return
	if local.view.position.distance_to(Vector2(float(def.x), float(def.y))) > GameData.PORTAL_RANGE:
		hud.show_message("Çok uzak")
		return
	room.send("usePortal", {"portalId": def.id})


## The server let us through a portal: light takes us away, then the next zone loads.
func teleport(event: Dictionary) -> void:
	if leaving:
		return
	leaving = true
	ui.close_browse()
	if local == null:
		transfer.emit(event)
		return
	Fx.beam(sorted, local.view.position, true, 0.45)
	var t := create_tween().set_parallel()
	t.tween_property(local.view.sprite, "scale", Vector2(0.2, 1.4), 0.45).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	t.tween_property(local.view.sprite, "modulate:a", 0.0, 0.45)
	_fade_out(func(): transfer.emit(event))


var _fade: ColorRect


func _fade_rect() -> ColorRect:
	if _fade == null:
		var layer := CanvasLayer.new()
		layer.layer = 5
		add_child(layer)
		_fade = ColorRect.new()
		_fade.color = Color8(215, 235, 255, 0)
		_fade.set_anchors_preset(Control.PRESET_FULL_RECT)
		_fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
		layer.add_child(_fade)
	return _fade


func _fade_out(done: Callable) -> void:
	var r := _fade_rect()
	var t := r.create_tween()
	t.tween_property(r, "color:a", 1.0, 0.5)
	t.tween_callback(done)


func _fade_in() -> void:
	var r := _fade_rect()
	r.color.a = 1.0
	r.create_tween().tween_property(r, "color:a", 0.0, 0.6)


func check_gates() -> void:
	var gates: Array = portals.filter(func(p): return p.def.get("auto", false) and portal_open(p.def))
	if gates.is_empty() or leaving or f(local.state, "dead", false):
		return
	var nearest := INF
	for g in gates:
		nearest = minf(nearest, local.view.position.distance_to(Vector2(float(g.def.x), float(g.def.y))))
	if not gates_armed:
		gates_armed = nearest > GameData.AUTO_GATE_RANGE * 2.5
		return
	for g in gates:
		if local.view.position.distance_to(Vector2(float(g.def.x), float(g.def.y))) <= GameData.AUTO_GATE_RANGE:
			gates_armed = false
			use_portal(g.def)
			return


func browse_stall(seller_id: String) -> void:
	var seller: Remote = players.get(seller_id)
	if local == null or seller == null or String(f(seller.state, "stall", "")).is_empty():
		return
	if local.view.position.distance_to(seller.view.position) > GameData.STALL_RANGE:
		hud.show_message("Tezgâha çok uzaksın")
		return
	room.send("stallBrowse", {"sellerId": seller_id})


func sync_stall(session_id: String, p: Schema.Struct) -> void:
	var title := String(f(p, "stall", ""))
	var existing = stalls.get(session_id)
	if existing and existing.title == title:
		return
	remove_stall_view(session_id)
	if title.is_empty():
		return
	var x := roundf(float(f(p, "x")))
	var y := roundf(float(f(p, "y")))
	var back := Depth.Painter.new(func(ci: CanvasItem):
		ci.draw_rect(Rect2(-12, -6, 24, 8), Depth.c(0x8c2f39))
		ci.draw_rect(Rect2(-12, -6, 24, 1), Depth.c(0xe0a83f))
		ci.draw_rect(Rect2(-12, 1, 24, 1), Depth.c(0xe0a83f))
		ci.draw_rect(Rect2(-12, -30, 2, 26), Depth.c(0x5b3a1e))
		ci.draw_rect(Rect2(10, -30, 2, 26), Depth.c(0x5b3a1e))
		for i in 6:
			ci.draw_rect(Rect2(-14 + i * 5, -34, 5, 6), Depth.c(0xf2efe6 if i % 2 else 0xc92a2a))
		ci.draw_rect(Rect2(-14, -28, 30, 1), Color(0, 0, 0, 0.25)))
	var bw := Depth.wrap(sorted, back)
	Depth.place(bw, x, y, y - 0.5)
	var sign := Label.new()
	sign.text = title
	var ls := Fonts.label_settings(Fonts.title(true), 9, Color("#2a1a08"))
	sign.label_settings = ls
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color("#e8c46a")
	bg.content_margin_left = 3
	bg.content_margin_right = 3
	bg.content_margin_top = 1
	bg.content_margin_bottom = 1
	sign.add_theme_stylebox_override("normal", bg)
	var holder := Node2D.new()
	holder.add_child(sign)
	sign.reset_size()
	sign.position = Vector2(-sign.size.x / 2.0, -sign.size.y)
	var sw := Depth.wrap(sorted, holder)
	Depth.place(sw, x, y - 40, 200000 + y)
	if session_id != room.session_id:
		sign.mouse_filter = Control.MOUSE_FILTER_STOP
		sign.gui_input.connect(func(ev):
			if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT and not ev.alt_pressed:
				walk_to(func(): return players[session_id].view.position if players.has(session_id) else null, GameData.STALL_RANGE - 4, func(): browse_stall(session_id)))
	stalls[session_id] = {"title": title, "back": bw, "sign": sw}
	if session_id == target_id:
		select_target("", false)


func remove_stall_view(session_id: String) -> void:
	var v = stalls.get(session_id)
	if v == null:
		return
	v.back.queue_free()
	v.sign.queue_free()
	stalls.erase(session_id)


func on_market_tile() -> bool:
	if local == null or f(local.state, "dead", false):
		return false
	if not zone.get("market", false):
		return false
	var at := local.view.position
	var near := func(p: Vector2) -> bool: return p.distance_to(at) < GameData.TILE_SIZE * 2.5
	for p in zone.get("portals", []):
		if near.call(Vector2(float(p.x), float(p.y))):
			return false
	for id in zone.get("npcs", []):
		var npc := GameData.npc(String(id))
		if not npc.is_empty() and near.call(Vector2(float(npc.x), float(npc.y))):
			return false
	return true


func show_boss_cast(e: Dictionary) -> void:
	last_casts[String(e.mobId)] = e
	var fill := [0.0]
	var painter: Callable
	var node := Depth.Painter.new()
	if e.ability == "charge":
		var dx := float(e.get("toX", e.x)) - float(e.x)
		var dy := float(e.get("toY", e.y)) - float(e.y)
		var length := sqrt(dx * dx + dy * dy)
		var width := float(e.get("width", 20))
		node.rotation = atan2(dy, dx)
		painter = func(ci: CanvasItem):
			ci.draw_rect(Rect2(0, -width / 2, length, width), Color(1, 0.125, 0.125, 0.15))
			ci.draw_rect(Rect2(0, -width / 2, length * fill[0], width), Color(1, 0.125, 0.125, 0.35))
			ci.draw_rect(Rect2(0, -width / 2, length, width), Color(1, 0.25, 0.25, 0.9), false, 1)
	else:
		var radius := float(e.get("radius", 40))
		painter = func(ci: CanvasItem):
			Depth.fill_ellipse(ci, 0, 0, radius * 2, radius, Color(1, 0.125, 0.125, 0.15))
			Depth.fill_ellipse(ci, 0, 0, radius * 2 * fill[0], radius * fill[0], Color(1, 0.125, 0.125, 0.35))
			Depth.stroke_ellipse(ci, 0, 0, radius * 2, radius, Color(1, 0.25, 0.25, 0.9), 1)
	node.painter = painter
	var w := Depth.wrap(sorted, node)
	Depth.place(w, roundf(float(e.x)), roundf(float(e.y)) - 2, 0.5)
	var t := node.create_tween()
	t.tween_method(func(v): fill[0] = v; node.queue_redraw(), 0.0, 1.0, float(e.castMs) / 1000.0)
	t.tween_callback(w.queue_free)
	var boss: Remote = mobs.get(String(e.mobId))
	if boss == null:
		return
	Fx.floating_text(sorted, boss.view.x, boss.view.head_y - 2, "!!", Color("#ff3b3b"), true)
	if e.ability == "leap":
		boss.view.play_action("jump", int(e.castMs) + 400)
		boss.view.rise(40, float(e.castMs) * 0.6)


func refresh_boss_bar() -> void:
	var boss: Remote = mobs.get(boss_id) if not boss_id.is_empty() else null
	if boss == null or local == null or local.view.position.distance_to(boss.view.position) > GameData.TILE_SIZE * 14 or int(f(boss.state, "hp")) <= 0:
		hud.set_boss_bar(null)
		boss_music.set_boss("")
		return
	boss_music.set_boss(String(f(boss.state, "kind", "")))
	hud.set_boss_bar({"name": GameData.mob(String(f(boss.state, "kind", ""))).get("name", "?"), "hp": int(f(boss.state, "hp")), "maxHp": int(f(boss.state, "maxHp", 1)), "enraged": bool(f(boss.state, "enraged", false))})


## E: a portal, a town portal, an NPC, a stall, otherwise the nearest chest.
func interact() -> void:
	if local == null:
		return
	var at := local.view.position
	for p in portals:
		if portal_open(p.def) and at.distance_to(Vector2(float(p.def.x), float(p.def.y))) <= GameData.PORTAL_RANGE:
			use_portal(p.def)
			return
	for id in town_portals:
		if own_town_portal(id) and at.distance_to(pos_of(town_portals[id].state)) <= GameData.PORTAL_RANGE:
			use_town_portal(id)
			return
	for id in zone.get("npcs", []):
		var npc := GameData.npc(String(id))
		if not npc.is_empty() and at.distance_to(Vector2(float(npc.x), float(npc.y))) <= GameData.NPC_RANGE:
			talk_to(npc)
			return
	for sid in players:
		var p: Remote = players[sid]
		if not String(f(p.state, "stall", "")).is_empty() and at.distance_to(p.view.position) <= GameData.STALL_RANGE:
			browse_stall(sid)
			return
	var nearest := ""
	var best := INF
	for id in loot:
		if not can_loot(loot[id].state):
			continue
		var d: float = at.distance_to(loot[id].view.position)
		if d <= GameData.LOOT_RANGE and d < best:
			best = d
			nearest = id
	if not nearest.is_empty():
		room.send("pickupLoot", {"lootId": nearest})


# ---- UI sync ----

func refresh_local_ui() -> void:
	if local == null:
		return
	var p := local.state
	var cls := GameData.class_of(String(f(p, "cls", "novice")))
	var level := int(f(p, "level", 1))
	hud.update_player_frame({
		"name": f(p, "name", ""), "level": level,
		"hp": int(f(p, "hp")), "maxHp": int(f(p, "maxHp", 1)),
		"resource": int(f(p, "resource")), "maxResource": int(f(p, "maxResource", 100)),
		"resourceType": cls.get("resource", "rage"), "shield": int(f(p, "shield")),
		"xp": int(f(p, "xp")), "xpToNext": GameData.xp_to_next_level(level),
	})
	var dead: bool = f(p, "dead", false)
	hud.set_death_panel(dead)
	local.view.set_dimmed(dead)
	local.view.set_ghost(f(p, "protected", false))
	local.view.set_base_tint(_status_tint(p, false))
	ui.set_pvp_stats({"rating": f(p, "pvpRating"), "kills": f(p, "pvpKills"), "deaths": f(p, "pvpDeaths")} if zone.get("pvp", false) else null)
	local.view.set_health(float(f(p, "hp")), float(f(p, "maxHp", 1)), float(f(p, "hp")) < float(f(p, "maxHp", 1)) and not dead)
	local.view.set_weapon(String(f(p, "weapon", "")), int(f(p, "weaponPlus", 0)))
	local.view.set_look(player_appearance(p))
	sync_mount(local.view, f(p, "mounted", false), String(f(p, "horseLook", "")), String(f(p, "horse", "village")))
	local.view.set_seated(f(p, "seated", false))
	if f(p, "seated", false) and local.dir != int(f(p, "dir")):
		local.dir = int(f(p, "dir"))
		local.view.set_animation(local.dir, false)
	local.view.set_gm_tag(f(p, "gm", false))
	hud.set_mount_button(not (zone.get("instanced", false) or zone.get("pvp", false)), f(p, "mounted", false))
	if dead and not target_id.is_empty():
		select_target("", false, false)
	if dead:
		ui.close_npc_windows()


func refresh_mob_health(mob_id: String) -> void:
	var mob: Remote = mobs.get(mob_id)
	if mob == null:
		return
	var hp := float(f(mob.state, "hp"))
	var max_hp := float(f(mob.state, "maxHp", 1))
	mob.view.set_health(hp, max_hp, hp < max_hp or mob_id == target_id)


func refresh_target_frame() -> void:
	var friend: Remote = players.get(target_id) if not target_id.is_empty() else null
	if friend:
		var s := friend.state
		var name := String(f(s, "name", ""))
		var enemy := is_enemy_player(target_id)
		hud.set_target_frame({
			"name": name, "level": int(f(s, "level", 1)), "hp": int(f(s, "hp")), "maxHp": int(f(s, "maxHp", 1)),
			"color": Color("#ff6b6b") if enemy else Color("#4cd964"),
			"subtitle": GameData.class_of(String(f(s, "cls", "novice"))).get("name", ""),
			"invite": not party.sessions.has(target_id),
			"duel": not zone.get("pvp", false) and duel_opponent.is_empty(),
			"trade": not enemy and not ui.is_trade_open(),
			"friend": not ui.is_friend_or_pending(name),
		})
		return
	var mob: Remote = mobs.get(target_id) if not target_id.is_empty() else null
	if mob == null or local == null:
		hud.set_target_frame(null)
		return
	var def := GameData.mob(String(f(mob.state, "kind", "")))
	var aggro_id := String(f(mob.state, "aggroId", ""))
	var aggro = player_state(aggro_id) if not aggro_id.is_empty() else null
	var subtitle = "Gece yaratığı" if def.get("nightOnly", false) else ("Gece gücü" if f(mob.state, "empowered", false) else null)
	var data := {
		"name": def.get("name", "?"), "level": int(f(mob.state, "level", 1)),
		"hp": int(f(mob.state, "hp")), "maxHp": int(f(mob.state, "maxHp", 1)),
		"color": GameData.level_color(int(f(mob.state, "level", 1)), int(f(local.state, "level", 1))),
	}
	if subtitle:
		data.subtitle = subtitle
	if aggro:
		data.aggro = f(aggro, "name", "")
	hud.set_target_frame(data)


func _on_target_action(action: String) -> void:
	var friend: Remote = players.get(target_id)
	if friend == null:
		return
	var name := String(f(friend.state, "name", ""))
	match action:
		"invite":
			room.send("chat", {"text": "/davet %s" % name})
		"duel":
			room.send("chat", {"text": "/duello %s" % name})
		"trade":
			room.send("chat", {"text": "/takas %s" % name})
		"friend":
			room.send("friendRequest", {"name": name})


func view_for(id: String, kind: String) -> EntityView:
	if kind == "mob":
		return mobs[id].view if mobs.has(id) else null
	if kind == "minion":
		return minions[id].view if minions.has(id) else null
	if id == room.session_id:
		return local.view if local else null
	return players[id].view if players.has(id) else null


func player_state(session_id: String) -> Schema.Struct:
	if session_id == room.session_id:
		return local.state if local else null
	return players[session_id].state if players.has(session_id) else null


func show_attack(e: Dictionary) -> void:
	var source := view_for(String(e.sourceId), String(e.sourceKind))
	if source == null:
		return
	var skill_id := String(e.get("skill", "")) if e.get("skill") != null else ""
	if skill_id == "slam" or skill_id == "leap":
		var cast = last_casts.get(String(e.sourceId))
		var at: Vector2 = Vector2(float(cast.x), float(cast.y)) if cast else source.position
		var radius := float(cast.get("radius", 48)) if cast else 48.0
		if skill_id == "leap":
			source.land()
		Fx.ring(sorted, at.x, at.y - 2, Depth.c(0xff3b3b), radius)
		if local and local.view.position.distance_to(at) < radius * 2:
			_shake(0.18, 0.006)
			hud.slosh_globes()
		return
	if skill_id == "charge":
		source.play_action("slide", 450)
		return
	var skill := GameData.skill(skill_id) if not skill_id.is_empty() else {}
	if not skill.is_empty() and skill.effect.get("type") == "dash" and e.get("fromX") != null:
		if String(e.sourceId) == room.session_id:
			dash_glide = {"from": Vector2(float(e.fromX), float(e.fromY)), "start": Time.get_ticks_msec(), "ms": 160.0}
		show_dash(skill, Vector2(float(e.fromX), float(e.fromY)), source)
		return
	var target := view_for(String(e.targetId), String(e.targetKind)) if e.get("targetId") != null and e.get("targetKind") != null else null
	var caster := player_state(String(e.sourceId)) if e.sourceKind == "player" else null
	if not skill.is_empty() and skill.get("visual") != "melee" and skill.get("visual") != "spin":
		show_spell(skill, source, target)
	elif skill.is_empty() and caster and GameData.class_of(String(f(caster, "cls", "novice"))).get("autoAttack", {}).get("ranged", false) and target:
		if f(caster, "cls", "") == "archer":
			Fx.arrow_shot(sorted, source.position, target.position)
		else:
			Fx.projectile(sorted, source.position, target.position, Depth.c(CASTER_BOLT.get(String(f(caster, "cls", "")), 0xb197fc)), 2)
	else:
		var kind := "spin" if skill_id == "whirlwind" else ("heavy" if skill_id == "heroicStrike" else "normal")
		source.play_attack(kind, target.position if target else null)
	if local and target and String(e.sourceId) == room.session_id and not local.moving:
		local.dir = ZoneMap.direction_toward(target.x - local.view.x, target.y - local.view.y, local.dir)


func _shake(duration: float, intensity: float) -> void:
	var strength := intensity * get_viewport().get_visible_rect().size.x / camera.zoom.x
	var t := create_tween()
	var steps := int(duration / 0.03)
	for i in steps:
		t.tween_property(camera, "offset", Vector2(randf_range(-1, 1), randf_range(-1, 1)) * strength, 0.03)
	t.tween_property(camera, "offset", Vector2.ZERO, 0.03)


func show_dash(skill: Dictionary, from: Vector2, view: EntityView) -> void:
	var color := Color(String(skill.color))
	Fx.burst(sorted, from, color, 10)
	get_tree().create_timer(0.14).timeout.connect(func():
		if not is_instance_valid(view) or view._destroyed:
			return
		var at := view.position
		if skill.get("visual") == "leap":
			Fx.ring(sorted, at.x, at.y - 2, color, float(skill.effect.get("landRadius", 30)))
			if local and local.view.position.distance_to(at) < 120:
				_shake(0.14, 0.004)
		else:
			Fx.burst(sorted, at, color, 10)
		if skill.get("visual") == "charge":
			view.play_attack("heavy"))


func show_spell(skill: Dictionary, source: EntityView, target: EntityView) -> void:
	if skill.get("target") == "enemy" and target == null:
		return
	var at := target.position if target else source.position
	var effect: Dictionary = skill.get("effect", {})
	var radius := float(effect.get("radius", 40))
	match String(skill.get("visual", "")):
		"fireball":
			if target:
				Fx.projectile(sorted, source.position, target.position, Depth.c(0xff6b00), 3)
		"lightning":
			Fx.lightning(sorted, at)
		"frost":
			Fx.frost_ring(sorted, source.position, radius if effect.get("type") == "nova" else 40.0)
		"holy":
			Fx.holy_beam(sorted, at)
		"heal", "selfHeal":
			Fx.heal_sparkles(sorted, at)
		"shield":
			Fx.burst(sorted, at, Depth.c(0x74c0fc), 10)
		"drain":
			if target:
				Fx.projectile(sorted, target.position, source.position, Depth.c(0x51cf66), 3)
		"summon":
			Fx.burst(sorted, source.position, Depth.c(0x868e96), 12)
		"bone":
			Fx.bone_burst(sorted, source.position, radius if effect.get("type") == "whirlwind" else 40.0)
		"stun":
			if target:
				Fx.burst(sorted, target.position, Depth.c(0xffe066), 9)
				Fx.stun_stars(sorted, func(): return target.position if is_instance_valid(target) else at)
		"blast":
			if target:
				var r := radius if effect.get("type") == "blast" else 40.0
				Fx.projectile(sorted, source.position, target.position, Depth.c(0xff6b00), 3, func(): Fx.ring(sorted, at.x, at.y - 2, Depth.c(0xff6b00), r))
		"radiance":
			Fx.ring(sorted, source.x, source.y - 2, Depth.c(0xffd43b), radius if effect.get("type") == "radiance" else 40.0)
			Fx.heal_sparkles(sorted, source.position)
		"buff":
			Fx.burst(sorted, source.position, Color(String(skill.color)), 14)
			Fx.heal_sparkles(sorted, source.position)
		"shout":
			Fx.ring(sorted, source.x, source.y - 2, Depth.c(0xe03131), radius if effect.get("type") == "whirlwind" else 40.0)
		"guard":
			Fx.burst(sorted, source.position, Depth.c(0x74c0fc), 12)
		"arrow":
			if target:
				var stun: bool = effect.get("type") == "stun"
				Fx.arrow_shot(sorted, source.position, target.position, func(): if stun: Fx.stun_stars(sorted, func(): return target.position if is_instance_valid(target) else at))
		"volley":
			if target:
				Fx.arrow_volley(sorted, target.position, radius if effect.get("type") == "blast" else 40.0)
		"storm":
			Fx.storm_ring(sorted, source.position, radius if effect.get("type") == "whirlwind" else 40.0)
		"spirit":
			Fx.spirit_wisps(sorted, at)
			if effect.get("type") == "stun":
				Fx.stun_stars(sorted, func(): return at)
		"nature":
			if effect.get("type") == "radiance":
				Fx.ring(sorted, source.x, source.y - 2, Depth.c(0x40c057), radius)
				Fx.leaf_burst(sorted, source.position, radius)
				Fx.heal_sparkles(sorted, source.position)
			elif target:
				Fx.leaf_burst(sorted, target.position, 16)
				Fx.burst(sorted, target.position, Depth.c(0x2f9e44), 8)
		"roots":
			Fx.roots_ring(sorted, source.position, radius if effect.get("type") == "nova" else 40.0)


func show_cast_start(e: Dictionary) -> void:
	var skill := GameData.skill(String(e.skillId))
	var view := view_for(String(e.sourceId), "player")
	if skill.is_empty() or view == null:
		return
	if cast_glows.has(String(e.sourceId)):
		cast_glows[String(e.sourceId)].queue_free()
	var glow := Fx.casting_glow(sorted, Color(String(skill.color)))
	glow.set_meta("view", view)
	cast_glows[String(e.sourceId)] = glow
	if String(e.sourceId) == room.session_id:
		hud.start_cast_bar(String(skill.name), float(e.castMs), String(skill.color))


func show_cast_end(e: Dictionary) -> void:
	if cast_glows.has(String(e.sourceId)):
		cast_glows[String(e.sourceId)].queue_free()
		cast_glows.erase(String(e.sourceId))
	if String(e.sourceId) == room.session_id:
		hud.stop_cast_bar(bool(e.interrupted))


func show_chat(e: Dictionary) -> void:
	hud.chat.add_message(e)
	var view := view_for(String(e.fromSession), "player") if e.get("fromSession") else null
	if view == null or not Settings.get_value("speechBubbles"):
		return
	var text := String(e.text)
	speech_bubble(view, (text.substr(0, 57) + "…") if text.length() > 60 else text)


func speech_bubble(view: EntityView, text: String) -> void:
	var bubble := Label.new()
	bubble.text = text
	bubble.label_settings = Fonts.label_settings(Fonts.mono(), 7, Color("#1a1408"))
	bubble.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	bubble.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color("#fff8e1")
	bg.content_margin_left = 3
	bg.content_margin_right = 3
	bg.content_margin_top = 2
	bg.content_margin_bottom = 2
	bubble.add_theme_stylebox_override("normal", bg)
	var font: Font = Fonts.mono()
	var width := minf(116.0, font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 7).x + 8)
	bubble.custom_minimum_size = Vector2(width, 0)
	bubble.size = Vector2(width, 0)
	var holder := Node2D.new()
	holder.add_child(bubble)
	var w := Depth.wrap(sorted, holder)
	var follow := func():
		if is_instance_valid(view) and not view._destroyed and is_instance_valid(bubble):
			bubble.reset_size()
			bubble.position = Vector2(-bubble.size.x / 2.0, -bubble.size.y)
			Depth.place(w, roundf(view.x), roundf(view.head_y) - 12, 300000)
	follow.call()
	var timer := Timer.new()
	timer.wait_time = 0.016
	timer.timeout.connect(follow)
	w.add_child(timer)
	timer.start()
	get_tree().create_timer(4.5).timeout.connect(func():
		if is_instance_valid(w):
			var t := w.create_tween()
			t.tween_property(w, "modulate:a", 0.0, 0.3)
			t.tween_callback(w.queue_free))


## Arena only: the crown goes to the player here with the best PvP rating.
func update_crown() -> void:
	var best_id := ""
	var best_rating := -1
	var best_kills := -1
	if zone.get("pvp", false):
		var everyone: Array = []
		for sid in players:
			everyone.append([sid, players[sid].state])
		if local:
			everyone.append([room.session_id, local.state])
		for pair in everyone:
			var s: Schema.Struct = pair[1]
			var kills := int(f(s, "pvpKills"))
			if kills + int(f(s, "pvpDeaths")) == 0:
				continue
			var rating := int(f(s, "pvpRating"))
			if best_id.is_empty() or rating > best_rating or (rating == best_rating and kills > best_kills):
				best_id = pair[0]
				best_rating = rating
				best_kills = kills
	if local:
		local.view.set_crown(best_id == room.session_id)
	for sid in players:
		players[sid].view.set_crown(best_id == sid)


func toggle_mount() -> void:
	if local and not f(local.state, "dead", false) and not leaving:
		room.send("mount")


func sync_mount(view: EntityView, mounted: bool, look: String, breed: String) -> void:
	var changed := view.mounted != mounted
	view.set_mounted(mounted, look, breed)
	if changed:
		Fx.dust_puff(sorted, view.x, view.y)


var _fishing_lines := {}


func update_fishing() -> void:
	var present := {}
	var update_one := func(id: String, view: EntityView, s: Schema.Struct):
		present[id] = true
		var fishing: bool = f(s, "fishing", false)
		view.set_weapon_hidden(fishing)
		var line: Depth.Painter = _fishing_lines.get(id)
		if not fishing:
			if line:
				line.get_parent().queue_free()
				_fishing_lines.erase(id)
			return
		var float_at := Vector2(float(f(s, "fishX")), float(f(s, "fishY")))
		var hand := Vector2(view.x + (5 if view._facing != Dir.LEFT else -5), view.y - 9)
		if line == null:
			line = Depth.Painter.new()
			Depth.wrap(sorted, line)
			_fishing_lines[id] = line
		var bob := sin(Time.get_ticks_msec() / 300.0) * 0.6
		line.painter = func(ci: CanvasItem):
			var a := hand - float_at
			ci.draw_line(Vector2(a.x, a.y), Vector2(0, bob), Color(0.9, 0.9, 0.9, 0.7), 0.5)
			ci.draw_circle(Vector2(0, bob), 1.5, Depth.c(0xe03131))
			ci.draw_rect(Rect2(-1, bob - 2.5, 2, 1), Color.WHITE)
		line.queue_redraw()
		Depth.place(line.get_parent(), float_at.x, float_at.y, float_at.y)
	if local:
		update_one.call(room.session_id, local.view, local.state)
	for sid in players:
		update_one.call(sid, players[sid].view, players[sid].state)
	for id in _fishing_lines.keys():
		if not present.has(id):
			_fishing_lines[id].get_parent().queue_free()
			_fishing_lines.erase(id)
	if not zone.get("fishing", false) or local == null or f(local.state, "dead", false) or not String(f(local.state, "stall", "")).is_empty():
		ui.set_fish_button(null)
		return
	if f(local.state, "fishing", false):
		ui.set_fish_button(true)
		return
	var has_rod := ui.has_fishing_rod()
	var facing := Vector2(1 if local.dir == Dir.RIGHT else (-1 if local.dir == Dir.LEFT else 0), 1 if local.dir == Dir.DOWN else (-1 if local.dir == Dir.UP else 0))
	ui.set_fish_button(false if (has_rod and cast_spot(local.view.position, facing)) else null)


## fishing.ts castSpot(): is there water within reach (in front preferred)?
func cast_spot(at: Vector2, facing: Vector2) -> bool:
	var ts := float(GameData.TILE_SIZE)
	var reach := float(GameData.get_value("FISHING_REACH", ts * 1.75))
	var fx := at.x
	var fy := at.y - ts / 2.0
	var tx0 := int(floor(fx / ts))
	var ty0 := int(floor(fy / ts))
	for ty in range(ty0 - 2, ty0 + 3):
		for tx in range(tx0 - 2, tx0 + 3):
			if map.tile_at(tx, ty) != 3:
				continue
			var c := Vector2((tx + 0.5) * ts, (ty + 0.5) * ts)
			if c.distance_to(Vector2(fx, fy)) <= reach + ts / 2.0:
				return true
	return false


func show_catch(e: Dictionary) -> void:
	var is_local := String(e.sessionId) == room.session_id
	var view: EntityView = local.view if is_local and local else (players[e.sessionId].view if players.has(e.sessionId) else null)
	var s: Schema.Struct = local.state if is_local and local else (players[e.sessionId].state if players.has(e.sessionId) else null)
	var def := GameData.item(String(e.item))
	if view == null or def.is_empty():
		return
	Fx.burst(sorted, Vector2(float(f(s, "fishX")), float(f(s, "fishY")) + 7), Depth.c(0xa5d8ff), 6)
	var rarity_color: Color = UiTheme.RARITY.get(String(def.get("rarity", "common")), Color.WHITE)
	Fx.floating_text(sorted, view.x, view.head_y - 6, String(def.name), rarity_color, is_local and def.get("rarity") != "common")


func update_shield_bubble(session_id: String, view: EntityView, shield: int, guarded: bool) -> void:
	var bubble: Node2D = shield_bubbles.get(session_id)
	if shield <= 0 and not guarded:
		if bubble:
			bubble.queue_free()
			shield_bubbles.erase(session_id)
		return
	if bubble == null:
		var painter := Depth.Painter.new(func(ci: CanvasItem):
			Depth.fill_ellipse(ci, 0, 0, 20, 22, Depth.c(0x74c0fc, 0.18))
			Depth.stroke_ellipse(ci, 0, 0, 20, 22, Depth.c(0xa5d8ff, 0.9), 1))
		bubble = Depth.wrap(sorted, painter)
		shield_bubbles[session_id] = bubble
	Depth.place(bubble, roundf(view.x), roundf(view.y) - 8, view.y + 0.7)


func show_combat_event(e: Dictionary) -> void:
	var view := view_for(String(e.targetId), String(e.targetKind))
	if view == null:
		return
	if not e.get("heal", false):
		view.flash()
	var me := room.session_id
	if not Settings.get_value("damageNumbers") or (String(e.sourceId) != me and String(e.targetId) != me):
		return
	var y := view.head_y - 2
	var amount := int(e.amount)
	if e.get("heal", false):
		Fx.floating_text(sorted, view.x, y, "+%d" % amount, Color("#4cd964"))
	elif String(e.targetId) == me:
		Fx.floating_text(sorted, view.x, y, "-%d" % amount, Color("#ff5a5a"), bool(e.get("crit", false)))
	elif e.get("crit", false):
		Fx.floating_text(sorted, view.x, y, "%d!" % amount, Color("#ffd34d"), true)
	else:
		Fx.floating_text(sorted, view.x, y, str(amount), Color.WHITE)


# ---- Simulation ----

## Server reconciliation: start from the authoritative position and replay the inputs the
## server hasn't processed yet. Movement is deterministic, so this normally equals the prediction.
func reconcile(server: Schema.Struct) -> void:
	if local == null:
		return
	var last_seq := int(f(server, "lastSeq"))
	pending_inputs = pending_inputs.filter(func(i): return int(i.seq) > last_seq)
	var p := pos_of(server)
	var mounted: bool = f(server, "mounted", false)
	var bonus := GameData.horse_speed_bonus(String(f(server, "horse", "village")))
	for input in pending_inputs:
		p = map.step_movement(p.x, p.y, int(input.dx), int(input.dy), GameData.TICK_MS / 1000.0, mounted, input.get("sprint", false), bonus)
	if p.distance_to(local.curr) > TELEPORT_DISTANCE:
		local.prev = p
	local.curr = p


func refresh_minimap() -> void:
	if local == null:
		return
	var dots: Array = [{"x": local.view.x, "y": local.view.y, "kind": "self"}]
	for sid in players:
		var kind := "party" if party.sessions.has(sid) else ("enemy" if is_enemy_player(sid) else "player")
		dots.append({"x": players[sid].view.x, "y": players[sid].view.y, "kind": kind})
	for id in zone.get("npcs", []):
		var npc := GameData.npc(String(id))
		if not npc.is_empty():
			dots.append({"x": float(npc.x), "y": float(npc.y), "kind": "npc"})
	for p in zone.get("portals", []):
		dots.append({"x": float(p.x), "y": float(p.y), "kind": "portal"})
	var now := Time.get_ticks_msec()
	pings = pings.filter(func(p): return p.until > now)
	for p in pings:
		dots.append({"x": p.x, "y": p.y, "kind": "ping"})
	if guide:
		dots.append({"x": float(guide.place.x), "y": float(guide.place.y), "kind": "guide"})
	hud.minimap.draw_dots(dots)
	if ui.world_map.visible:
		ui.world_map.draw_dots(dots)


func sit_on(bench: Dictionary) -> void:
	if local == null:
		return
	var nearest := func():
		var best = null
		var best_d := INF
		for i in int(bench.w):
			var seat := Vector2((float(bench.tx) + i + 0.5) * GameData.TILE_SIZE, (float(bench.ty) + 1) * GameData.TILE_SIZE)
			var d := local.curr.distance_to(seat)
			if d < best_d:
				best_d = d
				best = seat
		return best
	walk_to(nearest, GameData.TILE_SIZE * 1.5, func(): room.send("sit", {"bench": bench.id}))


## A guard pointed the way: an arrow at our feet and a mark on the minimap.
func show_way(place: Dictionary) -> void:
	if guide:
		guide.arrow.get_parent().queue_free()
	guide = null
	if zone_id != "town":
		return
	var arrow := Depth.Painter.new(func(ci: CanvasItem):
		ci.draw_colored_polygon(PackedVector2Array([Vector2(9, 0), Vector2(-4, -6), Vector2(-4, 6)]), Color(0, 0, 0, 0.6))
		ci.draw_colored_polygon(PackedVector2Array([Vector2(7, 0), Vector2(-3, -4), Vector2(-3, 4)]), Depth.c(0xffd43b)))
	Depth.wrap(sorted, arrow)
	var t := arrow.create_tween().set_loops().set_trans(Tween.TRANS_SINE)
	t.tween_property(arrow, "modulate:a", 0.55, 0.5)
	t.tween_property(arrow, "modulate:a", 1.0, 0.5)
	guide = {"place": place, "until": Time.get_ticks_msec() + 90000, "arrow": arrow}


func update_guide() -> void:
	if guide == null or local == null:
		return
	var d := Vector2(float(guide.place.x), float(guide.place.y)) - local.view.position
	var arrived_there := d.length() < GameData.TILE_SIZE * 3
	if arrived_there or Time.get_ticks_msec() > guide.until:
		if arrived_there:
			hud.show_message("%s burada" % guide.place.name, "info", "#ffd43b")
		guide.arrow.get_parent().queue_free()
		guide = null
		return
	var angle := d.angle()
	var arrow: Node2D = guide.arrow
	arrow.rotation = angle
	Depth.place(arrow.get_parent(), roundf(local.view.x + cos(angle) * 18), roundf(local.view.y - 6 + sin(angle) * 14), 1e7 + 1)


func _process(delta: float) -> void:
	update_guide()
	_minimap_timer -= delta
	if _minimap_timer <= 0:
		_minimap_timer = 0.04
		refresh_minimap()
	_ping_timer -= delta
	if _ping_timer <= 0:
		_ping_timer = PING_INTERVAL
		room.send("ping", Time.get_ticks_usec() / 1000.0)
	# Fixed-step simulation at the server's tick rate; clamped so a stall doesn't burst.
	tick_acc = minf(tick_acc + delta * 1000.0, GameData.TICK_MS * 5)
	while tick_acc >= GameData.TICK_MS:
		fixed_tick()
		tick_acc -= GameData.TICK_MS
	if local:
		var alpha := tick_acc / GameData.TICK_MS
		var p := local.prev.lerp(local.curr, alpha)
		if dash_glide:
			var t := minf(1.0, (Time.get_ticks_msec() - dash_glide.start) / dash_glide.ms)
			var ease := 1.0 - (1.0 - t) * (1.0 - t)
			p = dash_glide.from.lerp(p, ease)
			if t >= 1.0:
				dash_glide = null
		local.view.set_position(p.x, p.y)
		local.view.set_animation(local.dir, local.moving)
		hud.set_world_position(p.x, p.y)
		camera.position = Vector2(roundf(p.x), roundf(p.y))
		check_gates()
		var in_market := on_market_tile()
		if in_market and not was_in_market:
			hud.show_message("Pazar alanı: burada tezgâh açıp eşya satabilirsin", "info", "#e8c33a")
		was_in_market = in_market
		ui.set_stall_button_visible(in_market)
		var seller_id := ui.browsing_seller()
		if not seller_id.is_empty():
			var seller: Remote = players.get(seller_id)
			if seller == null or local.view.position.distance_to(seller.view.position) > GameData.STALL_RANGE + GameData.TILE_SIZE:
				ui.close_browse()
		if not debug_keep_npc_windows:
			ui.close_far_npc_windows(local.view.position)
	refresh_boss_bar()
	if local:
		update_shield_bubble(room.session_id, local.view, int(f(local.state, "shield")), f(local.state, "guarded", false))
	for sid in players:
		update_shield_bubble(sid, players[sid].view, int(f(players[sid].state, "shield")), f(players[sid].state, "guarded", false))
	var render_time := SnapshotBuffer.now_ms() - SnapshotBuffer.INTERPOLATION_DELAY_MS
	for r in players.values():
		render_remote(r, render_time)
	for r in mobs.values():
		render_remote(r, render_time)
	for r in minions.values():
		render_remote(r, render_time)
	for r in pets.values():
		render_remote(r, render_time)
	for sid in cast_glows:
		var glow: Node2D = cast_glows[sid]
		var v: EntityView = glow.get_meta("view")
		if is_instance_valid(v):
			Depth.place(glow, roundf(v.x), roundf(v.y) - 1, 0.6)
	update_fishing()
	update_crown()
	var target: Remote = mobs.get(target_id, players.get(target_id)) if not target_id.is_empty() else null
	_target_ring.visible = target != null
	if target:
		Depth.place(_target_ring_w, roundf(target.view.x), roundf(target.view.y) - 1, 0)
	_apply_lamp_light()


func _apply_lamp_light() -> void:
	var light := func(view: EntityView):
		var l: Vector3 = night.light_at(view.x, view.y - 8)
		view.set_lighting(l.x, l.y, l.z)
	if local:
		light.call(local.view)
	for r in players.values():
		light.call(r.view)
	for r in mobs.values():
		light.call(r.view)
	for r in minions.values():
		light.call(r.view)
	for r in pets.values():
		light.call(r.view)
	for v in npc_views.values():
		light.call(v)


func _input_blocked() -> bool:
	return get_viewport().gui_get_focus_owner() is LineEdit or ui.menu_open()


func move_axis() -> Vector2i:
	if _input_blocked():
		return Vector2i.ZERO
	var dx := int(Input.is_action_pressed("move_right")) - int(Input.is_action_pressed("move_left"))
	var dy := int(Input.is_action_pressed("move_down")) - int(Input.is_action_pressed("move_up"))
	# The on-screen joystick (phones), when the keys are idle.
	if dx == 0 and dy == 0:
		return hud.virtual_axis
	return Vector2i(dx, dy)


func fixed_tick() -> void:
	if local == null:
		return
	local.prev = local.curr
	var axis := move_axis()
	if axis != Vector2i.ZERO:
		approach = null
	else:
		axis = approach_axis()
	var s := local.state
	if f(s, "dead", false) or f(s, "rooted", false) or not String(f(s, "stall", "")).is_empty() or leaving or axis == Vector2i.ZERO:
		local.moving = false
		local.view.set_gallop(false)
		return
	var mounted: bool = f(s, "mounted", false)
	var sprint := mounted and Input.is_action_pressed("sprint") and not _input_blocked()
	var input := {"seq": next_seq, "dx": axis.x, "dy": axis.y}
	if sprint:
		input.sprint = true
	next_seq += 1
	local.curr = map.step_movement(local.curr.x, local.curr.y, axis.x, axis.y, GameData.TICK_MS / 1000.0, mounted, sprint, GameData.horse_speed_bonus(String(f(s, "horse", "village"))))
	local.view.set_gallop(sprint)
	local.dir = ZoneMap.direction_from(axis.x, axis.y, local.dir)
	local.moving = true
	pending_inputs.append(input)
	room.send("input", input)


func render_remote(r: Remote, render_time: float) -> void:
	var sample := r.buffer.sample(render_time)
	if sample.is_empty():
		return
	var moved := absf(float(sample.x) - r.view.x) > 0.01 or absf(float(sample.y) - r.view.y) > 0.01
	r.view.set_position(float(sample.x), float(sample.y))
	r.view.set_animation(int(sample.dir), moved)


# ---- Keys ----

func _unhandled_input(event: InputEvent) -> void:
	# A second finger tapping the world (the first one may be on the joystick): touches after
	# the first don't become mouse clicks, so pick what is under it by hand.
	if event is InputEventScreenTouch and event.pressed and event.index > 0:
		_touch_pick(event.position)
		return
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT and event.alt_pressed:
		ui.open_ping_wheel(get_global_mouse_position(), func(kind): room.send("mapPing", {"kind": kind, "x": get_global_mouse_position().x, "y": get_global_mouse_position().y}))
		return
	if not (event is InputEventKey) or not event.pressed or event.echo:
		return
	if ui.menu_open() and not event.is_action("clear_target"):
		return
	for action in ["clear_target", "target_next", "attack", "inventory", "interact", "quest_log", "passive_tree", "skills", "friends", "leaderboard", "potion_1", "potion_2", "world_map", "mount", "town_portal"] + Keys.HOTBAR:
		if event.is_action(action):
			do_action(action)
			break
	get_viewport().set_input_as_handled()


## One game action, from a key or an on-screen button (Keys action names).
func do_action(action: String) -> void:
	if ui.menu_open() and action != "clear_target":
		return
	match action:
		"clear_target":
			if ui.menu_open():
				ui.menu_back()
			elif GameWindow.close_top():
				pass
			elif not target_id.is_empty():
				select_target("", false)
			else:
				ui.open_menu()
		"target_next":
			cycle_target()
		"attack":
			if not target_id.is_empty():
				select_target(target_id, true)
		"inventory":
			ui.toggle_inventory()
		"interact":
			interact()
		"quest_log":
			ui.toggle_quest_log()
		"passive_tree":
			ui.toggle_passives()
		"skills":
			ui.toggle_skills()
		"friends":
			ui.toggle_friends()
		"leaderboard":
			ui.toggle_leaderboard()
		"potion_1":
			use_potion(0)
		"potion_2":
			use_potion(1)
		"world_map":
			ui.toggle_world_map()
		"mount":
			toggle_mount()
		"town_portal":
			if local and not f(local.state, "dead", false) and not leaving:
				room.send("openTownPortal")
		"chat":
			hud.chat.set_active(true)
		_:
			var i := Keys.HOTBAR.find(action)
			if i != -1:
				use_hotbar(i)


func _touch_pick(screen_pos: Vector2) -> void:
	var world_pos := get_canvas_transform().affine_inverse() * screen_pos
	var query := PhysicsPointQueryParameters2D.new()
	query.position = world_pos
	query.collide_with_areas = true
	query.collide_with_bodies = false
	query.collision_mask = 1
	for hit in get_world_2d().direct_space_state.intersect_point(query, 8):
		var area: Area2D = hit.collider
		var click := InputEventMouseButton.new()
		click.button_index = MOUSE_BUTTON_LEFT
		click.pressed = true
		click.position = screen_pos
		area.input_event.emit(get_viewport(), click, 0)
		return
