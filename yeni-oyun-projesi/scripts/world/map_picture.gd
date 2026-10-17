class_name MapPicture
extends RefCounted

## The zone as a picture for the minimap and the big map: a copy of its map scene (ground, props,
## everything but the characters) drawn once, scaled down, into an offscreen viewport when the
## zone is entered. Made from the scene itself, so it always shows the map as it is now.

## Texture pixels per map pixel (8 per tile: crisp in the minimap, sharp on the big map).
const SCALE := 0.5
## Neither side of the picture gets bigger than this (huge maps are drawn smaller).
const MAX_SIDE := 4096


## The picture of `scene_path` (null when the zone has no map scene). `host` is any node in the
## tree (the viewport lives under it for the few frames it takes).
static func render(host: Node, scene_path: String, size_px: Vector2, background: Color) -> ImageTexture:
	if not ResourceLoader.exists(scene_path):
		return null
	var scale := minf(SCALE, MAX_SIDE / maxf(size_px.x, size_px.y))
	var viewport := SubViewport.new()
	viewport.size = Vector2i(ceili(size_px.x * scale), ceili(size_px.y * scale))
	viewport.transparent_bg = false
	viewport.disable_3d = true
	viewport.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_LINEAR
	# Drawn every frame for a few frames: the tile layers build their pictures a frame late.
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var back := ColorRect.new()
	back.color = background
	back.size = Vector2(viewport.size)
	# Under everything: the map's ground layers sit at negative z indexes.
	back.z_index = RenderingServer.CANVAS_ITEM_Z_MIN
	viewport.add_child(back)
	var map: Node2D = (load(scene_path) as PackedScene).instantiate()
	map.scale = Vector2(scale, scale)
	viewport.add_child(map)
	host.add_child(viewport)
	for i in 4:
		await RenderingServer.frame_post_draw
	var image := viewport.get_texture().get_image()
	viewport.queue_free()
	if image == null or image.is_empty():
		return null
	image.generate_mipmaps()
	return ImageTexture.create_from_image(image)
