import * as T from "three";
import { CANADA_PLACE_PROMENADE_FIXTURES } from "./canada-place-promenade-fixtures-data";
import { CANADA_PLACE_FIXTURE_DIMENSIONS } from "./canada-place-promenade-fixtures";

/** Visual foot radius, not the intentionally larger collision envelope.
 * 80mm falloff/22% indirect occlusion are restrained rendering estimates. */
export const CANADA_PLACE_FIXTURE_CONTACT = {
  radius: CANADA_PLACE_FIXTURE_DIMENSIONS.baseRadius,
  falloff: 0.08,
  strength: 0.22,
} as const;
/** Original source-local X/Z, the same frame as paving's (uv.x,-uv.y). */
export const CANADA_PLACE_FIXTURE_CONTACT_CENTERS =
  CANADA_PLACE_PROMENADE_FIXTURES.map((p) => [p.x, p.z] as const);

/** Explicit capability gate: absent/failed fixture integration must shade nothing. */
export function canadaPlaceFixtureContactUniforms(enabled = false) {
  return {
    fixtureContactEnabled: { value: enabled ? 1 : 0 },
    fixtureContactCenters: {
      value: CANADA_PLACE_FIXTURE_CONTACT_CENTERS.map(
        (p) => new T.Vector2(...p),
      ),
    },
  };
}
/** CPU semantic reference: returned factor multiplies indirect light only. */
export function canadaPlaceFixtureContact(
  x: number,
  z: number,
  enabled = false,
) {
  if (!enabled || !Number.isFinite(x) || !Number.isFinite(z)) return 1;
  const { radius, falloff, strength } = CANADA_PLACE_FIXTURE_CONTACT;
  let distance: number = falloff;
  for (const [cx, cz] of CANADA_PLACE_FIXTURE_CONTACT_CENTERS)
    distance = Math.min(
      distance,
      Math.max(0, Math.hypot(x - cx, z - cz) - radius),
    );
  const t = Math.min(1, distance / falloff);
  return 1 - strength * (1 - t * t * (3 - 2 * t));
}
/** Append to fragment <common>. Call only after <aomap_fragment>, multiplying
 * reflectedLight.indirectDiffuse and indirectSpecular. Never diffuseColor or
 * direct light. Reuses existing source-local varying; no new draw/map/geometry. */
export const CANADA_PLACE_FIXTURE_CONTACT_GLSL = `
uniform float fixtureContactEnabled;
uniform vec2 fixtureContactCenters[${CANADA_PLACE_FIXTURE_CONTACT_CENTERS.length}];
float canadaFixtureContact(vec2 sourcePoint){
 if(fixtureContactEnabled<0.5)return 1.0;
 float d=${CANADA_PLACE_FIXTURE_CONTACT.falloff};
 for(int i=0;i<${CANADA_PLACE_FIXTURE_CONTACT_CENTERS.length};i++){
  d=min(d,max(0.0,length(sourcePoint-fixtureContactCenters[i])-${CANADA_PLACE_FIXTURE_CONTACT.radius}));
 }
 return 1.0-${CANADA_PLACE_FIXTURE_CONTACT.strength}*(1.0-smoothstep(0.0,${CANADA_PLACE_FIXTURE_CONTACT.falloff},d));
}
`;
