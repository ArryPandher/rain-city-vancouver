# Bounded approximate Canada Place integration

2026-11-14. Planning only. A civil survey is not a prerequisite for a coherent game scene. The official entrance plan and elevated-street description support authoring a connected raised street/plaza system now, with estimated grades clearly recorded. All elevations below are local model coordinates, not geodetic claims.

## Recommended scope

Keep Canada Place and its mast/rigging anchors fixed. Use the **actual modeled exposed deck top, world y=7.88**, as the pedestrian endpoint. Reconstruct the mapped north Howe approach and eastern Canada Place street, adjoining sidewalks/front plaza and west-promenade connection as a supported network. Keep Cordova and unrelated blocks at their existing datum. Preserve the existing VCC/Jack Poole geometry; tie into its current eastern approach at Burrard, not a flat arbitrary western edge.

Use a shared surface function plus explicit pedestrian/road offsets. Existing asphalt is `roadHeight + .092`, generic walkways `+.15`, sidewalks `+.15`. Therefore a pedestrian finished level of 7.88 means ground baseline 7.73 where these offsets apply; otherwise adding 7.88 to ground creates a second 15cm step. A custom plaza should use its finished level directly. These small offsets must be reconciled once rather than piled on top of the deck.

## Measured road spans and illustrative grades

Offline measurements from current `public/data/vancouver-roads.json`, saved in `grade-audit.json`:

| Link | Source | Length | Existing endpoint ground | Proposed relationship |
|---|---|---:|---|---|
| Cordova `(443.7,-400)` → `(478.4,-443.5)` | Howe w232195213 |55.7m|0 →0|start ascent at Cordova |
| → north Howe `(503.5,-479.2)` | w1255990033 |44.6m|0 →0|continue same longitudinal profile |
| → Canada Place `(496.3,-492.2)` | w1550614843 |15.5m|0 →0|finish ascent before front-plaza street |
| → `(427.8,-525.6)` | Canada Place w1255990035 |76.2m|0 →0|raised waterfront street |
| → Burrard `(325.5,-568.2)` | w706831744 |110.8m|0 →4.993|blend to existing VCC approach |
| Burrard south to Cordova `(279.7,-517.4)` | w1255590706 + w50162810 |68.8m|4.993 →0|retain existing approach profile initially |

The 115.8m Howe approach can rise 7.73m at an average **6.68%**. A profile with 15m linear-slope easements at each end has approximately **7.67% maximum grade**, with continuous zero slope at the junctions. This is a moderate urban street grade, not a claimed gentle accessible ramp. A simplistic smoothstep across the entire length would peak near10%, so avoid it. An estimated raised intersection/front-plaza level is source-consistent even though the precise real-world gradient is unknown.

A strict 5% maximum rise needs at least154.6m without easing, and more with easements. It requires extending south of Cordova and raising that intersection, then blending the east/west Cordova branches and adjoining storefronts. That is a legitimate broader terrain task but is not the smallest Canada Place access repair. Do not conceal this scope by introducing a short steep ramp at the wall.

The eastern Canada Place link is187.0m long. Its baseline7.73 at Howe can decline toward the existing4.993 Burrard node at about1.46% average. Shape the front-plaza end as a level landing and transition westward; sample the full adjoining existing VCC deck boundary, not just the node. This allows a continuous waterfront road without raising the already authored western landmark.

## Existing seams and obstacles that must be handled

