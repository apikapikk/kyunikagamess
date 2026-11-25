# OhmTap OT-39 - Blocky Nature

*38 blocky low-poly nature models (forest, meadow, lake shore) with wind and water shaders for Godot 4 (GLB, OBJ, 2D renders).* Version 1.0.0.

Thirty-eight blocky low-poly nature models from the OhmTap 3D line for a summer forest, a meadow and a lake shore: spruces, pines, birches and oaks, a dead tree, stumps, a fallen log, mushrooms, grass, flowers, bushes, a fern, rocks, a cliff, pebbles, reeds, lily pads, a pier, stepping stones, ground tiles and a ready demo island. Every model is a GLB and an OBJ at real size (1 unit = 1 metre). In Godot 4 the plants move in the wind: the included project has a wind shader, a water shader, an OhmWind node that puts the wind on any of the models, an OhmScatter node that scatters grass and flowers over your ground, and a demo island. 38 models also come as 2D renders in two directions.

## What's inside

- **38 objects**, **76 static state images**
- No 2D animation loops: the 2D images are stills
- Every image at **1x and native 2x** (`name@2x.png`): 152 PNG files in `assets/`
- Sprite atlases `spritesheets/atlas_1x|2x.png` + JSON (static states)
- `manifest.csv`: every file with size, category, state and intended use
- `demo/index.html`: offline gallery of every 2D image
- `previews/`: product images, contact sheets, scale reference

| Cat | Category | Objects | Images |
|---|---|---|---|
| A | Forest | 12 | 24 |
| B | Meadow | 11 | 22 |
| C | Shore and rocks | 10 | 20 |
| D | Ground tiles | 5 | 10 |

## 3D models, wind and water

- `models/glb/<ID>_<name>.glb`: binary glTF 2.0, flat-shaded blocks, one material per colour, vertex colours (rgb = baked ambient occlusion, a = wind bend amount).
- `models/obj/`: OBJ + MTL with the same shapes and colours (no vertex colours).
- `models/models.csv`: triangle count, size in units and file paths of every model.
- `godot/`: a Godot 4.4+ project. `nature/wind.gdshader` (the wind), `nature/water.gdshader` (the water), `nature/ohm_wind.gd` (class OhmWind), `nature/ohm_scatter.gd` (class OhmScatter), `demo.gd` (the demo island, the model gallery, view and wind buttons), `island_layout.json` (where the demo places each model).
- Wind shader settings: `wind_strength`, `wind_speed`, `wind_direction` (shared, set by OhmWind.set_wind), `roughness`, `ao_strength`, and the per-model `wind_height` (set by OhmWind).
- Water shader settings: `shallow_color`, `deep_color`, `foam_color`, `depth_range`, `bands` (0 = smooth), `clarity`, `foam_width`, `ripple_scale`, `ripple_speed`, `ripple_strength`.
- OhmScatter settings: `model`, `count`, `area`, `random_seed`, `scale_range`, `patchiness`, `patch_size`, `height_range`, `collision_mask`, `wind`.

Units: 1 unit = 1 metre, Y is up. Every model stands on y = 0 at its origin (the pier's deck is at y = 0.15 and runs along -z; the tiles' top face is y = 0, D04 y = 1).


## Folder structure

```
assets/1x/<category>/ID_name_state.png
assets/2x/<category>/ID_name_state@2x.png
(no 2D animation folders: the animations are in the 3D files)
spritesheets/atlas_1x.png, atlas_1x.json, atlas_2x.png, atlas_2x.json
demo/index.html, demo/assets_data.js
previews/
documentation/
manifest.csv
README.md, LICENSE.txt, CHANGELOG.md
```

## Quick start

1. Unzip the archive.
2. Open `demo/index.html` in a browser to browse everything. If your browser blocks local files, open a terminal in the pack folder and run `python -m http.server`, then visit http://localhost:8000/demo/index.html.
3. Copy the PNGs you need from `assets/1x` (or `assets/2x`) into your project.

