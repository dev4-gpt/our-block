import React, { useEffect, useRef } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { districts } from "../shared/content.ts";
import { worldPlan, type WorldBox } from "../shared/world.ts";
import { visualPosition, smoothingAlpha } from "./motion.ts";
import { createScenery } from "./scenery.ts";
import { createGardenHabitat } from "./garden-habitat.ts";
import {
  getWorldTheme,
  themeColor,
  type WorldThemeId,
} from "./world-themes.ts";
export default function World({
  state,
  selected,
  follow,
  themeId = "forest",
  onSelect,
  onMove,
  onFail,
}: {
  state: any;
  selected: string;
  follow: boolean;
  themeId?: WorldThemeId;
  onSelect: (id: string) => void;
  onMove: (x: number, z: number) => void;
  onFail: () => void;
}) {
  const received = useRef({ state, at: performance.now() });
  if (received.current.state !== state)
    received.current = { state, at: performance.now() };
  const host = useRef<HTMLDivElement>(null),
    latest = useRef({ state, selected, follow, onSelect, onMove });
  latest.current = { state, selected, follow, onSelect, onMove };
  useEffect(() => {
    const theme = getWorldTheme(themeId);
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      onFail();
      return;
    }
    const el = host.current!;
    el.appendChild(renderer.domElement);
    const contextLost = (e: Event) => {
      e.preventDefault();
      onFail();
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        matchMedia("(max-width: 760px)").matches ? 1.25 : 1.6,
      ),
    );
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(theme.sky);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    scene.fog = new T.Fog(theme.sky, 55, 155);
    scene.background = new T.Color(theme.sky);
    const scenery = createScenery(theme);
    scene.add(scenery);
    const camera = new T.PerspectiveCamera(52, 1, 0.1, 230);
    camera.position.set(42, 48, 52);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 7;
    controls.maxDistance = 95;
    controls.enableDamping = !reduce;
    controls.enablePan = true;
    const sun = new T.DirectionalLight(
      theme.sun,
      theme.outfit === "space" ? 2.1 : 3,
    );
    sun.position.set(-25, 50, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.normalBias = 0.04;
    Object.assign(sun.shadow.camera, {
      left: -40,
      right: 40,
      top: 40,
      bottom: -40,
    });
    scene.add(sun, new T.HemisphereLight(theme.sun, theme.ground, 2.3));
    const materials = new Map<string, T.MeshStandardMaterial>();
    function mat(c: string) {
      if (!materials.has(c))
        materials.set(
          c,
          new T.MeshStandardMaterial({
            color: themeColor(c, theme),
            roughness: 0.85,
          }),
        );
      return materials.get(c)!;
    }
    function box(
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      c: string,
      parent: T.Object3D = scene,
    ) {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat(c));
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    function worldBox(o: WorldBox, parent: T.Object3D = scene) {
      return box(...o.size, ...o.position, o.color, parent);
    }
    worldBox(worldPlan.ground);
    worldPlan.roads.forEach((o) => worldBox(o));
    const habitat =
      theme.outfit === "space" ? createGardenHabitat() : undefined;
    if (habitat) scene.add(habitat.group);
    let gardenRoof: T.Mesh<T.BoxGeometry, T.MeshStandardMaterial> | undefined;
    if (theme.shelter && !habitat) {
      const garden = districts.find((d) => d.id === "garden")!;
      gardenRoof = new T.Mesh(
        new T.BoxGeometry(12, 0.12, 14),
        new T.MeshStandardMaterial({
          color: theme.id === "mountains" ? "#edf5ff" : "#9cdde5",
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
          roughness: 0.3,
        }),
      );
      gardenRoof.position.set(garden.x, 4.1, garden.z);
      scene.add(gardenRoof);
    }
    const pickers: T.Object3D[] = [];
    const labelEls: HTMLDivElement[] = [];
    const gardenPlants: T.Mesh[] = [];
    for (const d of districts) {
      const g = new T.Group();
      scene.add(g);
      box(13, 0.2, 18, d.x, -0.02, d.z, "#cfcea9", g);
      box(11, 0.12, 4, d.x, 0.13, d.z + 5, "#e8ddc6", g);
      // Open-front buildings allow the avatar to enter without hidden interiors.
      if (d.id !== "garden") {
        worldPlan.regions
          .find((r) => r.id === d.id)!
          .structures.forEach((o) => worldBox(o, g));
        box(4, 1, 1.5, d.x, 0.9, d.z - 4, "#af8763", g);
        for (const dx of [-3, 3])
          box(1.4, 1.5, 0.1, d.x + dx, 2.5, d.z - 5.78, "#ffdfa1", g);
      }
      if (d.id === "garden") {
        for (let i = 0; i < 4; i++) {
          const x = d.x - 3 + (i % 2) * 5,
            z = d.z - 4 + Math.floor(i / 2) * 5;
          box(3, 0.5, 3, x, 0.2, z, "#8a684f", g);
          for (let k = 0; k < 5; k++) {
            const plant = new T.Mesh(
              new T.ConeGeometry(0.35, 0.9, 5),
              mat("#5d8b54"),
            );
            plant.position.set(
              x + ((k % 3) - 1) * 0.7,
              0.9,
              z + (Math.floor(k / 3) - 0.5),
            );
            gardenPlants.push(plant);
            g.add(plant);
          }
        }
      }
      if (d.id === "market")
        for (const dx of [-3, 3]) {
          box(3, 1.2, 2, d.x + dx, 0.8, d.z + 1, "#ac8966", g);
          box(3.4, 0.2, 2.4, d.x + dx, 3, d.z + 1, "#d77861", g);
          for (const xx of [-1.4, 1.4])
            box(0.12, 2.5, 0.12, d.x + dx + xx, 1.7, d.z + 1, "#795b44", g);
          for (let i = 0; i < 3; i++)
            box(
              0.6,
              0.4,
              0.6,
              d.x + dx + i * 0.7 - 0.7,
              1.6,
              d.z + 1,
              "#b2ba70",
              g,
            );
        }
      if (d.id === "depot")
        for (let i = 0; i < 5; i++)
          box(1, 0.8, 1, d.x - 3 + i * 1.4, 0.6, d.z + 1, "#ba966b", g);
      if (d.id === "workshop") {
        box(4, 1, 2, d.x, 0.7, d.z + 1, "#7e8d97", g);
        box(1, 0.2, 1, d.x, 1.3, d.z + 1, "#e1ba67", g);
      }
      if (d.id === "hall") {
        box(5, 0.5, 3, d.x, 0.5, d.z + 1, "#a28b9f", g);
        for (const dx of [-4, 4])
          box(1, 1, 1, d.x + dx, 0.8, d.z + 2, "#ddc193", g);
      }
      if (d.id === "home") {
        box(3, 0.8, 1.5, d.x, 0.7, d.z + 1, "#d09e78", g);
        box(1, 2, 1, d.x + 3, 1, d.z + 1, "#bca77d", g);
      }
      const hit = box(12, 0.01, 17, d.x, 0.3, d.z, "#ffffff");
      hit.visible = false;
      hit.userData.district = d.id;
      pickers.push(hit);
      const label = document.createElement("div");
      label.className = "world-label";
      label.textContent = d.name;
      el.appendChild(label);
      labelEls.push(label);
    }
    for (
      let i = 0;
      i < (theme.id === "forest" || theme.id === "mountains" ? 22 : 0);
      i++
    ) {
      const x = i < 11 ? -26 : 26,
        z = (i % 11) * 4.3 - 22;
      box(0.35, 1.5, 0.35, x, 0.7, z, "#8b7156");
      const tree = new T.Mesh(
        new T.IcosahedronGeometry(1.3, 0),
        mat(i % 2 ? "#79996d" : "#668969"),
      );
      tree.position.set(x, 2.6, z);
      tree.castShadow = true;
      scene.add(tree);
    }
    const garden = districtGarden();
    function districtGarden() {
      return districts.find((d) => d.id === "garden")!;
    }
    // A visible gap becomes a fitted pipe, then water reaches the beds after testing.
    const supply = new T.Group();
    scene.add(supply);
    box(2.8, 0.35, 0.35, garden.x - 4, 0.55, garden.z + 3, "#656969", supply);
    box(2.8, 0.35, 0.35, garden.x, 0.55, garden.z + 3, "#656969", supply);
    const fitting = new T.Group();
    scene.add(fitting);
    box(1.3, 0.45, 0.45, garden.x - 2, 0.55, garden.z + 3, "#d7af63", fitting);
    const water = new T.Group();
    scene.add(water);
    for (let i = 0; i < 4; i++)
      box(
        0.18,
        0.08,
        9,
        garden.x - 3 + i * 1.7,
        0.52,
        garden.z - 1,
        "#a7e3ef",
        water,
      );
    const improvements = new Map<string, T.Group>();
    for (const d of districts) {
      const g = new T.Group();
      scene.add(g);
      improvements.set(d.id, g);
      for (let i = 0; i < 3; i++)
        box(0.8, 0.6, 0.8, d.x - 2 + i * 2, 0.6, d.z + 4, "#e8bc59", g);
      g.visible = false;
    }
    const packedOrders = new T.Group();
    scene.add(packedOrders);
    for (let i = 0; i < 4; i++)
      box(0.8, 0.7, 0.8, -2 + i * 1.3, 0.7, 15, "#c89d62", packedOrders);
    const deliveredStock = new T.Group();
    scene.add(deliveredStock);
    for (let i = 0; i < 5; i++)
      box(0.7, 0.6, 0.7, -3 + i * 1.3, 0.8, -8, "#779f63", deliveredStock);
    const eveningFurniture = new T.Group();
    scene.add(eveningFurniture);
    box(5, 0.2, 2, 15, 1.2, 16, "#f6edd1", eveningFurniture);
    for (const dx of [-2, 0, 2]) {
      box(0.8, 0.8, 0.8, 15 + dx, 0.6, 18, "#a98a6d", eveningFurniture);
      box(0.4, 0.5, 0.4, 15 + dx, 1.55, 16, "#f3c466", eveningFurniture);
    }
    for (const dx of [-4, 4])
      box(0.5, 0.7, 0.5, 15 + dx, 3, 15, "#ffe1a0", eveningFurniture);
    const upgradeMarks = new Map<string, T.Group>();
    const upgradeIds = [
      "storage",
      "insulation",
      "stall",
      "stock",
      "bench",
      "station",
      "irrigation",
      "rain",
      "cart",
      "shelves",
      "kitchen",
      "event",
    ];
    upgradeIds.forEach((id, i) => {
      const d = districts[Math.floor(i / 2)],
        g = new T.Group();
      scene.add(g);
      upgradeMarks.set(id, g);
      box(
        1.3,
        1.3,
        1.3,
        d.x + (i % 2 ? 4 : -4),
        0.8,
        d.z + 4,
        i % 2 ? "#90b39e" : "#dbba6b",
        g,
      );
      g.visible = false;
    });
    const avatars = new Map<string, T.Group>();
    const colors = ["#cc664b", "#5e87a4", "#a080ad", "#c7a23f"];
    const ring = new T.Mesh(
      new T.RingGeometry(1, 1.2, 32),
      new T.MeshBasicMaterial({ color: "#f6d16e", side: T.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    scene.add(ring);
    const ground = new T.Plane(new T.Vector3(0, 1, 0), 0),
      ray = new T.Raycaster();
    let down = { x: 0, y: 0 };
    const pointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const pointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new T.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      const pos = new T.Vector3();
      if (ray.ray.intersectPlane(ground, pos)) {
        latest.current.onMove(
          T.MathUtils.clamp(pos.x, -25, 25),
          T.MathUtils.clamp(pos.z, -23, 23),
        );
        const d = districts.find(
          (d) => Math.abs(d.x - pos.x) < 6.5 && Math.abs(d.z - pos.z) < 9,
        );
        if (d) latest.current.onSelect(d.id);
      }
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    let frame = 0;
    const resize = new ResizeObserver(() => {
      const w = el.clientWidth,
        h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      controls.maxDistance = 95 * Math.max(1, h / w);
      if (!latest.current.follow && !wasFollowing)
        camera.position.set(42, 48, 52).multiplyScalar(Math.max(1, h / w));
      camera.updateProjectionMatrix();
    });
    resize.observe(el);

    const avatarLabels = new Map<string, HTMLDivElement>();
    let wasFollowing = false,
      previousFrame = performance.now();
    function animate() {
      frame = requestAnimationFrame(animate);
      const now = performance.now(),
        frameSeconds = Math.min(0.1, (now - previousFrame) / 1000);
      previousFrame = now;
      const s = latest.current.state;
      habitat?.update(s?.players || [], frameSeconds, reduce);
      const watered =
        !!s?.gardenRepair?.tested ||
        s?.contracts?.garden?.status === "complete";
      packedOrders.visible = (s?.players || []).some(
        (p: any) => (p.bag?.parcel || 0) > 0,
      );
      deliveredStock.visible = s?.contracts?.market?.status === "complete";
      eveningFurniture.visible = s?.contracts?.evening?.status === "complete";
      fitting.visible = !!s?.gardenRepair;
      water.visible = watered;
      for (const plant of gardenPlants) {
        plant.scale.y = watered ? 1 : 0.35;
        plant.material = mat(watered ? "#5d8b54" : "#a58d60");
      }
      for (const [id, g] of improvements)
        g.visible =
          s?.contracts?.[id === "hall" ? "evening" : id]?.status === "complete";
      for (const [id, g] of upgradeMarks)
        g.visible = !!s?.upgrades?.includes(id);
      for (const [i, p] of (s?.players || []).entries()) {
        let g = avatars.get(p.id);
        if (!g) {
          g = new T.Group();
          const suit = theme.outfit === "space",
            winter = theme.outfit === "winter",
            beach = theme.outfit === "beach";
          const clothing = suit ? "#e6edf1" : colors[i % colors.length];
          const body = new T.Mesh(
            new T.CapsuleGeometry(
              winter || suit ? 0.4 : 0.35,
              beach ? 0.4 : 0.65,
              4,
              8,
            ),
            mat(clothing),
          );
          body.position.y = 0.9;
          g.add(body);
          const head = new T.Mesh(
            new T.SphereGeometry(0.3, 10, 8),
            mat("#e5c09a"),
          );
          head.position.y = 1.7;
          g.add(head);
          const hair = new T.Mesh(
            new T.SphereGeometry(0.31, 8, 6),
            mat("#514335"),
          );
          hair.scale.y = 0.6;
          hair.position.set(0, 1.89, -0.04);
          g.add(hair);
          if (suit) {
            hair.visible = false;
            const helmet = new T.Mesh(
              new T.SphereGeometry(0.43, 12, 8),
              mat("#e6edf1"),
            );
            helmet.position.y = 1.74;
            g.add(helmet);
            box(0.6, 0.38, 0.14, 0, 1.78, 0.37, "#526b86", g);
            box(0.45, 0.46, 0.28, 0, 1, -0.43, "#b2c2cf", g);
            box(0.28, 0.27, 0.1, 0, 1.18, 0.39, colors[i % colors.length], g);
          } else if (winter) {
            hair.material = mat(clothing);
            hair.scale.set(1.1, 1.1, 1.1);
            const pom = new T.Mesh(
              new T.SphereGeometry(0.13, 6, 4),
              mat("#f3e4bc"),
            );
            pom.position.y = 2.2;
            g.add(pom);
            box(0.55, 0.16, 0.45, 0, 1.47, 0, "#f3e4bc", g);
          } else if (beach) {
            const hat = new T.Mesh(
              new T.CylinderGeometry(0.5, 0.5, 0.07, 12),
              mat("#e5c783"),
            );
            hat.position.y = 1.99;
            g.add(hat);
            box(
              0.52,
              0.25,
              0.4,
              0,
              0.64,
              0,
              colors[(i + 1) % colors.length],
              g,
            );
          }
          g.userData.outfit = theme.outfit;
          const limbs: T.Group[] = [];
          for (const side of [-1, 1]) {
            const leg = new T.Group();
            leg.position.set(side * 0.18, 0.6, 0);
            box(
              0.22,
              0.48,
              0.25,
              0,
              -0.24,
              0,
              suit ? clothing : beach ? "#e5c09a" : "#405c63",
              leg,
            );
            box(
              0.25,
              winter || suit ? 0.22 : 0.13,
              0.4,
              0,
              -0.5,
              0.06,
              suit ? "#acb8c7" : beach ? "#d5ac71" : "#4c443b",
              leg,
            );
            g.add(leg);
            limbs.push(leg);
            const arm = new T.Group();
            arm.position.set(side * 0.44, 1.28, 0);
            box(0.19, 0.5, 0.2, 0, -0.24, 0, beach ? "#e5c09a" : clothing, arm);
            g.add(arm);
            limbs.push(arm);
          }
          g.userData.limbs = limbs;
          scene.add(g);
          avatars.set(p.id, g);
          g.position.set(p.x, 0, p.z);
          const label = document.createElement("div");
          label.className = "world-label";
          el.appendChild(label);
          avatarLabels.set(p.id, label);
        }
        const visual = reduce
          ? p
          : visualPosition(p, (now - received.current.at) / 1000);
        const dx = visual.x - g.position.x,
          dz = visual.z - g.position.z;
        const moving = Math.hypot(dx, dz) > 0.025;
        if (moving) {
          const heading = Math.atan2(dx, dz);
          g.rotation.y +=
            Math.atan2(
              Math.sin(heading - g.rotation.y),
              Math.cos(heading - g.rotation.y),
            ) * (reduce ? 1 : smoothingAlpha(frameSeconds));
        }
        g.userData.limbs.forEach((limb: T.Group, index: number) => {
          limb.rotation.x =
            !reduce && moving
              ? Math.sin(now * 0.012 + (index < 2 ? 0 : Math.PI)) *
                0.45 *
                (index % 2 ? -1 : 1)
              : 0;
        });
        g.position.lerp(
          new T.Vector3(visual.x, 0, visual.z),
          reduce ? 1 : smoothingAlpha(frameSeconds),
        );
        g.visible = p.online;
        const label = avatarLabels.get(p.id)!;
        label.hidden = !p.online;
        label.textContent = `${p.name}${p.id === s.you ? " (you)" : ""}`;
        const v = new T.Vector3(g.position.x, 2.8, g.position.z).project(
          camera,
        );
        label.hidden =
          !p.online ||
          v.z < -1 ||
          v.z > 1 ||
          Math.abs(v.x) > 1 ||
          Math.abs(v.y) > 1;
        // Legacy saves may have overlapping residents; stagger their labels.
        const overlaps = s.players
          .slice(0, i)
          .filter(
            (other: any) =>
              other.online && Math.hypot(other.x - p.x, other.z - p.z) < 1,
          ).length;
        label.style.transform = `translate(-50%,-50%) translate(${(v.x * 0.5 + 0.5) * el.clientWidth}px,${(-v.y * 0.5 + 0.5) * el.clientHeight - overlaps * 22}px)`;
        if (p.id === s.you) {
          ring.position.x = g.position.x;
          ring.position.z = g.position.z;
          if (latest.current.follow) {
            if (!wasFollowing) {
              controls.target.copy(g.position).add(new T.Vector3(0, 1.2, 0));
              camera.position
                .copy(controls.target)
                .add(new T.Vector3(9, 7.5, 12));
            }
            const target = g.position.clone().add(new T.Vector3(0, 1.2, 0));
            const shift = target
              .sub(controls.target)
              .multiplyScalar(reduce ? 1 : 1 - Math.exp(-8 * frameSeconds));
            camera.position.add(shift);
            controls.target.add(shift);
          } else if (wasFollowing) {
            controls.target.set(0, 0, 0);
            camera.position
              .set(42, 48, 52)
              .multiplyScalar(Math.max(1, el.clientHeight / el.clientWidth));
          }
          wasFollowing = latest.current.follow;
        }
      }
      labelEls.forEach((label, i) => {
        const d = districts[i],
          v = new T.Vector3(d.x, 5.4, d.z - 3).project(camera);
        label.style.transform = `translate(-50%,-50%) translate(${(v.x * 0.5 + 0.5) * el.clientWidth}px,${(-v.y * 0.5 + 0.5) * el.clientHeight}px)`;
        label.hidden =
          v.z < -1 ||
          v.z > 1 ||
          Math.abs(v.x) > 0.95 ||
          Math.abs(v.y) > 0.9 ||
          (latest.current.follow &&
            camera.position.distanceTo(new T.Vector3(d.x, 0, d.z)) > 32);
        label.classList.toggle("selected", d.id === latest.current.selected);
      });
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      renderer.dispose();
      if (habitat) {
        scene.remove(habitat.group);
        habitat.dispose();
      }
      scene.traverse((o) => {
        if (o instanceof T.Mesh) o.geometry.dispose();
      });
      materials.forEach((m) => m.dispose());
      scenery.material.dispose();
      gardenRoof?.material.dispose();
      ring.material.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      el.replaceChildren();
    };
  }, [themeId]);
  return (
    <div
      className="world"
      ref={host}
      aria-label="3D neighborhood. Tap ground to walk; drag to rotate and scroll to zoom."
    />
  );
}
