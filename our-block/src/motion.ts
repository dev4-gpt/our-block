type Point = { x: number; z: number };
/** Visual-only extrapolation follows the validated route and stops after 250 ms.
 * Never used for interaction distance or other game rules. */
export function visualPosition(
  p: Point & { target?: Point; path?: Point[] },
  age: number,
): Point {
  let x = p.x,
    z = p.z,
    budget = Math.min(0.25, Math.max(0, age)) * 5;
  for (const target of p.target ? [p.target, ...(p.path || [])] : []) {
    const dx = target.x - x,
      dz = target.z - z,
      distance = Math.hypot(dx, dz);
    if (distance <= budget) {
      x = target.x;
      z = target.z;
      budget -= distance;
    } else {
      x += (dx / distance) * budget;
      z += (dz / distance) * budget;
      break;
    }
  }
  return { x, z };
}
export const smoothingAlpha = (dt: number) =>
  1 - Math.exp(-24 * Math.max(0, dt));