## Importing into your engine

The files are plain PNG (RGBA, transparent background) plus a simple JSON atlas. **They have not been tested in any specific engine.** These are untested suggestions:

- Import as 2D textures / sprites with alpha. Use linear (smooth) filtering: this is not pixel art.
- Use the 2x files for high-DPI screens or when the camera zooms in, and display them at half size to keep the 1x layout.
- States of one object have the same canvas size and alignment, so switch the texture in code.
- Animation strips are horizontal (frame width = strip width / frame count). Long loops come as grid sheets: columns, rows, frame size and suggested fps are in the manifest.

## File naming

`<ID>_<name>[_<state>].png`, e.g. `A03_spruce_tall_se.png`. The ID letter is the category. 2x files add `@2x`.

## All objects

| ID | Name | 1x size | States | Use |
|---|---|---|---|---|
| A01 | spruce_small | 228x236 | se, sw | A small spruce: stacked square tiers with drooping skirts and a spike. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| A02 | spruce_medium | 218x239 | se, sw | A medium spruce. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| A03 | spruce_tall | 211x247 | se, sw | A tall spruce. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| A04 | pine | 160x280 | se, sw | A pine: a tall bare orange-brown trunk, broken stubs, a flat layered crown. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| A05 | birch_small | 181x276 | se, sw | A small birch: a white trunk with dark marks, a loose leafy crown. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| A06 | birch_tall | 162x282 | se, sw | A tall birch. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| A07 | oak | 248x254 | se, sw | An oak: a thick trunk, two limbs and a wide, heavy crown. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| A08 | oak_young | 234x260 | se, sw | A young oak. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| A09 | dead_tree | 168x276 | se, sw | A bare grey dead tree with stepped branches. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| A10 | stump | 337x268 | se, sw | A tree stump with a cut top, roots and a moss patch. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| A11 | fallen_log | 377x322 | se, sw | A fallen log with cut ends, moss and two small mushrooms. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| A12 | mushrooms | 383x258 | se, sw | A cluster of four mushrooms: two red with white dots, two brown. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| B01 | grass_short | 232x272 | se, sw | A clump of short grass. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| B02 | grass_medium | 224x281 | se, sw | A clump of grass. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| B03 | grass_tall | 229x268 | se, sw | A clump of tall grass. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| B04 | flowers_yellow | 289x277 | se, sw | A patch of yellow flowers. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| B05 | flowers_white | 261x280 | se, sw | A patch of white flowers. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| B06 | flowers_violet | 319x265 | se, sw | A patch of violet flowers. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| B07 | flowers_red | 287x275 | se, sw | A patch of red poppies. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| B08 | bush_round | 396x279 | se, sw | A round leafy bush. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| B09 | bush_berry | 387x276 | se, sw | A bush with red berries. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| B10 | bush_flowering | 396x281 | se, sw | A bush with pink blossom. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| B11 | fern | 420x230 | se, sw | A fern with arching fronds. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| C01 | rock_small | 376x277 | se, sw | A small rock. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| C02 | rock_medium | 355x284 | se, sw | A rock with a moss top. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| C03 | rock_large | 346x273 | se, sw | A large mossy rock. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| C04 | cliff | 336x298 | se, sw | A stepped rock outcrop about 3 m high. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| C05 | pebbles | 491x226 | se, sw | A scatter of pebbles. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| C06 | reeds | 155x291 | se, sw | Reeds with cattails, for the water's edge. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| C07 | lily_pad | 540x269 | se, sw | A lily pad. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| C08 | lily_pad_flower | 447x214 | se, sw | A lily pad with a pink flower. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| C09 | pier | 385x339 | se, sw | A 4 m plank pier on posts. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| C10 | stepping_stones | 491x310 | se, sw | A curve of five flat stepping stones. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| D01 | tile_turf | 508x348 | se, sw | A 2 x 2 m ground tile: turf on soil. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| D02 | tile_sand | 508x348 | se, sw | A 2 x 2 m sand tile. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| D03 | tile_path | 496x340 | se, sw | A 2 x 2 m dirt path tile with small stones. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| D04 | tile_turf_raised | 347x348 | se, sw | A 2 x 2 m turf tile 1 m higher, for terraces. 3D: GLB + OBJ; 2D: two directions (se, sw) |
| D05 | demo_island | 612x307 | se, sw | The 32 x 22 m demo island ground: a hill, a pond bed, sand banks and a path. 3D: GLB + OBJ; 2D: two directions (se, sw) |

