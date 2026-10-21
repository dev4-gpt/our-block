import { botStep } from "../server/bot.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  act,
  replaceMissingWithBot,
  createRoom,
  start,
  tick,
  project,
  route,
  SHELTER,
  locked,
  type Role,
  type Branch,
  type Room,
} from "../shared/game.ts";
function setup(variant = 0) {
  const r = createRoom("TEST");
  r.variant = variant;
  r.seats = [
    {
      token: "secret-g",
      name: "G",
      role: "gridkeeper",
      bot: false,
      connected: true,
    },
    {
      token: "secret-p",
      name: "P",
      role: "pathfinder",
      bot: false,
      connected: true,
    },
  ];
  start(r, 1000);
  return r;
}
let seq = 0;
function action(
  r: Room,
  role: Role,
  type: string,
  fields: object = {},
  now = 10000,
) {
  return act(
    r,
    r.seats.find((s) => s.role === role)!,
    { id: `a${++seq}`, phase: r.phase, mission: r.mission, type, ...fields },
    now,
  );
}
test("roles reject unauthorized controls, stale phases and invalid targets", () => {
  const r = setup();
  assert.throws(
    () => action(r, "pathfinder", "power", { branch: "bridge" }),
    /Gridkeeper/,
  );
  assert.throws(
    () => action(r, "gridkeeper", "dispatch", { van: "01", target: "g0" }),
    /Pathfinder/,
  );
  assert.throws(
    () => action(r, "pathfinder", "dispatch", { van: "01", target: "missing" }),
    /waiting/,
  );
  assert.throws(
    () =>
      act(
        r,
        r.seats[0],
        {
          id: "stale",
          phase: "lobby",
          mission: r.mission,
          type: "power",
          branch: "bridge",
        },
        9000,
      ),
    /changed/,
  );
});
test("capacity, cooldown, duplicate actions and locked crossings", () => {
  const r = setup();
  const a = {
    id: "same",
    phase: r.phase,
    mission: r.mission,
    type: "power",
    branch: "bridge",
  };
  act(r, r.seats[0], a, 5000);
  act(r, r.seats[0], a, 5000);
  assert.deepEqual(r.power, ["shelter", "bridge"]);
  assert.throws(
    () => action(r, "gridkeeper", "power", { branch: "shelter" }, 5500),
    /cooling/,
  );
  assert.throws(
    () => action(r, "gridkeeper", "power", { branch: "north" }, 9000),
    /maximum/,
  );
  action(r, "pathfinder", "dispatch", { van: "01", target: "g0" }, 10000);
  assert.equal(locked(r, "bridge"), true);
  assert.throws(
    () => action(r, "gridkeeper", "power", { branch: "bridge" }, 11000),
    /reserved/,
  );
});
test("private snapshots do not leak groups, target paths, tokens or dependency descriptions", () => {
  const r = setup();
  action(r, "gridkeeper", "power", { branch: "bridge" });
  action(r, "pathfinder", "dispatch", { van: "01", target: "g0" });
  const g = project(r, r.seats[0], 10000),
    p = project(r, r.seats[1], 10000);
  assert.equal("groups" in g, false);
  assert.equal("circuits" in p, false);
  assert.equal("path" in g.vans[0], false);
  assert.equal("target" in g.vans[0], false);
  assert(!JSON.stringify(g).includes("secret-"));
  assert(!JSON.stringify(g).includes("Clocktower"));
  assert(!JSON.stringify(p).includes("Opens the eastern crossing"));
});
test("pings never execute actions and only teammate responds", () => {
  const r = setup();
  action(r, "pathfinder", "ping", { branch: "bridge" });
  assert.deepEqual(r.power, ["shelter"]);
  const id = r.pings[0].id;
  assert.throws(
    () =>
      action(r, "pathfinder", "pingStatus", {
        pingId: id,
        status: "completed",
      }),
    /teammate/,
  );
  action(r, "gridkeeper", "pingStatus", { pingId: id, status: "acknowledged" });
  assert.equal(r.pings[0].status, "acknowledged");
});
test("routes cannot cross unpowered canal and blocked dispatch cannot mutate van", () => {
  const r = setup();
  assert.equal(route(SHELTER, { x: 11, y: 6 }, []).length, 0);
  assert.throws(
    () => action(r, "pathfinder", "dispatch", { van: "01", target: "g0" }),
    /blocked/,
  );
  assert.equal(r.vans[0].target, null);
});
test("timer expiry and Calm mode", () => {
  const r = setup();
  tick(r, 301001);
  assert.equal(r.phase, "over");
  const calm = setup();
  calm.calm = true;
  tick(calm, 901001);
  assert.equal(calm.phase, "active");
  const paused = setup();
  paused.phase = "paused";
  tick(paused, 999999);
  assert.equal(paused.remaining, 300000);
});
for (let variant = 0; variant < 3; variant++)
  test(`authored variant ${variant + 1} has a complete legal scripted solution`, () => {
    const r = setup(variant);
    let now = 10000;
    const power = (b: Branch) => {
      if (r.power.includes(b)) return;
      while (r.power.length >= 2) {
        const release = r.power.find((x) => x !== b)!;
        now += 3100;
        action(r, "gridkeeper", "power", { branch: release }, now);
      }
      now += 3100;
      action(r, "gridkeeper", "power", { branch: b }, now);
    };
    const drive = (target: string) => {
      action(r, "pathfinder", "dispatch", { van: "01", target }, now);
      for (let i = 0; i < 160 && r.vans[0].path.length; i++) {
        now += 250;
        tick(r, now);
      }
      now += 250;
      tick(r, now);
    };
    for (const g of r.groups) {
      power(g.pos.y <= 4 ? "north" : g.pos.y >= 8 ? "pump" : "bridge");
      drive(g.id);
      assert.equal(g.status, "aboard");
      assert.equal(
        r.rescued,
        r.groups.filter((x) => x.status === "safe").length,
      );
      drive("shelter");
      power("shelter");
      now += 250;
      tick(r, now);
      assert.equal(g.status, "safe");
    }
    assert.equal(r.phase, "over");
    assert.equal(r.rescued, 6);
    assert.equal(r.vans[0].cargo, null);
    assert.match(r.reason, /Everyone home/);
  });
