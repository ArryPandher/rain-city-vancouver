# Harbour Green fountain pier profiles

2026-11-14. Original exterior detail, based on directly inspected local photographs:

- Vincent Helton's [Harbour Green Park project](https://www.vincenthelton.com/harbour-green-park), close-up `artifacts/local/harbour-green-reference/photo-2.jpg`: [original image](https://images.squarespace-cdn.com/content/v1/55aec7ede4b05604afa5cb69/1440454297164-Z4DBOJU1L76JV46XSF6M/Harbour+Green+Park+Water+Feature+-+Vincent+Helton+1.jpg).
- The same designer's wider `photo-0.jpg`, showing the recurring capped piers and dark V-shaped faces: [original image](https://images.squarespace-cdn.com/content/v1/55aec7ede4b05604afa5cb69/1440454299469-APNV7QC1G7W0SEU3YOIE/Harbour+Green+Park+Water+Feature+-+Vincent+Helton+2.jpg).
- Darwin Construction `photo-4.jpg` establishes the piers' relationship to the central Bute stairs; see `harbour-frontage.md` for that photograph's provenance.

The close-up shows pale dressed blocks separated by horizontal joints, layered cap beds below the pyramids, framed inset faces and dark triangular spout/plate motifs. New original geometry interprets those features without including photograph pixels, plaques, lettering, tenant identities or internal plumbing. Existing credited CC0 cast-concrete maps are reused with a restrained normal scale; they are generic material, not a scan of the site.

`fountainStoneMaterials(materials)` creates three shared materials. Call `buildFountainStonePier(mesh, u, v, sharedMaterials)` in place of the former body box, cap box and cone. The caller retains the existing obstacle/trunk collision. The outer body/cap envelope and pyramid footprint remain within the previous geometry; peak remains `HARBOUR_POOL_LEVEL + 1.90`. Facade surrounds stand ahead of actual recessed panel geometry. Canopy/frontage and fountain water are separate components.

Panel placement, joint widths and exact cut-stone dimensions are bounded interpretations. The source does not establish every unseen face or current condition. Tests verify finite geometry, unchanged envelope/peak and external raycast evidence of recess depth; they do not establish photorealism. Parent must inspect the ordinary gameplay view and close pedestrian approach before accepting this refinement.
