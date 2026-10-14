shader_type canvas_item;

// Characters: modulate is Phaser's tint (multiply); `flash` is setTintFill(white) for hit flashes.
uniform float flash : hint_range(0.0, 1.0) = 0.0;

void fragment() {
	vec4 c = texture(TEXTURE, UV) * COLOR;
	COLOR = vec4(mix(c.rgb, vec3(1.0), flash), c.a);
}
