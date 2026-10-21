import React, { useEffect, useRef } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { districts } from "../shared/content.ts";
import { worldPlan, type WorldBox } from "../shared/world.ts";
export default function World({
  state,
  selected,
  follow,
  onSelect,
  onMove,
  onFail,
}: {
  state: any;
  selected: string;
  follow: boolean;
  onSelect: (id: string) => void;
  onMove: (x: number, z: number) => void;
  onFail: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef({ state, selected, follow, onSelect, onMove });
  latest.current = { state, selected, follow, onSelect, onMove };
  useEffect(() => {
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
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.setClearColor("#dce7e5");
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    scene.fog = new T.Fog("#dce7e5", 75, 160);
    const camera = new T.PerspectiveCamera(42, 1, 0.1, 200);
    camera.position.set(42, 48, 52);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.maxPolarAngle = Math.PI / 2.35;
    controls.minDistance = 12;
    controls.maxDistance = 95;
    controls.enableDamping = !reduce;
    controls.enablePan = true;
    const sun = new T.DirectionalLight("#fff2ce", 3);
    sun.position.set(-25, 50, 15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -40,
      right: 40,
      top: 40,
      bottom: -40,
    });
    scene.add(sun, new T.HemisphereLight("#f7f6e8", "#719177", 2.3));
    const materials = new Map<string, T.MeshStandardMaterial>();
    function mat(c: string) {
      if (!materials.has(c))
        materials.set(
          c,
          new T.MeshStandardMaterial({ color: c, roughness: 0.85 }),
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
    for (let i = 0; i < 22; i++) {
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
      camera.position.set(42, 48, 52).multiplyScalar(Math.max(1, h / w));
      camera.updateProjectionMatrix();
    });
    resize.observe(el);

    let wasFollowing = false;
    function animate() {
      frame = requestAnimationFrame(animate);
      const s = latest.current.state;
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
          const body = new T.Mesh(
            new T.CapsuleGeometry(0.35, 0.65, 4, 8),
            mat(colors[i]),
          );
          body.position.y = 0.9;
          g.add(body);
          const head = new T.Mesh(
            new T.SphereGeometry(0.3, 10, 8),
            mat("#e5c09a"),
          );
          head.position.y = 1.7;
          g.add(head);
          scene.add(g);
          avatars.set(p.id, g);
          g.position.set(p.x, 0, p.z);
        }
        g.position.lerp(new T.Vector3(p.x, 0, p.z), reduce ? 1 : 0.3);
        g.visible = p.online;
        if (p.id === s.you) {
          ring.position.x = g.position.x;
          ring.position.z = g.position.z;
          if (latest.current.follow) {
            if (!wasFollowing)
              camera.position.copy(g.position).add(new T.Vector3(15, 19, 21));
            const shift = g.position.clone().sub(controls.target);
            camera.position.add(shift);
            controls.target.copy(g.position);
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
      scene.traverse((o) => {
        if (o instanceof T.Mesh) o.geometry.dispose();
      });
      materials.forEach((m) => m.dispose());
      el.replaceChildren();
    };
  }, []);
  return (
    <div
      className="world"
      ref={host}
      aria-label="3D neighborhood. Tap ground to walk; drag to rotate and scroll to zoom."
    />
  );
}
