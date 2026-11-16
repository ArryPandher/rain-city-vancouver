import * as T from "three";

/** Read current resources on demand, including asynchronous image completion. */
export function readNorthShoreDiagnostics(
  terrain?: T.Group,
  photo?: T.MeshBasicMaterial,
) {
  let meshCount = 0;
  let material: T.MeshStandardMaterial | T.MeshBasicMaterial | undefined =
    photo;
  terrain?.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    meshCount++;
    if (!material && object.material instanceof T.MeshStandardMaterial)
      material = object.material;
  });
  const map = material?.map;
  const image = map?.image as { width?: number; height?: number } | undefined;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  return {
    mode: terrain ? "dem" : "photo",
    groupName:
      terrain?.name ??
      (photo ? "Photographic North Shore mountain horizon" : null),
    meshCount: terrain ? meshCount : photo ? 1 : 0,
    imageryStatus: terrain
      ? (terrain.userData.imageryStatus ?? "not-requested")
      : photo
        ? width > 0 && height > 0
          ? "ready"
          : "loading"
        : "not-requested",
    material: material
      ? {
          name: material.name,
          type: material.type,
          mapName: map?.name ?? null,
          vertexColors: material.vertexColors,
          fog: material.fog,
        }
      : null,
    texture: map ? { width, height, colorSpace: map.colorSpace } : null,
  };
}
