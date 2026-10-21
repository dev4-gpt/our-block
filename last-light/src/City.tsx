import { useEffect, useRef, useState } from "react";
import * as T from "three";
import {
  BRANCHES,
  LOCATIONS,
  SHELTER,
  road,
  branchAt,
  type View,
  type Point,
} from "../shared/game";
// Adapted shaded geometry and seeded PRNG from Autopolis, Steven Koehl (MIT).
function shadedBox() {
  const g = new T.BoxGeometry(1, 1, 1),
    p = g.attributes.position,
    c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const shade = p.getY(i) > 0.49 ? 1 : p.getY(i) < -0.49 ? 0.42 : 0.62;
    c.set([shade, shade, shade], i * 3);
  }
  g.setAttribute("color", new T.BufferAttribute(c, 3));
  return g;
}
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function City({
  view,
  flat,
  route: previewRoute,
  onPick,
}: {
  view: View;
  flat: boolean;
  route: Point[];
  onPick: (p: Point) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    state = useRef(view),
    pick = useRef(onPick),
    [failed, setFailed] = useState(false);
  state.current = view;
  pick.current = onPick;
  const paths = useRef(previewRoute);
  paths.current = previewRoute;
  useEffect(() => {
    if (flat || failed || !host.current) return;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    const node = host.current;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.outputColorSpace = T.SRGBColorSpace;
    node.appendChild(renderer.domElement);
    const scene = new T.Scene(),
      camera = new T.OrthographicCamera(-12, 12, 12, -12, 0.1, 100);
    camera.position.set(20, 23, 22);
    camera.lookAt(0, 0, 0);
    scene.add(new T.HemisphereLight("#b2d5e3", "#14282f", 2.3));
    const sun = new T.DirectionalLight("#ffe0ad", 2.8);
    sun.position.set(-12, 22, 5);
    scene.add(sun);
    const boxes = shadedBox(),
      dummy = new T.Object3D(),
      tiles = new T.InstancedMesh(
        boxes,
        new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
        256,
      ),
      tilePositions: Point[] = [];
    let idx = 0;
    const rnd = mulberry32(42),
      bridges = new Map<string, T.Mesh[]>(),
      windows: T.Mesh[] = [],
      vans = new Map<string, T.Group>();
    const mesh = (
      geo: T.BufferGeometry,
      color: string,
      x: number,
      y: number,
      z: number,
      sx = 1,
      sy = 1,
      sz = 1,
    ) => {
      const m = new T.Mesh(
        geo,
        new T.MeshStandardMaterial({ color, roughness: 0.8 }),
      );
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      scene.add(m);
      return m;
    };
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const land = x >= 1 && x <= 14 && y >= 1 && y <= 14 && x !== 8;
        dummy.position.set(x - 7.5, land ? -0.3 : -0.7, y - 7.5);
        dummy.scale.set(0.98, land ? 0.65 : 0.18, 0.98);
        dummy.updateMatrix();
        tiles.setMatrixAt(idx, dummy.matrix);
        tiles.setColorAt(
          idx,
          new T.Color(
            land ? (road({ x, y }) ? "#536269" : "#344d4b") : "#244650",
          ),
        );
        tilePositions.push({ x, y });
        idx++;
        if (branchAt({ x, y })) {
          const b = mesh(
            new T.BoxGeometry(1.1, 0.15, 0.75),
            "#8a775d",
            x - 7.5,
            0.12,
            y - 7.5,
          );
          const id = branchAt({ x, y })!;
          bridges.set(id, [...(bridges.get(id) || []), b]);
        }
        if (
          land &&
          !road({ x, y }) &&
          x > 1 &&
          x < 14 &&
          y > 1 &&
          y < 14 &&
          rnd() > 0.24
        ) {
          const height = 0.4 + rnd() * 1.7;
          mesh(
            boxes,
            rnd() > 0.5 ? "#74918b" : "#596e76",
            x - 7.5,
            height / 2 + 0.06,
            y - 7.5,
            0.64,
            height,
            0.64,
          );
          mesh(
            new T.BoxGeometry(0.75, 0.12, 0.75),
            "#293d44",
            x - 7.5,
            height + 0.12,
            y - 7.5,
          );
          for (let j = 0; j < Math.floor(height * 3); j++) {
            const w = mesh(
              new T.BoxGeometry(0.11, 0.13, 0.015),
              "#f9c778",
              x - 7.5 - 0.18,
              height - 0.2 - j * 0.28,
              y - 7.5 + 0.327,
            );
            windows.push(w);
          }
        }
        if (road({ x, y }) && x !== 8) {
          mesh(
            new T.BoxGeometry(0.13, 0.012, 0.035),
            "#a4aaa0",
            x - 7.5,
            0.04,
            y - 7.5,
          );
        }
      }
    scene.add(tiles);
    mesh(
      new T.CylinderGeometry(1.1, 1.25, 0.22, 6),
      "#ba9864",
      SHELTER.x - 7.5,
      0.12,
      SHELTER.y - 7.5,
    );
    mesh(
      new T.BoxGeometry(0.7, 0.8, 0.7),
      "#e1c398",
      SHELTER.x - 7.5,
      0.6,
      SHELTER.y - 7.5,
    );
    mesh(
      new T.ConeGeometry(0.65, 0.55, 4),
      "#c6824e",
      SHELTER.x - 7.5,
      1.25,
      SHELTER.y - 7.5,
    ).rotation.y = Math.PI / 4;
    const beacon = mesh(
      new T.CylinderGeometry(0.035, 0.035, 3.4, 8),
      "#efd09d",
      SHELTER.x - 7.5,
      2.4,
      SHELTER.y - 7.5,
    );
    const ring = mesh(
      new T.TorusGeometry(0.8, 0.018, 6, 48),
      "#d7ac67",
      SHELTER.x - 7.5,
      3.8,
      SHELTER.y - 7.5,
    );
    ring.rotation.x = Math.PI / 2;
    for (const id of ["01", "02"]) {
      const g = new T.Group(),
        body = new T.Mesh(
          new T.BoxGeometry(0.45, 0.3, 0.7),
          new T.MeshStandardMaterial({
            color: id === "01" ? "#f0b563" : "#9ac6bf",
          }),
        );
      body.position.y = 0.3;
      g.add(body);
      const roof = new T.Mesh(
        new T.BoxGeometry(0.32, 0.18, 0.3),
        new T.MeshStandardMaterial({ color: "#edf2dd" }),
      );
      roof.position.set(0, 0.52, -0.08);
      g.add(roof);
      scene.add(g);
      vans.set(id, g);
    }
    const markerGeometry = new T.CylinderGeometry(0.19, 0.19, 0.06, 16),
      markers = LOCATIONS.map((l) =>
        mesh(markerGeometry, "#ffc574", l.x - 7.5, 0.15, l.y - 7.5),
      );
    const routeGeo = new T.BufferGeometry(),
      routeLine = new T.Line(
        routeGeo,
        new T.LineBasicMaterial({ color: "#f7cc87" }),
      );
    scene.add(routeLine);
    const ray = new T.Raycaster(),
      pointer = new T.Vector2();
    const click = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        (-(e.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObject(tiles)[0];
      if (hit?.instanceId !== undefined)
        pick.current(tilePositions[hit.instanceId]);
    };
    renderer.domElement.addEventListener("pointerup", click);
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive isometric Beacon Island. Use the control panel for keyboard actions.",
    );
    const resize = () => {
      const w = node.clientWidth,
        h = node.clientHeight;
      renderer.setSize(w, h);
      const aspect = w / h;
      camera.left = -11.5 * aspect;
      camera.right = 11.5 * aspect;
      camera.top = 11.5;
      camera.bottom = -11.5;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    resize();
    let frame = 0,
      last = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate = (time: number) => {
      frame = requestAnimationFrame(animate);
      if (time - last < 32) return;
      last = time;
      const v = state.current;
      for (const b of BRANCHES) {
        const m = bridges.get(b.id);
        if (m)
          for (const gate of m)
            (gate.material as T.MeshStandardMaterial).color.set(
              v.power.includes(b.id) ? "#edbd72" : "#495563",
            );
      }
      windows.forEach((w, i) => {
        const lit = i % 6 < v.rescued;
        (w.material as T.MeshStandardMaterial).color.set(
          lit ? "#ffd48d" : "#697773",
        );
        (w.material as T.MeshStandardMaterial).emissive.set(
          lit ? "#9c6224" : "#000000",
        );
      });
      for (const van of v.vans) {
        const m = vans.get(van.id)!;
        const desired = new T.Vector3(van.pos.x - 7.5, 0, van.pos.y - 7.5);
        if (reduced) m.position.copy(desired);
        else m.position.lerp(desired, 0.28);
      }
      markers.forEach((m, i) => {
        const g = v.groups?.[i];
        m.visible = v.role === "pathfinder" && g?.status === "waiting";
        if (g) m.position.set(g.pos.x - 7.5, 0.15, g.pos.y - 7.5);
      });
      routeGeo.setFromPoints(
        paths.current.map((p) => new T.Vector3(p.x - 7.5, 0.22, p.y - 7.5)),
      );
      beacon.visible = v.power.includes("shelter");
      ring.visible = beacon.visible;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerup", click);
      scene.traverse((obj) => {
        const m = obj as T.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material)
          for (const material of Array.isArray(m.material)
            ? m.material
            : [m.material])
            material.dispose();
      });
      renderer.dispose();
      node.removeChild(renderer.domElement);
    };
  }, [flat, failed]);
  return (
    <div ref={host} className="city-canvas">
      {(flat || failed) && (
        <svg viewBox="0 0 400 400" role="img" aria-label="Beacon Island map">
          <rect width="400" height="400" rx="20" fill="#1a3842" />
          {Array.from({ length: 256 }, (_, i) => {
            const p = { x: i % 16, y: Math.floor(i / 16) },
              b = branchAt(p),
              isRoad = road(p);
            return (
              <rect
                key={i}
                x={p.x * 24 + 8}
                y={p.y * 24 + 8}
                width="22"
                height="22"
                rx="3"
                fill={
                  b
                    ? view.power.includes(b)
                      ? "#dca865"
                      : "#45505a"
                    : isRoad
                      ? "#738184"
                      : p.x === 8 || p.x < 1 || p.x > 14 || p.y < 1 || p.y > 14
                        ? "#254853"
                        : "#36504c"
                }
                onClick={() => onPick(p)}
              />
            );
          })}
          <text
            x={SHELTER.x * 24 + 19}
            y={SHELTER.y * 24 + 28}
            textAnchor="middle"
            fill="#ffe2a9"
            fontSize="25"
          >
            ⌂
          </text>
          {previewRoute.map((p, i) => (
            <circle
              key={i}
              cx={p.x * 24 + 19}
              cy={p.y * 24 + 19}
              r="3"
              fill="#ffe2a9"
            />
          ))}
          {view.groups
            ?.filter((g) => g.status === "waiting")
            .map((g) => (
              <g key={g.id} onClick={() => onPick(g.pos)}>
                <circle
                  cx={g.pos.x * 24 + 19}
                  cy={g.pos.y * 24 + 19}
                  r="8"
                  fill="#f6bd75"
                />
                <text
                  x={g.pos.x * 24 + 19}
                  y={g.pos.y * 24 + 23}
                  textAnchor="middle"
                  fill="#182c31"
                  fontSize="10"
                >
                  !
                </text>
              </g>
            ))}
          {view.vans.map((v) => (
            <text
              key={v.id}
              x={v.pos.x * 24 + 19}
              y={v.pos.y * 24 + 25}
              textAnchor="middle"
              fill={v.id === "01" ? "#fff2cb" : "#94d6cb"}
              fontSize="21"
            >
              ◆
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}
