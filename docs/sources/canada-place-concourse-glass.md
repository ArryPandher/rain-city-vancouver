# Canada Place upper concourse glazing

The upper west concourse uses thin-sheet alpha-composited glazing over closed shallow structural backing. This replaces the opaque dielectric proxy while retaining its nonmetallic response. The material is an approximation of glass over visible geometry, not a physical refraction/transmission simulation or an accessible interior.

## Evidence and calibration

Juan Tanus’s photograph in BC Museums Association *Roundup*, Fall 2012, page 21, shows green-tinted curved glazing, pale framing and visible structure. The dated June 2022 Dietmar Rabich entrance photograph supports green glass and pale framing at another part of the frontage. Rayner’s historical west section supports the stepped geometry. None measures material properties, and the photos have different exposure, weather and age.

- [Museum publication](https://museum.bc.ca/wp-content/uploads/2021/07/253-roundup_fall2012.pdf), cached research crop `artifacts/local/canada-place-pedestrian-references/museum-west-photo.png`.
- [Rabich entrance photograph](https://commons.wikimedia.org/wiki/File:Vancouver_(BC,_Canada),_Canada_Place,_Kunstwerk_%22Salish_Sea,_the_Journey_Within%22_--_2022_--_1863.jpg), CC BY-SA 4.0, cached review in the same folder.
- Historical Rayner section: `rayner-section-west-crop.png`, provenance in the existing concourse source record.

Reference photographs are research only, not runtime textures. The excluded NoAI scan is not used.

## Current material

`createCanadaPlaceConcourseGlass()` creates an independent MeshPhysicalMaterial with IOR 1.5, zero metalness, untinted specular reflection, roughness 0.21 and muted green color 0x78998b. Normal-incidence dielectric reflectance is approximately 4%. The existing harbour probe retains intensity 0.8; no additional capture, texture or transmission pass is introduced.

Coverage is estimated at 0.42 at normal incidence and rises to 0.96 at grazing through a view-angle shader. At a normal view, alpha compositing mixes 42% shaded glass with 58% backing. Standard alpha blending attenuates the specular term as well; this is not optically exact glass. Clearcoat and transmission are disabled. Front faces render with depthWrite false; the material opts out of casting opaque shadows. Actual backing receives/casts shadows. Shader callback, cache key, transparency and shadow opt-out survive static batching and existing reflection assignment.

Only curved upper panes use this transparent material. Opaque end caps are a separate material with their own existing-probe assignment; ground doors keep their dedicated material. The facade loader must preserve factory flags rather than reset all glass to opaque.

## Native review and limits

The first depth candidate had broad pale 400 mm returns that resembled heavy greenhouse ribs. Final backing retains the closed 400 mm depth but limits pale rebates to the front 100 mm, with muted deeper returns. Native same-view review accepts this as an improvement over the opaque baseline and the first candidate: slimmer framing retains visible depth. Ground route and exterior curves are unchanged.

The repeated dark backing remains too uniform compared with the photograph’s varied visible structure. Source-grounded longitudinal variation and structural layers are the next architectural/material task. Stronger metalness or reflected highlights would not resolve that mismatch. This remains visibly below photographic or GTA VI/AAA fidelity.

Targeted checks cover dielectric properties, shader injection into the installed physical shader, actual batching/shadow semantics and compatibility with the shared reflection texture. Full checkpoint checks and native evidence are in [the depth checkpoint](../CANADA-PLACE-GLAZING-DEPTH.md).
