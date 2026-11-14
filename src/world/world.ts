import * as T from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  CityData,
  centroid,
  seeded,
  hash,
  roadWidth,
  isStreet,
  geo,
  bounds,
  pointInPoly,
  Road,
} from "./data";
import { Materials, mesh, box, label, BASE } from "./materials";
import { Batcher, flatPolygon, ribbon, walls } from "./geometry";
import { CollisionWorld, BRIDGES } from "./collision";
import { architecture } from "./architecture";
import { buildLandmarks, specialBuilding } from "./landmarks";
export type Weather = "golden" | "overcast" | "night";
export class World {
  root = new T.Group();
  materials = new Materials();
  collision: CollisionWorld;
  chunks: T.Mesh[] = [];
  sun = new T.DirectionalLight(0xffe0b3, 3.2);
  ambient = new T.HemisphereLight(0xc6dfed, 0x697265, 2.0);
  water!: T.ShaderMaterial;
  weather: Weather = "golden";
  rain!: T.Points;
  time = 0;
  skyTextures: Record<string, T.Texture> = {};
  nightLights: T.MeshStandardMaterial[] = [];
  stats = { buildings: 0, trees: 0, roads: 0 };
  constructor(
    public scene: T.Scene,
    public data: CityData,
  ) {
    this.collision = new CollisionWorld(data);
    scene.add(this.root);
    scene.add(this.sun, this.sun.target, this.ambient);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -95;
    this.sun.shadow.camera.right = 95;
    this.sun.shadow.camera.top = 95;
    this.sun.shadow.camera.bottom = -95;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 650;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.14;
    this.sun.shadow.radius = 2.5;
    scene.fog = new T.FogExp2(0xc2cbd0, 0.00032);
  }
  async build(report: (text: string, n: number) => void) {
    report("Loading Vancouver’s streets", 0.12);
    this.collision = new CollisionWorld(this.data);
    this.terrain();
    this.roads();
    await new Promise((r) => setTimeout(r, 20));
    report("Raising the downtown skyline", 0.3);
    this.buildings();
    await new Promise((r) => setTimeout(r, 20));
    report("Planting Stanley Park", 0.49);
    this.vegetation();
    await new Promise((r) => setTimeout(r, 20));
    report("Building the waterfront", 0.68);
    const landmarkRoot = new T.Group();
    this.root.add(landmarkRoot);
    buildLandmarks(landmarkRoot, this.materials);
    this.mergeStatic(landmarkRoot);
    this.streetDetails();
    await new Promise((r) => setTimeout(r, 20));
    report("Lighting the coast", 0.84);
    this.mountains();
    this.createRain();
    try {
      const loader = new RGBELoader();
      const [sunset, overcast, env] = await Promise.all(
        ["sunset", "overcast", "city-reflections"].map((name) =>
          loader.loadAsync(`${BASE}textures/${name}.hdr`),
        ),
      );
      for (const t of [sunset, overcast, env])
        t.mapping = T.EquirectangularReflectionMapping;
      this.skyTextures = { golden: sunset, overcast, night: sunset };
      this.scene.environment = env;
      this.scene.background = sunset;
      this.scene.backgroundRotation.y = 2.3;
      this.scene.environmentRotation.y = 1.2;
      this.scene.backgroundIntensity = 0.8;
      this.scene.environmentIntensity = 0.75;
    } catch {
      this.scene.background = new T.Color(0xb6ccd7);
    }

    this.root.updateMatrixWorld(true);
    this.root.traverse((object) => {
      object.matrixAutoUpdate = false;
      object.matrixWorldAutoUpdate = false;
    });
    this.setWeather("golden");
    report("Ready to explore", 1);
  }
  addEasternRoad() {
    // Authored connector outside the extracted downtown map. The core map remains OSM geometry.
    const coords = [
      [49.28113, -123.097],
      [49.2812, -123.08],
      [49.2818, -123.061],
      [49.2823, -123.046],
      [49.2838, -123.032],
      [49.289, -123.023],
      [49.2941, -123.0236],
    ];
    const r: Road = {
      name: "East Vancouver connector",
      kind: "primary",
      pts: coords.flatMap(([lat, lon]) => geo(lat, lon)),
    };
    this.data.roads.push(r);
    const north: Road = {
      name: "North Shore approach",
      kind: "primary",
      pts: [
        ...geo(49.3153, -123.0286),
        ...geo(49.319, -123.034),
        ...geo(49.324, -123.052),
        ...geo(49.326, -123.075),
        ...geo(49.3276, -123.13645),
      ],
    };
    this.data.roads.push(north);
  }
  terrain() {
    const m = this.materials;
    const floor = mesh(
      new T.PlaneGeometry(24000, 24000),
      m.grass,
      this.root,
      2000,
      -0.09,
      0,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.geometry
      .getAttribute("uv")
      .array.forEach((_, i, a) => (a[i] *= 2800));
    floor.castShadow = false;
    const b = new Batcher(this.root, 600);
    for (const a of this.data.areas) {
      if (a.kind === "water") continue;
      let mat = m.grass;
      if (["parking", "plaza", "campus", "construction"].includes(a.kind))
        mat = m.concrete;
      if (a.kind === "beach")
        mat = new T.MeshStandardMaterial({ color: 0xb2a894, roughness: 1 });
      const [x, z] = centroid(a.pts);
      try {
        b.add(flatPolygon(a.pts, a.holes, 0.0, 8), mat, x, z);
      } catch {}
    }
    const cityBase = mesh(
      flatPolygon(
        [
          bounds.minX,
          bounds.minZ,
          bounds.maxX,
          bounds.minZ,
          bounds.maxX,
          bounds.maxZ,
          bounds.minX,
          bounds.maxZ,
        ],
        [],
        -0.035,
        5,
      ),
      m.concrete,
      this.root,
    );
    cityBase.castShadow = false;
    this.chunks.push(...b.finish(false));
    this.water = new T.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        deep: { value: new T.Color(0x204b58) },
        sky: { value: new T.Color(0xbccdd1) },
        sunDir: { value: new T.Vector3(-0.6, 0.28, -0.5).normalize() },
        sunColor: { value: new T.Color(0xffd5a3) },
        night: { value: 0 },
      },
      vertexShader: `varying vec3 vWorld; varying vec3 vView; void main(){vec4 wp=modelMatrix*vec4(position,1.0);vWorld=wp.xyz;vView=cameraPosition-wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
      fragmentShader: `uniform float time;uniform vec3 deep,sky,sunDir,sunColor;uniform float night;varying vec3 vWorld;varying vec3 vView;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float wave(vec2 p){return sin(p.x*.72+time*.9)*.12+sin(p.y*.92-time*.7)*.09+noise(p*2.+time*.12)*.14+noise(p*.18-time*.08)*.4;}void main(){vec2 p=vWorld.xz;float eps=.15;float dx=wave(p+vec2(eps,0))-wave(p-vec2(eps,0));float dz=wave(p+vec2(0,eps))-wave(p-vec2(0,eps));vec3 n=normalize(vec3(-dx,.65,-dz));vec3 v=normalize(vView);float fres=pow(1.-max(dot(n,v),0.),3.);vec3 color=mix(deep,sky,fres*.85);float spec=pow(max(dot(reflect(-sunDir,n),v),0.),220.);color+=sunColor*spec*2.3*(1.-night*.8);color+=vec3(.12,.16,.16)*pow(noise(p*.13+time*.04),7.);float fog=1.-exp(-length(vView)*.00035);color=mix(color,sky,fog);gl_FragColor=vec4(color,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,
    });
    for (const o of this.data.ocean)
      mesh(flatPolygon(o, [], 0.065, 1), this.water, this.root).castShadow =
        false;
    for (const a of this.data.areas.filter((a) => a.kind === "water"))
      mesh(flatPolygon(a.pts, [], 0.065, 1), this.water, this.root).castShadow =
        false;
    // Ocean outside the core extract, with land on either side of the inlet.
    const oceanRect = (
      minX: number,
      maxX: number,
      minZ: number,
      maxZ: number,
    ) =>
      (mesh(
        flatPolygon(
          [minX, minZ, maxX, minZ, maxX, maxZ, minX, maxZ],
          [],
          0.065,
        ),
        this.water,
        this.root,
      ).castShadow = false);
    oceanRect(-12000, bounds.minX, -18000, 10000);
    oceanRect(bounds.minX, 15000, -18000, -8500);
  }
  roads() {
    const b = new Batcher(this.root, 450),
      m = this.materials;
    const stripes = new T.MeshStandardMaterial({
      color: 0xdfd8c0,
      roughness: 0.6,
    });
    for (const r of this.data.roads) {
      const [x, z] = centroid(r.pts),
        width = roadWidth(r),
        street = isStreet(r);
      const height = (x: number, z: number) => this.collision.height(x, z);
      if (street)
        b.add(
          ribbon(r.pts, width + 5, 0.045, height, 5),
          m.concrete,
          x,
          z,
          "curb",
        );
      b.add(
        ribbon(r.pts, width, street ? 0.082 : 0.11, height, 5),
        street ? m.asphalt : m.concrete,
        x,
        z,
        "road",
      );
      if (street && r.kind !== "residential") {
        for (let i = 0; i < r.pts.length - 2; i += 2) {
          const ax = r.pts[i],
            az = r.pts[i + 1],
            bx = r.pts[i + 2],
            bz = r.pts[i + 3],
            len = Math.hypot(bx - ax, bz - az),
            dx = (bx - ax) / len,
            dz = (bz - az) / len;
          for (let t = 3; t < len - 3; t += 11) {
            const end = Math.min(t + 4.5, len);
            b.add(
              ribbon(
                [ax + dx * t, az + dz * t, ax + dx * end, az + dz * end],
                0.16,
                0.102,
                height,
              ),
              m.yellow,
              ax + dx * t,
              az + dz * t,
              "stripe",
            );
          }
        }
      }
      this.stats.roads++;
    }
    this.chunks.push(...b.finish(false));
  }
  buildings() {
    const result = architecture(
      this.root,
      this.data,
      this.materials,
      this.collision,
    );
    this.chunks.push(...result.chunks);
    this.stats.buildings = result.count;
  }

