# Ironworkers path contact shadows

Native `artifacts/local/ironworkers-path-fixed-walk.png` shows the now-continuous, opaque path but weak grounding of the player and nearby fence. The actual path, curbs and physical rail/picket batches created by `createRenderGroup` previously retained Three's default receiveShadow/castShadow=false.

This change sets the path to receive shadows, without making the full receiving deck cast. Curbs and physical rail/post batches receive and cast. Visible near-LOD physical picket boxes receive and cast. Distant filtered full-pitch proxy cells explicitly neither cast nor receive: the single-sample shadow pass cannot reproduce their MSAA coverage and must not turn them into solid fence sheets. Shadow-map traversal respects the current LOD child visibility.

No material darkening, new light, altered geometry, contact shape, instance matrix, LOD distance or beauty draw was introduced. The existing24maximum beauty draws remain. Physical posts, rails, curbs and near pickets participate in the existing shadow/cache pipeline.

## Cost and checks

The new shadow test uses the real bridge grade and source boundary geometry. It verifies all flags, unchanged original top triangles/member matrices, retained materials and LOD visibility. Across current LOD-center camera samples, the largest CPU-selected caster set is7meshes/144,480triangles before the light's own frustum culling, including4,924near pickets. The two existing full-span curb/rail batches contribute85,392triangles to that bound. Their coarse batch bounds can keep whole buffers submitted when only a local region is visible. This is an explicit added shadow cost, not an FPS or GPU timing claim.

Five focused tests pass (shadow contract plus picket coverage/integration). Scoped strict TypeScript passes. Native review should verify player/rail contact on the fixed path, no solid distant-proxy shadow, and the resulting shadow pass cost. If full-span static member shadow submission is excessive, changing their batching is a separate measured optimization; do not conceal that issue through arbitrary material darkening. No build/browser performed by this implementation agent.
