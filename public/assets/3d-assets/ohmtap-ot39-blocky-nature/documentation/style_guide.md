# OhmTap HARDLINE style guide (v1)

This is the house style for OhmTap props. Every future OhmTap pack uses it so packs can be mixed.

## Look

- Front-elevation (orthographic) view, flat shading with soft vertical gradients.
- Crisp dark outline `(24,28,36)`, about 1.5 px at 1x. 1 px bevel: highlight top-left, shadow bottom-right. **Light always comes from the top-left.**
- Transparent background, no baked ground shadows, at least 2 px empty margin (except tiling pieces).
- Lit indicators: near-white core and a saturated halo, clipped to the object. Unlit: dark lens.
- Damage recipe: jagged breach with colored wires and bent flaps, soot, small translucent rust, 10-20 thin scratches, a few dents. All clipped to the silhouette.

## Palette

| Role | RGB / hex |
|---|---|
| Outline | (24,28,36) |
| Steel body | (122,138,154) -> (88,102,118) |
| Door / face | (134,150,166) -> (100,114,130) |
| Dark parts | (70,80,94) -> (46,54,66) |
| Cream plastic / labels | (232,230,222) -> (190,188,180) |
| Safety yellow / red / green / amber | (247,196,18) / (206,44,44) / (46,168,84) / (240,150,20) |
| OhmTap signal orange (machine paint, brand) | #FF6A13 |
| OhmTap live cyan (active screens, data lights) | #33D6F5 |
| Machine blue | (54,96,206) |

Yellow, red, green and amber are reserved for safety items and indicator states.

## Technical

- Drawn at 4x supersampling, downsampled with a box filter on premultiplied alpha (no LANCZOS ringing).
- 1x and 2x are rendered separately at native resolution.
- Baked text: DejaVu Sans / Bold, minimum about 7 px at 1x.
- Tiling periods divide the tile width (for example a 32 px stripe in a 128 px tile).
