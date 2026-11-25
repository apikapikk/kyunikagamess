// OhmTap OT-39 wind shader for the blocky nature models.
// The models carry COLOR.rgb = baked ambient occlusion and COLOR.a = how much the part bends (0 = rigid).
// Every plant bends from its base: the higher a vertex, the further it moves. Small plants (grass, flowers) bend
// more than trees, and every instance gets its own phase from its position, so a field never moves in lockstep.
shader_type spatial;
render_mode cull_back, diffuse_burley, specular_schlick_ggx;

uniform vec3 albedo : source_color = vec3(0.5);
uniform float roughness : hint_range(0.0, 1.0) = 0.82;
uniform float ao_strength : hint_range(0.0, 1.0) = 1.0;
uniform float wind_strength = 1.0;
uniform float wind_speed = 1.0;
uniform vec2 wind_direction = vec2(1.0, 0.35);
instance uniform float wind_height = 1.0;   // the plant's height in metres (set by OhmWind)

void vertex() {
	float flex = COLOR.a;
	if (flex > 0.0 && wind_strength > 0.0) {
		vec3 origin = MODEL_MATRIX[3].xyz;
		vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
		float hgt = max(wind_height, 0.2);
		float h = clamp(VERTEX.y / hgt, 0.0, 1.2);
		float small = clamp(1.0 - hgt / 3.0, 0.0, 1.0);
		float t = TIME * wind_speed;
		float ph = dot(origin.xz, vec2(0.31, 0.19));
		float gust = 0.55 + 0.45 * sin(t * 0.43 + origin.x * 0.07 + origin.z * 0.05);
		float sway = 0.4 + (0.7 * sin(t * 1.5 + ph) + 0.3 * sin(t * 2.6 + ph * 1.9)) * gust;
		float flutter = sin(t * 3.4 + dot(wp, vec3(0.9, 1.1, 0.7))) * (0.25 + 0.5 * small);
		float bend = (0.03 + 0.16 * small) * wind_strength * flex;
		float off = hgt * h * h * bend * (sway + flutter);
		vec2 d = normalize(wind_direction);
		vec3 world_off = vec3(d.x * off, -off * off / (2.0 * hgt), d.y * off);
		VERTEX += inverse(mat3(MODEL_MATRIX)) * world_off;
	}
}

void fragment() {
	ALBEDO = albedo * mix(vec3(1.0), COLOR.rgb, ao_strength);
	ROUGHNESS = roughness;
	SPECULAR = 0.3;
}
