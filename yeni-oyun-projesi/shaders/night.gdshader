shader_type canvas_item;
render_mode blend_mul, unshaded;

// The night (client/src/fx/nightLights.ts NightLayer): the scene multiplied by a deep blue, with
// warm pools cut out round the lights: the night colour with a radial gradient erased and
// drawn again tinted for every light, multiplied over the scene, computed per pixel.

uniform vec2 view_origin;
uniform vec2 view_size;
uniform vec3 night = vec3(1.0);
uniform int count = 0;
// x, y, radius, erase strength
uniform vec4 lights[64];
// tint rgb, tint strength
uniform vec4 tints[64];

// The light stamp: stops 0 -> 1, 0.35 -> 0.85, 0.7 -> 0.3, 1 -> 0.
float stamp(float d) {
	if (d >= 1.0) return 0.0;
	if (d < 0.35) return mix(1.0, 0.85, d / 0.35);
	if (d < 0.7) return mix(0.85, 0.3, (d - 0.35) / 0.35);
	return mix(0.3, 0.0, (d - 0.7) / 0.3);
}

void fragment() {
	vec2 p = view_origin + UV * view_size;
	vec3 premul = night;
	float alpha = 1.0;
	for (int i = 0; i < count; i++) {
		vec4 l = lights[i];
		float d = distance(p, l.xy);
		if (d >= l.z) continue;
		float e = stamp(d / l.z) * l.w;
		premul *= 1.0 - e;
		alpha *= 1.0 - e;
		float a = stamp(d / (l.z * 0.8)) * tints[i].a;
		premul = tints[i].rgb * a + premul * (1.0 - a);
		alpha = a + alpha * (1.0 - a);
	}
	COLOR = vec4(premul + vec3(1.0 - alpha), 1.0);
}