  vegetation() {
    const rand = seeded(7503),
      m = this.materials,
      trees: number[][] = [];
    for (let i = 0; i < this.data.trees.length; i += 2) {
      const x = this.data.trees[i],
        z = this.data.trees[i + 1];
      if (this.collision.water(x, z) || this.collision.blocked(x, z, 1))
        continue;
      trees.push([x, z, 5 + rand() * 9, rand()]);
    }
    // Densify the forest interior while keeping mapped roads and trails open.
    const stanley = this.data.areas.filter((a) =>
      ["forest", "park"].includes(a.kind),
    );
    for (let i = 0; i < 4400; i++) {
      const [x, z] = geo(49.295 + rand() * 0.017, -123.159 + rand() * 0.03);
      if (
        !stanley.some((a) => pointInPoly(x, z, a.pts)) ||
        this.collision.water(x, z)
      )
        continue;
      const road = this.collision.nearestRoad(x, z, 10);
      if (road && road.d < 7) continue;
      let path = false;
      for (const r of this.collision.roads.query(x, z, 8)) {
        for (let j = 0; j < r.pts.length - 2; j += 2) {
          const ax = r.pts[j],
            az = r.pts[j + 1],
            bx = r.pts[j + 2],
            bz = r.pts[j + 3],
            vx = bx - ax,
            vz = bz - az,
            t = Math.max(
              0,
              Math.min(
                1,
                ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz),
              ),
            );
          if (Math.hypot(x - ax - vx * t, z - az - vz * t) < 5) path = true;
        }
      }
      if (!path) trees.push([x, z, 15 + rand() * 17, rand()]);
    }
    const chunkTrees = new Map<string, number[][]>();
    for (const t of trees) {
      const k = Math.floor(t[0] / 350) + "," + Math.floor(t[1] / 350);
      let a = chunkTrees.get(k);
      if (!a) chunkTrees.set(k, (a = []));
      a.push(t);
    }
    const foliageMap = m.texture("broadleaf-branch.png", true),
      pineMap = m.texture("fir-branch.png", true);
    foliageMap.wrapS =
      foliageMap.wrapT =
      pineMap.wrapS =
      pineMap.wrapT =
        T.ClampToEdgeWrapping;
    const leafMat = new T.MeshStandardMaterial({
      map: foliageMap,
      color: 0xc2cbbb,
      alphaTest: 0.4,
      alphaToCoverage: true,
      side: T.DoubleSide,
      roughness: 0.93,
      emissive: 0x162419,
      emissiveIntensity: 0.16,
    });
    const pineMat = new T.MeshStandardMaterial({
      map: pineMap,
      color: 0xb0bbaa,
      alphaTest: 0.35,
      alphaToCoverage: true,
      side: T.DoubleSide,
      roughness: 1,
      emissive: 0x10251a,
      emissiveIntensity: 0.15,
    });
    const leafParts: T.BufferGeometry[] = [];
    for (let i = 0; i < 165; i++) {
      const u = rand() * Math.PI * 2,
        v = Math.acos(rand() * 2 - 1),
        r = 0.35 + rand() * 0.65;
      const g = new T.PlaneGeometry(0.51 + rand() * 0.22, 0.57 + rand() * 0.24);
      g.rotateX((rand() - 0.5) * Math.PI);
      g.rotateY(rand() * Math.PI * 2);
      g.rotateZ(rand() * Math.PI);
      g.translate(
        Math.sin(v) * Math.cos(u) * r,
        Math.cos(v) * r,
        Math.sin(v) * Math.sin(u) * r,
      );
      leafParts.push(g);
    }
    const crownGeo = mergeGeometries(leafParts)!;
    const pineParts: T.BufferGeometry[] = [];
    for (let layer = 0; layer < 12; layer++) {
      const y = layer * 0.21,
        r = 1 - layer * 0.065;
      for (let j = 0; j < 7; j++) {
        const a = (j * Math.PI * 2) / 7 + layer * 0.7,
          g = new T.PlaneGeometry(r * 0.95, r * 1.35);
        g.rotateX(-0.75);
        g.rotateY(a);
        g.translate(Math.sin(a) * r * 0.47, y, Math.cos(a) * r * 0.47);
        pineParts.push(g);
      }
    }
    const pineGeo = mergeGeometries(pineParts)!;
    const bark = new T.MeshStandardMaterial({
      map: m.texture("fir_tree_01-bark_diff.png", true),
      color: 0xaaa494,
      roughness: 1,
    });
    const dummy = new T.Object3D(),
      color = new T.Color();
    for (const [key, list] of chunkTrees) {
      const trunk = new T.InstancedMesh(
          new T.CylinderGeometry(0.6, 0.9, 1, 8),
          bark,
          list.length,
        ),
        leaves = new T.InstancedMesh(crownGeo, leafMat, list.length),
        pines = new T.InstancedMesh(pineGeo, pineMat, list.length);
      let li = 0,
        pi = 0;
      for (let i = 0; i < list.length; i++) {
        const [x, z, h, t] = list[i];
        dummy.position.set(x, h * 0.35, z);
        dummy.rotation.set(0, t * 6.28, 0);
        dummy.scale.set(h * 0.023, h * 0.7, h * 0.023);
        dummy.updateMatrix();
        trunk.setMatrixAt(i, dummy.matrix);
        const pine = h > 14 && t > 0.2;
        if (pine) {
          dummy.position.set(x, h * 0.4, z);
          dummy.scale.set(h * 0.21, h * 0.22, h * 0.21);
          dummy.updateMatrix();
          pines.setMatrixAt(pi, dummy.matrix);
          color.setHSL(0.18 + t * 0.03, 0.07, 0.65 + t * 0.23);
          pines.setColorAt(pi++, color);
        } else {
          dummy.position.set(x, h * 0.73, z);
          dummy.scale.set(h * 0.32, h * 0.44, h * 0.31);
          dummy.updateMatrix();
          leaves.setMatrixAt(li, dummy.matrix);
          color.setHSL(0.16 + t * 0.09, 0.08 + t * 0.08, 0.65 + t * 0.2);
          leaves.setColorAt(li++, color);
        }
      }
      leaves.count = li;
      pines.count = pi;
      for (const obj of [trunk, leaves, pines]) {
        obj.castShadow = obj.receiveShadow = true;
        obj.computeBoundingSphere();
        obj.userData.center = key.split(",").map((v) => Number(v) * 350 + 175);
        this.root.add(obj);
        this.chunks.push(obj);
      }
    }
    this.stats.trees = trees.length;
  }
  streetDetails() {
    const b = new Batcher(this.root, 240),
      m = this.materials,
      rand = seeded(44);
    const lampMat = new T.MeshStandardMaterial({
      color: 0xffedc7,
      emissive: 0xffd48b,
      emissiveIntensity: 2,
    });
    this.nightLights.push(lampMat);
    const signCache = new Map<string, T.Material>();
    let count = 0;
    for (const r of this.data.roads) {
      if (!isStreet(r) || r.kind === "residential") continue;
      for (let i = 0; i < r.pts.length - 2; i += 2) {
        const ax = r.pts[i],
          az = r.pts[i + 1],
          bx = r.pts[i + 2],
          bz = r.pts[i + 3],
          len = Math.hypot(bx - ax, bz - az);
        if (len < 20) continue;
        const dx = (bx - ax) / len,
          dz = (bz - az) / len,
          offset = roadWidth(r) / 2 + 1.4;
        for (let d = 15; d < len; d += 47) {
          const side = count++ % 2 ? 1 : -1,
            x = ax + dx * d + dz * offset * side,
            z = az + dz * d - dx * offset * side;
          if (this.collision.water(x, z) || this.collision.blocked(x, z, 0.5))
            continue;
          const h = this.collision.height(x, z);
          let geo: T.BufferGeometry = new T.CylinderGeometry(0.055, 0.09, 8, 6);
          geo.translate(x, h + 4, z);
          b.add(geo, m.dark, x, z);
          geo = new T.BoxGeometry(1.4, 0.12, 0.27);
          geo.rotateY(-Math.atan2(dz, dx));
          geo.translate(x - dz * 0.5 * side, h + 8, z + dx * 0.5 * side);
          b.add(geo, m.chrome, x, z);
          geo = new T.BoxGeometry(0.85, 0.04, 0.22);
          geo.translate(x - dz * 0.5 * side, h + 7.92, z + dx * 0.5 * side);
          b.add(geo, lampMat, x, z);
          if (count % 6 === 0) {
            geo = new T.CylinderGeometry(0.23, 0.23, 0.85, 10);
            geo.translate(x + 1, h + 0.43, z);
            b.add(geo, m.dark, x, z);
          }
        }
        if (r.name && i === 0 && len > 38) {
          const x = ax + dx * 10 + dz * offset,
            z = az + dz * 10 - dx * offset;
          if (this.collision.blocked(x, z, 1)) continue;
          let mat = signCache.get(r.name);
          if (!mat) {
            mat = new T.MeshStandardMaterial({
              map: label(
                r.name.toUpperCase(),
                512,
                96,
                "#f5f4e7",
                "#20403c",
                42,
              ),
              roughness: 0.7,
            });
            signCache.set(r.name, mat);
          }
          const sign = new T.BoxGeometry(3.1, 0.53, 0.07);
          sign.rotateY(Math.atan2(dx, dz));
          sign.translate(x, 3.4, z);
          b.add(sign, mat, x, z);
          const pole = new T.CylinderGeometry(0.045, 0.045, 3.4, 6);
          pole.translate(x, 1.7, z);
          b.add(pole, m.chrome, x, z);
          // Zebra crossing near the end of this named street segment.
          for (
            let q = -roadWidth(r) * 0.5 + 1;
            q < roadWidth(r) * 0.5;
            q += 1.2
          ) {
            const stripe = new T.BoxGeometry(0.55, 0.018, 2.8);
            stripe.rotateY(Math.atan2(dx, dz));
            stripe.translate(ax + dx * 5 + dz * q, 0.114, az + dz * 5 - dx * q);
            b.add(stripe, m.white, x, z);
          }
        }
      }
    }
    this.chunks.push(...b.finish());
    // Blade signs mark the entertainment street and face approaching traffic.
    const neonRoot = new T.Group();
    this.root.add(neonRoot);
    const names = ["ORPHEUM", "VOGUE", "GRANVILLE", "RAIN CITY", "COMMODORE"];
    for (let i = 0; i < names.length; i++) {
      const at = geo(49.2807 - i * 0.00055, -123.1217 - i * 0.0007),
        near = this.collision.nearestRoad(...at, 85);
      if (!near) continue;
      const side = i % 2 ? 1 : -1,
        offset = roadWidth(near.road) / 2 - 0.7,
        g = new T.Group();
      g.position.set(
        near.x + Math.cos(near.heading) * offset * side,
        0,
        near.z - Math.sin(near.heading) * offset * side,
      );
      g.rotation.y = near.heading;
      neonRoot.add(g);
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 1024;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#0b151a";
      ctx.fillRect(0, 0, 256, 1024);
      ctx.strokeStyle = ["#efba79", "#ed8d8b", "#9fcddd"][i % 3];
      ctx.lineWidth = 5;
      ctx.strokeRect(12, 12, 232, 1000);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.font = "bold 108px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const letters = names[i].replaceAll(" ", "");
      for (let j = 0; j < letters.length; j++)
        ctx.fillText(letters[j], 128, 70 + (j * 880) / (letters.length - 1));
      const tex = new T.CanvasTexture(c);
      tex.colorSpace = T.SRGBColorSpace;
      const mat = new T.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: 0xffffff,
        emissiveIntensity: 2,
        roughness: 0.55,
      });
      box(g, mat, 0, 12.5, 0, 2.2, 9, 0.48);
      box(g, m.dark, side * 1.35, 16.5, 0, 2.6, 0.13, 0.15);
      box(g, m.dark, side * 1.35, 8.3, 0, 2.6, 0.13, 0.15);
      this.nightLights.push(mat);
    }
    this.mergeStatic(neonRoot);
  }
  mergeStatic(root: T.Group) {
    root.updateWorldMatrix(true, true);
    const batch = new Batcher(this.root, 400),
      remove: T.Mesh[] = [];
    root.traverse((o) => {
      if (
        o instanceof T.Mesh &&
        o.geometry &&
        !(o instanceof T.InstancedMesh) &&
        !Array.isArray(o.material)
      ) {
        const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
        if (!g.getAttribute("uv"))
          g.setAttribute(
            "uv",
            new T.Float32BufferAttribute(
              new Float32Array(g.getAttribute("position").count * 2),
              2,
            ),
          );
        const p = new T.Vector3();
        o.getWorldPosition(p);
        batch.add(g, o.material, p.x, p.z);
        remove.push(o);
      }
    });
    remove.forEach((o) => o.removeFromParent());
    this.chunks.push(...batch.finish());
  }
  mountains() {
    const rand = seeded(451);
    for (let layer = 0; layer < 3; layer++) {
      const width = 28000,
        depth = 5500,
        g = new T.PlaneGeometry(width, depth, 200, 35);
      g.rotateX(-Math.PI / 2);
      const p = g.getAttribute("position"),
        colors: number[] = [];
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          z = p.getZ(i);
        const ridge =
          (Math.sin(x * 0.0007 + layer * 2) * 0.5 + 0.5) * 650 +
          (Math.sin(x * 0.0017 + 0.6) + 1) * 270 +
          (Math.cos(x * 0.0034) * 0.5 + 0.5) * 180;
        const profile = Math.pow(Math.sin((z / depth + 0.5) * Math.PI), 1.4);
        let y = (600 + ridge + rand() * 60) * profile;
        p.setY(i, y);
        const snow = y > 1250 ? Math.min(1, (y - 1250) / 240) : 0;
        const c = new T.Color(layer === 0 ? 0x5c7277 : 0x859598).lerp(
          new T.Color(0xe3e9e7),
          snow,
        );
        colors.push(c.r, c.g, c.b);
      }
      g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
      g.computeVertexNormals();
      const mountain = mesh(
        g,
        new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
        this.root,
        2000,
        -70,
        -6600 - layer * 1600,
      );
      mountain.castShadow = false;
    }
  }
  createRain() {
    const a = new Float32Array(2000 * 3),
      rand = seeded(24);
    for (let i = 0; i < a.length; i += 3) {
      a[i] = (rand() - 0.5) * 70;
      a[i + 1] = rand() * 40;
      a[i + 2] = (rand() - 0.5) * 70;
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(a, 3));
    this.rain = new T.Points(
      g,
      new T.PointsMaterial({
        color: 0xc3dae1,
        size: 0.04,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    );
    this.scene.add(this.rain);
  }
  setWeather(w: Weather) {
    this.weather = w;
    const night = w === "night",
      rain = w === "overcast";
    if (this.skyTextures[w]) this.scene.background = this.skyTextures[w];
    this.sun.color.set(night ? 0xaec9f9 : rain ? 0xcbd9e2 : 0xffc28c);
    this.sun.intensity = night ? 0.32 : rain ? 1.1 : 3.1;
    this.ambient.intensity = night ? 0.4 : rain ? 1.45 : 0.9;
    this.ambient.color.set(night ? 0x4f6d90 : rain ? 0xb7c8d1 : 0xb4c8d8);
    this.scene.backgroundIntensity = night ? 0.045 : rain ? 0.67 : 0.85;
    this.scene.environmentIntensity = night ? 0.45 : rain ? 0.72 : 0.8;
    const fog = this.scene.fog as T.FogExp2;
    fog.color.set(night ? 0x182a3c : rain ? 0x9aaeb8 : 0xb3b1b0);
    fog.density = night ? 0.0006 : rain ? 0.00055 : 0.00023;
    this.materials.setNight(night ? 1 : 0.1);
    this.materials.asphalt.roughness = rain ? 0.25 : 0.5;
    this.materials.asphalt.metalness = rain ? 0.22 : 0.08;
    this.rain.visible = rain;
    this.water.uniforms.deep.value.set(
      night ? 0x091923 : rain ? 0x344d57 : 0x294956,
    );
    this.water.uniforms.sky.value.copy(fog.color);
    this.water.uniforms.sunDir.value.set(-0.71, 0.35, 0.55).normalize();
    this.water.uniforms.night.value = night ? 1 : 0;
    this.nightLights.forEach((m) => (m.emissiveIntensity = night ? 2.0 : 0.25));
  }

  update(dt: number, x: number, z: number) {
    this.time += dt;
    this.water.uniforms.time.value = this.time;
    const sx = Math.round(x / 2) * 2,
      sz = Math.round(z / 2) * 2;
    this.sun.position.set(sx - 220, 110, sz + 170);
    this.sun.target.position.set(sx, 0, sz);
    this.rain.position.set(x, 0, z);
    if (this.rain.visible) {
      const a = this.rain.geometry.getAttribute("position");
      for (let i = 0; i < a.count; i++) {
        let y = a.getY(i) - dt * 25;
        if (y < 0) y = 40;
        a.setY(i, y);
      }
      a.needsUpdate = true;
    }
    for (const c of this.chunks) {
      const p = c.userData.center;
      if (!p) continue;
      const dist = Math.hypot(p[0] - x, p[1] - z);
      c.visible =
        dist <
        (c.userData.detail ? 350 : c instanceof T.InstancedMesh ? 1400 : 2900);
      c.castShadow = c.userData.allowShadow !== false && dist < 210;
    }
  }
}
