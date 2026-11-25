extends Node3D
## OhmTap OT-39 Blocky Nature demo: an island with a forest on a hill, a meadow and a pond, plus a gallery of every
## model. The top row of buttons flies the camera (island, forest, meadow, pond, models); the second row sets the wind
## (calm, breeze, strong). Right mouse button + drag: orbit. Mouse wheel: zoom. W A S D: move the camera.
## Trees, rocks and flowers come from island_layout.json; the grass is scattered with OhmScatter onto the turf.
##
## Capture modes for the OhmTap factory (user arguments after --):
##   --shot=out.png [--view=island|forest|meadow|pond|models] [--wind=0..2] [--ui=0] [--t=seconds]
##   --stills=dir      every model alone on a transparent background, two directions: dir/<name>_<se|sw>.png
##   --showcase        a cursor clicks through the views and the wind (use with --write-movie)

var views := {
	"island": [Vector3(0.0, 0.0, 0.0), 28.0, -32.0, 44.0],
	"forest": [Vector3(-8.5, 3.0, -5.0), 38.0, -24.0, 23.0],
	"meadow": [Vector3(-4.5, 0.3, 6.5), -35.0, -30.0, 16.0],
	"pond": [Vector3(5.6, 0.0, 2.6), 16.0, -21.0, 15.0],
	"models": [Vector3(92.0, 0.0, 9.0), 0.0, -42.0, 40.0],
}
const WINDS := {"calm": [0.0, 1.0], "breeze": [1.0, 1.0], "strong": [2.2, 1.6]}
const GALLERY := Vector3(70.0, 0.0, 0.0)
const GAP := 1.4                 # metres between models in a gallery row
const GROUP := ["flowers_yellow", "flowers_white", "flowers_violet", "flowers_red"]   # drawn as MultiMesh

var args := {}
var files := {}                 # model name -> res:// path
var cam: Camera3D
var env: Environment
var target := Vector3.ZERO
var yaw := 28.0
var pitch := -32.0
var dist := 44.0
var clock := 0.0
var ui: CanvasLayer
var view_row: HBoxContainer
var wind_row: HBoxContainer
var info: Label


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv: PackedStringArray = a.trim_prefix("--").split("=", true, 1)
		args[kv[0]] = kv[1] if kv.size() > 1 else ""
	_find_models()
	_world()
	if args.has("stills"):
		await _stills(args["stills"])
		get_tree().quit()
		return
	_island()
	_gallery()
	_ui()
	_set_view(args.get("view", "island"), false)
	_set_wind("breeze")
	if args.has("wind"):
		OhmWind.set_wind(float(args["wind"]))
	if args.has("shot"):
		ui.visible = args.get("ui", "1") != "0"
		await _run_for(float(args.get("t", "1.5")))
		_save(args["shot"])
		get_tree().quit()
	elif args.has("showcase"):
		await _showcase()
		get_tree().quit()


func _process(delta: float) -> void:
	clock += delta
	var move := Vector3(float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A)), 0.0,
		float(Input.is_key_pressed(KEY_S)) - float(Input.is_key_pressed(KEY_W)))
	if move != Vector3.ZERO:
		target += Basis(Vector3.UP, deg_to_rad(yaw)) * move.normalized() * delta * (4.0 + dist * 0.3)
	var r := Basis.from_euler(Vector3(deg_to_rad(pitch), deg_to_rad(yaw), 0.0))
	cam.position = target + r * Vector3(0, 0, dist)
	cam.look_at(target)


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseMotion and (e.button_mask & MOUSE_BUTTON_MASK_RIGHT):
		yaw -= e.relative.x * 0.3
		pitch = clamp(pitch - e.relative.y * 0.3, -85.0, -2.0)
	elif e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_WHEEL_UP:
			dist = max(2.0, dist * 0.9)
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			dist = min(120.0, dist * 1.1)


func _run_for(seconds: float) -> void:
	var end := clock + seconds
	while clock < end:
		await get_tree().process_frame


func _save(path: String) -> void:
	get_viewport().get_texture().get_image().save_png(path)
	print("saved ", path)


# ---------------------------------------------------------------- models
func _find_models() -> void:
	for f in DirAccess.get_files_at("res://models"):
		var file := f.trim_suffix(".import").trim_suffix(".remap")
		if file.ends_with(".glb"):
			files[file.get_basename().split("_", true, 1)[1]] = "res://models/" + file