test("arrival at unpowered shelter waits, then scores exactly once", () => {
  const r = setup();
  r.power = ["bridge"];
  const v = r.vans[0],
    g = r.groups[0];
  g.status = "aboard";
  v.cargo = g.id;
  v.pos = { ...SHELTER };
  v.target = "shelter";
  tick(r, 2000);
  assert.equal(r.rescued, 0);
  action(r, "gridkeeper", "power", { branch: "shelter" }, 5000);
  tick(r, 5100);
  tick(r, 5500);
  assert.equal(r.rescued, 1);
});
test("retry resets mission, new mission advances variant", () => {
  const r = setup();
  r.phase = "over";
  r.rescued = 5;
  action(r, "gridkeeper", "retry", { calm: true });
  assert.equal(r.rescued, 0);
  assert.equal(r.variant, 0);
  assert.equal(r.events.length, 1);
  r.phase = "over";
  action(r, "gridkeeper", "new");
  assert.equal(r.variant, 1);
});

for (let variant = 0; variant < 3; variant++)
  test(`bots obey legal game rules and cooperate through variant ${variant + 1}`, () => {
    const r = setup(variant);
    let firstRescue = 0;
    for (let now = 1200; now < 300000 && r.phase === "active"; now += 200) {
      tick(r, now);
      if (now % 2000 === 0) {
        r.seats[0].bot = true;
        r.seats[1].bot = false;
        r.botAt = 0;
        botStep(r, now);
      }
      if (now % 2000 === 1000) {
        r.seats[0].bot = false;
        r.seats[1].bot = true;
        r.botAt = 0;
        botStep(r, now);
      }
      if (r.rescued && !firstRescue) firstRescue = now;
    }
    assert.equal(
      r.rescued,
      6,
      JSON.stringify({
        p: r.power,
        pings: r.pings,
        vans: r.vans,
        groups: r.groups,
      }),
    );
    assert(
      firstRescue < 30000,
      "First bot-coordinated rescue should take under 30 seconds",
    );
  });

test("bot takeover requires explicit grace expiry and preserves the paused battery", () => {
  const r = setup();
  r.phase = "paused";
  r.pauseAt = 2000;
  r.seats[0].connected = false;
  assert.throws(
    () => replaceMissingWithBot(r, "new-bot-token", 61000),
    /60-second/,
  );
  replaceMissingWithBot(r, "new-bot-token", 62000);
  assert.equal(r.phase, "active");
  assert.equal(r.remaining, 300000);
  assert.equal(r.seats[0].token, "new-bot-token");
  assert.equal(r.seats[0].role, "gridkeeper");
  assert.equal(r.seats[0].bot, true);
  tick(r, 62200);
  assert.equal(r.remaining, 299800);
});
test("one permanently powered crossing cannot solve the whole mission", () => {
  for (const variant of [0, 1, 2]) {
    const r = setup(variant);
    assert(
      r.groups.some(
        (g) => !route(SHELTER, g.pos, ["bridge", "shelter"]).length,
      ),
    );
  }
});

test("packets from an older mission cannot act after retry returns to active", () => {
  const r = setup();
  const stale = {
    id: "old-mission",
    phase: r.phase,
    mission: r.mission,
    type: "power",
    branch: "bridge",
  };
  r.phase = "over";
  action(r, "gridkeeper", "retry");
  assert.throws(() => act(r, r.seats[0], stale, 20000), /mission changed/);
  assert.deepEqual(r.power, ["shelter"]);
});
