# Tree detail startup streaming

2026-11-14. A fresh public load lingered at “Planting Stanley Park”. That progress label previously included base vegetation, broadleaf volume loading, both street-tree LOD models, all ten forest models, forest textures and the full understory placement grid. It was not a measure of tree-placement CPU alone.

## Measurements and limits

Local Node/tsx measurement with the base downtown map converted exactly as the app, current road/public-tree layers and the coarse Stanley terrain grid: collision construction 27–37ms; reconcile 61–62ms; water/building filter 747–753ms; authored forest trees 619–629ms; forest-floor placement 2.22–2.31s. This omits eastern area additions and any finer terrain and is not a browser wall-clock measurement. Script: ignored `artifacts/local/profile-planting.ts`.

Inventory in that calculation: 50,141 mapped/public trees, 49,832 after the filter, 20,215 added conifers, and 70,889 floor sites after forest trunk collisions are registered. The floor grid examines about 169,000 candidates.

Six committed tree GLBs alone total **126.28MiB**, excluding understory, volume textures and other city assets. Street near/medium: 33.1/6.8MiB, 741,374/95,375 triangles. Fir near variants: 26.9/48.9MiB, 463,490/964,225 triangles; medium variants: 4.0/6.7MiB, 48,048/76,555 triangles. Sizes and primitive counts were read from committed files, not inferred from browser timings. At hypothetical 20Mbps, transferring 126MiB alone requires roughly 53 seconds before latency/decode; cache, compression and real bandwidth change this substantially.

## Changed behavior

Base vegetation, solid trunk collision, broadleaf volume fallbacks and coastal vegetation are still prepared before entry. Large optional street/forest detail no longer blocks the build promise. After the world starts updating, a queue starts at most one detail job at a time. The current location prioritizes Stanley detail inside a 350m collar around the park; the forest job remains waiting while the player stays downtown. Street detail streams first downtown. The already visible trees remain until complete detail slots can replace them.

Each detail loader requests one GLB at a time and yields between models. Forest installation yields between model batches; floor candidate generation yields after approximately 5ms CPU slices. New forest mesh counts stay zero and street slot groups stay hidden until placed, preventing origin flashes during asynchronous construction. None of the optional loaders adds collision. Failed jobs retain fallbacks and record failure once rather than retrying each frame.

`world.treeDetailStream.status` exposes waiting/loading/ready/failed with measured elapsed milliseconds for completed jobs. `world.onDetailReady` reapplies the user's current quality setting when a system arrives late. Queue, priority and failure tests pass alongside existing fallback restoration and forest tests.

Limit: these yields bound our scheduling and placement work; GLTFLoader's internal parsing, image decode, individual geometry conversion and GPU upload are not worker-isolated. Actual first-entry duration and worst frame stalls must be checked in the public browser. No claim is made that the 126MiB assets download instantly or that deferred loading eliminates every frame spike.