func _make(name: String) -> Node3D:
	var m := (load(files[name]) as PackedScene).instantiate() as Node3D
	OhmWind.apply(m)
	return m


func _mesh_of(name: String) -> Mesh:
	var src := (load(files[name]) as PackedScene).instantiate()
	var mesh: Mesh = (src.find_children("*", "MeshInstance3D", true, false)[0] as MeshInstance3D).mesh
	src.free()
	return mesh


# ---------------------------------------------------------------- world
func _world() -> void:
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color("#6fb2e8")
	sky_mat.sky_horizon_color = Color("#cfe6f2")
	sky_mat.ground_horizon_color = Color("#cfe6f2")
	sky_mat.ground_bottom_color = Color("#9cc3d8")
	var sky := Sky.new()
	sky.sky_material = sky_mat
	env = Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.adjustment_enabled = true
	env.adjustment_contrast = 1.12
	env.adjustment_saturation = 1.06
	env.ssao_enabled = true
	env.ssao_radius = 0.8
	env.ssao_intensity = 1.6
	env.fog_enabled = true
	env.fog_light_color = Color("#cfe6f2")
	env.fog_density = 0.0015
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -35, 0)
	sun.light_energy = 1.5
	sun.light_color = Color("#fff4e2")
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 90.0
	add_child(sun)
	cam = Camera3D.new()
	cam.fov = 38
	cam.far = 400
	add_child(cam)


func _island() -> void:
	var data: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://island_layout.json"))
	var isle := _make("demo_island")
	add_child(isle)
	_turf_collider(isle)
	var water := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(data["water"][2], data["water"][3])
	water.mesh = plane
	var wm := ShaderMaterial.new()
	wm.shader = load("res://nature/water.gdshader")
	water.material_override = wm
	water.position = Vector3(data["water"][0], data["water_y"], data["water"][1])
	add_child(water)
	var groups := {}
	for item in data["items"]:
		var name: String = item[0]
		var xf := Transform3D(Basis(Vector3.UP, deg_to_rad(item[4])).scaled(Vector3.ONE * item[5]),
			Vector3(item[1], item[2], item[3]))
		if name in GROUP:
			if not groups.has(name):
				groups[name] = []
			groups[name].append(xf)
			continue
		var m := _make(name)
		m.transform = xf
		add_child(m)
	for name in groups:                                       # repeated small plants: one MultiMesh each
		var mesh := _mesh_of(name)
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = OhmWind.wind_mesh(mesh)
		mm.instance_count = groups[name].size()
		for i in mm.instance_count:
			mm.set_instance_transform(i, groups[name][i])
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.set_instance_shader_parameter("wind_height", maxf(mesh.get_aabb().end.y, 0.2))
		add_child(mmi)
	var size := Vector2(data["size"][0], data["size"][1])
	for g in [["grass_short", 900, 3], ["grass_medium", 800, 4], ["grass_tall", 350, 5]]:
		var sc := OhmScatter.new()
		sc.model = load(files[g[0]])
		sc.count = g[1]
		sc.random_seed = g[2]
		sc.area = size - Vector2(0.6, 0.6)
		sc.patchiness = 0.55
		sc.patch_size = 5.0
		sc.height_range = Vector2(-0.05, 10.0)
		add_child(sc)


func _turf_collider(isle: Node) -> void:
	## The grass may only land on the turf: a collider from the island's turf surface alone.
	var mi := isle.find_children("*", "MeshInstance3D", true, false)[0] as MeshInstance3D
	for s in mi.mesh.get_surface_count():
		var mat := mi.mesh.surface_get_material(s)
		if mat and mat.resource_name == "turf":
			var am := ArrayMesh.new()
			am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, mi.mesh.surface_get_arrays(s))
			var body := StaticBody3D.new()
			var shape := CollisionShape3D.new()
			shape.shape = am.create_trimesh_shape()
			body.add_child(shape)
			add_child(body)


