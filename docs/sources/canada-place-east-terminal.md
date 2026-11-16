# Near east Canada Place terminal elevation

This candidate replaces only the first sail bay's east-facing vertical terminal wall. It preserves the retained PIER floor, roof cap, mast/fabric/rigging, other four east bays, completed west concourse, hotel, ship and all public movement policy. No extra capture or downloaded texture is introduced. Native appearance remains pending.

## Registration and evidence

The normal arrival views `artifacts/local/canada-place-noon-default.png` and `cruise-forward-native.png` show a long flat white wall with two repeated window rows beside the ship. Retained [MCM Handford01](https://www.mcmparchitects.com/wp-content/uploads/2025/09/Handford-MCM-CanadaPlace-01-WEB.jpg) shows a lower glazed dock corridor beneath a projecting horizontal fascia, then taller recessed service bays and a solid upper promenade wall. Handford08/10 show the upper east service wall and coping; they are not the west curved-glass concourse. All are reference-only, not runtime textures. Capture date, exposure and dimensions are unverified.

Source model: © 2026 Codriver, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), from the [Codriver asset library](https://3d-assets.codriver.io/); geographic placement © OpenStreetMap contributors. Existing central attribution applies. The GLB file is unchanged; this is a runtime adaptation.

The first source SAILS ring's edge[2,3] is the near splayed bay, 55.6611m long. Its exact baked endpoints are local(−68.2682342529,58.5998611450) to(−18.6622772217,33.3527526855). Wall bottom7.6537394524 and roof17.6466751099 are decoded source values; PIER top7.7989358902 is retained. The original first wall comprises concrete triangles368–369 and glass604–623, the latter at localY10.09646–13.80320 and14.9990–16.69863. Source trim/steel/fabric near this plane is the sail/mast system and stays untouched. Audit files: `artifacts/local/canada-east-terminal-audit.json`, `canada-east-terminal-decoded.json` and their MTS extractors.

The photograph provides **ordering and depth relationships**, not surveyed level heights. The existing source floor/roof anchor a fitted section: lower glazed corridor from PIER to11.65; intermediate fascia/slab11.65–12.15; service openings12.15–16.35; upper solid fascia16.35–17.646675. Ten approximately5.566m structural bays, 0.55m piers, 0.6m glazing recess, 0.8m rear closure and 0.35m maximum fascia projection are explicit interpreted dimensions. The service faces use closed recessed metal shutter/slat geometry; this does not claim every real opening is permanently shuttered or reproduce hidden terminal interiors. Lower glazing is also opaque-backed. Do not describe this as an as-built service-door schedule.

## Geometry and source ownership

`canada-place-east-terminal-source.ts` preflights the original scene, pinned normalized/baked position and index fingerprints. It removes exactly22 ordered original triangles wherever prior index cuts moved them. Missing/duplicated/reversed/mixed target triangles fail without mutation. Atomic all-material removal is available. Original positions, other attributes, source floor/caps and all non-target indices stay byte-for-byte unchanged.

**Paving extraction remains first**, as required by the existing extractor. Thereafter the new cut commutes with the completed west/canopy/hotel/Howe-podium/tower/near-podium cuts. Original-scene compatibility must run before any extraction/cut. The implementation never treats368/604 as post-cut offsets.

New supports start at the original wall bottom below the retained pier surface. The retained PIER closes the bottom; no horizontal replacement is laid on its top. Intermediate slabs have real top/bottom/side faces. The source roof closes the top over the inward footprint: new upward faces there are omitted. Only the new outward coping lip keeps its exposed top. Full opaque backs, piers and fascia/reveal returns keep service cavities closed. This is an exterior reconstruction without a new walking route.

All new vertices fit inside the pre-existing0.55m SAILS collision allowance, including the0.35m fascia. Existing conservative collision therefore covers the physical projection without additional barriers, support overrides or exemptions. Inward bays stay private/closed under that policy.

## Materials and cost

Four batches: pale mineral, muted service metal, recessed dark glazing and closed backing. The mineral material clones sampler wrappers around existing `canada-place-plinth/{color,normal,roughness}.webp`, the committed CC0 Poly Haven Concrete Wall009 derivative by Charlotte Baglioni; see that asset's existing SOURCES.json/central attribution. Images are shared and no new asset bytes are added. Matched two-metre UV scale and restrained normal strength remain physical surface detail. Materials are uncalibrated estimates; there is no emission or source photograph pasted onto the wall. The existing scene environment supplies reflections; no new probe.

Geometry cost: **2,708 triangles / four batches** (stone178, metal2,280, glass120, backing130). No new per-frame work. The original22 triangles are removed. Source collision and geometry outside this face are unchanged.

## Integration contract

Root loader owns integration. Before mutations call `canadaPlaceEastTerminalCompatible(gltf.scene)`. After mandatory paving extraction and Howe/hotel/canopy/west cuts, run the existing atomic tower (3,140) and near-podium (70) transactions, then call atomic `replaceCanadaPlaceEastTerminalSource(canadaReplacementSource)` and require22. Collect both required baked primitives whenever this preflight is enabled. The lower-level per-primitive helper is available but not needed for this atomic loader integration. On failure retain source and do not install candidate. Add `createCanadaPlaceEastTerminal(materials).group` beneath the existing Canada Place parent with its existing origin and +0.08Y only after successful source replacement. No World, support, camera or probe hook is required.

Tests decode the actual GLB and verify exact removal/preservation, preflight, atomic failure, commuting prior cuts, retained floor/roof contact across the inset strip, no duplicate upward cap, first-hit recessed backs/columns/slab tops and every vertex within the existing collision envelope. Native close/arrival/drive views still need root acceptance; source uncertainty and estimated service levels remain explicit.
