import { FrameSample, type FrameSampleContext } from "./rendering/frame-sample";
import * as T from "three";
import { StaticShadowCache } from "./rendering/static-shadow-cache";
import { profileRender } from "./rendering/render-profile";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { loadDetailedCharacter } from "./game/detailed-character";
import { loadDetailedCar } from "./world/detailed-car";
import { ContactOcclusion } from "./rendering/contact-occlusion";
import { SceneReflections } from "./rendering/reflection-probes";
import { loadCity, LANDMARKS, geo, ungeo } from "./world/data";
import { World, Weather } from "./world/world";
import { UI } from "./ui/ui";
import { Actors, Vehicle } from "./game/actors";
import { makeCharacter, makeWeapon, Character } from "./game/character";
import { drive, damp, angleDelta } from "./game/physics";
import { GameAudio } from "./game/audio";
import { PointerInput } from "./game/pointer-input";
import { Combat, WEAPONS } from "./game/combat";
import { Missions, formatTime } from "./game/missions";
import "./ui/style.css";
const ui = new UI();
class Game {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 24000);
  renderer: T.WebGLRenderer;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  contactOcclusion: ContactOcclusion;
  reflections?: SceneReflections;
  world!: World;
  actors!: Actors;
  character!: Character;
  combat!: Combat;
  missions!: Missions;
  audio = new GameAudio();
  vehicle: Vehicle | null = null;
  viewWeapons: T.Group[] = [];
  player = new T.Vector3();
  heading = 0;
  velocityY = 0;
  keys = new Set<string>();
  running = false;
  ready = false;
  photo = false;
  mouseLocked = false;
  pointerInput = new PointerInput();
  pointerLockPending = false;
  pointerLockUnavailable = false;
  pointerFallbackHintShown = false;
  mouseDown = false;
  aiming = false;
  mouseYaw = 0;
  pitch = 0.19;
  sensitivity = 0.75;
  cameraMode = 0;
  quality = "balanced";
  time = 0;
  last = 0;
  uiTimer = 0;
  fps = 60;
  damage = 0;
  health = 100;
  runtimeErrors: string[] = [];
  footSpeed = 0;
  autoCameraTimer = 0;
  lastSafe = new T.Vector3();
  photoPos = new T.Vector3();
  targetCourse = false;
  targetTime = 0;
  lastWorldUpdate = 0;
  lastMini = 0;
  frameCount = 0;
  private frameSample?: FrameSample;
  private frameSampleReport?: HTMLPreElement;
  private frameSampleButton?: HTMLButtonElement;
  shadowCache = new StaticShadowCache();
  footstepDistance = 0;
  headlights: T.SpotLight[] = [];
  constructor() {
    this.renderer = new T.WebGLRenderer({
      canvas: ui.$("world") as HTMLCanvasElement,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    const recordError = (message: string) => {
      if (!this.runtimeErrors.includes(message))
        this.runtimeErrors.push(message.slice(0, 2000));
      if (this.runtimeErrors.length > 20) this.runtimeErrors.shift();
    };
    window.addEventListener("error", (event) => recordError(event.message));
    window.addEventListener("unhandledrejection", (event) =>
      recordError(String(event.reason)),
    );
    this.renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      const message = [
        gl.getProgramInfoLog(program),
        gl.getShaderInfoLog(vertex),
        gl.getShaderInfoLog(fragment),
      ]
        .filter(Boolean)
        .join("\n");
      recordError(`Shader compilation: ${message}`);
      console.error(message);
    };
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.info.autoReset = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    const target = new T.WebGLRenderTarget(innerWidth, innerHeight, {
      samples: 4,
      type: T.HalfFloatType,
    });
    target.depthTexture = new T.DepthTexture(
      innerWidth,
      innerHeight,
      T.UnsignedIntType,
    );
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.contactOcclusion = new ContactOcclusion(this.scene, this.camera);
    this.composer.addPass(this.contactOcclusion);
    this.bloom = new UnrealBloomPass(
      new T.Vector2(innerWidth, innerHeight),
      0.12,
      0.4,
      2.2,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    const grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader:
        "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float v=smoothstep(.85,.22,distance(vUv,vec2(.5)));c*=.87+.13*v;gl_FragColor=vec4(c,1.);}",
    });
    this.composer.addPass(grade);
    for (const side of [-1, 1]) {
      const light = new T.SpotLight(0xd6e6ff, 0, 80, 0.46, 0.6, 1.0);
      light.userData.side = side;
      this.scene.add(light, light.target);
      this.headlights.push(light);
    }
    ui.actions = {
      start: (m) => this.start(m),
      resume: () => this.resume(),
      pause: () => this.pause(),
      travel: (id) => this.travel(id),
      weather: (w) => this.setWeather(w as Weather),
      quality: (q) => this.setQuality(q),
      volume: (v) => this.audio.setVolume(v),
      sensitivity: (v) => {
        this.sensitivity = v;
      },
      reset: () => this.recover(),
      title: () => this.title(),
      activity: (id) => this.activity(id),
      photo: () => this.togglePhoto(),
      screenshot: () => this.screenshot(),
      car: () => this.summon("car"),
      bike: () => this.summon("bike"),
    };
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("keydown", (e) => this.keyDown(e));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.clearPointerInput();
      if (this.running) this.pause();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.running) this.pause();
    });
    document.addEventListener("pointerlockchange", () => {
      const wasLocked = this.mouseLocked;
      this.mouseLocked =
        document.pointerLockElement === this.renderer.domElement;
      this.clearPointerInput();
      if (this.mouseLocked) {
        this.pointerLockPending = false;
        this.pointerLockUnavailable = false;
      } else if (wasLocked && this.running && !this.photo) this.pause();
    });
    this.renderer.domElement.addEventListener("click", () => {
      if (this.running || this.photo) this.lock();
    });
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const delta = this.pointerInput.move(
        e.clientX,
        e.clientY,
        e.movementX,
        e.movementY,
        e.buttons,
        (this.running && !ui.modalOpen && !ui.mapOpen) || this.photo,
        this.mouseLocked,
      );
      this.syncPointerInput();
      if (!delta) return;
      this.mouseYaw -= delta[0] * 0.0022 * this.sensitivity;
      this.pitch = Math.max(
        -0.95,
        Math.min(0.9, this.pitch + delta[1] * 0.0018 * this.sensitivity),
      );
      this.autoCameraTimer = 2.3;
    });
    // Mouse button events include chord changes (left fire while right aiming),
    // unlike pointerdown, which only fires for the first pressed mouse button.
    this.renderer.domElement.addEventListener("mousedown", (e) => {
      const accepted = this.pointerInput.down(e.button, e.clientX, e.clientY, {
        active: this.running && !ui.modalOpen && !ui.mapOpen,
        canvas: e.target === this.renderer.domElement,
        locked: this.mouseLocked,
        weapon: !!this.combat && !this.combat.holstered && !this.vehicle,
      });
      this.syncPointerInput();
      if (accepted) e.preventDefault();
    });
    this.renderer.domElement.addEventListener("pointerdown", (e) => {
      if (
        e.pointerType !== "mouse" ||
        this.mouseLocked ||
        !this.running ||
        ui.modalOpen ||
        ui.mapOpen ||
        e.target !== this.renderer.domElement ||
        ![0, 2].includes(e.button)
      )
        return;
      try {
        this.renderer.domElement.setPointerCapture(e.pointerId);
      } catch {}
    });
    window.addEventListener("mouseup", (e) => {
      this.pointerInput.up(e.button);
      this.syncPointerInput();
    });
    window.addEventListener("pointerup", (e) => {
      if (!e.buttons && this.renderer.domElement.hasPointerCapture(e.pointerId))
        this.renderer.domElement.releasePointerCapture(e.pointerId);
    });
    this.renderer.domElement.addEventListener("lostpointercapture", () =>
      this.clearPointerInput(),
    );
    window.addEventListener("pointercancel", () => this.clearPointerInput());
    this.renderer.domElement.addEventListener("contextmenu", (e) =>
      e.preventDefault(),
    );
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.pause();
      ui.error(
        "The graphics context was interrupted. Reload the game. If this repeats, use Performance graphics and close other graphics-heavy tabs.",
      );
    });
  }
  async init() {
    const data = await loadCity();
    ui.data = data;
    // Fetch actor assets while the independent city geometry and textures prepare.
    const actorAssets = Promise.all([
      loadDetailedCar().catch((e) =>
        console.warn("Detailed car unavailable; using built-in model", e),
      ),
      loadDetailedCharacter().catch((e) =>
        console.warn("Detailed character unavailable; using built-in model", e),
      ),
    ]);
    this.world = new World(this.scene, data);
    await this.world.build((s, n) => ui.loading(s, n * 0.82));
    this.reflections = new SceneReflections(
      this.scene,
      this.world.root,
      this.world.chunks,
      this.world.sun,
      this.world.reflections,
    );
    ui.loading("Preparing your ride and character", 0.89);
    await actorAssets;
    this.actors = new Actors(this.world);
    this.character = makeCharacter(this.world.materials);
    this.scene.add(this.character.group, this.camera);
    for (let i = 0; i < 3; i++) {
      const weapon = makeWeapon(this.world.materials, i);
      weapon.rotation.set(0, Math.PI, 0);
      weapon.position.set(0.19, -0.2, -0.36);
      weapon.visible = false;
      this.camera.add(weapon);
      this.viewWeapons.push(weapon);
      const skin = new T.MeshStandardMaterial({
        color: 0xb58b6e,
        roughness: 0.85,
      });
      const hand = new T.Mesh(new T.CapsuleGeometry(0.035, 0.055, 4, 12), skin);
      hand.position.set(0.012, -0.085, -0.005);
      hand.rotation.x = -0.45;
      weapon.add(hand);
    }
    this.combat = new Combat(
      this.world,
      this.actors,
      this.audio,
      this.character,
    );
    this.combat.onHit = () => {
      if (this.targetCourse && this.combat.hits === 6) {
        ui.toast(
          `Six targets down · ${formatTime(this.targetTime)} · ${this.combat.shots} shots`,
        );
        this.targetCourse = false;
        this.audio.notify();
      }
    };
    this.missions = new Missions(this.world, (t) => {
      ui.toast(t);
      this.audio.notify();
    });
    const spawn = this.spawnPoint("canada");
    this.player.set(spawn.x, 0, spawn.z);
    this.heading = spawn.heading;
    this.vehicle = this.actors.addVehicle(
      "car",
      spawn.x,
      spawn.z,
      spawn.heading,
    );
    this.actors.populate(spawn.x, spawn.z);
    this.actors.update(0, this.player, this.vehicle);
    const bikeSpot = this.world.collision.safe(spawn.x + 8, spawn.z + 4, 1);
    this.actors.addVehicle("bike", ...bikeSpot, spawn.heading);
    this.character.group.visible = false;
    this.world.onDetailReady = () => this.setQuality(this.quality);
    this.setQuality(localStorage.getItem("rain-city-quality") || "balanced");
    const w = localStorage.getItem("rain-city-weather");
    if (w && ["day", "golden", "overcast", "night"].includes(w))
      this.setWeather(w as Weather);
    if (this.quality !== "low" && this.reflections) {
      ui.loading("Preparing local reflections", 0.94);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      for (const probe of this.world.reflections)
        this.reflections.update(
          this.renderer,
          new T.Vector3(...probe.position),
        );
    }
    ui.loading("Warming up the renderer", 0.97);
    this.setCamera(true);
    // The scene renders into the composer's HDR target before OutputPass applies
    // tone mapping. Warm the same shader variants used during gameplay.
    const previousTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.composer.readBuffer);
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } finally {
      this.renderer.setRenderTarget(previousTarget);
    }
    if (new URLSearchParams(location.search).has("debug")) {
      const panel = document.createElement("details");
      panel.id = "render-profile";
      panel.style.cssText =
        "position:fixed;left:12px;top:85px;z-index:1000;max-width:580px;max-height:70vh;overflow:auto;background:#101a20e8;color:#dce8eb;padding:8px;font:11px monospace;pointer-events:auto";
      const title = document.createElement("summary");
      title.textContent = "Render diagnostics";
      const button = document.createElement("button");
      button.textContent = "Profile one frame";
      const report = document.createElement("pre");
      report.style.cssText =
        "white-space:pre-wrap;margin:8px 0;max-width:550px";
      button.addEventListener("click", () => {
        report.textContent = JSON.stringify(
          {
            ...profileRender(this.renderer, this.scene, this.camera, () =>
              this.render(),
            ),
            treeDetail: this.world.treeDetailStream?.status,
            streetTreeLOD: this.world.detailedTrees?.lodState,
            camera: {
              position: this.camera.position.toArray(),
              fov: this.camera.fov,
              yaw: this.mouseYaw,
              pitch: this.pitch,
              mode: this.cameraMode,
            },
            player: this.player.toArray(),
          },
          null,
          2,
        );
      });
      const sampleButton = document.createElement("button");
      sampleButton.textContent = "Sample 20 seconds";
      const sampleReport = document.createElement("pre");
      sampleReport.id = "frame-sample-result";
      sampleReport.style.cssText = report.style.cssText;
      this.frameSampleButton = sampleButton;
      this.frameSampleReport = sampleReport;
      sampleButton.addEventListener("click", () => {
        this.frameSample = new FrameSample(this.frameSampleContext());
        const inactive = this.frameSampleInactive();
        if (inactive) {
          this.finishFrameSample(inactive);
          return;
        }
        sampleButton.disabled = true;
        sampleReport.textContent = JSON.stringify({
          state: "sampling",
          targetSeconds: 20,
          start: this.frameSample.start,
        });
      });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.finishFrameSample("document hidden");
      });
      panel.append(title, button, sampleButton, report, sampleReport);
      document.body.append(panel);
    }
    this.ready = true;
    this.lastSafe.copy(this.player);
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
    ui.loading("Ready", 1);
    (window as unknown as { rainCity: unknown }).rainCity = {
      game: this,
      state: () => this.debugState(),
      travel: (id: string) => this.travel(id),
      start: (mode: "drive" | "walk" = "drive") => this.start(mode),
      pause: () => this.pause(),
      resume: () => this.resume(),
      activity: (id: string) => this.activity(id),
    };
  }
  spawnPoint(id: string) {
    const l = LANDMARKS.find((l) => l.id === id) || LANDMARKS[0];
    const p = this.world.collision.nearestRoad(...l.spawn, 100);
    const [x, z] = this.world.collision.safe(
      p?.x ?? l.spawn[0],
      p?.z ?? l.spawn[1],
      1.2,
    );
    return {
      x,
      z,
      heading: ["ironworkers", "harbour-green"].includes(id)
        ? l.heading
        : (p?.heading ?? l.heading),
    };
  }
  start(mode: "drive" | "walk") {
    if (!this.ready) return;
    ui.started();
    if (mode === "walk" && this.vehicle) this.exitVehicle();
    else if (mode === "drive" && !this.vehicle) this.summon("car");
    this.running = true;
    this.audio.init();
    this.mouseYaw = this.heading;
    this.pitch = 0.19;
    this.setCamera(true);
    this.lock();
    ui.toast(
      mode === "drive"
        ? "WASD to drive · E to get out · M to explore the city"
        : "WASD to walk · V for a car · 1, 2, 3 for weapons",
    );
  }
  syncPointerInput() {
    this.mouseDown = this.pointerInput.firing;
    this.aiming = this.pointerInput.aiming;
  }
  clearPointerInput() {
    this.pointerInput.reset();
    this.syncPointerInput();
  }
  lock() {
    if (
      this.pointerLockUnavailable &&
      !this.pointerFallbackHintShown &&
      this.running
    ) {
      this.pointerFallbackHintShown = true;
      ui.toast(
        "Drag to look · Weapon out: right-drag to aim, left-click to fire",
      );
    }
    if (
      document.pointerLockElement === this.renderer.domElement ||
      this.pointerLockPending ||
      this.pointerLockUnavailable
    )
      return;
    this.pointerLockPending = true;
    // Some embedded browsers silently ignore the request. One bounded check
    // enables drag controls without repeat permission requests on every click.
    window.setTimeout(() => {
      this.pointerLockPending = false;
      if (document.pointerLockElement === this.renderer.domElement) return;
      this.pointerLockUnavailable = true;
      if (!this.pointerFallbackHintShown && this.running) {
        this.pointerFallbackHintShown = true;
        ui.toast(
          "Drag to look · Weapon out: right-drag to aim, left-click to fire",
        );
      }
    }, 750);
    try {
      const p = this.renderer.domElement.requestPointerLock();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {}
  }
  resume() {
    if (!this.ready || ui.introOpen) return;
    this.running = true;
    ui.resume();
    this.audio.init();
    this.keys.clear();
    this.lock();
  }
  pause() {
    if (!this.ready) return;
    this.finishFrameSample("game paused");
    this.running = false;
    this.clearPointerInput();
    this.keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.suspend();
    if (!ui.introOpen) ui.pause();
  }
  title() {
    this.pause();
    ui.title();
    this.photo = false;
    ui.show("photo-ui", false);
  }
  keyDown(e: KeyboardEvent) {
    if (
      ["INPUT", "SELECT", "TEXTAREA"].includes(
        (e.target as HTMLElement)?.tagName,
      )
    )
      return;
    const c = e.code;
    if (
      [
        "Space",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Tab",
      ].includes(c)
    )
      e.preventDefault();
    this.keys.add(c);
    if (e.repeat) return;
    if (c === "Escape") {
      if (ui.modalOpen) {
        ui.closePanel();
        return;
      }
      if (ui.mapOpen) {
        ui.closeMap();
        return;
      }
      if (this.photo) {
        if (document.pointerLockElement) document.exitPointerLock();
        return;
      }
      if (this.running) this.pause();
      else if (!ui.introOpen) this.resume();
      return;
    }
    if (!this.ready || ui.introOpen) return;
    if (c === "KeyM") {
      if (ui.mapOpen) ui.closeMap();
      else ui.showMap();
      return;
    }
    if (c === "KeyP") {
      this.togglePhoto();
      return;
    }
    if (this.photo && c === "Enter") {
      this.screenshot();
      return;
    }
    if (!this.running) return;
    if (c === "KeyE") this.vehicle ? this.exitVehicle() : this.enterVehicle();
    if (c === "KeyV") this.summon("car");
    if (c === "KeyB") this.summon("bike");
    if (c === "KeyR") this.vehicle ? this.recover() : this.combat.reload();
    if (c === "KeyQ") this.combat.holster();
    if (c === "Digit1" || c === "Digit2" || c === "Digit3") {
      if (!this.vehicle) this.combat.select(Number(c.at(-1)) - 1);
      else ui.toast("Step out with E to equip a weapon.");
    }
    if (c === "KeyC") {
      this.cameraMode = (this.cameraMode + 1) % 3;
      ui.toast(
        ["Chase camera", "Close camera", "Hood / first-person camera"][
          this.cameraMode
        ],
      );
    }
    if (c === "KeyT") {
      const list: Weather[] = ["day", "golden", "overcast", "night"];
      this.setWeather(
        list[(list.indexOf(this.world.weather) + 1) % list.length],
      );
      ui.toast(
        this.world.weather === "day"
          ? "Pacific daylight"
          : this.world.weather === "golden"
            ? "Golden hour"
            : this.world.weather === "night"
              ? "Vancouver after dark"
              : "Vancouver rain",
      );
    }
    if (c === "KeyH") {
      this.audio.horn();
      this.actors.panic(this.player.x, this.player.z);
    }
    if (
      c === "Space" &&
      !this.vehicle &&
      this.player.y <=
        this.world.collision.height(
          this.player.x,
          this.player.z,
          this.player.y,
        ) +
          0.05
    )
      this.velocityY = 5.0;
  }
  enterVehicle() {
    const near = this.actors.nearest(this.player.x, this.player.z, 7);
    if (!near) {
      ui.toast("Walk closer to a vehicle, or press V to bring a car.");
      return;
    }
    this.vehicle = near;
    near.ai = false;
    near.state.speed = near.state.vx = near.state.vz = 0;
    near.state.steer = 0;
    this.combat.holster();
    this.player.set(
      near.state.x,
      this.world.collision.height(
        near.state.x,
        near.state.z,
        near.model.group.position.y,
      ),
      near.state.z,
    );
    this.heading = near.state.heading;
    this.mouseYaw = this.heading;
    this.pitch = 0.18;
    this.character.group.visible = near.kind === "bike";
    this.audio.init();
    ui.toast(
      near.kind === "bike"
        ? "Seawall cycle · Shift to pedal harder"
        : "Pacific GT · Shift for full throttle · Space to brake",
    );
  }
  exitVehicle() {
    const v = this.vehicle;
    if (!v) return;
    if (Math.abs(v.state.speed) > 9) {
      ui.toast("Slow down before getting out.");
      return;
    }
    const side = new T.Vector3(
      Math.cos(v.state.heading) * 2.3,
      0,
      -Math.sin(v.state.heading) * 2.3,
    );
    let p = this.world.collision.safe(
      v.state.x + side.x,
      v.state.z + side.z,
      0.4,
    );
    this.player.set(
      p[0],
      this.world.collision.height(...p, this.player.y),
      p[1],
    );
    this.heading = v.state.heading;
    v.state.speed = v.state.vx = v.state.vz = 0;
    this.vehicle = null;
    this.character.group.visible = true;
    this.mouseYaw = this.heading;
    this.pitch = 0.12;
    this.setCamera(true);
  }
  summon(kind: "car" | "bike") {
    if (!this.ready) return;
    if (this.vehicle) {
      this.vehicle.state.speed = 0;
      this.exitVehicle();
    }
    const nearest = this.world.collision.nearestRoad(
      this.player.x,
      this.player.z,
      100,
    );
    const p = this.world.collision.safe(
      nearest?.x ?? this.player.x,
      nearest?.z ?? this.player.z,
      1.2,
    );
    const heading = nearest?.heading ?? this.heading;
    // Keep summoned vehicles clear of the ride we just left and ambient traffic.
    let spot: [number, number] | null = null;
    for (const distance of [0, 12, -12, 20, -20, 30]) {
      for (const lateral of [0, 3, -3]) {
        const x =
          p[0] + Math.sin(heading) * distance + Math.cos(heading) * lateral;
        const z =
          p[1] + Math.cos(heading) * distance - Math.sin(heading) * lateral;
        if (
          !this.world.collision.blocked(x, z, 1.3) &&
          !this.world.collision.water(x, z) &&
          this.actors.vehicles.every(
            (v) => Math.hypot(v.state.x - x, v.state.z - z) > 6,
          )
        ) {
          spot = [x, z];
          break;
        }
      }
      if (spot) break;
    }
    if (!spot) {
      ui.toast(
        "This street is crowded. Walk to a clear spot to bring a vehicle.",
      );
      return;
    }
    p[0] = spot[0];
    p[1] = spot[1];
    const v = this.actors.addVehicle(
      kind,
      ...p,
      heading,
      false,
      0x375f68,
      this.player.y,
    );
    this.vehicle = v;
    this.combat.holster();
    this.player.set(
      p[0],
      this.world.collision.height(...p, this.player.y),
      p[1],
    );
    this.heading = heading;
    this.mouseYaw = heading;
    this.pitch = 0.18;
    this.character.group.visible = kind === "bike";
    this.setCamera(true);
    ui.toast(
      kind === "bike"
        ? "Your seawall ride is ready."
        : "Your Pacific GT is ready.",
    );
  }
  recover() {
    const p = this.world.collision.nearestRoad(
      this.player.x,
      this.player.z,
      220,
    );
    let pos = p ? [p.x, p.z] : [this.lastSafe.x, this.lastSafe.z];
    if (this.world.collision.water(pos[0], pos[1]))
      pos = [this.lastSafe.x, this.lastSafe.z];
    this.player.set(
      pos[0],
      this.world.collision.height(pos[0], pos[1]),
      pos[1],
    );
    this.health = 100;
    this.velocityY = 0;
    if (this.vehicle) {
      Object.assign(this.vehicle.state, {
        x: pos[0],
        z: pos[1],
        heading: p?.heading ?? this.heading,
        speed: 0,
        vx: 0,
        vz: 0,
        steer: 0,
      });
      this.vehicle.health = 100;
      this.heading = this.vehicle.state.heading;
      this.actors.sync(this.vehicle, 0);
    }
    this.mouseYaw = this.heading;
    this.setCamera(true);
    ui.toast("Back on the road.");
  }
  travel(id: string) {
    const p = this.spawnPoint(id);
    this.player.set(p.x, this.world.collision.height(p.x, p.z), p.z);
    this.heading = p.heading;
    this.mouseYaw = p.heading;
    this.pitch = 0.19;
    this.velocityY = 0;
    this.lastSafe.copy(this.player);
    if (this.vehicle) {
      Object.assign(this.vehicle.state, {
        x: p.x,
        z: p.z,
        heading: p.heading,
        speed: 0,
        vx: 0,
        vz: 0,
        steer: 0,
      });
      this.actors.sync(this.vehicle, 0);
    }
    this.actors.recycle(this.player, this.vehicle, true);
    this.setCamera(true);
    ui.mapOpen = false;
    ui.show("map-layer", false);
    this.resume();
    ui.toast(LANDMARKS.find((l) => l.id === id)?.name || "Vancouver");
  }
  activity(id: string) {
    if (id === "targets") {
      if (this.vehicle) {
        this.vehicle.state.speed = 0;
        this.exitVehicle();
      }
      this.combat.targetCourse(this.player.x, this.player.z, this.mouseYaw);
      this.targetCourse = true;
      this.targetTime = 0;
      this.missions.start("free");
      ui.toast(
        "Target practice · 1 / 2 / 3 to switch · Right mouse to aim · R reload",
      );
    } else {
      this.targetCourse = false;
      if (id === "seawall") {
        this.travel("stanley");
        this.summon("bike");
      }
      this.missions.start(id);
    }
    ui.mapOpen = false;
    ui.show("map-layer", false);
    this.resume();
  }
  setWeather(w: Weather) {
    if (!this.world) return;
    this.world.setWeather(w);
    this.reflections?.setNight(w === "night");
    this.reflections?.invalidate();
    this.bloom.threshold = w === "night" ? 1.15 : w === "golden" ? 1.7 : 2.2;
    this.bloom.strength = w === "night" ? 0.21 : 0.12;
    try {
      localStorage.setItem("rain-city-weather", w);
    } catch {}
  }
  setQuality(q: string) {
    this.quality = q;
    if (q === "low") this.reflections?.invalidate();
    if (this.world?.detailedTrees)
      this.world.detailedTrees.budget =
        q === "high" ? 48 : q === "low" ? 0 : 24;
    if (this.world?.forestDetail)
      this.world.forestDetail.budget = q === "high" ? 24 : q === "low" ? 0 : 8;
    if (this.world?.coastalVegetation)
      this.world.coastalVegetation.enabled = q !== "low";
    if (this.world?.detailedArchitecture)
      this.world.detailedArchitecture.budget =
        q === "high" ? 384 : q === "low" ? 64 : 192;
    const ratio =
      q === "high"
        ? Math.min(2, devicePixelRatio)
        : q === "low"
          ? 1
          : Math.min(1.35, devicePixelRatio);
    this.renderer.setPixelRatio(ratio);
    this.composer.setPixelRatio(ratio);
    this.renderer.shadowMap.enabled = q !== "low";
    this.bloom.enabled = q !== "low";
    this.contactOcclusion.enabled = q !== "low";
    this.contactOcclusion.updateGtaoMaterial({
      samples: q === "high" ? 16 : 8,
    });
    this.resize();
    try {
      localStorage.setItem("rain-city-quality", q);
    } catch {}
  }
  togglePhoto() {
    if (!this.ready || ui.introOpen) return;
    if (this.photo) {
      this.photo = false;
      ui.show("photo-ui", false);
      this.resume();
      this.setCamera(true);
    } else {
      this.pause();
      ui.show("pause", false);
      this.photo = true;
      this.photoPos.copy(this.camera.position);
      this.mouseYaw = this.heading;
      this.pitch = 0.15;
      ui.show("photo-ui");
      this.lock();
    }
  }
  screenshot() {
    ui.show("photo-ui", false);
    this.render();
    const link = document.createElement("a");
    link.download = `rain-city-vancouver-${Date.now()}.png`;
    link.href = this.renderer.domElement.toDataURL("image/png");
    link.click();
    ui.show("photo-ui");
    ui.toast("Photo saved.");
  }
  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
    if (ui.mapOpen) ui.drawMap();
  }
  setCamera(immediate = false, dt = 0.016) {
    // Aerial views need depth precision for water/road layers separated by centimetres.
    const near = ui.introOpen
      ? 8
      : this.photo
        ? Math.min(8, Math.max(0.35, this.photoPos.y * 0.025))
        : this.cameraMode === 2
          ? 0.08
          : 0.35;
    if (this.camera.near !== near) {
      this.camera.near = near;
      this.camera.updateProjectionMatrix();
    }
    this.viewWeapons.forEach((w, i) => {
      w.visible =
        !ui.introOpen &&
        !this.photo &&
        !this.vehicle &&
        this.cameraMode === 2 &&
        !this.combat?.holstered &&
        this.combat?.selected === i;
      w.position.set(
        this.aiming ? 0.06 : 0.17,
        -0.2 +
          Math.sin(this.time * 8) * Math.min(0.008, this.footSpeed * 0.0015),
        this.aiming ? -0.52 : -0.48,
      );
      w.rotation.x = this.combat
        ? Math.min(0.11, this.combat.cooldown * 0.25)
        : 0;
    });
    if (ui.introOpen) {
      const p = geo(49.2858, -123.1081);
      this.camera.position.set(
        p[0] + Math.sin(this.time * 0.018) * 28,
        88,
        p[1] + Math.cos(this.time * 0.018) * 20,
      );
      const look = geo(49.29, -123.118);
      this.camera.lookAt(look[0], 23, look[1]);
      this.camera.fov = 56;
      this.camera.updateProjectionMatrix();
      return;
    }
    if (this.photo) {
      const d = this.keys.has("ShiftLeft") ? 45 : 15;
      const f =
          (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0),
        s = (this.keys.has("KeyA") ? 1 : 0) - (this.keys.has("KeyD") ? 1 : 0);
      this.photoPos.x +=
        (Math.sin(this.mouseYaw) * f + Math.cos(this.mouseYaw) * s) * d * dt;
      this.photoPos.z +=
        (Math.cos(this.mouseYaw) * f - Math.sin(this.mouseYaw) * s) * d * dt;
      this.photoPos.y +=
        ((this.keys.has("KeyE") ? 1 : 0) - (this.keys.has("KeyQ") ? 1 : 0)) *
        d *
        dt;
      this.camera.position.copy(this.photoPos);
      this.camera.lookAt(
        this.photoPos.x + Math.sin(this.mouseYaw) * 10,
        this.photoPos.y - Math.sin(this.pitch) * 10,
        this.photoPos.z + Math.cos(this.mouseYaw) * 10,
      );
      return;
    }
    const veh = this.vehicle,
      first = this.cameraMode === 2,
      distance = veh
        ? veh.kind === "bike"
          ? 5
          : this.cameraMode === 1
            ? 5.8
            : 8.7
        : this.aiming
          ? 1.2
          : 4.3;
    let yaw = this.mouseYaw;
    if (veh && Math.abs(veh.state.speed) > 1.5 && this.autoCameraTimer <= 0) {
      this.mouseYaw +=
        angleDelta(this.mouseYaw, veh.state.heading) * Math.min(1, dt * 2.7);
      this.pitch = damp(this.pitch, 0.18, 1.5, dt);
      yaw = this.mouseYaw;
    }
    const focus = this.player.clone();
    focus.y += veh?.kind === "car" ? 1.2 : 1.52;
    const desired = new T.Vector3();
    if (first) {
      desired
        .copy(this.player)
        .add(
          new T.Vector3(
            Math.sin(this.heading) * (veh ? 1.5 : 0),
            veh ? 1.35 : 1.69,
            Math.cos(this.heading) * (veh ? 1.5 : 0),
          ),
        );
      this.camera.position.lerp(
        desired,
        immediate ? 1 : 1 - Math.exp(-18 * dt),
      );
      this.camera.lookAt(
        desired.x + Math.sin(yaw) * 20,
        desired.y - Math.sin(this.pitch) * 20,
        desired.z + Math.cos(yaw) * 20,
      );
    } else {
      desired
        .copy(focus)
        .add(
          new T.Vector3(
            -Math.sin(yaw) * distance,
            Math.max(0.25, Math.sin(this.pitch) * distance) +
              (veh ? 1.05 : 0.3),
            -Math.cos(yaw) * distance,
          ),
        );
      if (!veh && this.aiming) {
        desired.x += Math.cos(yaw) * 0.55;
        desired.z -= Math.sin(yaw) * 0.55;
      }
      // Shorten the chase boom against mapped buildings so the camera stays outside walls.
      for (let t = 0.15; t <= 1; t += 0.085) {
        const p = focus.clone().lerp(desired, t);
        if (this.world.collision.blocked(p.x, p.z, 0.25) && p.y < 45) {
          desired.copy(focus).lerp(desired, Math.max(0.12, t - 0.09));
          break;
        }
      }
      desired.y = Math.max(
        this.world.collision.height(desired.x, desired.z, this.player.y) + 0.5,
        desired.y,
      );
      this.camera.position.lerp(
        desired,
        immediate ? 1 : 1 - Math.exp(-(veh ? 8 : 12) * dt),
      );
      const look = focus
        .clone()
        .add(
          new T.Vector3(
            Math.sin(yaw) * (this.aiming ? 20 : 3),
            -Math.sin(this.pitch) * (this.aiming ? 20 : 2),
            Math.cos(yaw) * (this.aiming ? 20 : 3),
          ),
        );
      this.camera.lookAt(look);
    }
    this.character.group.visible = (!veh || veh.kind === "bike") && !first;
    const targetFov =
      this.aiming && !veh
        ? 48
        : veh
          ? 62 + Math.min(10, Math.abs(veh.state.speed) * 0.17)
          : 62;
    this.camera.fov = damp(this.camera.fov, targetFov, 5, dt);
    this.camera.updateProjectionMatrix();
  }
  simulate(dt: number) {
    this.autoCameraTimer = Math.max(0, this.autoCameraTimer - dt);
    let throttle =
        (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
        (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0),
      steer =
        (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0) -
        (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0);
    const boost = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    if (this.vehicle) {
      const v = this.vehicle,
        s = v.state,
        ox = s.x,
        oz = s.z;
      drive(
        s,
        { throttle, steering: steer, brake: this.keys.has("Space"), boost },
        dt,
        v.kind === "bike",
      );
      const result = this.world.collision.move(
        ox,
        oz,
        s.x - ox,
        s.z - oz,
        v.kind === "bike" ? 0.45 : 1.16,
        this.player.y,
      );
      s.x = result.x;
      s.z = result.z;
      if (v.kind === "car") {
        for (const sign of [-1, 1]) {
          if (
            this.world.collision.blocked(
              s.x + Math.sin(s.heading) * 1.35 * sign,
              s.z + Math.cos(s.heading) * 1.35 * sign,
              0.9,
              this.player.y,
            )
          ) {
            s.x = ox;
            s.z = oz;
            result.hit = true;
            break;
          }
        }
      }
      if (result.hit) {
        const speed = Math.abs(s.speed);
        if (speed > 5) {
          v.health = Math.max(0, v.health - speed * 0.25);
          this.damage = 0.6;
          this.audio.hit();
        }
        s.speed *= 0.15;
        s.vx *= 0.15;
        s.vz *= 0.15;
      }
      for (const other of this.actors.vehicles) {
        if (other === v || !other.model.group.visible) continue;
        if (
          Math.hypot(s.x - other.state.x, s.z - other.state.z) < 2.1 &&
          Math.abs(s.speed) > 2
        ) {
          s.speed *= -0.2;
          s.vx *= -0.15;
          s.vz *= -0.15;
          other.state.speed = 0;
          this.damage = 0.3;
          this.audio.hit();
        }
      }
      this.heading = s.heading;
      this.player.set(
        s.x,
        this.world.collision.height(s.x, s.z, this.player.y),
        s.z,
      );
      this.actors.sync(v, dt);
      v.model.brakes.emissiveIntensity =
        this.keys.has("Space") || throttle < 0 ? 4 : 0.65;
      if (v.kind === "bike") {
        this.character.group.position.copy(v.model.group.position);
        this.character.group.rotation.copy(v.model.group.rotation);
        this.character.update(
          this.time,
          Math.abs(s.speed),
          false,
          true,
          v.model.group.userData.pedalPhase ?? 0,
        );
      }
      this.audio.update(s.speed, true, v.kind === "bike", throttle);
    } else {
      const speed = this.aiming ? 2.0 : boost ? 6.8 : 3.2,
        forward = new T.Vector3(
          Math.sin(this.mouseYaw),
          0,
          Math.cos(this.mouseYaw),
        ),
        right = new T.Vector3(
          Math.cos(this.mouseYaw),
          0,
          -Math.sin(this.mouseYaw),
        ),
        move = forward
          .multiplyScalar(throttle)
          .add(right.multiplyScalar(steer));
      if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);
      const moved = this.world.collision.move(
        this.player.x,
        this.player.z,
        move.x,
        move.z,
        0.36,
        this.player.y,
      );
      this.player.x = moved.x;
      this.player.z = moved.z;
      const ground = this.world.collision.height(
        this.player.x,
        this.player.z,
        this.player.y,
      );
      this.velocityY -= 17 * dt;
      this.player.y = Math.max(ground, this.player.y + this.velocityY * dt);
      if (this.player.y <= ground) this.velocityY = 0;
      this.footSpeed = move.length() / dt;
      this.heading +=
        angleDelta(
          this.heading,
          this.aiming || !this.combat.holstered
            ? this.mouseYaw
            : move.lengthSq() > 0
              ? Math.atan2(move.x, move.z)
              : this.heading,
        ) * Math.min(1, dt * 12);
      this.character.group.position.copy(this.player);
      this.character.group.rotation.set(0, this.heading, 0);
      this.character.update(this.time, this.footSpeed, !this.combat.holstered);
      if (this.mouseDown && this.combat.shoot(this.camera)) {
        this.pitch -= WEAPONS[this.combat.selected].recoil;
        this.autoCameraTimer = 1;
      }
      this.audio.update(this.footSpeed, false, false, 0);
      if (this.velocityY === 0) {
        this.footstepDistance += move.length();
        if (this.footstepDistance > 0.85) {
          this.footstepDistance = 0;
          this.audio.step();
        }
      }
    }
    if (
      this.world.collision.water(this.player.x, this.player.z, this.player.y)
    ) {
      this.damage = 0.65;
      this.recover();
      ui.toast("The harbour won that round. You’re back on dry land.");
    } else if (this.time % 2 < dt) this.lastSafe.copy(this.player);
    this.actors.update(dt, this.player, this.vehicle);
    this.combat.update(dt);
    this.missions.update(
      dt,
      this.player.x,
      this.player.z,
      this.vehicle?.state.speed ?? this.footSpeed,
    );
    if (this.targetCourse) this.targetTime += dt;
    this.damage = Math.max(0, this.damage - dt * 1.5);
  }
  updateHUD() {
    const veh = this.vehicle,
      nearest = veh ? null : this.actors.nearest(this.player.x, this.player.z);
    let loc = LANDMARKS[0],
      dist = Infinity;
    for (const l of LANDMARKS) {
      const d = Math.hypot(this.player.x - l.at[0], this.player.z - l.at[1]);
      if (d < dist) {
        loc = l;
        dist = d;
      }
    }
    const road = this.world.collision.nearestRoad(
      this.player.x,
      this.player.z,
      30,
    );
    ui.$("district").textContent = loc.district;
    ui.$("street").textContent =
      dist < 130 ? loc.name : road?.road.name || loc.district;
    ui.$("clock").textContent =
      this.world.weather === "night"
        ? "22:16"
        : this.world.weather === "overcast"
          ? "14:08"
          : this.world.weather === "day"
            ? "13:24"
            : "17:42";
    ui.show("speed-panel", !!veh);
    ui.show("ammo", !veh && !this.combat.holstered);
    ui.show("crosshair", !veh && !this.combat.holstered);
    ui.$("crosshair").classList.toggle("hit", this.combat.hitFlash > 0);
    ui.$("mode").textContent = veh
      ? veh.kind === "bike"
        ? "SEAWALL CYCLE"
        : "PACIFIC GT"
      : "ON FOOT";
    (ui.$("health") as HTMLElement).style.width =
      `${veh ? veh.health : this.health}%`;
    if (veh) {
      const km = Math.round(Math.abs(veh.state.speed) * 3.6);
      ui.$("speed").textContent = km.toString().padStart(3, "0");
      const gear =
        veh.state.speed < -0.2
          ? "R"
          : veh.state.speed < 0.5
            ? "N"
            : Math.min(6, 1 + Math.floor(km / 38)).toString();
      ui.$("vehicle-name").textContent =
        `${veh.name} · ${veh.kind === "bike" ? "Coastal ride" : gear + " / 6"}`;
      ui.root
        .querySelectorAll(".rev-bar i")
        .forEach((el, i) =>
          el.classList.toggle("active", i < ((km % 38) / 38) * 15 + 1),
        );
      ui.$("prompt").innerHTML = "<kbd>E</kbd> Get out";
      ui.$("key-guide").innerHTML =
        "<span><kbd>WASD</kbd> Drive</span><span><kbd>Space</kbd> Brake</span><span><kbd>C</kbd> Camera</span><span><kbd>P</kbd> Photo</span>";
    } else {
      ui.$("prompt").innerHTML = nearest
        ? `<kbd>E</kbd> ${nearest.kind === "bike" ? "Ride the bike" : "Get in " + nearest.name}`
        : this.combat.holstered
          ? "<kbd>V</kbd> Bring a car &nbsp; <kbd>B</kbd> Bring a bike"
          : "<kbd>R</kbd> Reload &nbsp; <kbd>Q</kbd> Holster";
      ui.$("key-guide").innerHTML =
        "<span><kbd>WASD</kbd> Move</span><span><kbd>1 2 3</kbd> Weapons</span><span>Right mouse Aim</span><span>Left mouse Fire</span>";
      const w = WEAPONS[this.combat.selected];
      ui.$("ammo").querySelector(".name")!.textContent = w.name;
      ui.$("ammo").querySelector(".rounds")!.innerHTML =
        `${this.combat.ammo[this.combat.selected]} <small>/ ${this.combat.reserve[this.combat.selected]}</small>`;
      ui.$("ammo").querySelector(".reload-label")!.textContent =
        this.combat.reloadLeft > 0
          ? "RELOADING"
          : this.combat.ammo[this.combat.selected] === 0
            ? "R · RELOAD"
            : "";
    }
    const mission = this.missions.active;
    ui.show("mission", !!mission || this.targetCourse);
    if (mission) {
      const c = mission.checkpoints[mission.index],
        dist = Math.hypot(this.player.x - c.at[0], this.player.z - c.at[1]);
      ui.$("mission").querySelector(".mission-name")!.textContent =
        mission.name;
      ui.$("mission").querySelector(".mission-step")!.textContent =
        `${c.name} · ${dist > 1000 ? (dist / 1000).toFixed(1) + " km" : Math.round(dist) + " m"}`;
      ui.$("mission").querySelector(".mission-timer")!.textContent =
        `${mission.index}/${mission.checkpoints.length} checkpoints · ${formatTime(mission.elapsed)}`;
    } else if (this.targetCourse) {
      ui.$("mission").querySelector(".mission-name")!.textContent =
        "Target practice";
      ui.$("mission").querySelector(".mission-step")!.textContent =
        `${this.combat.hits} / 6 targets`;
      ui.$("mission").querySelector(".mission-timer")!.textContent = formatTime(
        this.targetTime,
      );
    }
    ui.$("damage").style.opacity = String(this.damage);
    if (new URLSearchParams(location.search).has("debug"))
      ui.$("fps").textContent =
        `${Math.round(this.fps)} fps · ${this.renderer.info.render.calls} calls · ${(this.renderer.info.render.triangles / 1000).toFixed(0)}k tris · Position ${this.player
          .toArray()
          .map((v) => v.toFixed(2))
          .join(", ")} · Heading ${this.heading.toFixed(3)}`;
  }
  private frameSampleContext(): FrameSampleContext {
    return {
      viewport: {
        width: this.renderer.domElement.clientWidth,
        height: this.renderer.domElement.clientHeight,
        pixelRatio: this.renderer.getPixelRatio(),
      },
      preset: this.quality,
      weather: this.world.weather,
      position: [this.player.x, this.player.y, this.player.z],
    };
  }
  private frameSampleInactive() {
    return document.hidden
      ? "document hidden"
      : ui.introOpen
        ? "intro open"
        : !this.running
          ? "game paused"
          : this.photo
            ? "photo mode"
            : undefined;
  }
  private finishFrameSample(reason?: string) {
    if (!this.frameSample) return;
    const result = this.frameSample.finish(this.frameSampleContext(), reason);
    this.frameSample = undefined;
    if (this.frameSampleReport)
      this.frameSampleReport.textContent = JSON.stringify(result, null, 2);
    if (this.frameSampleButton) this.frameSampleButton.disabled = false;
  }
  frame(now: number) {
    requestAnimationFrame((t) => this.frame(t));
    if (this.frameSample) {
      const inactive = this.frameSampleInactive();
      if (inactive) this.finishFrameSample(inactive);
    }
    if (document.hidden) {
      this.last = now;
      return;
    }
    const rawDt = (now - this.last) / 1000;
    if (this.frameSample?.add(rawDt)) this.finishFrameSample();
    const dt = Math.min(0.05, rawDt);
    this.last = now;
    this.time += dt;
    this.fps = damp(this.fps, 1 / Math.max(0.001, rawDt), 1, dt);
    if (this.running) {
      let remain = dt;
      while (remain > 0) {
        const step = Math.min(1 / 60, remain);
        this.simulate(step);
        remain -= step;
      }
    }
    if (this.time - this.lastWorldUpdate > 0.15) {
      const viewPosition = this.photo ? this.photoPos : this.player;
      this.world.update(
        this.running || ui.introOpen ? 0.15 : 0,
        viewPosition.x,
        viewPosition.z,
        viewPosition.y,
        this.camera,
      );
      this.lastWorldUpdate = this.time;
    }
    this.setCamera(false, dt);
    if (this.running && this.time - this.uiTimer > 0.1) {
      this.updateHUD();
      this.uiTimer = this.time;
    }
    if (this.running && this.time - this.lastMini > 0.35) {
      ui.updateMini(this.player.x, this.player.z, this.heading);
      this.lastMini = this.time;
    }
    this.render();
    this.frameCount++;
  }
  render() {
    if (!ui.introOpen && this.quality !== "low")
      this.reflections?.update(
        this.renderer,
        this.photo ? this.photoPos : this.player,
      );
    for (const light of this.headlights) {
      const v = this.vehicle,
        active =
          v?.kind === "car" &&
          (this.world?.weather === "night" ||
            this.world?.weather === "overcast");
      light.intensity = active ? (this.world.weather === "night" ? 95 : 30) : 0;
      if (v && active) {
        const h = v.state.heading,
          side = light.userData.side;
        light.position.set(
          v.state.x + Math.sin(h) * 1.95 + Math.cos(h) * side * 0.69,
          this.player.y + 0.71,
          v.state.z + Math.cos(h) * 1.95 - Math.sin(h) * side * 0.69,
        );
        light.target.position.set(
          v.state.x + Math.sin(h) * 45,
          this.player.y + 0.1,
          v.state.z + Math.cos(h) * 45,
        );
      }
    }
    this.renderer.info.reset();
    this.shadowCache.render(
      this.renderer,
      this.camera,
      `${this.lastWorldUpdate}/${this.world.weather}/${this.quality}`,
      this.running || ui.introOpen,
      () => this.composer.render(),
    );
  }
  debugState() {
    return {
      ready: this.ready,
      running: this.running,
      photo: this.photo,
      position: this.player.toArray(),
      geo: ungeo(this.player.x, this.player.z),
      heading: this.heading,
      vehicle: this.vehicle
        ? {
            kind: this.vehicle.kind,
            speed: this.vehicle.state.speed,
            health: this.vehicle.health,
          }
        : null,
      ammo: this.combat.ammo,
      weapon: this.combat.selected,
      holstered: this.combat.holstered,
      targetsHit: this.combat.hits,
      mission: this.missions.active,
      weather: this.world.weather,
      fps: Math.round(this.fps),
      render: this.renderer.info.render,
      stats: this.world.stats,
      errors: [...this.runtimeErrors],
    };
  }
}
async function boot() {
  try {
    const game = new Game();
    await game.init();
  } catch (e) {
    console.error(e);
    ui.error(
      e instanceof Error
        ? e.message
        : "A graphics error interrupted loading. Please reload in a WebGL 2 compatible browser.",
    );
  }
}
void boot();
