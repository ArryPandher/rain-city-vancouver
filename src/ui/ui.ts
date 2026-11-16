import { CityData, LANDMARKS, Landmark, bounds, geo } from "../world/data";
import { BRIDGES } from "../world/collision";
export interface UIActions {
  start: (mode: "drive" | "walk") => void;
  resume: () => void;
  pause: () => void;
  travel: (id: string) => void;
  weather: (s: string) => void;
  quality: (s: string) => void;
  volume: (v: number) => void;
  sensitivity: (v: number) => void;
  reset: () => void;
  title: () => void;
  activity: (id: string) => void;
  photo: () => void;
  screenshot: () => void;
  car: () => void;
  bike: () => void;
}
const mark = `<svg class="mark" viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M4 28l9-14 8 10 5-8 10 12M11 7L8 12m13-8-3 5m13-2-3 5M4 34h32" stroke="currentColor" stroke-width="1.4"/></svg>`;
export class UI {
  root: HTMLElement;
  actions!: UIActions;
  mini: HTMLCanvasElement;
  map: HTMLCanvasElement;
  mapOpen = false;
  modalOpen = false;
  introOpen = true;
  toastTimer = 0;
  data: CityData | null = null;
  mapZoom = 1;
  mapCenter = [2000, -1400];
  lastPlayer = { x: 0, z: 0, heading: 0 };
  mapPins: { x: number; y: number; id: string }[] = [];
  polyBounds = new WeakMap<number[], number[]>();
  mapDrag: {
    x: number;
    y: number;
    cx: number;
    cz: number;
    moved: boolean;
  } | null = null;
  constructor() {
    this.root = document.getElementById("app")!;
    this.root.innerHTML = `<canvas id="world" aria-label="Rain City Vancouver 3D game"></canvas>
 <section class="layer intro" id="intro" aria-label="Rain City main menu"><header class="brandline"><div class="stamp">${mark}<span class="caps">Vancouver, British Columbia</span></div><span class="mono">49° 17′ N &nbsp; 123° 07′ W</span></header><div class="intro-content"><div class="eyebrow caps">An open-world playground</div><h1 class="title"><span>Rain</span><span class="city">City</span></h1><p class="tagline">From downtown to the seawall.<br>The city is yours.</p><div class="intro-actions"><button class="primary" id="start-drive" disabled>Enter Vancouver <span aria-hidden="true">↗</span></button><button class="secondary" id="start-walk" disabled>Explore on foot</button></div><div class="loading" id="loading"><i></i></div><p class="loading-text" id="loading-text" role="status">Preparing the coast…</p><p class="mobile-note">Best on a computer with a keyboard and mouse.</p></div><footer><div class="footer-links"><button class="text-button" data-panel="help">How to play</button><button class="text-button" data-panel="settings">Settings</button><button class="text-button" data-panel="credits">Credits</button></div><div class="view-caption"><span class="caps">Coal Harbour</span><br><span class="muted">Rain City · Vancouver</span></div></footer></section>
 <div class="layer hud hidden" id="hud"><div class="location"><div class="district" id="district">Coal Harbour</div><div class="street" id="street">Canada Place</div></div><div class="hud-top-right"><span id="clock">17:42</span><button id="map-button" aria-label="Open map">M &nbsp; Map</button><button id="pause-button" aria-label="Pause">Ⅱ</button></div><div class="mission hidden" id="mission"><div class="mission-name"></div><div class="mission-step"></div><div class="mission-timer"></div></div><div class="minimap-wrap"><canvas class="minimap" id="minimap" width="450" height="370"></canvas><div class="health"><i id="health"></i></div><div class="minimap-caption"><span id="mode">PACIFIC GT</span><span>N ↑</span></div></div><div class="speed-panel" id="speed-panel"><div class="speed-row"><span class="speed-num" id="speed">000</span><span class="speed-unit">km/h</span></div><div class="vehicle-name" id="vehicle-name">Pacific GT · RWD</div><div class="rev-bar">${"<i></i>".repeat(15)}</div></div><div class="ammo hidden" id="ammo"><div class="name"></div><div class="rounds"></div><div class="reload-label"></div></div><div class="prompt" id="prompt"><kbd>E</kbd> Exit vehicle</div><div class="key-guide" id="key-guide"></div><div class="crosshair hidden" id="crosshair"></div><span class="fps" id="fps"></span></div>
 <div class="damage" id="damage"></div><div class="toast" id="toast" role="status"></div>
 <section class="modal-shade hidden" id="pause" aria-label="Pause menu"><div class="pause-menu"><div class="caps muted">Vancouver</div><h2>Take a breath.</h2><p class="subtitle">Your city will be here.</p><button class="primary" id="resume">Keep exploring <span>↗</span></button><button class="secondary" id="pause-map">Map & activities</button><button class="secondary" data-panel="settings">Settings</button><button class="secondary" data-panel="help">Controls</button><button class="text-button" id="recover">Recover to the road</button><button class="text-button" id="return-title">Return to title</button></div></section>
 <section class="modal-shade hidden" id="panel" role="dialog" aria-modal="true"><div class="modal"><header class="modal-header"><div><h2 id="panel-title"></h2><span class="muted caps" id="panel-subtitle"></span></div><button class="close" id="panel-close" aria-label="Close dialog">×</button></header><div id="panel-body"></div></div></section>
 <section class="layer map-layer hidden" id="map-layer" aria-label="Vancouver travel map"><header class="map-header"><div><h2>Vancouver</h2><p>Pick a place. Explore Vancouver.</p></div><button class="close" id="map-close" aria-label="Close map">×</button></header><div class="map-content"><aside class="map-sidebar"><div class="map-tabbar"><button class="active" id="places-tab">Places</button><button id="activities-tab">Activities</button></div><div id="map-list"></div></aside><div class="map-surface"><canvas id="city-map"></canvas><div class="map-help">Drag to pan · Scroll to zoom · Select a pin to travel</div><div class="map-legend">● Places &nbsp; ▲ You</div><div class="map-attribution">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></div></div></div></section>
 <div class="photo-ui hidden" id="photo-ui"><div class="photo-header">RAIN CITY / PHOTO MODE</div><div class="photo-controls"><span>WASD Move · Q/E Height · Enter Save · Esc Release mouse</span><button id="capture">Save photo</button><button id="exit-photo">Return to game · P</button></div></div>`;
    this.mini = this.$("minimap") as HTMLCanvasElement;
    this.map = this.$("city-map") as HTMLCanvasElement;
    this.$("start-drive").onclick = () => this.actions.start("drive");
    this.$("start-walk").onclick = () => this.actions.start("walk");
    this.$("resume").onclick = () => this.actions.resume();
    this.$("pause-button").onclick = () => this.actions.pause();
    this.$("recover").onclick = () => {
      this.actions.reset();
      this.actions.resume();
    };
    this.$("return-title").onclick = () => this.actions.title();
    this.$("map-button").onclick = this.$("pause-map").onclick = () =>
      this.showMap();
    this.$("map-close").onclick = () => this.closeMap();
    this.$("panel-close").onclick = () => this.closePanel();
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-panel]")
      .forEach((b) => (b.onclick = () => this.showPanel(b.dataset.panel!)));
    this.$("places-tab").onclick = () => this.populateMap("places");
    this.$("activities-tab").onclick = () => this.populateMap("activities");
    this.$("capture").onclick = () => this.actions.screenshot();
    this.$("exit-photo").onclick = () => this.actions.photo();
    this.map.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.mapZoom = Math.max(
          0.5,
          Math.min(5, this.mapZoom * (e.deltaY > 0 ? 0.86 : 1.16)),
        );
        this.drawMap();
      },
      { passive: false },
    );
    this.map.addEventListener("pointerdown", (e) => {
      this.mapDrag = {
        x: e.clientX,
        y: e.clientY,
        cx: this.mapCenter[0],
        cz: this.mapCenter[1],
        moved: false,
      };
      this.map.setPointerCapture(e.pointerId);
    });
    this.map.addEventListener("pointermove", (e) => {
      if (!this.mapDrag) return;
      const d = this.mapDrag,
        rect = this.map.getBoundingClientRect(),
        scale = Math.min(rect.width / 12500, rect.height / 8500) * this.mapZoom;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) d.moved = true;
      this.mapCenter = [
        d.cx - (e.clientX - d.x) / scale,
        d.cz - (e.clientY - d.y) / scale,
      ];
      this.drawMap();
    });
    this.map.addEventListener("pointerup", () => {
      setTimeout(() => (this.mapDrag = null), 0);
    });
    this.map.onclick = (e) => {
      if (this.mapDrag?.moved) return;
      const rect = this.map.getBoundingClientRect(),
        x = e.clientX - rect.left,
        y = e.clientY - rect.top;
      const p = this.mapPins.find((p) => Math.hypot(p.x - x, p.y - y) < 22);
      if (p) this.actions.travel(p.id);
    };
    this.populateMap("places");
  }
  $(id: string) {
    return document.getElementById(id)!;
  }
  show(id: string, visible = true) {
    this.$(id).classList.toggle("hidden", !visible);
  }
  loading(t: string, n: number) {
    this.$("loading-text").textContent = t;
    (this.$("loading").firstElementChild as HTMLElement).style.width =
      `${n * 100}%`;
    if (n === 1) {
      this.$("start-drive").removeAttribute("disabled");
      this.$("start-walk").removeAttribute("disabled");
      this.show("loading", false);
      this.$("loading-text").textContent =
        "Keyboard + mouse · Headphones recommended";
    }
  }
  started() {
    this.introOpen = false;
    this.show("intro", false);
    this.show("hud");
    document.body.classList.add("playing");
  }
  pause() {
    this.show("pause");
    this.show("hud", false);
    document.body.classList.remove("playing");
  }
  resume() {
    this.show("pause", false);
    this.show("panel", false);
    this.show("map-layer", false);
    this.mapOpen = false;
    this.modalOpen = false;
    this.show("hud");
    document.body.classList.add("playing");
  }
  title() {
    this.introOpen = true;
    this.show("intro");
    this.show("hud", false);
    this.show("pause", false);
    this.show("map-layer", false);
    this.show("panel", false);
    document.body.classList.remove("playing");
  }
  toast(text: string) {
    this.$("toast").textContent = text;
    this.$("toast").classList.add("show");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(
      () => this.$("toast").classList.remove("show"),
      3800,
    );
  }
  showPanel(id: string) {
    if (!this.introOpen) this.actions.pause();
    this.modalOpen = true;
    this.show("panel");
    this.$("panel-subtitle").textContent = "Rain City · Vancouver";
    const body = this.$("panel-body");
    if (id === "help") {
      this.$("panel-title").textContent = "Make yourself at home.";
      const rows = [
        ["Move / drive", "W A S D or arrows"],
        ["Look around", "Mouse"],
        ["Enter / exit vehicle", "E"],
        ["Sprint / accelerate harder", "Shift"],
        ["Brake / jump", "Space"],
        ["Bring a car / bike", "V / B"],
        ["Aim / fire", "Right / left mouse"],
        ["Pistol / carbine / shotgun", "1 / 2 / 3"],
        ["Reload / recover vehicle", "R"],
        ["Holster weapon", "Q"],
        ["Switch camera", "C"],
        ["Map & activities", "M"],
        ["Photo mode", "P"],
        ["Weather / horn", "T / H"],
        ["Pause / release mouse", "Esc"],
      ];
      body.innerHTML = `<div class="control-grid">${rows.map(([a, b]) => `<div><span>${a}</span><kbd>${b}</kbd></div>`).join("")}</div><p>Click the game to capture your mouse. Press Escape to release it. If your car gets stuck, press R to return to the nearest road. Map locations offer fast travel, and activities are optional.</p>`;
    }
    if (id === "settings") {
      this.$("panel-title").textContent = "Your kind of Vancouver.";
      body.innerHTML = `<label class="setting"><span>Atmosphere<small>Change the entire city’s light.</small></span><select id="weather-setting"><option value="day">Pacific daylight</option><option value="golden">Golden hour</option><option value="overcast">Vancouver rain</option><option value="night">After dark</option></select></label><label class="setting"><span>Graphics<small>Balanced is recommended on laptops.</small></span><select id="quality-setting"><option value="balanced">Balanced</option><option value="high">High</option><option value="low">Performance</option></select></label><label class="setting"><span>Sound<small>Engine, footsteps and coastal ambience.</small></span><input id="volume-setting" type="range" min="0" max="100" value="30" aria-label="Sound volume"/></label><label class="setting"><span>Mouse sensitivity</span><input id="sensitivity-setting" type="range" min="20" max="160" value="75" aria-label="Mouse sensitivity"/></label><p>Progress and preferences stay in this browser. Real map geometry covers downtown, Stanley Park, East Vancouver and the Second Narrows crossing.</p>`;
      const weather = this.$("weather-setting") as HTMLSelectElement,
        quality = this.$("quality-setting") as HTMLSelectElement;
      weather.value = localStorage.getItem("rain-city-weather") || "day";
      quality.value = localStorage.getItem("rain-city-quality") || "balanced";
      weather.onchange = () => this.actions.weather(weather.value);
      quality.onchange = () => this.actions.quality(quality.value);
      (this.$("volume-setting") as HTMLInputElement).oninput = (e) =>
        this.actions.volume(Number((e.target as HTMLInputElement).value) / 100);
      (this.$("sensitivity-setting") as HTMLInputElement).oninput = (e) =>
        this.actions.sensitivity(
          Number((e.target as HTMLInputElement).value) / 100,
        );
    }
    if (id === "credits") {
      this.$("panel-title").textContent = "Made for this city.";
      body.innerHTML = `<div class="credits-list"><p>Rain City is an original independent open-world prototype by Arry Pandher. Vancouver is the inspiration. The streets are real; the interpretation is ours.</p><p>Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>, licensed under ODbL. Downtown extract from Arry’s Penguin Party project, October 2026. Buildings use mapped footprints and available heights; architecture and local elevation are approximate.</p><p>Public-tree inventory: City of Vancouver. Contains information licensed under the <a href="https://opendata.vancouver.ca/pages/licence/" target="_blank" rel="noreferrer">Open Government Licence – Vancouver</a>. Recorded positions, heights and species guide the trees; canopy dimensions are interpretations.</p><p>Photographic asphalt, concrete, grass, sky, trees and shop interiors: <a href="https://polyhaven.com" target="_blank" rel="noreferrer">Poly Haven</a> (CC0). Three.js (MIT). Barlow typefaces (SIL Open Font License). Rigged characters and their fitted animations use CC0 generated data from CharacterCreator / MakeHuman; Rain City supplies the game animation and pose controller. Bikes, fallback cars, effects and bridge/boat models are original procedural work. The detailed concept car is by Eric Chadwick / Darmstadt Graphics Group GmbH (CC BY 4.0), based on a CC0 model by Unity Fan. Modified for this game: materials, orientation, part batching and wheel pivots.</p><p>BMW M3 E30 model by <a href="https://sketchfab.com/3d-models/free-bmw-m3-e30-ac3c7013434e403e8faff87948caf422" target="_blank" rel="noreferrer">Martin Trafas</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Simplified meshopt derivative by pedrosoandre/carros; Rain City adapts texture sizes, materials, wheel pivots and game integration.</p><p>Vancouver landmark models: <a href="https://3d-assets.codriver.io/" target="_blank" rel="noreferrer">Codriver</a>, CC BY 4.0. Geographic placement © OpenStreetMap contributors. Runtime materials and placement adapted for Rain City.</p><p>North Shore elevation: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Mapzen Terrain Tiles / AWS Open Data</a>. Contains information licensed under the <a href="https://open.canada.ca/en/open-government-licence-canada" target="_blank" rel="noreferrer">Open Government Licence – Canada</a>; applicable global fallback terrain courtesy of the U.S. Geological Survey. Resampled for a visual terrain interpretation.</p><p>North Shore photography: Selmo. Hotel Vogue and Palms Hotel photography: Canadian2006 (CC BY-SA 3.0). Gastown photography: Xicotencatl (CC BY-SA 4.0), via Wikimedia Commons. Perspective-corrected and cropped derivatives retain those licenses. <a href="https://github.com/ArryPandher/rain-city-vancouver/blob/main/THIRD_PARTY.md" target="_blank" rel="noreferrer">Full sources, licenses and modifications ↗</a></p><p>Independent project, not affiliated with Rockstar Games or Grand Theft Auto. A playable prototype, not a full AAA release.</p><a href="https://github.com/ArryPandher/rain-city-vancouver" target="_blank" rel="noreferrer">Source & development notes ↗</a></div>`;
    }
    this.$("panel-close").focus();
  }
  closePanel() {
    this.modalOpen = false;
    this.show("panel", false);
    if (this.introOpen) this.$("start-drive").focus();
    else this.$("resume").focus();
  }
  showMap() {
    this.actions.pause();
    this.mapOpen = true;
    this.show("pause", false);
    this.show("map-layer");
    this.drawMap();
    this.$("map-close").focus();
  }
  closeMap() {
    this.mapOpen = false;
    this.show("map-layer", false);
    this.actions.resume();
  }
  populateMap(tab: string) {
    this.$("places-tab").classList.toggle("active", tab === "places");
    this.$("activities-tab").classList.toggle("active", tab === "activities");
    const list = this.$("map-list");
    if (tab === "places") {
      list.innerHTML = LANDMARKS.map(
        (l) =>
          `<button class="place-button" data-place="${l.id}"><span class="arrow">↗</span><strong>${l.name}</strong><span>${l.district} · Fast travel</span></button>`,
      ).join("");
      list
        .querySelectorAll<HTMLButtonElement>("button")
        .forEach(
          (b) => (b.onclick = () => this.actions.travel(b.dataset.place!)),
        );
    } else {
      const activities = [
        ["harbour", "Harbour run", "A drive through downtown’s landmarks"],
        ["seawall", "Seawall escape", "Take a bike around Stanley Park"],
        ["bridges", "Bridge runner", "Cambie to the Ironworkers crossing"],
        ["targets", "Target practice", "Six targets. Three weapons. Your aim."],
        ["free", "Just explore", "Clear the current activity"],
      ];
      list.innerHTML = activities
        .map(
          ([id, name, desc]) =>
            `<button class="place-button" data-activity="${id}"><span class="arrow">↗</span><strong>${name}</strong><span>${desc}</span></button>`,
        )
        .join("");
      list
        .querySelectorAll<HTMLButtonElement>("button")
        .forEach(
          (b) => (b.onclick = () => this.actions.activity(b.dataset.activity!)),
        );
    }
  }
  drawCity(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    cx: number,
    cz: number,
    scale: number,
    full = false,
  ) {
    const d = this.data;
    if (!d) return;
    const sx = (x: number) => w / 2 + (x - cx) * scale,
      sy = (z: number) => h / 2 + (z - cz) * scale;
    ctx.fillStyle = full ? "#14232b" : "#172831";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cz);
    const visible = (p: number[]) => {
      let b = this.polyBounds.get(p);
      if (!b) {
        let minX = Infinity,
          minZ = Infinity,
          maxX = -Infinity,
          maxZ = -Infinity;
        for (let i = 0; i < p.length; i += 2) {
          minX = Math.min(minX, p[i]);
          maxX = Math.max(maxX, p[i]);
          minZ = Math.min(minZ, p[i + 1]);
          maxZ = Math.max(maxZ, p[i + 1]);
        }
        b = [minX, minZ, maxX, maxZ];
        this.polyBounds.set(p, b);
      }
      return (
        b[0] < cx + w / scale / 2 &&
        b[2] > cx - w / scale / 2 &&
        b[1] < cz + h / scale / 2 &&
        b[3] > cz - h / scale / 2
      );
    };
    const poly = (p: number[]) => {
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
      ctx.closePath();
    };
    ctx.fillStyle = "#354247";
    ctx.fillRect(-4000, -5700, 12500, 8000);
    ctx.fillStyle = "#253e3a";
    for (const a of d.areas) {
      if (
        visible(a.pts) &&
        ["forest", "park", "grass", "garden"].includes(a.kind)
      ) {
        poly(a.pts);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#132831";
    for (const o of d.ocean) {
      poly(o);
      ctx.fill();
    }
    ctx.fillStyle = "#526063";
    if (full)
      for (const b of d.buildings) {
        if (!visible(b.pts)) continue;
        poly(b.pts);
        ctx.fill();
      }
    ctx.lineCap = "round";
    for (const r of d.roads) {
      if (!visible(r.pts)) continue;
      const street = [
        "primary",
        "secondary",
        "tertiary",
        "residential",
        "unclassified",
      ].includes(r.kind);
      ctx.strokeStyle = street ? "#78888a" : "#415b57";
      ctx.lineWidth = street ? (full ? 5 : 7) : 2.5;
      ctx.beginPath();
      ctx.moveTo(r.pts[0], r.pts[1]);
      for (let i = 2; i < r.pts.length; i += 2)
        ctx.lineTo(r.pts[i], r.pts[i + 1]);
      ctx.stroke();
    }
    for (const b of BRIDGES) {
      ctx.strokeStyle = "#91a0a0";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(...b.a);
      ctx.lineTo(...b.b);
      ctx.stroke();
    }
    ctx.restore();
    if (full) this.mapPins = [];
    for (const l of LANDMARKS) {
      const x = sx(l.spawn[0]),
        y = sy(l.spawn[1]);
      if (x < -40 || y < -20 || x > w + 40 || y > h + 20) continue;
      ctx.beginPath();
      ctx.arc(x, y, full ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = "#e9aa74";
      ctx.fill();
      if (full) {
        ctx.font = "12px Barlow,Arial";
        ctx.fillStyle = "#e1e7df";
        ctx.fillText(l.name, x + 10, y + 4);
        this.mapPins.push({ x, y, id: l.id });
      }
    }
    const px = sx(this.lastPlayer.x),
      pz = sy(this.lastPlayer.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-this.lastPlayer.heading + Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(5, 6);
    ctx.closePath();
    ctx.fillStyle = "#f6f2dd";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.restore();
  }
  updateMini(x: number, z: number, heading: number) {
    this.lastPlayer = { x, z, heading };
    this.drawCity(this.mini.getContext("2d")!, 450, 370, x, z, 0.95);
  }
  drawMap() {
    if (!this.mapOpen) return;
    const rect = this.map.getBoundingClientRect(),
      dpr = Math.min(2, window.devicePixelRatio);
    this.map.width = rect.width * dpr;
    this.map.height = rect.height * dpr;
    const ctx = this.map.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const scale =
      Math.min(rect.width / 12500, rect.height / 8500) * this.mapZoom;
    this.drawCity(
      ctx,
      rect.width,
      rect.height,
      this.mapCenter[0],
      this.mapCenter[1],
      scale,
      true,
    );
  }
  error(message: string) {
    const e = document.createElement("section");
    e.className = "error";
    const d = document.createElement("div");
    const h = document.createElement("h1");
    h.textContent = "The city couldn’t load.";
    const p = document.createElement("p");
    p.textContent = message;
    const b = document.createElement("button");
    b.className = "primary";
    b.textContent = "Reload Vancouver";
    b.onclick = () => location.reload();
    d.append(h, p, b);
    e.append(d);
    this.root.append(e);
  }
}
