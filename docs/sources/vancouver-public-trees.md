# City of Vancouver public-tree inventory

Source: https://opendata.vancouver.ca/explore/dataset/public-trees/
API: https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/public-trees
Licence: https://opendata.vancouver.ca/pages/licence/

**Contains information licensed under the Open Government Licence – Vancouver.**

The 2026-11-14 extract uses source data modified 2026-11-09T14:49:37+00:00. Reproduce from the repository root with `node scripts/fetch-public-trees.mjs`; `--cached` reuses the ignored raw extract. The API `within` polygon bounds are latitude 49.264–49.334, longitude −123.164–−123.010. The export retains only asset ID, common/botanical/cultivar names, height in metres, diameter in centimetres and public coordinates. No address field is distributed.

46,330 source records produce 45,600 unique live tree records, 460 excluded planting-site positions, six invalid/out-of-bounds positions and 264 duplicate IDs or positions rounded to 10 cm. Source height is retained directly; diameter is converted from centimetres to metres. Values outside physical bounds become null. Local projection uses the game's origin 49.283/−123.12 and longitude factor cos(49.2935°) × 111320, with south-positive z at 110540 metres/degree. This matches the existing OSM map conversion.

At runtime, City positions replace OSM tree points within five metres. Empty planting sites suppress OSM points within three metres. Unmatched OSM points remain as private or uninventoried trees. Water/building intersections are excluded from rendering. The procedural Stanley forest and Robson planter trees supplement the point inventories. City coverage does not extend to the North Shore.

Recorded height governs the visual top of the tree. Measured DBH guides trunk thickness. Crown widths are **not in this dataset**: bounded height ratios and botanical/cultivar names estimate broad, columnar and conifer forms. Pyramidal/fastigiate hornbeams and pears are narrower than broad beeches/maples/oaks; conifer genera use the existing licensed fir foliage. Unknown dimensions use deterministic estimates. Nearby broadleaf trees use the existing CC0 Tree Small 02 mesh with independent height/canopy scaling and lower-stem deformation; the sunlight depth material uses the same deformation. This generic model is not an exact species model. Distant crown geometry is normalized to avoid exceeding the same target height.

The City describes a public boulevard/park inventory, excluding private trees. Coordinates largely originate in a 2016 survey and records can lag reality by years. This snapshot does not establish the condition or presence of an individual tree today. It is not a photogrammetric survey or endorsement of Rain City.
