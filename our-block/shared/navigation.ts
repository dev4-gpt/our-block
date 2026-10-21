import { worldPlan } from "./world.ts";
export function walkable(x: number, z: number) {
  const b = worldPlan.bounds;
  if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return false;
  for (const region of worldPlan.regions)
    for (const object of region.structures) {
      if (!object.solid) continue;
      const [ox, , oz] = object.position,
        [w, , d] = object.size;
      if (Math.abs(x - ox) <= w / 2 + 0.4 && Math.abs(z - oz) <= d / 2 + 0.4)
        return false;
    }
  return true;
}
// Small integer grid keeps movement deterministic across browser and Unity clients.
export function route(
  x: number,
  z: number,
  tx: number,
  tz: number,
): { x: number; z: number }[] {
  const start = [Math.round(x), Math.round(z)],
    end = [Math.round(tx), Math.round(tz)];
  if (!walkable(...(end as [number, number])))
    throw Error("Choose open ground or enter through the front.");
  const key = (x: number, z: number) => `${x},${z}`;
  const queue = [start],
    parent = new Map<string, string | null>([[key(start[0], start[1]), null]]);
  for (let i = 0; i < queue.length; i++) {
    const [cx, cz] = queue[i];
    if (cx === end[0] && cz === end[1]) {
      const result: { x: number; z: number }[] = [];
      let k: string | null = key(cx, cz);
      while (k) {
        const [px, pz] = k.split(",").map(Number);
        result.unshift({ x: px, z: pz });
        k = parent.get(k) || null;
      }
      return result.slice(1);
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx,
        nz = cz + dz,
        k = key(nx, nz);
      if (!parent.has(k) && walkable(nx, nz)) {
        parent.set(k, key(cx, cz));
        queue.push([nx, nz]);
      }
    }
  }
  throw Error("No walkable route.");
}
