# WorldClaw integration review — October 20, 2026

## Decision

Use the research's coarse-to-fine planning concept in an original, data-driven world representation. Do not represent OUR BLOCK as running Tencent's generator. No upstream code, weights or showcase assets have been imported. A licensed static asset generated offline can later be integrated independently of the generator; GPU inference does not belong in the multiplayer server.

## What was actually inspected

- Official main revision `427e5f953bbc2eedccbf82415cc597387d47e5d9`: README, .gitignore, assets/pipeline.jpg and assets/teaser.jpg. No generator implementation, model weights, environment lock, mesh exports or license file. No published GitHub releases found.
- Official `web` branch: 308 files at inspection, including React components, authored method descriptions, website build scripts, images and videos. It is a substantial research showcase, not a game runtime. No .glb/.gltf/.fbx/.blend assets or generation weights were found. The Python scripts create website thumbnails/stills.
- `src/components/SceneViews.tsx` and data records select pre-rendered views. Orbit/walk examples and instance/depth/normal channels are not proof of an interactive scene download.
- Website Footer.tsx reserves Tencent-owned visuals and grants no license for them. The attribution list separately identifies twelve CC BY third-party works (grass, flowers, reeds, trees, fences, bench, signs and picnic table). Those original source works are potential asset candidates only after checking the individual download and license. Their presence in a render does not license the entire rendered world.
- Public PR #3 from markscorpius715: independent replacement workflow, not merged official implementation. Contains Python planning, validation, worker and Blender code, with synthetic and live modes explicitly distinguished. No license file found in that branch. It is evidence that a procedural replacement is feasible, not a verified reusable dependency or quality-equivalent reproduction.

Sources: [official repository](https://github.com/Tencent-Hunyuan/Hunyuan3D-WorldClaw), [web source](https://github.com/Tencent-Hunyuan/Hunyuan3D-WorldClaw/tree/web), [community PR](https://github.com/Tencent-Hunyuan/Hunyuan3D-WorldClaw/pull/3), [paper](https://arxiv.org/html/2608.05248v1), [asset attributions](https://tencent-hunyuan.github.io/Hunyuan3D-WorldClaw/attributions.html).

## Research method versus runtime

The paper separates scene intent, global terrain and regional objects. Terrain uses a semantic layout and a height field; detailed areas add separate mesh instances and undergo rendered-view inspection and contact refinement. The useful idea is stable structure plus replaceable local detail.

Its implementation section reports Blender 5.1.1, multiple planning/image/segmentation/reconstruction models and four NVIDIA H20 GPUs. This is a reported experimental setup, not a proved minimum. The paper gives no turnkey, free hosting recipe. It explicitly leaves runtime navigation, physics, interactions and production engine integration as further work. These must remain our own systems.

OUR BLOCK needs legible walkable routes, accessible entrances, measurable parts, moving supplies and authoritative multiplayer actions. A generated mesh alone does not supply any of these. Collision and activity anchors must be independent from visual meshes so visual upgrades cannot silently invalidate missions.

## Related released models

- [HunyuanWorld-1.0](https://github.com/Tencent-Hunyuan/HunyuanWorld-1.0), inspected revision `57fa9f3a79eae1079c279968cdb9d82c75fa7c86`: real scene-generation code and mesh export. The documented path uses CUDA; its quantized variant advertises consumer RTX 4090 support. Its Tencent Community License is not MIT/Apache and includes distribution/territory conditions. It is a possible offline asset experiment, not the same pipeline as WorldClaw and not a verified free-cloud dependency.
- [HunyuanWorld-Mirror](https://github.com/Tencent-Hunyuan/HunyuanWorld-Mirror), revision `c61300e47ce06db2f02c8e2551aae68be7ae3a0b`: real reconstruction code and pretrained model links, geometry/depth/camera and 3D Gaussian outputs. Reconstructs inputs rather than designing our six-district economy and interactions. Has its own License.txt; no general reuse permission should be inferred from another Hunyuan repository.

No large models were downloaded, no generation APIs invoked, and no cost incurred by this review. Their runtime quality and output portability have not been benchmarked locally.

## Concrete change made

`shared/world.ts` now declares versioned world units, bounds, roads, region bounds, entrances and individually identified building instances. Browser rendering, authoritative navigation and exported Unity content consume this same structure. Validation checks unique IDs and finite positive geometry; tests verify entrances and interiors remain reachable. The initial geometry is intentionally preserved for existing saves.

## Future asset intake contract

For a candidate region or prop, record the actual provider/revision, source URL, asset hash, author, license and required notices, units, orientation, bounds, texture count and triangle count. Import an explicitly licensed GLB/glTF as visual detail against stable district/activity IDs. Keep terrain, props, collision and navigation separable. Inspect contact, open doorways, scale, camera views and mobile rendering. Reject oversized or opaque single-world meshes that prevent interaction or loading by district.

Prefer an offline, one-time generation workflow with static optimized assets: source → mesh cleanup → individual exports → validation → browser/Unity. This is compatible with a CPU-only free game server. Generation itself remains optional until access, compute quota and output-use rights are actually verified. This review does not prove visual parity with the paper.
