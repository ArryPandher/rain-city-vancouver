# Canada Place upper concourse glazing

## Visible problem and reference

The published view `artifacts/local/canada-doors-final-public.jpg` shows bright, almost chrome-like horizontal bands across the repeated curves. Juan Tanus's photograph in the BC Museums Association's *Roundup*, Fall 2012, page 21, shows green-tinted curved glazing with pale frames and reflected daylight, rather than a continuous metallic skin. The dated June 2022 Dietmar Rabich entrance photograph also supports green glass and pale framing, although it is a different part of the frontage.

Sources and inspected files:

- https://museum.bc.ca/wp-content/uploads/2021/07/253-roundup_fall2012.pdf — `artifacts/local/canada-place-pedestrian-references/museum-west-photo.png`.
- https://commons.wikimedia.org/wiki/File:Vancouver_(BC,_Canada),_Canada_Place,_Kunstwerk_%22Salish_Sea,_the_Journey_Within%22_--_2022_--_1863.jpg — `rabich-west-2022-review.jpg` in the same directory, CC BY-SA 4.0.
- Rayner's historical section, `rayner-section-west-crop.png`, supports the nested geometry but does not measure material properties.

Photographs are evidence for material character, not calibrated reflectance samples. Their exposure, white balance, age and weather differ from the game.

## Material correction

`createCanadaPlaceConcourseGlass()` returns a separate `MeshPhysicalMaterial` named `canada-west-glass`. It uses zero metalness, IOR 1.5 and untinted specular reflection. This yields approximately 4% normal-incidence Fresnel reflectance, with strong reflection retained at grazing angles. The previous 0.58 metalness blended a much higher, tinted metallic reflectance into the material.

Roughness rises from 0.14 to an estimated 0.21, softening the unnaturally sharp repeated highlights without removing the harbour reflection. A muted blue-green body colour provides a bounded approximation of the coloured glazing over a closed backing. These visual calibration values remain estimates.

The material remains opaque, with transmission and clearcoat disabled. It is an **opaque-backed dielectric proxy**, not a simulation of light travelling through real glass. There is no upper interior behind the shell to reveal. No additional probe, transmission pass, texture, fake reflected stripes or shader animation is introduced. Ground door glazing is unchanged.

The current loader sets upper-glass probe intensity to 0.8, overriding the previous facade value of 1.65. The helper therefore uses 0.8 directly. The existing probe pipeline may assign its cube texture normally; no reflection-manager changes are required. Integration must replace the previous glass creation and its metalness/tint/roughness assignments rather than reapply them after calling the helper.

## Validation and remaining limitations

Two targeted tests check dielectric reflectance versus the previous metallic floor, grazing-angle reflection, isolated material instances and compatibility with the existing cube texture. They also check that no transmission, extra coating, emission or texture-driven illusion has been introduced. These are material-contract checks, not a rendered visual test.

Native before/after review at walking height found less chrome-like reflection and a color closer to the independent photographic reference. The panes nevertheless still read as opaque painted panels in close views. Keep this material as a better baseline, then add source-supported frame subdivisions and visible structural depth behind the upper glazing. The helper cannot correct repeated identical curve profiles, approximate fascia transitions or simplified end junctions. This is not photographic or AAA parity.
