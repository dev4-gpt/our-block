# Immersive neighborhood review — October 23, 2026

User request: make the actual game a more immersive 3D world; inspect starred/owned repositories and search more broadly. This is a new local visual candidate. The live rc1 and the prepared Handshake entry have not been updated by this work.

## Account discovery

Authenticated GitHub connector identified dev4-gpt and returned 64 accessible repositories owned by that account, including forks. Ownership is not proof that a project was originally authored by the user. The public GitHub starred API returned 182 repositories across two pages. Relevant matches were inspected rather than treating every star as an implementation dependency. The CLI credential failed; the connector and public unauthenticated star listing supplied the research instead. No credentials or private repo contents were copied into the game.

## Relevant starred and owned projects

| Source | Evidence inspected | Useful lesson / decision |
| --- | --- | --- |
| [Starred: Autopolis](https://github.com/sleuthy-sloth/autopolis) | README: TypeScript/Three.js viewport, instanced grid, merged procedural building geometry and vertex colors | Closest fit. Keep scenery local and batch static details. Its reported performance is not evidence about OUR BLOCK. No simulation or LLM-agent system imported. |
| [Starred: Hunyuan3D-WorldClaw](https://github.com/Tencent-Hunyuan/Hunyuan3D-WorldClaw) | Current README: paper, project page and method illustrations | Research reference, not a drop-in released game engine. No usable generation implementation/weights were established from this README. No download or model service added. |
| [Owned: God's Eye View](https://github.com/dev4-gpt/gods-eye-view) | README credits bilawalsidhu upstream; tracked-entity/cockpit camera, global-context switch, terrain/globe dependencies | Use the idea of switching between close follow and overview. Cesium/geospatial feeds and metered photorealistic tiles do not fit this fictional neighborhood. No upstream code/assets imported. |
| [Owned: Aetheris](https://github.com/dev4-gpt/aetheris) | README: bounded USGS elevation scene and separate globe/flat views | Reinforces bounded scene planning. Real-world observation feeds are unrelated to cooperative neighborhood play. |
| Owned: FocusFlow-Inner-World-OS | Metadata and root directory; no root README | Name alone does not establish reusable world rendering. Not selected as a source. |

## Wider primary-source search

- [Lakewalk](https://github.com/ctc136/lakewalk): README describes damped third-person orbit/follow, terrain avoidance, instanced dressing and procedural surroundings. Relevant camera/environment reference. Its character assets and benchmark claims are not adopted.
- [Cozy Street Builder](https://github.com/wurmmatthias/CozyStreetBuilder): README describes modular streets/buildings, foliage and separate view modes, with Poly Pizza assets. Relevant visual reference; no models copied and no third-party asset-license assumption made.
- [Three.js: Optimize Lots of Objects](https://threejs.org/manual/pages/optimize-lots-of-objects.html): merging static geometry reduces separate draw requests. Applied to original authored props as one vertex-colored scenery mesh.
- [Three.js: Fog](https://threejs.org/manual/pages/fog.html): use distance atmosphere to connect the playable block with a horizon.
- [Three.js: Shadows](https://threejs.org/manual/pages/shadows.html): shadow maps have rendering cost. Kept one shadow-casting sun; reduced its map to 1024 and capped mobile pixel ratio at 1.25.

## Implemented local candidate

- Default walk-with-resident camera: close, lower perspective; orbit/zoom still available. Town overview remains one button away. Resizing no longer resets an active follow camera to the distant overview.
- Ground extends beyond the playable block, with low-poly hills and trees around the horizon, sky-colored fog and tone mapping.
- Pitched rear canopies, window frames/crossbars, flower boxes, porch details, garden fence, paving joints, street lamps and benches. The original open-front building access and server-authoritative routes remain.
- Residents gain hair, shoes, arms and legs; they face travel direction with an in-place walking cycle. Reduced motion disables the limb cycle and camera damping.
- Labels behind/outside the camera are hidden; distant district labels are suppressed in follow mode.
- Added scenery is batched into one mesh with fewer than 10,000 triangles. No new model downloads, paid services or runtime asset requests.

## Validation and limits

Production TypeScript/Vite build passed. Seven focused movement/world/scenery checks passed, including route reachability, bounded visual prediction, finite geometry, rendering budget and unobstructed main walking lanes. Build still reports the existing >500 kB world-chunk advisory; the final world bundle is about 520.6 kB / 132.6 kB gzip.

Browser discovery explicitly reports local browser use disabled in Work settings. No alternate browser/automation surface was used to bypass that restriction. Rendered appearance, close-camera obstruction/orbit behavior, touch interaction, actual mobile FPS and visual quality remain to be inspected. This is an implemented, build-checked local preview, not a deployed or visually accepted release. No broad load test or additional campaign allowance was started. Keep the current public version and prepared submission unchanged until the new scene is reviewed.
