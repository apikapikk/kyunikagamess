class_name OhmWind
extends Node
## OhmTap OT-39: add this node as a child of an imported nature model and the model moves in the wind.
## It swaps the model's colours for the wind shader (one shared material per colour) and tells the shader how tall
## the model is. OhmWind.set_wind() changes the wind for every model at once.

const SHADER := preload("res://nature/wind.gdshader")

static var _materials := {}
static var _wind := {"wind_strength": 1.0, "wind_speed": 1.0, "wind_direction": Vector2(1.0, 0.35)}


func _ready() -> void:
	var p := get_parent()
	if p:
		OhmWind.apply(p)


## The wind shader material for one colour (shared by every model that uses that colour).
static func material_for(color: Color) -> ShaderMaterial:
	var key := color.to_html()
	if not _materials.has(key):
		var m := ShaderMaterial.new()
		m.shader = SHADER
		m.set_shader_parameter("albedo", color)
		for k in _wind:
			m.set_shader_parameter(k, _wind[k])
		_materials[key] = m
	return _materials[key]


## Every MeshInstance3D under root gets the wind materials.
static func apply(root: Node) -> void:
	var list: Array[Node] = [root]
	list.append_array(root.find_children("*", "MeshInstance3D", true, false))
	for n in list:
		if n is MeshInstance3D and n.mesh:
			var mi := n as MeshInstance3D
			mi.set_instance_shader_parameter("wind_height", maxf(mi.mesh.get_aabb().end.y, 0.2))
			for s in mi.mesh.get_surface_count():
				mi.set_surface_override_material(s, material_for(_albedo(mi.mesh.surface_get_material(s))))


## A copy of a mesh with the wind materials on its surfaces (for MultiMesh scattering).
static func wind_mesh(mesh: Mesh) -> ArrayMesh:
	var out := mesh.duplicate() as ArrayMesh
	for s in out.get_surface_count():
		out.surface_set_material(s, material_for(_albedo(out.surface_get_material(s))))
	return out


## Wind for every model: strength 0 = calm, 1 = a breeze, 2 = a strong wind.
static func set_wind(strength: float, speed := 1.0, direction := Vector2(1.0, 0.35)) -> void:
	_wind = {"wind_strength": strength, "wind_speed": speed, "wind_direction": direction}
	for key in _materials:
		for k in _wind:
			_materials[key].set_shader_parameter(k, _wind[k])


static func _albedo(m: Material) -> Color:
	if m is BaseMaterial3D:
		return (m as BaseMaterial3D).albedo_color
	return Color(0.5, 0.5, 0.5)
