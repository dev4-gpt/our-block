import { randomUUID } from "node:crypto";
import {
  act,
  route,
  locked,
  BRANCHES,
  SHELTER,
  type Room,
  type Branch,
} from "../shared/game.ts";
export function botStep(r: Room, now: number) {
  const bot = r.seats.find((s) => s.bot);
  if (!bot || r.phase !== "active" || now < r.botAt) return;
  r.botAt = now + 900;
  const run = (type: string, rest: Record<string, unknown>) => {
    try {
      act(
        r,
        bot,
        { id: randomUUID(), phase: r.phase, mission: r.mission, type, ...rest },
        now,
      );
    } catch {}
  };
  if (bot.role === "pathfinder") {
    for (const v of r.vans) {
      if (v.path.length || v.target) continue;
      if (v.cargo) {
        if (route(v.pos, SHELTER, r.power).length)
          run("dispatch", { van: v.id, target: "shelter" });
        else {
          const b = BRANCHES.find(
            (b) => b.id !== "shelter" && route(v.pos, SHELTER, [b.id]).length,
          );
          if (b) run("ping", { branch: b.id });
        }
      } else {
        const g = r.groups.find(
          (g) =>
            g.status === "waiting" && !r.vans.some((o) => o.target === g.id),
        );
        if (g) {
          if (route(v.pos, g.pos, r.power).length)
            run("dispatch", { van: v.id, target: g.id });
          else
            run("ping", {
              branch:
                BRANCHES.filter((b) => b.id !== "shelter")
                  .map((b) => ({
                    id: b.id,
                    path: route(v.pos, g.pos, [...r.power, b.id]),
                  }))
                  .filter((b) => b.path.length)
                  .sort((a, b) => a.path.length - b.path.length)[0]?.id ||
                "bridge",
            });
        }
      }
    }
    if (
      r.vans.some(
        (v) => v.cargo && v.pos.x === SHELTER.x && v.pos.y === SHELTER.y,
      )
    )
      run("ping", { branch: "shelter" });
  } else {
    const pending = r.pings.find(
      (p) =>
        p.from !== bot.role &&
        (p.status === "requested" || p.status === "acknowledged") &&
        !r.power.includes(p.branch),
    );
    const waitingUnload = r.vans.some(
      (v) => v.cargo && v.pos.x === SHELTER.x && v.pos.y === SHELTER.y,
    );
    const needed: Branch | undefined = waitingUnload
      ? "shelter"
      : pending?.branch;
    if (needed) {
      if (r.power.length >= 2) {
        const release = r.power.find((b) => b !== needed && !locked(r, b));
        if (release) run("power", { branch: release });
      } else run("power", { branch: needed });
    }
    for (const p of r.pings.filter(
      (p) =>
        p.from !== bot.role &&
        r.power.includes(p.branch) &&
        p.status !== "completed",
    ))
      run("pingStatus", { pingId: p.id, status: "completed" });
  }
}