func _gallery() -> void:
	## Every model at its real size, one row per category (A forest, B meadow, C shore, D ground tiles), labelled.
	var names := files.keys()
	names.sort_custom(func(a, b): return files[a] < files[b])
	var rows := {}
	for name in names:
		if name != "demo_island":
			var cat: String = files[name].get_file().left(1)
			if not rows.has(cat):
				rows[cat] = []
			rows[cat].append(name)
	var z := 0.0
	var right := 0.0
	for cat in rows:
		var depth := 0.0
		var x := 0.0
		for name in rows[cat]:
			var m := _make(name)
			add_child(m)
			var box := _box(m)
			var slot := maxf(box.size.x, 3.8)               # room for the label under small models
			if x > 0.0 and x + slot > 44.0:                  # wrap long rows
				right = maxf(right, x)
				z += depth + 3.2
				x = 0.0
				depth = 0.0
			m.position = GALLERY + Vector3(x + (slot - box.size.x) / 2 - box.position.x, 0.0, z - box.get_center().z)
			var l := Label3D.new()
			l.text = files[name].get_file().get_basename()
			l.font_size = 64
			l.pixel_size = 0.01
			l.outline_size = 12
			l.modulate = Color("#f3f0e9")
			l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			l.position = GALLERY + Vector3(x + slot / 2, 0.15, z + box.size.z / 2 + 0.7)
			l.font_size = 52
			add_child(l)
			x += slot + GAP
			depth = maxf(depth, box.size.z)
		right = maxf(right, x)
		z += depth + 3.2
	var ground := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(right + 8.0, z + 6.0)
	ground.mesh = plane
	var gm := StandardMaterial3D.new()
	gm.albedo_color = Color("#4f8a3a")
	gm.roughness = 1.0
	ground.material_override = gm
	ground.position = GALLERY + Vector3(right / 2, -0.01, z / 2 - 3.0)
	add_child(ground)
	views["models"] = [GALLERY + Vector3(right / 2, 0.0, z / 2 - 1.0), 0.0, -52.0, maxf(right * 0.95, z * 1.5)]


func _box(m: Node3D) -> AABB:
	var box := AABB()
	var first := true
	for mi in m.find_children("*", "MeshInstance3D", true, false):
		var b: AABB = (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
		box = b if first else box.merge(b)
		first = false
	return box


# ---------------------------------------------------------------- UI
func _button(row: Container, text: String, cb: Callable) -> void:
	var b := Button.new()
	b.text = text
	b.name = text
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(cb)
	row.add_child(b)


func _ui() -> void:
	ui = CanvasLayer.new()
	add_child(ui)
	var box := VBoxContainer.new()
	box.position = Vector2(10, 8)
	ui.add_child(box)
	view_row = HBoxContainer.new()
	box.add_child(view_row)
	for v in views:
		_button(view_row, v, _set_view.bind(v, true))
	wind_row = HBoxContainer.new()
	box.add_child(wind_row)
	for w in WINDS:
		_button(wind_row, w, _set_wind.bind(w))
	info = Label.new()
	info.add_theme_color_override("font_color", Color("#111215"))
	info.position = Vector2(10, 690)
	ui.add_child(info)


func _set_view(v: String, fly: bool) -> void:
	var p: Array = views[v]
	if not fly:
		target = p[0]
		yaw = p[1]
		pitch = p[2]
		dist = p[3]
		return
	var tw := create_tween().set_parallel().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_property(self, "target", p[0], 1.0)
	tw.tween_property(self, "yaw", p[1], 1.0)
	tw.tween_property(self, "pitch", p[2], 1.0)
	tw.tween_property(self, "dist", p[3], 1.0)


func _set_wind(w: String) -> void:
	OhmWind.set_wind(WINDS[w][0], WINDS[w][1])
	if info:
		info.text = "OT-39 Blocky Nature  ·  wind: %s  ·  right mouse: orbit · wheel: zoom · WASD: move" % w


# ---------------------------------------------------------------- 2D stills
func _stills(dir: String) -> void:
	OhmWind.set_wind(0.0)
	get_viewport().transparent_bg = true
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.fog_enabled = false
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	var names := files.keys()
	names.sort_custom(func(a, b): return files[a] < files[b])
	for name in names:
		var m := _make(name)
		add_child(m)
		var box := _box(m)
		for d in [["se", 35.0], ["sw", -35.0]]:
			var c := box.get_center()
			target = c                                      # _process keeps the camera here
			yaw = d[1]
			pitch = -26.0
			dist = 200.0
			var r := Basis.from_euler(Vector3(deg_to_rad(-26.0), deg_to_rad(d[1]), 0.0))
			cam.position = c + r * Vector3(0, 0, 200.0)
			cam.look_at(c)
			var inv := cam.global_transform.affine_inverse()
			var ext := Vector2.ZERO
			for k in 8:
				var p := inv * box.get_endpoint(k)
				ext = Vector2(maxf(ext.x, absf(p.x)), maxf(ext.y, absf(p.y)))
			cam.size = maxf(ext.y * 2.0, ext.x * 2.0 * 720.0 / 1280.0) * 1.06
			await _run_for(0.25)
			_save(dir.path_join("%s_%s.png" % [name, d[0]]))
		m.free()


# ---------------------------------------------------------------- showcase: a cursor clicks the controls
var cursor: Polygon2D
var ripple: Line2D
var caption: Label


func _make_cursor() -> void:
	var arrow := PackedVector2Array([Vector2(0, 0), Vector2(0, 26), Vector2(6.5, 20), Vector2(11, 30), Vector2(15, 28),
		Vector2(10.5, 18.5), Vector2(19, 18.5)])
	cursor = Polygon2D.new()
	cursor.polygon = arrow
	cursor.color = Color("#f3f0e9")
	var edge := Line2D.new()
	edge.points = arrow
	edge.closed = true
	edge.width = 2.0
	edge.default_color = Color("#111215")
	cursor.add_child(edge)
	ripple = Line2D.new()
	var ring := PackedVector2Array()
	for k in 33:
		ring.append(Vector2(cos(TAU * k / 32.0), sin(TAU * k / 32.0)) * 10.0)
	ripple.points = ring
	ripple.width = 3.0
	ripple.default_color = Color("#ff6a13")
	ripple.visible = false
	ui.add_child(ripple)
	ui.add_child(cursor)
	cursor.position = Vector2(900, 500)
	var box := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.067, 0.07, 0.082, 0.85)
	sb.border_color = Color("#ff6a13")
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(8)
	sb.content_margin_left = 22
	sb.content_margin_right = 22
	sb.content_margin_top = 6
	sb.content_margin_bottom = 8
	box.add_theme_stylebox_override("panel", sb)
	caption = Label.new()
	caption.add_theme_font_size_override("font_size", 30)
	caption.add_theme_color_override("font_color", Color("#f3f0e9"))
	box.add_child(caption)
	box.anchor_left = 0.5
	box.anchor_right = 0.5
	box.anchor_top = 1.0
	box.anchor_bottom = 1.0
	box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	box.grow_vertical = Control.GROW_DIRECTION_BEGIN
	box.offset_bottom = -44
	ui.add_child(box)