## Tiling and open-ended pieces

The ground tiles D01-D04 are 2 x 2 m blocks with their top face at y = 0 (D04 at y = 1): place them on a 2 m grid and they join without gaps. The other models stand anywhere.

## Atlas JSON format

Example (values shortened):

```json
{"meta": {"image": "atlas_1x.png", "size": {"w": 1024, "h": 2048}, "scale": 1, "padding": 2},
 "frames": {"A03_spruce_tall_se": {"x": 0, "y": 0, "w": 300, "h": 280}}}
```
Keys are file names without extension. Animation frames are not in the atlas; use the strips.

## Recommended uses

3D games, above all Godot games: adventure, RPG, survival and crafting, farming and cozy life games, exploration, camping and fishing games, level prototypes and greyboxing with a finished look; the 2D renders suit icons, menus and 2D games.

## License (summary)

- Allowed: Use the assets in unlimited personal and commercial projects: games, apps, videos, prototypes, game jams, including monetized ones.
- Allowed: Modify, recolor, crop, resize and combine the assets.
- Allowed: Team members of one studio working on the same project may share the single purchased copy.
- Allowed: Credit is appreciated but not required ("Art: OhmTap").
- Not allowed: Redistributing or reselling the assets, original or modified, as an asset pack, template, sprite sheet, or stock resource.
- Not allowed: Uploading the assets to asset marketplaces, sharing sites or public repositories as separately downloadable files.
- Not allowed: Claiming authorship of the assets or registering them (or derivatives) as a trademark or logo.
- Not allowed: Using the assets to train machine-learning or generative-AI models.

Full terms: `LICENSE.txt` (draft terms, not legal advice).

## How these assets were made

Made with AI-assisted code. Every image is original vector-like art rendered procedurally by Python scripts (Pillow + NumPy). No image-generation model was used, and no third-party artwork is included.

## Honest limitations

- The wind and the water are Godot 4 shaders: in other engines the GLB / OBJ files are the same models, standing still, and there is no water surface (add your own).
- Tested in Godot 4.7.2 with the Forward+ renderer on one PC (NVIDIA RTX 3060). The water shader reads the depth texture, so it needs Forward+ or Mobile; it was not tested with Mobile, the Compatibility renderer, on phones or in other engines.
- Colours are material colours plus vertex colours (no texture maps, no UV maps); the GLB vertex colour alpha holds the wind data, which other engines ignore for opaque materials.
- The wind bends whole plants from the base and lets leaves flutter a little; the blocks stretch slightly as they bend. There is no collision with the player and no interaction (trampling).
- Flat-shaded blocks with no LODs: the models are light (under 500 triangles each, the demo island under 17 000), so LODs were not needed in the demo.
- OhmScatter needs colliders under its area (it casts rays down); copies over empty space are skipped.
- 2D renders are stills with the wind off, from one camera angle (two directions).

## Credits

Art and code: OhmTap. Text in images uses DejaVu Sans (https://dejavu-fonts.github.io/). Font files are not included.

## FAQ

**Can I use this in a commercial game?** Yes, see the license.

**Can I recolor or edit the images?** Yes.

**Do I have to credit you?** No, but "Art: OhmTap" is appreciated.

**Will there be updates?** Fixes for reported file problems are planned; new content goes into new OhmTap packs.
