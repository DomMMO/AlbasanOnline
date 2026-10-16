shader_type canvas_item;

// Characters: modulate is the tint (multiply); `flash` fills the sprite white for hit flashes.
// In Godot 4 COLOR already is the texture times the modulate (sampling TEXTURE again here would
// multiply the picture by itself and darken it).
uniform float flash : hint_range(0.0, 1.0) = 0.0;

void fragment() {
	COLOR = vec4(mix(COLOR.rgb, vec3(1.0), flash), COLOR.a);
}
