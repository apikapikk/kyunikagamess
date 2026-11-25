// OhmTap OT-39 water: colour by depth in a few hard bands (blocky look), a foam line where the water meets the
// shore, and slow ripples in the surface normal. Put it on a flat plane (PlaneMesh) at the water level.
// Needs the Forward+ or Mobile renderer (it reads the depth texture).
shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_back, diffuse_burley, specular_schlick_ggx;

uniform vec3 shallow_color : source_color = vec3(0.36, 0.80, 0.78);
uniform vec3 deep_color : source_color = vec3(0.04, 0.26, 0.42);
uniform vec3 foam_color : source_color = vec3(0.95, 0.97, 0.96);
uniform float depth_range = 2.2;            // metres (along the view) from the shallow colour to the deep colour
uniform int bands = 4;                      // 0 = smooth
uniform float clarity : hint_range(0.0, 1.0) = 0.6;
uniform float foam_width = 0.22;
uniform float ripple_scale = 0.9;
uniform float ripple_speed = 0.3;
uniform float ripple_strength = 0.35;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;

varying vec3 world_pos;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
}

float ripple(vec2 p, float t) {
	return vnoise(p + vec2(t, t * 0.6)) + 0.6 * vnoise(p * 1.9 - vec2(t * 0.8, -t * 0.5));
}

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = world_pos.xz * ripple_scale;
	float t = TIME * ripple_speed;
	float e = 0.06;
	float f0 = ripple(p, t);
	vec3 n = normalize(vec3((f0 - ripple(p + vec2(e, 0.0), t)) / e * ripple_strength * 0.12, 1.0,
		(f0 - ripple(p + vec2(0.0, e), t)) / e * ripple_strength * 0.12));
	NORMAL = normalize((VIEW_MATRIX * vec4(n, 0.0)).xyz);

	float raw = texture(depth_tex, SCREEN_UV).r;
	vec4 scene = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, raw, 1.0);
	scene.xyz /= scene.w;
	float depth = max(0.0, VERTEX.z - scene.z);
	float k = clamp(depth / depth_range, 0.0, 1.0);
	if (bands > 0) {
		k = clamp(ceil(k * float(bands)) / float(bands), 0.0, 1.0);
	}
	vec3 water = mix(shallow_color, deep_color, k);
	float foam = step(depth, foam_width * (0.6 + 0.7 * f0 / 1.6));
	ALBEDO = mix(water, foam_color, foam);
	ALPHA = max(mix(1.0 - clarity, 0.94, k), foam * 0.95);
	ROUGHNESS = 0.08;
	SPECULAR = 0.6;
}
