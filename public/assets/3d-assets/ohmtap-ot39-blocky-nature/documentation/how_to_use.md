# How to use the files

## Which scale?

- **1x** is the intended in-game size: the props are drawn to scale with each other (see `previews/scale_reference_1280x720.png`). Scale the whole set to fit your characters.
- **2x** is rendered natively at double resolution (not upscaled). Use it for high-DPI screens or zoom.

## Swapping states

Each object's states share the canvas size and alignment. Place the sprite once and change only the image (for example `A03_spruce_tall_se.png` / `_sw`: the two screen directions of the same model).

## Animations

The wind is a shader in Godot, not an animation in the files. Every model carries how much each part bends (the vertex colour alpha: 0 rigid, up to 1 for leaves and grass) and baked ambient occlusion (vertex colour rgb). OhmWind (godot/nature/ohm_wind.gd) swaps a model's colours for the wind shader; OhmWind.set_wind(strength, speed, direction) changes the wind for every model at once (0 = calm, 1 = a breeze, 2 = strong). Plants bend from their base, small plants more than trees, and every copy gets its own phase from its position. OhmScatter (godot/nature/ohm_scatter.gd) drops many copies of one model onto the colliders under an area as one MultiMesh, with random turn and size, optional clumping, and the wind on. The water shader (godot/nature/water.gdshader) colours a flat plane by the depth under it in hard bands, adds a foam line at the shore and slow ripples.

## Tiling pieces

3D tiles D01-D04: place them on a 2 m grid. The 2D renders have no tiling pieces.

## Manifest columns

`asset_id, object_id, name, state, kind (static/frame/strip), category, intended_use, width_1x, height_1x, width_2x, height_2x, format, path_1x, path_2x, allow_edge_contact, production_status, validation_status, license`