func _point(c: Control) -> Vector2:
	var r := c.get_global_rect()
	return r.position + r.size * Vector2(0.62, 0.66)


func _move_to(p: Vector2, t := 0.45) -> void:
	var tw := create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	tw.tween_property(cursor, "position", p, t)
	await tw.finished


func _click() -> void:
	ripple.position = cursor.position
	ripple.scale = Vector2.ONE
	ripple.modulate.a = 1.0
	ripple.visible = true
	var tw := create_tween().set_parallel()
	tw.tween_property(ripple, "scale", Vector2(2.6, 2.6), 0.35)
	tw.tween_property(ripple, "modulate:a", 0.0, 0.35)
	var press := create_tween()
	press.tween_property(cursor, "scale", Vector2(0.86, 0.86), 0.06)
	press.tween_property(cursor, "scale", Vector2.ONE, 0.1)
	await press.finished


func _press(c: Control, label: String, hold: float) -> void:
	await _move_to(_point(c))
	await _click()
	c.emit_signal("pressed")
	caption.text = label
	await _run_for(hold)


func _showcase() -> void:
	_make_cursor()
	caption.text = "OT-39 Blocky Nature"
	await _run_for(2.2)
	await _press(view_row.get_node("forest"), "forest", 3.0)
	await _press(view_row.get_node("meadow"), "meadow", 3.0)
	await _press(wind_row.get_node("strong"), "strong wind", 3.2)
	await _press(view_row.get_node("pond"), "pond: water by depth", 3.4)
	await _press(wind_row.get_node("calm"), "calm", 2.0)
	await _press(wind_row.get_node("breeze"), "breeze", 1.6)
	await _press(view_row.get_node("models"), "every model, real size", 3.6)
	await _press(view_row.get_node("island"), "the demo island", 2.6)