- **VCC precedence:** CollisionWorld currently resolves Jack Poole, then VCC deck6.04, then its custom approach. Near Burrard, sampled street heights are around4.99, whereas the adjacent VCC deck is6.04. The Canada function must blend along the real shared edge or explicitly leave the western connection at its existing terrain; a hard rectangular override creates a seam. A check of node heights alone is insufficient.
- **Existing western street is already nonuniform:** w119945021 samples12.02 near Thurlow,5.46 at `(213.8,-613.8)`,0 around `(285.8,-584.5)`, then5.00 at Burrard. This comes from pre-existing Jack/VCC approach fields. Do not propagate an eastern7.88 plateau west across that system or claim this pass repairs all waterfront grading.
- **West side of Howe:** building w363651936 spans roughly x386.5–469.5,z−503.6–−428.1; its centroid ground is0. Its north/east perimeter adjoins the elevated route. Keeping its facade at0 would bury several metres of its current ground floor; shifting its whole body by a sampled centroid would expose/break its Cordova-facing side. Author a bounded retaining/plinth frontage and grade-relative visible entrance/storefront placement along the raised side, keeping the lower side consistent. A blind global building-base uplift is unsafe.
- **East side:** PwC Place w138256216 spans x464.5–520.0,z−427.6–−374.6; w208599553 spans x494.0–549.0,z−456.6–−398.1. Both currently base0. Keep the road's terrain shoulder out of their interiors, use supported sidewalk retaining edges, and audit any doors/steps adjoining the ascent. These are not proof of their real-world multilevel layouts.
- **Waterfront Centre:** w143683980 spans x319.5–380.0,z−549.6–−482.1 with base0. Its north frontage borders raised Canada Place and already sits beside VCC approach. It needs the same facade/plinth contact audit before the western tie can be called visually complete.
- **Hotel/site mass:** relation r16532084 occupies x451.5–574.5,z−599.1–−514.1. This overlaps the site frontage. Do not remove this entire collision polygon to create entry. Use the official plaza footprint and source mesh clear surfaces to retain hotel/hall solids and open only verified exterior public space.

## Rendering and collision work required

`CollisionWorld.groundHeight`/`roadHeight` already drive actors and road placement, so this can be a small site module rather than a new game mode. However, changing height alone is insufficient:

1. Add footprint-based site coverage and a continuous street station profile, with defined shared junction heights. Keep service/parkade routes a separate level, rather than applying the upper field to every road in a rectangle.
2. `world.ts roads()` only subdivides terrain paths for existing terrain/Jack/Harbour/VCC-approach conditions. Include the new site so roads, markings, crossing ribbons and curb sides follow the profile rather than long straight chords. Test shared-node continuity and curb cut heights.
3. Render the actual terrain/deck and retaining faces under elevated ribbons. Current baseline ground is flat; roads alone would float. At building interfaces use a controlled footprint boundary, not a shoulder that slants through a wall.
4. Generic architecture bases are sampled at the centroid (`architecture.ts`). Do not let a broad new field accidentally lift whole blocks. Make building-base policy explicit and adapt affected frontage detail separately. Ground-following props update through existing helpers, but hard-coded trolley/power-line heights in `world.ts` remain near6–6.45 and must be audited above raised roads.
5. Replace only the source-confirmed public-deck collision portion, preserve interior solids, and exclude lower service access/water correctly. Rendering and collision must agree on all retaining edges and deck support.
6. Check height/normal continuity, maximum road grade, footprint clearance, car tyre/body orientation on grades, foot entry from both curb sides, neighboring building contacts, parked/traffic actor heights and native view while approaching. No camera hacks needed.

## What can be authored now / what needs evidence

**Now:** local deck datum, connected front-plaza/Canadian Trail public topology, mapped road centreline and legal directions, approximate continuous grade, source-plan plaza/entrance layout, visible supporting walls and bounded collision masks. Explicitly label the grade as an artistic integration estimate. Existing model/plan data can establish whether the intended path actually lies on an exposed top surface.

**Do not invent:** a specific real staircase/ramp where the plan does not show one, exact surveyed heights, lower parkade/loading connectivity, inaccessible private terraces made public, or facade doors that purport to reproduce unobserved entrances. Survey/current entrance evidence would improve those details, but should not block an honest approximate supported network.

Recommended implementation order: Howe grade + actual front plaza/public-deck connection first; then Canada Place westward tie and affected adjacent frontages in the same acceptance pass. If frontage contact cannot be made plausible within scope, stop the grade footprint at a deliberate supported edge and record the incomplete tie, rather than shipping buried doors or floating buildings.
