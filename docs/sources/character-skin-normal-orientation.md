# Character skin normal orientation

The native Gallery walking still prompted a material audit. This correction addresses a verified tangent-space convention error; it does not change character identity, skin color, lighting or introduce a shirt texture.

Both committed `rain-city-protagonist.glb` and `rain-city-pedestrian.glb` have a tangentless skinned `Body`: POSITION, NORMAL, TEXCOORD_0, JOINTS_0 and WEIGHTS_0, with no TANGENT attribute. Their Skin normal texture uses tangent space. Three.js r182 GLTFLoader's derivative-tangent material branch negates normalScale.y, giving the loaded Skin `(0.6, -0.6)`. `makeDetailedCharacterFromTemplate()` previously replaced this with `setScalar(0.55)`, producing `(0.55, +0.55)` and reversing the green-channel relief direction.

The override now preserves each existing component's sign while applying the intended0.55 magnitude. Actual hero and male/female NPC skin therefore use `(0.55, -0.55)`. A positive convention stays positive; no extra flip is forced solely from a mesh name. Material cloning keeps the loaded shared source unchanged. Skin roughness0.66, environment intensity0.5, colors, maps, geometry, animation and all other material policies are unchanged. There are no new asset bytes, textures, draws, shaders or per-frame operations.

## Evidence and checks

`tests/character-skin-normal.test.ts` loads both actual GLBs through the installed GLTFLoader with only browser image decoding substituted. It checks the tangentless geometry, loaded signed scale, material cloning, and unchanged source. Original embedded skin-normal images are independently decoded. Sampled real Body triangles/UVs and non-flat image values are evaluated through the installed Three shader's derivative-frame equations and tangent-space normal multiplication. The corrected response matches the loaded source convention at reduced magnitude; more than50 sampled relief directions per case distinguish the former positive-Y error. Cases cover hero0, male NPC1 and female NPC3, including existing skin color/roughness/map invariants.

This is CPU evaluation of the actual shader basis equations and asset data, not a native GPU appearance result. Root will compare ordinary rear/three-quarter Gallery walking views with unchanged camera, weather and light, followed by a front hand/arm view. Expected effect is correctly directed fine skin relief; it may be subtle at normal chase distance. No general realism or face-identity change is claimed. The larger neutral-shirt proposal remains separate and unimplemented; its source map contains an emblem, and its existing normal texture is flat.

## Source and licensing

Existing character assets are CC0-1.0 generated CharacterCreator / Kasper Olesen and MakeHuman system-asset derivatives: [asset manifest](../../public/asset-manifest.json), [license evidence](CHARACTER-ASSET-LICENSE.md). No upstream code or new character assets were copied. Three.js shader/loader behavior referenced above is supplied by the existing MIT-licensed dependency.

Validation completed: eight focused skin-normal, animation-pose and actual-asset grounding tests passed; full TypeScript check passed. Native comparison remains pending.
