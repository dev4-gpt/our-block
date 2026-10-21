import { districts, type DistrictId } from "./content.ts";
export type WorldBox = {
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  solid?: boolean;
};
export type RegionPlan = {
  id: DistrictId;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  entrance: { x: number; z: number };
  structures: WorldBox[];
  surface: "courtyard" | "cultivated";
};
/** Original authored scene graph. Inspired by coarse-to-fine scene planning, not copied upstream code. */
export const worldPlan = {
  version: 1,
  units: "meters",
  upAxis: "Y",
  id: "our-block-neighborhood-v1",
  bounds: { minX: -25, maxX: 25, minZ: -23, maxZ: 23 },
  ground: {
    id: "town-ground",
    position: [0, -0.6, 0],
    size: [57, 0.7, 51],
    color: "#96ad83",
  } as WorldBox,
  roads: [
    {
      id: "main-street",
      position: [0, -0.13, 0],
      size: [55, 0.12, 7],
      color: "#e4d7be",
    },
    ...[-7.5, 7.5].map((x, i) => ({
      id: `lane-${i}`,
      position: [x, -0.1, 0],
      size: [3, 0.1, 48],
      color: "#e4d7be",
    })),
  ] as WorldBox[],
  regions: districts.map((d) => ({
    id: d.id,
    bounds: { minX: d.x - 6.5, maxX: d.x + 6.5, minZ: d.z - 9, maxZ: d.z + 9 },
    entrance: { x: d.x, z: d.z + 3 },
    surface: d.id === "garden" ? "cultivated" : "courtyard",
    structures:
      d.id === "garden"
        ? []
        : [
            {
              id: `${d.id}-floor`,
              position: [d.x, 0.2, d.z - 3],
              size: [10, 0.25, 6],
              color: "#e4d7be",
            },
            {
              id: `${d.id}-back`,
              position: [d.x, 2.2, d.z - 6],
              size: [10, 4, 0.35],
              color: d.color,
              solid: true,
            },
            {
              id: `${d.id}-left`,
              position: [d.x - 5, 2.2, d.z - 3],
              size: [0.35, 4, 6],
              color: d.color,
              solid: true,
            },
            {
              id: `${d.id}-right`,
              position: [d.x + 5, 2.2, d.z - 3],
              size: [0.35, 4, 6],
              color: d.color,
              solid: true,
            },
            {
              id: `${d.id}-roof`,
              position: [d.x, 4.35, d.z - 5.4],
              size: [10.8, 0.4, 2],
              color: "#657b73",
            },
          ],
  })) as RegionPlan[],
};
export function validateWorldPlan(plan: typeof worldPlan = worldPlan) {
  const ids = new Set<string>();
  for (const box of [
    plan.ground,
    ...plan.roads,
    ...plan.regions.flatMap((r) => r.structures),
  ]) {
    if (ids.has(box.id)) throw Error(`Duplicate world instance: ${box.id}`);
    ids.add(box.id);
    if (
      ![...box.position, ...box.size].every(Number.isFinite) ||
      box.size.some((x) => x <= 0)
    )
      throw Error(`Invalid geometry: ${box.id}`);
  }
  for (const d of districts) {
    const region = plan.regions.find((r) => r.id === d.id);
    if (!region) throw Error(`Missing district: ${d.id}`);
    const e = region.entrance;
    if (
      e.x < region.bounds.minX ||
      e.x > region.bounds.maxX ||
      e.z < region.bounds.minZ ||
      e.z > region.bounds.maxZ
    )
      throw Error(`Invalid entrance: ${d.id}`);
  }
  return true;
}
validateWorldPlan();
