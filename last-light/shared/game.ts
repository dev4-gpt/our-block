export type Role = "gridkeeper" | "pathfinder";
export type Point = { x: number; y: number };
export const BRANCHES = [
  {
    id: "bridge",
    name: "Harbor Bridge",
    symbol: "≋",
    description: "Opens the eastern crossing.",
    x: 8,
    y: 6,
  },
  {
    id: "pump",
    name: "Canal Pump",
    symbol: "◈",
    description: "Drains the canal shortcut.",
    x: 8,
    y: 10,
  },
  {
    id: "north",
    name: "North Gate",
    symbol: "⌁",
    description: "Opens the upper crossing.",
    x: 8,
    y: 3,
  },
  {
    id: "shelter",
    name: "Beacon Shelter",
    symbol: "⌂",
    description: "Allows vans to unload rescued groups.",
    x: 3,
    y: 10,
  },
] as const;
export const SHELTER: Point = { x: 3, y: 10 };
export const LOCATIONS = [
  { x: 11, y: 6, name: "Clocktower" },
  { x: 12, y: 3, name: "Observatory" },
  { x: 11, y: 10, name: "Canal Market" },
  { x: 13, y: 6, name: "Harbor Homes" },
  { x: 13, y: 10, name: "Old Library" },
  { x: 11, y: 3, name: "Hill Gardens" },
];
export const VARIANTS = [
  "The First Blackout",
  "Across the Water",
  "The Long Way Home",
];
export type Branch = (typeof BRANCHES)[number]["id"];
export type Van = {
  id: string;
  pos: Point;
  path: Point[];
  cargo: string | null;
  target: string | null;
  nextAt: number;
};
export type Group = {
  id: string;
  name: string;
  pos: Point;
  status: "waiting" | "aboard" | "safe";
};
export type Seat = {
  token: string;
  name: string;
  role: Role;
  bot: boolean;
  connected: boolean;
};
export type Ping = {
  id: string;
  branch: Branch;
  request: string;
  status: "requested" | "acknowledged" | "completed" | "declined";
  from: Role;
};
export type Room = {
  mission: number;
  code: string;
  phase: "lobby" | "active" | "paused" | "over";
  variant: number;
  calm: boolean;
  seats: Seat[];
  power: Branch[];
  cooldown: number;
  vans: Van[];
  groups: Group[];
  startedAt: number;
  remaining: number;
  lastTick: number;
  pauseAt: number;
  rescued: number;
  events: {
    t: number;
    text: string;
    rescued: number;
    power: Branch[];
    vans: { id: string; pos: Point }[];
  }[];
  pings: Ping[];
  seen: string[];
  reason: string;
  botAt: number;
};
export type Action = {
  mission: number;
  id: string;
  phase: Room["phase"];
  type: string;
  [key: string]: unknown;
};
export function road(p: Point) {
  return (
    (p.x >= 2 && p.x <= 13 && (p.y === 3 || p.y === 6 || p.y === 10)) ||
    (p.y >= 3 && p.y <= 10 && (p.x === 3 || p.x === 11 || p.x === 13))
  );
}
export function branchAt(p: Point): Branch | undefined {
  if ((p.x === 11 || p.x === 13) && p.y === 4) return "north";
  if ((p.x === 11 || p.x === 13) && p.y === 9) return "pump";
  return p.x === 8
    ? p.y === 3
      ? "north"
      : p.y === 6
        ? "bridge"
        : p.y === 10
          ? "pump"
          : undefined
    : undefined;
}
// Grid-native deterministic A*, adapted from Autopolis (Steven Koehl, MIT).
// Uses typed-array scores, orthogonal neighbors and stable key tie-breaking.
export function route(start: Point, goal: Point, power: Branch[]): Point[] {
  const key = (p: Point) => p.y * 16 + p.x,
    scores = new Float64Array(256).fill(Infinity),
    parent = new Int32Array(256).fill(-1),
    closed = new Uint8Array(256),
    open = [key(start)];
  scores[key(start)] = 0;
  const heuristic = (k: number) =>
    Math.abs((k % 16) - goal.x) + Math.abs(Math.floor(k / 16) - goal.y);
  while (open.length) {
    open.sort(
      (a, b) => scores[a] + heuristic(a) - (scores[b] + heuristic(b)) || a - b,
    );
    const cur = open.shift()!;
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === key(goal)) {
      const out: Point[] = [];
      let n = cur;
      while (n !== -1) {
        out.push({ x: n % 16, y: Math.floor(n / 16) });
        n = parent[n];
      }
      return out.reverse();
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const p = { x: (cur % 16) + dx, y: Math.floor(cur / 16) + dy };
      if (!road(p)) continue;
      const branch = branchAt(p);
      if (branch && !power.includes(branch)) continue;
      const n = key(p);
      if (scores[cur] + 1 < scores[n]) {
        scores[n] = scores[cur] + 1;
        parent[n] = cur;
        open.push(n);
      }
    }
  }
  return [];
}
export function createRoom(code: string): Room {
  return {
    code,
    mission: 0,
    phase: "lobby",
    variant: 0,
    calm: false,
    seats: [],
    power: [],
    cooldown: 0,
    vans: [],
    groups: [],
    startedAt: 0,
    remaining: 300000,
    lastTick: 0,
    pauseAt: 0,
    rescued: 0,
    events: [],
    pings: [],
    seen: [],
    reason: "",
    botAt: 0,
  };
}
export function record(r: Room, text: string) {
  r.events.push({
    t: 300000 - r.remaining,
    text,
    rescued: r.rescued,
    power: [...r.power],
    vans: r.vans.map((v) => ({ id: v.id, pos: { ...v.pos } })),
  });
  if (r.events.length > 800) r.events.shift();
}
export function start(r: Room, now: number) {
  r.mission = (r.mission || 0) + 1;
  r.phase = "active";
  r.power = ["shelter"];
  r.cooldown = 0;
  r.remaining = 300000;
  r.startedAt = now;
  r.lastTick = now;
  r.rescued = 0;
  r.events = [];
  r.pings = [];
  r.reason = "";
  r.vans = ["01", "02"].map((id) => ({
    id,
    pos: { ...SHELTER },
    path: [],
    cargo: null,
    target: null,
    nextAt: now,
  }));
  r.groups = LOCATIONS.map((p, i) => {
    const variantPoints = [
      LOCATIONS,
      [
        { x: 11, y: 6 },
        { x: 13, y: 3 },
        { x: 13, y: 10 },
        { x: 11, y: 4 },
        { x: 11, y: 9 },
        { x: 13, y: 5 },
      ],
      [
        { x: 11, y: 6 },
        { x: 12, y: 10 },
        { x: 13, y: 4 },
        { x: 11, y: 8 },
        { x: 13, y: 8 },
        { x: 12, y: 3 },
      ],
    ];
    const pos = variantPoints[r.variant][i];
    return {
      id: `g${i}`,
      name: p.name,
      pos: { x: pos.x, y: pos.y },
      status: "waiting",
    };
  });
  record(r, "Mission started. Restore Harbor Bridge for your first rescue.");
}
export function locked(r: Room, b: Branch) {
  return r.vans.some(
    (v) => branchAt(v.pos) === b || v.path.some((p) => branchAt(p) === b),
  );
}
export function act(r: Room, seat: Seat, a: Action, now: number) {
  if (typeof a.id !== "string" || a.id.length > 100)
    throw Error("Invalid action.");
  if (r.seen.includes(a.id)) return;
  if (a.phase !== r.phase || a.mission !== r.mission)
    throw Error("The mission changed. Try again.");
  if (a.type === "start" || a.type === "retry" || a.type === "new") {
    if (seat !== r.seats[0]) throw Error("Only the room creator can start.");
    if (r.phase !== "lobby" && r.phase !== "over")
      throw Error("Finish this mission first.");
    if (r.seats.length !== 2) throw Error("Invite a teammate or add a bot.");
    if (r.seats.some((s) => !s.connected))
      throw Error("Your teammate must reconnect or be replaced by a bot.");
    if (a.type === "new") r.variant = (r.variant + 1) % 3;
    r.calm = a.calm === true;
    start(r, now);
  } else if (a.type === "end") {
    if (r.phase !== "paused" || now - r.pauseAt < 60000)
      throw Error("Wait for the reconnect grace period.");
    r.phase = "over";
    r.reason = "Mission ended after disconnection.";
    record(r, r.reason);
  } else if (a.type === "pingStatus") {
    if (r.phase !== "active") throw Error("Mission is not active.");
    const p = r.pings.find((p) => p.id === a.pingId);
    if (!p || p.from === seat.role)
      throw Error("Only your teammate can respond.");
    if (!["acknowledged", "completed", "declined"].includes(String(a.status)))
      throw Error("Invalid response.");
    p.status = a.status as Ping["status"];
  } else {
    if (r.phase !== "active") throw Error("Mission is not active.");
    if (a.type === "power") {
      if (seat.role !== "gridkeeper")
        throw Error("Only Gridkeeper controls power.");
      const b = a.branch as Branch;
      if (!BRANCHES.some((x) => x.id === b)) throw Error("Unknown branch.");
      if (now < r.cooldown) throw Error("Relays are cooling down.");
      if (r.power.includes(b)) {
        if (locked(r, b))
          throw Error("Crossing reserved by a van. Wait until it clears.");
        r.power = r.power.filter((x) => x !== b);
      } else {
        if (r.power.length >= 2)
          throw Error("Two branches maximum. Release one first.");
        r.power.push(b);
      }
      r.cooldown = now + 3000;
      record(
        r,
        `${BRANCHES.find((x) => x.id === b)!.name} ${r.power.includes(b) ? "powered" : "released"}.`,
      );
    } else if (a.type === "dispatch") {
      if (seat.role !== "pathfinder")
        throw Error("Only Pathfinder dispatches vans.");
      const v = r.vans.find((v) => v.id === a.van);
      if (!v || v.path.length) throw Error("Van is already moving.");
      const g = r.groups.find(
        (g) => g.id === a.target && g.status === "waiting",
      );
      if (v.cargo && a.target !== "shelter")
        throw Error("Deliver your passengers first.");
      if (!v.cargo && !g) throw Error("Choose a waiting group.");
      if (g && r.vans.some((o) => o.target === g.id))
        throw Error("Another van is collecting this group.");
      const goal = a.target === "shelter" ? SHELTER : g!.pos;
      const p = route(v.pos, goal, r.power);
      if (!p.length)
        throw Error("Route blocked. Ask your teammate to power a crossing.");
      v.path = p.slice(1);
      v.target = String(a.target);
      v.nextAt = now + 230;
      record(
        r,
        `Van ${v.id} dispatched ${g ? `to ${g.name}` : "to Beacon Shelter"}.`,
      );
    } else if (a.type === "ping") {
      const b = a.branch as Branch;
      if (!BRANCHES.some((x) => x.id === b)) throw Error("Unknown landmark.");
      if (
        r.pings.some(
          (p) =>
            p.branch === b &&
            p.from === seat.role &&
            (p.status === "requested" || p.status === "acknowledged"),
        )
      )
        throw Error("That request is already on the radio.");
      r.pings.push({
        id: a.id,
        branch: b,
        request:
          b === "shelter"
            ? "Power shelter"
            : b === "pump"
              ? "Open route"
              : "Power bridge",
        status: "requested",
        from: seat.role,
      });
      r.pings = r.pings.slice(-12);
    } else throw Error("Unknown action.");
  }
  r.seen.push(a.id);
  r.seen = r.seen.slice(-500);
}
export function tick(r: Room, now: number) {
  if (r.phase !== "active") return;
  const dt = Math.max(0, now - r.lastTick);
  r.lastTick = now;
  if (!r.calm) r.remaining = Math.max(0, r.remaining - dt);
  else r.remaining -= dt;
  if (!r.calm && r.remaining <= 0) {
    r.phase = "over";
    r.reason = "Battery empty. Every rescue mattered.";
    record(r, r.reason);
    return;
  }
  for (const v of r.vans) {
    if (v.path.length && now >= v.nextAt) {
      v.pos = v.path.shift()!;
      v.nextAt = now + 230;
    }
    if (!v.path.length && v.target) {
      if (v.target === "shelter") {
        if (!r.power.includes("shelter")) continue;
        const g = r.groups.find((g) => g.id === v.cargo);
        if (g) {
          g.status = "safe";
          v.cargo = null;
          r.rescued++;
          record(r, `Group from ${g.name} is safe. ${r.rescued}/6 rescued.`);
        }
      } else {
        const g = r.groups.find((g) => g.id === v.target);
        if (g?.status === "waiting") {
          g.status = "aboard";
          v.cargo = g.id;
          record(r, `Van ${v.id}: passengers aboard.`);
        }
      }
      v.target = null;
    }
  }
  if (r.rescued === 6) {
    r.phase = "over";
    r.reason = "Everyone home. You brought back the light.";
    record(r, r.reason);
  }
}
export function project(r: Room, seat: Seat, now: number) {
  return {
    code: r.code,
    phase: r.phase,
    mission: r.mission,
    variant: r.variant,
    calm: r.calm,
    role: seat.role,
    host: seat === r.seats[0],
    seats: r.seats.map(({ name, role, bot, connected }) => ({
      name,
      role,
      bot,
      connected,
    })),
    power: r.power,
    cooldown: r.cooldown,
    serverNow: now,
    remaining: r.remaining,
    pauseAt: r.pauseAt,
    rescued: r.rescued,
    reason: r.reason,
    vans: r.vans.map(({ id, pos, path, cargo, target }) => ({
      id,
      pos,
      moving: path.length > 0,
      loaded: !!cargo,
      ...(seat.role === "pathfinder" ? { cargo, target, path } : {}),
    })),
    ...(seat.role === "pathfinder" ? { groups: r.groups } : {}),
    ...(seat.role === "gridkeeper" ? { circuits: BRANCHES } : {}),
    pings: r.pings,
    events:
      r.phase === "over"
        ? r.events
        : r.events.slice(-5).map((e) => ({
            ...e,
            text: e.text
              .replace(/Group from .* is safe\./, "A group reached safety.")
              .replace(
                /to (Clocktower|Observatory|Canal Market|Harbor Homes|Old Library|Hill Gardens)/,
                "to destination",
              ),
          })),
  };
}
export type View = ReturnType<typeof project>;

/** Explicit takeover after the paused reconnect grace, never a silent resume. */
export function replaceMissingWithBot(r: Room, token: string, now: number) {
  if (r.phase !== "paused" || now - r.pauseAt < 60000)
    throw Error("Wait for the 60-second reconnect period.");
  const missing = r.seats.find((s) => !s.connected);
  if (!missing) throw Error("Teammate is connected.");
  missing.bot = true;
  missing.name = "EMBER · bot";
  missing.token = token;
  missing.connected = true;
  if (r.seats.every((s) => s.connected)) {
    r.phase = "active";
    r.lastTick = now;
    r.vans.forEach((v) => (v.nextAt = now + 230));
  }
  record(r, "EMBER joined the rescue. Mission resumed.");
}
