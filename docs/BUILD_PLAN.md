# Build plan — 2026-11-14

> Current direction (2026-11-14): **browser-only is essential**. The playable prototype is far below the requested visual goal. The updated goal explicitly uses **GTA VI as the AAA realism benchmark** for four concentrated daylight regions: Canada Place/sails, Robson Square/Art Gallery, Granville Street and Stanley Park's seawall. Architecture, street depth, materials, lighting and animation must hold up during ordinary walking, driving and shooting, checked against real Vancouver views. See the [daylight target](DAYLIGHT-LANDMARKS.md) and [quality assessment](QUALITY-ASSESSMENT.md). Use only the existing Codex in-app browser and one game instance. No new photo-mode or interior work.

Build a substantial playable Vancouver vertical slice with real OpenStreetMap streets and building footprints, custom landmarks, on-foot exploration, cars, bikes, weapons, NPCs, missions, cinematic rendering and a shareable GitHub Pages release.

Requested landmarks: Canada Place sails, Robson Square, Stanley Park and its seawall, Granville Street, Cambie Bridge, Ironworkers Memorial Bridge. Include English Bay, Gastown, Harbour Centre, Science World, BC Place and Lions Gate when feasible.

This is an original game inspired by the open-world genre. No Rockstar code, branding, characters or extracted assets. A browser prototype is not a full AAA production.

Implementation: Three.js, TypeScript, Vite. Real map at metre scale, chunked rendering, PBR materials, daylight presets, fog, ocean shading and post processing. Keyboard/mouse desktop controls; clear mobile capability guidance. No external runtime API keys.

Verification: typecheck, production build, deterministic simulation tests, live browser controls, rendered screenshots, deployment check. Preserve source, asset licenses and limitations.
