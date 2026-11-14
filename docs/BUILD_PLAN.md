# Build plan — 2026-11-14

> Current direction (2026-11-14): **browser-only is essential**. The playable prototype is far below the requested visual goal. Prioritize high-fidelity Coal Harbour, Robson/Granville and a Stanley Park seawall region, using the [quality assessment and review brief](QUALITY-ASSESSMENT.md). GTA V is the nearer visual benchmark; GTA VI remains a reference. These are milestones within the full Vancouver objective. Use one Chrome tab maximum and avoid two simultaneous game instances.

Build a substantial playable Vancouver vertical slice with real OpenStreetMap streets and building footprints, custom landmarks, on-foot exploration, cars, bikes, weapons, NPCs, missions, cinematic rendering and a shareable GitHub Pages release.

Requested landmarks: Canada Place sails, Robson Square, Stanley Park and its seawall, Granville Street, Cambie Bridge, Ironworkers Memorial Bridge. Include English Bay, Gastown, Harbour Centre, Science World, BC Place and Lions Gate when feasible.

This is an original game inspired by the open-world genre. No Rockstar code, branding, characters or extracted assets. A browser prototype is not a full AAA production.

Implementation: Three.js, TypeScript, Vite. Real map at metre scale, chunked rendering, PBR materials, daylight presets, fog, ocean shading and post processing. Keyboard/mouse desktop controls; clear mobile capability guidance. No external runtime API keys.

Verification: typecheck, production build, deterministic simulation tests, live browser controls, rendered screenshots, deployment check. Preserve source, asset licenses and limitations.
