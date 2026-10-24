import * as T from "three";
import { districts } from "../shared/content.ts";

/** Visual enclosure over the existing garden footprint; shared game rules stay unchanged. */
export function createGardenHabitat() {
  const garden = districts.find((d) => d.id === "garden")!;
  const group = new T.Group();
  group.name = "Enclosed growing habitat";
  group.position.set(garden.x, 0, garden.z);
  const frame = new T.MeshStandardMaterial({
    color: "#cad9df",
    roughness: 0.65,
  });
  const glass = new T.MeshStandardMaterial({
    color: "#a1d8e3",
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    roughness: 0.25,
    side: T.DoubleSide,
  });
  const doorMaterial = new T.MeshStandardMaterial({
    color: "#d4e6eb",
    roughness: 0.5,
  });
  const windowMaterial = new T.MeshStandardMaterial({
    color: "#456c88",
    roughness: 0.25,
  });
  function box(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: T.Material,
    parent: T.Object3D = group,
  ) {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = material !== glass;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  // Full roof and three continuous sides. The east side faces the town's walking lane.
  box(12.2, 0.16, 14.2, 0, 4.15, 0, glass);
  box(0.12, 4, 14, -6, 2, 0, glass);
  for (const z of [-7, 7]) box(12, 4, 0.12, 0, 2, z, glass);
  for (const z of [-4.2, 4.2]) box(0.12, 4, 5.6, 6, 2, z, glass);
  box(0.12, 1.2, 2.8, 6, 3.4, 0, glass);
  for (const x of [-6, 6])
    for (const z of [-7, 7]) box(0.2, 4.3, 0.2, x, 2.05, z, frame);
  for (const z of [-7, 7])
    for (const y of [0.15, 4.1]) box(12.2, 0.18, 0.18, 0, y, z, frame);
  for (const x of [-6, 6])
    for (const y of [0.15, 4.1]) box(0.18, 0.18, 14.2, x, y, 0, frame);
  for (const z of [-1.5, 1.5]) box(0.3, 2.9, 0.22, 6, 1.4, z, frame);
  box(0.32, 0.22, 3.2, 6, 2.85, 0, frame);
  box(0.35, 0.08, 3.1, 6, 0.18, 0, frame);
  box(
    0.4,
    0.12,
    2.5,
    6,
    3.05,
    0,
    new T.MeshBasicMaterial({ color: "#90e0bb" }),
  );
  const leaves = [-1, 1].map((side) => {
    const leaf = new T.Group();
    leaf.name = "Sliding entrance door";
    group.add(leaf);
    box(0.18, 2.6, 1.44, 0, 1.4, 0, doorMaterial, leaf);
    box(0.2, 0.85, 0.85, 0.02, 1.75, 0, windowMaterial, leaf);
    box(0.23, 0.35, 0.08, 0.05, 1.1, -side * 0.45, frame, leaf);
    leaf.position.set(6.06, 0, side * 0.7);
    return leaf;
  });
  const entrance = { x: garden.x + 6, z: garden.z };
  let openness = 0;
  return {
    group,
    entrance,
    update(
      players: { online: boolean; x: number; z: number }[],
      dt: number,
      reducedMotion: boolean,
    ) {
      const open = players.some(
        (p) => p.online && Math.hypot(p.x - entrance.x, p.z - entrance.z) < 4,
      );
      const target = open ? 1 : 0;
      openness +=
        (target - openness) *
        (reducedMotion ? 1 : 1 - Math.exp(-10 * Math.max(0, dt)));
      leaves.forEach((leaf, i) => {
        leaf.position.z = (i ? 1 : -1) * (0.7 + openness * 1.45);
      });
    },
    dispose() {
      group.traverse((object) => {
        if (object instanceof T.Mesh) object.geometry.dispose();
      });
      const materials = new Set<T.Material>();
      group.traverse((object) => {
        if (object instanceof T.Mesh)
          materials.add(object.material as T.Material);
      });
      materials.forEach((material) => material.dispose());
    },
  };
}
