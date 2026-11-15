# Granville Square Howe wing: replacement audit

The ordinary parked-car view at `artifacts/local/rim-satin-before.jpg` exposes a
large chopped/repeating brick facade behind the car. This is a whole-scene
architectural error, not a texture-seam problem. It is the next architecture
priority within the Canada Place/Howe scene.

## Identified source and current error

The mapped building is **w208599553**, centred approximately at world
**(518.05, -427.30)** / **49.286866, -123.112864**, between PwC and Granville
Square. The saved camera's horizontal centre ray intersects its Howe edge,
[(516.049,-456.630),(497.549,-437.130)], at (501.273,-441.056), about 25.7 m away.
The generic architecture fallback receives `building=yes` without reliable
height/date/type metadata, invents a 12.8 m heritage block, selects
`gastown-arches`, repeats that photograph every 15 by 6 m and adds fictional
shop signs. The footprint is useful; the inferred architecture is wrong.

[A matching 2015 Howe photograph and author context](https://vanasitwas.wordpress.com/2015/08/09/waterfront-station-howe-street-entry/)
([direct photograph](https://vanasitwas.wordpress.com/wp-content/uploads/2015/08/img_0368.jpg))
shows a modern concrete office wing with deep rectangular window bands,
strongly splayed/cantilevered concrete sections, a tall pale vertical sign
volume and the separate curved-glass Waterfront Station entry in front.
The photograph is historical reference only, with no runtime redistribution
permission established. It is not a source for a texture asset.

[The property owner's aerial](https://assets.cadillacfairview.com/transform/f5d7a51c-9cdf-44b1-9d3f-aac40189536a/200-Granville-Aerial)
also shows the connected modern complex. Existing cached OSM and City source
parts locate the same wing. City parts 161153 and 162139 cover approximately
71.5% and 24.3% of its footprint; their recorded top elevations are 34.4 and
30.12 m. PwC's existing normalization subtracts 19.32 m, giving provisional
15.08/10.80 m relative values, **not surveyed heights above this street**.
Register the datum and levels against the sloping street/photo before adopting
them. The figures must not be blindly used for a new extrusion.

## Next implementation

Add a dedicated handler for this building ID before generic architecture.
Replace its invented brick facade, shops and arbitrary parapet with the
registered roof-part massing, physical recessed rectangular glazing, concrete
belt sections and source-supported sign volume. Reuse existing mineral/glass
materials. Keep Granville Square tower w128409618 and parkade w116527978 separate.

The station entry has separate OSM node 3633792226 at approximately
(479.749,-428.519); its glass pavilion is supported by the photograph, but its
roof footprint remains unresolved. Do not invent an entrance polygon or move
it onto the wing merely to fill the view.

Review at the saved car pose and along the walking/driving route, with close
oblique views, source-registration checks and collision/grade coverage. This
audit changes the next action; it does not implement the replacement or
establish AAA fidelity.
