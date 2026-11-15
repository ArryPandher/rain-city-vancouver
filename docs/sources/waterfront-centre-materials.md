# Waterfront Centre exterior materials

Scope: OSM `w143683980`, 200 Burrard Street, through `createWaterfrontCentreMaterials`. This factory is isolated from shared city materials, daylight, exposure and other buildings. It supplies eight shared material groups, never a material per pane.

## Reference interpretation

- `artifacts/local/waterfront-centre-reference/cf-office-exterior.jpg`, extracted from the official [CF Suite 650 sheet](https://assets.cadillacfairview.com/m/79b711ef733ef8ab/original/200-Burrard-Suite-650.pdf): broad continuous blue/silver reflections across a fine pale metal grid, including the rounded tower corner. This establishes the visual relationship, not calibrated reflectance or a glazing specification.
- [BCVD071](https://travelphotobase.com/v/CDNBC/BCVD071.HTM), local `bcvd071.jpg`: reflective blue upper tower contrasted with substantial pale lower piers and deeply recessed square windows.
- [BCVD072](https://travelphotobase.com/v/CDNBC/BCVD072.HTM), local `bcvd072.jpg`: pale mineral panels and silver frames around the lower glazed drum; panel joints and dark reveals belong to the geometry, not a black-window texture.

The latter photographs are Jim Steinhart, copyright 2011; the official image also has no identified open redistribution licence. All photographs remain research-only and are not runtime textures. Photograph lighting/reflected sky varies strongly; none supplies measured RGB, coating composition, roughness, panel size or current planting inventory.

## Runtime choices and limits

Tower glass uses one opaque MeshPhysicalMaterial with a restrained blue/silver tint, roughness 0.14, clearcoat and a metallic-response approximation to a reflective coating. The metallic parameter is an artistic proxy, not a measured glass optical stack. No transmission, fake interior, random illuminated windows, pane grid or view-independent baked reflection is added. Geometry provides the thin mullions and separate muted blue spandrel bands. One static 128-pixel cube capture at (393,36,-555), outside the northeast corner, supplies the glass and spandrel environment through the existing reflection system. It is a bounded approximation shared by the building, not ray tracing, a per-frame capture or a new light.

Pale mineral cladding reuses `public/textures/canada-place-plinth/{color,normal,roughness}.webp`: the committed joint/tie-hole-free crop derived from Charlotte Baglioni's [Concrete Wall 009](https://polyhaven.com/a/concrete_wall_009), [CC0](https://creativecommons.org/publicdomain/zero/1.0/). Its exact preparation and source URLs remain in `public/textures/canada-place-plinth/SOURCES.json`. This generic granular material is not a Waterfront Centre scan or a claim about its stone species. Diffuse texture is sRGB; normal and roughness data remain linear. Roughness multiplier 1 preserves the prepared map's approximately 0.74–0.86 range. Normal strength 0.22 is restrained. No source assets were downloaded or modified.

Geometry must supply UVs in metres, including box faces. All three mineral maps repeat every estimated 2 m, with identical transforms; geometry baking must not change that registration. The material intentionally adds no extra panel-joint shader over the authored cladding/reveals. Sampler wrappers are cloned so repeat/color-space changes cannot affect another landmark's texture state. Closed recess backing, roof, soil and planted-ledge materials are opaque, lit by the normal scene lighting, and non-emissive.

## Checks and native acceptance

Focused tests verify the source licence/files, library sampler isolation, matched color/normal/roughness registration, metre UV persistence after world transformation/baking, no emissive/grid glass, and the unmodified Three standard/physical shader path. No custom GLSL is used, avoiding the prior instanced-versus-batched shader-variable class of error. Native daylight review on 2026-11-15 confirms the continuous blue/silver corner, thin mullions, recessed square windows and pale skirt in Burrard/Cordova street views and the northeast pier approach. The simplified broad reflections and opaque closed lobby still limit realism; these values are not calibrated albedo or an AAA-parity claim.
