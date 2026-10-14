shader_type canvas_item;

// The +7..+10 weapon glow (Phaser preFX addGlow): a soft purple halo round the opaque pixels.
// The texture carries transparent padding so the halo has room.
uniform vec4 glow_color : source_color = vec4(0.65, 0.3, 1.0, 1.0);
uniform float strength = 2.0;
uniform float distance = 8.0;

void fragment() {
	vec4 c = texture(TEXTURE, UV);
	float halo = 0.0;
	for (int i = 0; i < 16; i++) {
		float a = 6.2831853 * float(i) / 16.0;
		vec2 dir = vec2(cos(a), sin(a));
		for (int s = 1; s <= 4; s++) {
			float r = distance * float(s) / 4.0;
			float t = texture(TEXTURE, UV + dir * r * TEXTURE_PIXEL_SIZE).a;
			halo = max(halo, t * (1.0 - r / (distance + 1.0)));
		}
	}
	float g = clamp(halo * strength * 0.3, 0.0, 1.0) * (1.0 - c.a);
	vec3 rgb = c.rgb * c.a + glow_color.rgb * g;
	float alpha = c.a + g;
	COLOR = vec4(alpha > 0.0 ? rgb / alpha : rgb, alpha) * COLOR;
}
