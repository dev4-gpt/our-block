import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { districts } from "../shared/content.ts";
import { getWorldTheme, themeColor, type WorldTheme } from "./world-themes.ts";

/** Authored visual dressing, batched into one mesh. Never changes walkable space. */
export function createScenery(theme: WorldTheme = getWorldTheme("forest")) {
  const parts: T.BufferGeometry[] = [];
  const transform = new T.Matrix4();
  function shape(
    geometry: T.BufferGeometry,
    x: number,
    y: number,
    z: number,
    color: string,
    scale: [number, number, number] = [1, 1, 1],
    tilt = 0,
  ) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute("uv");
    transform.compose(
      new T.Vector3(x, y, z),
      new T.Quaternion().setFromEuler(new T.Euler(0, 0, tilt)),
      new T.Vector3(...scale),
    );
    g.applyMatrix4(transform);
    const c = new T.Color(themeColor(color, theme)),
      colors = new Float32Array(g.getAttribute("position").count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = c.r;
      colors[i + 1] = c.g;
      colors[i + 2] = c.b;
    }
    g.setAttribute("color", new T.BufferAttribute(colors, 3));
    parts.push(g);
  }
  function box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    color: string,
  ) {
    shape(new T.BoxGeometry(w, h, d), x, y, z, color);
  }
  function tree(x: number, z: number, size: number) {
    box(0.35, size * 2, 0.35, x, size, z, "#88664c");
    shape(
      new T.IcosahedronGeometry(size * 1.5, 0),
      x,
      size * 2.5,
      z,
      "#537c60",
      [1, 1.2, 1],
    );
    shape(
      new T.IcosahedronGeometry(size, 0),
      x + size * 0.8,
      size * 2.3,
      z,
      "#789968",
    );
  }
  // Every theme uses the same playable block; the surroundings carry its identity.
  box(
    280,
    0.2,
    280,
    0,
    -1.3,
    0,
    theme.id === "island" ? "#4eacbb" : theme.ground,
  );
  if (theme.id === "island") {
    shape(
      new T.CylinderGeometry(1, 1, 1, 48),
      0,
      -0.8,
      0,
      theme.ground,
      [41, 0.5, 37],
    );
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2,
        x = Math.cos(a) * 36,
        z = Math.sin(a) * 32;
      box(0.35, 5, 0.35, x, 1.6, z, "#a78659");
      for (let j = 0; j < 5; j++) {
        const angle = (j / 5) * Math.PI * 2;
        shape(
          new T.ConeGeometry(1, 1, 4),
          x + Math.cos(angle) * 1.5,
          4,
          z + Math.sin(angle) * 1.5,
          theme.foliage,
          [1.5, 0.3, 1.5],
        );
      }
    }
    for (let i = 0; i < 10; i++)
      box(12, 0.025, 0.15, -65 + i * 14, -1.17, 48 + (i % 3) * 8, "#9fd9db");
  } else if (theme.id === "city") {
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2,
        x = Math.cos(a) * 49,
        z = Math.sin(a) * 47,
        h = 8 + (i % 5) * 4;
      box(6, h, 6, x, h / 2 - 1, z, i % 2 ? "#879aab" : "#aebac3");
      box(6.4, 0.3, 6.4, x, h - 1, z, "#52677b");
      for (let floor = 2; floor < h - 1; floor += 3)
        for (const dx of [-1.5, 1.5])
          box(0.85, 1.1, 0.12, x + dx, floor, z + 3.05, "#dfebc4");
    }
  } else if (theme.outfit === "space") {
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2,
        x = Math.cos(a) * (38 + (i % 4) * 8),
        z = Math.sin(a) * (38 + (i % 4) * 8);
      shape(
        new T.IcosahedronGeometry(1, 0),
        x,
        -0.5,
        z,
        theme.id === "mars" ? "#97553e" : "#777c8c",
        [2 + (i % 4), 1.5 + (i % 3), 2 + (i % 4)],
      );
      if (theme.id !== "space") {
        const crater = new T.TorusGeometry(3 + (i % 3), 0.35, 4, 16);
        crater.rotateX(Math.PI / 2);
        shape(crater, x, -0.85, z, theme.id === "mars" ? "#cf8b62" : "#b9bcc4");
      }
    }
    if (theme.id !== "mars")
      for (let i = 0; i < 100; i++) {
        const a = i * 2.39996;
        shape(
          new T.OctahedronGeometry(0.18 + (i % 3) * 0.07),
          Math.cos(a) * 105,
          12 + (i % 17) * 3,
          Math.sin(a) * 105,
          "#f6f4dc",
        );
      }
    if (theme.id === "space") {
      shape(new T.SphereGeometry(18, 20, 12), -60, 27, -80, "#5e8fae");
      for (const x of [-36, 36])
        for (const z of [-20, 20]) {
          box(5, 0.25, 11, x, 2.8, z, "#406c9c");
          for (let i = -2; i <= 2; i++)
            box(0.06, 0.03, 11, x + i, 2.95, z, "#9bd5e0");
        }
    }
  } else {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      shape(
        theme.shelter
          ? new T.ConeGeometry(1, 1, 6)
          : new T.IcosahedronGeometry(1, 1),
        Math.cos(a) * 95,
        -1,
        Math.sin(a) * 95,
        theme.shelter ? "#a4bbc7" : i % 2 ? "#8da998" : "#9cb2a0",
        [22, theme.shelter ? 30 + (i % 4) * 5 : 9 + (i % 4) * 3, 20],
      );
      if (theme.shelter)
        shape(
          new T.ConeGeometry(1, 1, 6),
          Math.cos(a) * 95,
          22 + (i % 4) * 3,
          Math.sin(a) * 95,
          "#f2f5f4",
          [7, 10, 7],
        );
    }
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      tree(
        Math.cos(a) * (35 + (i % 3) * 3),
        Math.sin(a) * (34 + (i % 4) * 2),
        1.5 + (i % 3) * 0.3,
      );
    }
  }
  if (theme.shelter && theme.outfit !== "space") {
    const garden = districts.find((d) => d.id === "garden")!;
    for (const dx of [-5.8, 5.8])
      for (const dz of [-6.8, 6.8])
        box(0.15, 4, 0.15, garden.x + dx, 2, garden.z + dz, theme.roof);
    for (const dz of [-6.8, 0, 6.8])
      box(11.8, 0.18, 0.18, garden.x, 4, garden.z + dz, theme.roof);
    for (const dx of [-5.8, 0, 5.8])
      box(0.15, 0.18, 13.8, garden.x + dx, 4, garden.z, theme.roof);
  }
  // Curbs follow existing roads; the center stays visually clear for walking.
  for (const z of [-3.65, 3.65]) box(55, 0.18, 0.25, 0, -0.05, z, "#b5b8a4");
  for (const x of [-9.15, -5.85, 5.85, 9.15])
    box(0.18, 0.16, 46, x, -0.04, 0, "#b5b8a4");
  for (let x = -24; x <= 24; x += 2)
    box(0.035, 0.02, 6.6, x, -0.055, 0, "#c9bda6");
  for (const d of districts) {
    const { x, z } = d;
    if (d.id !== "garden") {
      // A pitched rear canopy keeps the existing open-front interior readable.
      shape(
        new T.BoxGeometry(5.6, 0.2, 2.4),
        x - 2.65,
        4.95,
        z - 5.4,
        "#637b73",
        [1, 1, 1],
        0.22,
      );
      shape(
        new T.BoxGeometry(5.6, 0.2, 2.4),
        x + 2.65,
        4.95,
        z - 5.4,
        "#536c65",
        [1, 1, 1],
        -0.22,
      );
      // Roof fascia, open-front porch, framed windows and warm interiors.
      box(10.9, 0.22, 0.25, x, 4.65, z - 4.3, "#e8dec5");
      for (const dx of [-4.6, 4.6]) {
        box(0.22, 3.9, 0.22, x + dx, 2.1, z - 4.2, "#ede0c5");
        box(0.28, 0.18, 6.5, x + dx, 4.35, z - 3, "#e4d5b7");
      }
      for (const dx of [-3, 3]) {
        box(1.65, 1.75, 0.16, x + dx, 2.5, z - 5.65, "#f6ecd1");
        box(1.35, 1.4, 0.18, x + dx, 2.5, z - 5.54, "#8dafb1");
        box(0.07, 1.45, 0.2, x + dx, 2.5, z - 5.4, "#f6ecd1");
        box(1.4, 0.07, 0.2, x + dx, 2.5, z - 5.4, "#f6ecd1");
        box(1.9, 0.3, 0.5, x + dx, 1.45, z - 5.2, "#ac7856");
        for (let i = 0; i < 4; i++)
          shape(
            new T.IcosahedronGeometry(0.22, 0),
            x + dx - 0.65 + i * 0.42,
            1.8,
            z - 5.15,
            i % 2 ? "#d6b765" : "#708b54",
          );
      }
      box(2.2, 0.1, 1, x, 0.35, z + 0.6, "#e7d9bb");
    }
    // Courtyard benches and planters sit inside the existing solid wall footprint.
    for (const dx of [-4.6, 4.6]) {
      box(0.45, 0.65, 1.1, x + dx, 0.55, z - 1, "#bb8662");
      shape(new T.IcosahedronGeometry(0.6, 0), x + dx, 1.15, z - 1, "#6e925f");
    }
    if (d.id === "garden") {
      for (let i = 0; i < 12; i++) {
        const px = x - 6 + i * 1.1;
        box(0.12, 1.05, 0.12, px, 0.4, z - 7.8, "#e4d4b2");
      }
      box(12, 0.12, 0.12, x, 0.45, z - 7.8, "#e4d4b2");
      box(12, 0.12, 0.12, x, 0.05, z - 7.8, "#e4d4b2");
    }
  }
  // Street lamps and benches flank the block, outside the server's movement bounds.
  for (const x of [-27, 27])
    for (const z of [-18, -2, 18]) {
      box(0.18, 4.3, 0.18, x, 1.9, z, "#435b53");
      box(0.9, 0.12, 0.9, x, 4.1, z, "#435b53");
      box(0.5, 0.65, 0.5, x, 3.7, z, "#ffe1a1");
      box(0.7, 0.12, 0.7, x, 3.32, z, "#435b53");
      box(2.6, 0.15, 0.8, x, 0.65, z + 3, "#a77e58");
      box(2.6, 0.65, 0.12, x, 1.05, z + 2.6, "#b18a62");
      for (const dx of [-0.9, 0.9])
        box(0.15, 0.8, 0.6, x + dx, 0.2, z + 3, "#52665b");
    }
  const geometry = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  geometry.computeBoundingSphere();
  const mesh = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      flatShading: true,
    }),
  );
  mesh.name = "Batched neighborhood scenery";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
