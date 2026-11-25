class_name OhmScatter
extends MultiMeshInstance3D
## OhmTap OT-39: scatters many copies of one model (grass, flowers, pebbles) over an area, drawn as one MultiMesh.
## Every copy is dropped straight down onto the colliders under the area (for example a StaticBody3D on your
## ground), gets a random turn and size, and moves in the wind (OhmWind). Copies that hit nothing, or land outside
## height_range, are skipped. Call scatter() again after you change a setting.

@export var model: PackedScene
@export var count := 500
@export var area := Vector2(20.0, 20.0)            ## metres, centred on this node
@export var random_seed := 1
@export var scale_range := Vector2(0.8, 1.15)
@export_range(0.0, 1.0) var patchiness := 0.4      ## 0 = even cover, 1 = clumps with open ground between them
@export var patch_size := 6.0                      ## metres
@export var height_range := Vector2(-1000.0, 1000.0)   ## world heights where copies may land
@export_flags_3d_physics var collision_mask := 1
@export var wind := true


func _ready() -> void:
	if model:
		await get_tree().physics_frame
		scatter()


func scatter() -> void:
	var src := model.instantiate()
	var found := src.find_children("*", "MeshInstance3D", true, false)
	if src is MeshInstance3D:
		found.push_front(src)
	if found.is_empty():
		src.free()
		push_warning("OhmScatter: the model has no mesh")
		return
	var mesh: Mesh = (found[0] as MeshInstance3D).mesh
	src.free()
	if wind:
		set_instance_shader_parameter("wind_height", maxf(mesh.get_aabb().end.y, 0.2))
		mesh = OhmWind.wind_mesh(mesh)
	var space := get_world_3d().direct_space_state
	var rng := RandomNumberGenerator.new()
	rng.seed = random_seed
	var noise := FastNoiseLite.new()
	noise.seed = random_seed
	noise.frequency = 1.0 / maxf(patch_size, 0.1)
	var xforms: Array[Transform3D] = []
	var tries := count * 6
	while xforms.size() < count and tries > 0:
		tries -= 1
		var wp := global_transform * Vector3(rng.randf_range(-area.x / 2, area.x / 2), 0.0,
			rng.randf_range(-area.y / 2, area.y / 2))
		if patchiness > 0.0:
			var n := noise.get_noise_2d(wp.x, wp.z) * 0.5 + 0.5
			if rng.randf() > lerpf(1.0, smoothstep(0.38, 0.62, n), patchiness):
				continue
		var q := PhysicsRayQueryParameters3D.create(wp + Vector3.UP * 500.0, wp + Vector3.DOWN * 500.0, collision_mask)
		var hit := space.intersect_ray(q)
		if hit.is_empty() or hit.position.y < height_range.x or hit.position.y > height_range.y:
			continue
		var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(scale_range.x, scale_range.y))
		xforms.append(global_transform.affine_inverse() * Transform3D(b, hit.position))
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = xforms.size()
	for i in xforms.size():
		mm.set_instance_transform(i, xforms[i])
	multimesh = mm
