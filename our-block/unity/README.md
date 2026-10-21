# OUR BLOCK Unity client — source provided, builds unverified

This is a desktop client for the same Node server and persistent towns as the browser. It contains procedural 3D districts, Input System movement, an orbit/follow camera, interactive action panels, inventory, projects, ledger, radio, spending approval and seat recovery. The server remains authoritative.

No Unity editor is installed at the standard location on the development Mac. Package resolution, editor compilation, player builds, rendering and mixed browser/Unity sessions have **not** been verified. Do not ship these sources as a tested desktop release.

Pinned editor: Unity **6000.3.25f1**, verified in [official release notes](https://unity.com/releases/editor/whats-new/6000.3.25f1). Package manifest selects URP 17.3.0, Input System 1.20.1 and Newtonsoft JSON 3.2.1. [Unity 6.3 URP documentation](https://docs.unity3d.com/6000.3/Documentation/Manual/com.unity.render-pipelines.universal.html) identifies the 17.3 series; [Input System documentation](https://docs.unity3d.com/6000.3/Documentation/Manual/com.unity.inputsystem.html) lists 1.20.1. The editor must resolve and lock transitive dependencies before a reproducible release.

1. Run the browser server on port 3001.
2. From our-block/, run `npm run export:unity` after changing shared content.
3. Open this unity/ directory with the pinned Unity editor.
4. Choose **OUR BLOCK → Prepare scene and URP**. This creates the scene and render pipeline, and enables both input backends. Allow an editor restart if requested.
5. Press Play. Enter a nickname and the town code shown by a browser teammate. Use ws://localhost:3001/ws on this Mac or wss://your-host/ws in production.
6. Use **OUR BLOCK → Build macOS** or **Build Windows** with the appropriate platform module installed. Output is in Builds/.

Keyboard: WASD/arrows; left-click open ground to walk; right-drag to orbit; wheel to zoom. Panel controls perform the same commands as browser controls. Seat secrets are stored in local PlayerPrefs; recovery reconnects that same seat. The current Unity UI is a functional IMGUI prototype, not the browser's visual polish.

Required acceptance: compile without warnings requiring fixes; create/join/recover; two browser and two Unity residents in one room; inspect/buy/approve/transfer/complete; restart recovery; macOS build; Windows build and execution on Windows; no client-side economic mutation. Native build availability must not be inferred from protocol tests alone.

## Free-only cloud build gate

Keep Unity cloud builds disabled until the account dashboard confirms free license eligibility, included builder minutes, exact editor availability, repository access, artifact access and a hard stop before paid overages. If any requirement cannot be confirmed, retain source and ship the browser prototype. Do not substitute a paid VM or trial.

Prepared manual configuration (not yet enabled):
- Repository project subdirectory: `our-block/unity`.
- Editor: `6000.3.25f1`; if unavailable, do not silently select another version.
- Pre-build shell script: `our-block/scripts/unity-prebuild.sh` (repository-root path).
- Pre-export static method: `BlockBuild.PreExport` (prepares generated scene and URP; does not recursively call BuildPipeline).
- Environment: `OUR_BLOCK_SERVER_URL=wss://YOUR-RENDER-HOST/ws`. This is a public endpoint, not a database credential.
- Target one: macOS, Apple Silicon. Target two: Windows x86-64 after Mac success and quota review.
- Automatic builds: off. Concurrency: one. Retain/download artifacts and logs after successful manual builds.

The hook writes a public ServerConfig resource; the desktop client reads it at startup. Shared content is exported and committed in advance. Compilation and package resolution happen before the pre-export hook; fix failures from the build log before spending minutes on another build. The included shell hook enables the Input System before compilation.

Cloud compilation has not been run. It provides no interactive editor session. A successful build is not proof of playability: download and run the macOS app, join a browser town, complete a project and test reconnect. Windows remains experimental until run on Windows. Code signing/notarization and app-store distribution are outside this $0 prototype; do not bypass operating-system security warnings through automation.
