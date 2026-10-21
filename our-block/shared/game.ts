import { debitLots, inventoryAt, refundPlan, type Lot } from "./provenance.ts";
import { route } from "./navigation.ts";
import {
  townOffers,
  evidenceText,
  activities,
  districts,
  offers,
  projects,
  upgrades,
  pings,
  type DistrictId,
} from "./content.ts";
export type Bag = Record<string, number>;
export type Player = {
  id: string;
  name: string;
  token: string;
  x: number;
  z: number;
  target?: { x: number; z: number };
  path?: { x: number; z: number }[];
  online: boolean;
  money: number;
  bag: Bag;
  seen: string[];
  daily: string[];
};
export type Ledger = {
  day: number;
  text: string;
  amount: number;
  account: string;
  category?: "income" | "expense" | "transfer" | "note";
};
export type Town = {
  schema: 3;
  lots: Lot[];
  projectWork: Record<string, Record<string, string[]>>;
  outcomes: {
    project: string;
    reward: number;
    spending: number | null;
    income: number | null;
    net: number | null;
    contributions: Record<string, string[]>;
  }[];
  movementSequence: number;
  totals: Record<string, { income: number; expense: number; transfer: number }>;
  totalsComplete: boolean;
  gardenRepair?: { part: string; by: string; tested: boolean };
  contributions: Record<string, string>;
  decisions: { id: string; by: string; text: string; status: string }[];
  simTime: number;
  crops: { ready: number; by: string }[];
  code: string;
  revision: number;
  day: number;
  seconds: number;
  mode: "life" | "explore";
  review: boolean;
  funds: number;
  players: Player[];
  storage: Bag;
  upgrades: string[];
  evidence: string[];
  ledger: Ledger[];
  contracts: Record<
    string,
    {
      due: number;
      status: "active" | "complete" | "expired";
      variant: number;
      baseline?: { income: number; expense: number };
    }
  >;
  pending: {
    id: string;
    by: string;
    kind: "buy" | "upgrade" | "bill";
    target: string;
    cost: number;
  }[];
  radio: {
    id: string;
    by: string;
    district: string;
    text: string;
    ack?: string;
  }[];
  processed: string[];
  bill: number;
  variant: number;
  companion: boolean;
};
export type Command = {
  v: 1;
  id: string;
  revision: number;
  type: string;
  target?: string;
  x?: number;
  z?: number;
  item?: string;
  qty?: number;
  account?: string;
  direction?: string;
  player?: string;
  text?: string;
};
export function createTown(
  code: string,
  mode: "life" | "explore" = "life",
): Town {
  return {
    schema: 3,
    lots: [],
    projectWork: {},
    outcomes: [],
    movementSequence: 0,
    totals: {},
    totalsComplete: true,
    contributions: {},
    decisions: [],
    simTime: 0,
    crops: [],
    code,
    revision: 0,
    day: 1,
    seconds: 0,
    mode,
    review: false,
    funds: 300,
    players: [],
    storage: { tool: 1 },
    upgrades: [],
    evidence: [],
    ledger: [],
    contracts: {},
    pending: [],
    radio: [],
    processed: [],
    bill: 0,
    variant: 0,
    companion: true,
  };
}
export function join(t: Town, name: string, token: string) {
  if (t.players.length >= 4)
    throw new GameRuleError("This town already has four residents.");
  const p: Player = {
    id: `p${t.players.length + 1}`,
    name: name.trim().slice(0, 24) || "Neighbor",
    token,
    x: -15,
    z: -7,
    online: true,
    money: 0,
    bag: {},
    seen: [],
    daily: [],
  };
  t.players.push(p);
  t.revision++;
  return p;
}
export class GameRuleError extends Error {
  constructor(
    message: string,
    public code = "RULE",
  ) {
    super(message);
  }
}
function need(ok: unknown, message: string, code = "RULE"): asserts ok {
  if (!ok) throw new GameRuleError(message, code);
}
function near(p: Player, d: string) {
  const a = districts.find((x) => x.id === d);
  need(
    a && Math.hypot(p.x - a.x, p.z - a.z) <= 7,
    "Walk closer to this district to interact.",
    "DISTANCE",
  );
}
function add(b: Bag, k: string, n: number) {
  b[k] = (b[k] || 0) + n;
  if (!b[k]) delete b[k];
}
function has(b: Bag, items: Bag) {
  return Object.entries(items).every(([k, n]) => (b[k] || 0) >= n);
}
function consume(b: Bag, items: Bag) {
  need(has(b, items), "You need the listed supplies in your backpack.");
  for (const [k, n] of Object.entries(items)) add(b, k, -n);
}
function consumeAt(
  t: Town,
  location: string,
  required: Bag,
  destination?: string,
) {
  const bag = inventoryAt(t, location);
  need(has(bag, required), "You need the listed supplies in your backpack.");
  for (const [item, qty] of Object.entries(required))
    debitLots(t, location, item, qty, destination);
  consume(bag, required);
}
function work(t: Town, p: Player, text: string) {
  t.contributions[p.id] = text;
  for (const [id, c] of Object.entries(t.contracts))
    if (c.status === "active") {
      const rows = ((t.projectWork[id] ??= {})[p.id] ??= []);
      if (!rows.includes(text)) rows.push(text);
    }
}
function financials(t: Town) {
  return Object.values(t.totals).reduce(
    (n, v) => ({ income: n.income + v.income, expense: n.expense + v.expense }),
    { income: 0, expense: 0 },
  );
}
function count(b: Bag) {
  return Object.values(b).reduce((a, b) => a + b, 0);
}
function limit(t: Town) {
  return t.upgrades.includes("cart") ? 14 : 8;
}
function record(
  t: Town,
  text: string,
  amount = 0,
  account = "shared",
  category: Ledger["category"] = amount > 0
    ? "income"
    : amount < 0
      ? "expense"
      : "note",
) {
  const total = (t.totals[account] ??= { income: 0, expense: 0, transfer: 0 });
  if (category !== "note") total[category] += amount;
  t.ledger.push({ day: t.day, text, amount, account, category });
  t.ledger = t.ledger.slice(-200);
}
function grant(t: Town, p: Player, e: string) {
  if (!p.seen.includes(e)) p.seen.push(e);
  if (!t.evidence.includes(e)) t.evidence.push(e);
}
function purchase(
  t: Town,
  p: Player,
  kind: string,
  target: string,
  account: string,
) {
  if (kind === "buy") {
    const o = townOffers(t).find((x) => x.id === target)!;
    need(o, "Offer not found.");
    if (o.id === "delivery-fee")
      need(
        !(p.bag["disputed-payment"] > 0),
        "Resolve your existing disputed payment first.",
      );
    need(
      count(p.bag) + o.qty <= limit(t),
      "Your backpack is full. Store or use supplies first.",
      "INVENTORY_FULL",
    );
    add(p.bag, o.item, o.qty);
    t.lots.push({
      id: `lot-${t.revision}-${t.lots.length}`,
      offer: o.id,
      item: o.item,
      qty: o.qty,
      unitPaid: o.price / o.qty,
      purchasedRevision: t.revision,
      payer: account,
      location: p.id,
    });
    work(t, p, `Acquired ${o.name}`);
  } else if (kind === "upgrade") {
    need(!t.upgrades.includes(target), "Already improved.");
    t.upgrades.push(target);
  } else {
    need(t.bill > 0, "No unpaid bill.");
    t.bill = 0;
  }
  record(
    t,
    `${p.name}: ${kind === "bill" ? "paid service bill" : target}`,
    0,
    account,
  );
}
function costOf(t: Town, kind: string, target: string) {
  return kind === "buy"
    ? townOffers(t).find((x) => x.id === target)?.price
    : kind === "upgrade"
      ? upgrades.find((x) => x.id === target)?.cost
      : t.bill;
}
export function disconnect(t: Town, id: string) {
  const p = t.players.find((x) => x.id === id);
  if (p) {
    p.online = false;
    p.target = undefined;
    p.path = [];
    for (const q of t.pending.filter((x) => x.by === id))
      t.decisions.push({
        id: q.id,
        by: id,
        status: "canceled",
        text: "Request canceled because its requester disconnected. No credits spent.",
      });
    t.decisions = t.decisions.slice(-12);
    t.pending = t.pending.filter((x) => x.by !== id);
    t.revision++;
  }
}
export function apply(
  original: Town,
  id: string,
  c: Command,
): { town: Town; message: string; duplicate?: boolean } {
  need(c.v === 1, "Unsupported protocol version.");
  need(
    typeof c.id === "string" && c.id.length > 0 && c.id.length < 100,
    "Invalid action identifier.",
  );
  if (original.processed.includes(id + ":" + c.id))
    return { town: original, message: "Already applied.", duplicate: true };
  need(
    c.type === "move" ||
      c.type === "ping" ||
      c.type === "ack" ||
      c.revision === original.revision,
    "STALE: The town changed. Review the latest view and try again.",
  );
  const t = structuredClone(original),
    p = t.players.find((x) => x.id === id);
  need(p?.online, "Join the town before acting.");
  const target = c.target || "";
  let message = "Done.";
  if (c.type === "move") {
    need(Number.isFinite(c.x) && Number.isFinite(c.z), "Invalid destination.");
    need(
      Math.abs(c.x!) <= 25 && Math.abs(c.z!) <= 23,
      "Stay within the neighborhood.",
    );
    p.path = route(p.x, p.z, c.x!, c.z!);
    p.target = p.path.shift();
  } else if (c.type === "ping") {
    need(
      districts.some((x) => x.id === target) && pings.includes(c.text as any),
      "Choose a contextual request and landmark.",
    );
    if (c.item)
      need(
        t.evidence.includes(c.item),
        "Inspect this evidence before sharing it.",
      );
    t.radio.push({
      id: c.id,
      by: p.name,
      district: target,
      text: c.item
        ? `${c.text}: ${activities.find((a) => a.evidence === c.item)?.name || c.item}`
        : c.text!,
    });
    t.radio = t.radio.slice(-15);
  } else if (c.type === "ack") {
    const ping = t.radio.find((x) => x.id === target);
    need(ping, "Request no longer exists.");
    ping.ack = p.name;
  } else if (c.type === "next") {
    need(t.review, "The current day is still running.");
    t.review = false;
    t.day++;
    t.seconds = 0;
    for (const a of t.players) a.daily = [];
    if (t.upgrades.includes("rain")) add(t.storage, "water", 2);
    if (t.upgrades.includes("station")) add(t.storage, "filter", 1);
    if (t.upgrades.includes("kitchen")) {
      t.bill += t.upgrades.includes("insulation") ? 5 : 8;
      record(
        t,
        `Kitchen bill due: ${t.bill} credits. Service pauses until paid.`,
      );
    }
    for (const [k, v] of Object.entries(t.contracts))
      if (v.status === "active" && v.due < t.day) {
        v.status = "expired";
        record(
          t,
          `${k} deadline missed. Renegotiate at its district; supplies are retained.`,
        );
      }
  } else {
    need(!t.review, "Review the day’s ledger and start the next day first.");
    if (c.type === "fit" || c.type === "test") {
      near(p, "garden");
      need(
        t.contracts.garden?.status === "active",
        "Accept the garden project first.",
      );
      if (c.type === "fit") {
        need(
          !t.gardenRepair,
          "The fitting is installed. Test the water connection.",
        );
        need(
          ["leak", "diagnosis", "sizes"].every((x) => t.evidence.includes(x)),
          "Inspect the connection, measure at Workshop and examine the Market specifications first.",
        );
        need(
          c.item === "connector" || c.item === "hose",
          "Choose a compatible carried repair part. Unused incompatible parts can be returned at Market.",
        );
        consumeAt(t, p.id, { [c.item]: 1 });
        if (t.contracts.garden.variant === 1) consumeAt(t, p.id, { filter: 1 });
        t.gardenRepair = { part: c.item, by: p.id, tested: false };
        message =
          "Part fitted. The connection still needs a water test before delivery.";
      } else {
        need(
          t.gardenRepair,
          "Fit a repair part before testing the connection.",
        );
        need(
          !t.gardenRepair.tested,
          "Water already reaches the beds. Complete the project to reconcile the reward.",
        );
        t.gardenRepair.tested = true;
        message =
          "Water test passed: the beds receive water and the connection holds. Complete the project to receive its reward.";
      }
      work(
        t,
        p,
        c.type === "fit"
          ? "Fitted the garden connection"
          : "Tested the water connection",
      );
      record(t, `${p.name}: ${message}`);
    } else if (c.type === "activity") {
      const a = activities.find((x) => x.id === target);
      need(a, "Activity not found.");
      near(p, a.district);
      need(
        !a.onceDay || !p.daily.includes(a.id),
        "Already completed today. Try a different activity.",
      );
      if (a.requires === "water") {
        need(
          t.crops.length < 6,
          "All six garden beds are occupied. Harvest before planting more.",
        );
        if (!t.upgrades.includes("irrigation"))
          consumeAt(t, p.id, { water: 1 });
        t.crops.push({ ready: t.simTime + 30, by: p.id });
      }
      if (a.requires === "harvest") {
        const crop = t.crops.findIndex((x) => x.ready <= t.simTime);
        need(
          crop >= 0,
          "No mature crops yet. Check the garden timer and return soon.",
        );
        t.crops.splice(crop, 1);
        add(p.bag, "produce", 1);
      }
      if (a.requires === "kitchen")
        need(
          t.upgrades.includes("kitchen") && !t.bill,
          "Rent the kitchen and pay any outstanding bill first.",
        );
      if (a.requires === "pack") {
        consumeAt(t, p.id, { produce: 1 });
        if (!(p.bag.reused > 0)) consumeAt(t, p.id, { pack: 1 });
      }
      if (a.input) consumeAt(t, p.id, a.input);
      if (a.output)
        for (const [k, n] of Object.entries(a.output)) add(p.bag, k, n);
      need(
        count(p.bag) <= limit(t),
        "Your backpack is full. Store supplies first.",
        "INVENTORY_FULL",
      );
      if (a.evidence) {
        grant(t, p, a.evidence);
        work(t, p, a.name);
      }
      if (!a.evidence) work(t, p, a.name);
      if (a.onceDay) p.daily.push(a.id);
      let pay = a.pay || 0;
      if (a.id === "sell" && t.upgrades.includes("stall")) pay += 5;
      if (a.id === "repair" && t.upgrades.includes("bench")) pay += 3;
      if (pay) {
        p.money += pay;
        record(t, `${p.name}: ${a.name}`, pay, p.id);
      }
      record(t, `${p.name}: ${a.name}`);
      message = a.evidence ? evidenceText(t, a.evidence) : a.description;
    } else if (["buy", "upgrade", "bill"].includes(c.type)) {
      const kind = c.type;
      const def =
        kind === "buy"
          ? townOffers(t).find((x) => x.id === target)
          : upgrades.find((x) => x.id === target);
      if (kind !== "bill") {
        need(def, "Not found.");
        near(p, def.district);
      } else near(p, "hall");
      if (kind === "upgrade")
        need(!t.upgrades.includes(target), "Already improved.");
      const cost = costOf(t, kind, target);
      need(cost && cost > 0, "No charge is due.");
      const personal = c.account === "personal";
      need(
        (personal ? p.money : t.funds) >= cost,
        "Not enough credits. Free jobs are available at Home, Market and Hall.",
        "INSUFFICIENT_FUNDS",
      );
      if (!personal && t.players.some((x) => x.online && x.id !== p.id)) {
        need(
          !t.pending.some((x) => x.by === p.id),
          "You already have a purchase awaiting approval.",
          "PENDING_APPROVAL",
        );
        t.pending.push({ id: c.id, by: p.id, kind: kind as any, target, cost });
        message = "A teammate must approve this shared purchase.";
      } else {
        purchase(t, p, kind, target, personal ? p.id : "shared");
        if (personal) p.money -= cost;
        else t.funds -= cost;
        record(
          t,
          `${kind}: ${target || "kitchen bill"}`,
          -cost,
          personal ? p.id : "shared",
        );
      }
    } else if (
      c.type === "approve" ||
      c.type === "cancel" ||
      c.type === "decline"
    ) {
      const q = t.pending.find((x) => x.id === target);
      need(q, "Purchase is no longer pending.");
      if (c.type === "cancel")
        need(
          q.by === p.id,
          "Only the requester can cancel; teammates can decline.",
        );
      if (c.type === "decline")
        need(q.by !== p.id, "A different teammate must decline.");
      if (c.type === "approve") {
        need(q.by !== p.id, "A different teammate must approve.");
        const buyer = t.players.find((x) => x.id === q.by);
        need(buyer?.online, "Buyer disconnected.");
        need(
          costOf(t, q.kind, q.target) === q.cost,
          "The price changed. Request again.",
        );
        need(t.funds >= q.cost, "Shared funds are no longer sufficient.");
        purchase(t, buyer, q.kind, q.target, "shared");
        t.funds -= q.cost;
        record(t, `${p.name} approved ${q.target || "bill"}`, -q.cost);
      }
      const status =
        c.type === "approve"
          ? "approved"
          : c.type === "decline"
            ? "declined"
            : "canceled";
      message = `${q.target || "Service bill"}: ${status} by ${p.name}. ${status === "approved" ? `${q.cost} credits committed.` : "No credits spent."}`;
      t.decisions.push({ id: q.id, by: q.by, status, text: message });
      t.decisions = t.decisions.slice(-12);
      record(t, message);
      t.pending = t.pending.filter((x) => x.id !== target);
    } else if (c.type === "transfer") {
      near(p, "home");
      need(
        c.item && Number.isInteger(c.qty) && c.qty! > 0 && c.qty! <= 60,
        "Choose a valid quantity.",
      );
      const toStore = c.direction === "store";
      const from = toStore ? p.bag : t.storage,
        to = toStore ? t.storage : p.bag;
      consumeAt(
        t,
        toStore ? p.id : "storage",
        { [c.item]: c.qty! },
        toStore ? "storage" : p.id,
      );
      add(to, c.item, c.qty!);
      need(
        count(p.bag) <= limit(t),
        "Backpack capacity exceeded.",
        "INVENTORY_FULL",
      );
      need(
        count(t.storage) <=
          30 +
            (t.upgrades.includes("storage") ? 30 : 0) +
            (t.upgrades.includes("stock") ? 20 : 0) +
            (t.upgrades.includes("shelves") ? 10 : 0),
        "Shared storage is full.",
        "INVENTORY_FULL",
      );
    } else if (c.type === "give") {
      const other = t.players.find((x) => x.id === c.player);
      need(
        other &&
          other.id !== p.id &&
          Math.hypot(other.x - p.x, other.z - p.z) < 5,
        "Meet your teammate to exchange supplies.",
      );
      need(
        c.item && Number.isInteger(c.qty) && c.qty! > 0,
        "Invalid quantity.",
      );
      consumeAt(t, p.id, { [c.item]: c.qty! }, other.id);
      add(other.bag, c.item, c.qty!);
      work(t, p, "Shared repair or project supplies");
      need(
        count(other.bag) <= limit(t),
        "Their backpack is full.",
        "INVENTORY_FULL",
      );
    } else if (c.type === "deposit") {
      near(p, "home");
      need(
        Number.isInteger(c.qty) && c.qty! > 0 && p.money >= c.qty!,
        "Choose an amount you have earned.",
      );
      p.money -= c.qty!;
      t.funds += c.qty!;
      record(t, `${p.name} contributed earnings`, c.qty!, "shared", "transfer");
      record(t, "Contribution to cooperative", -c.qty!, p.id, "transfer");
    } else if (c.type === "refund") {
      const o = townOffers(t).find((x) => x.id === target);
      need(o, "Offer not found.");
      near(p, o.district);
      if (o.id === "delivery-fee")
        need(
          t.evidence.includes("verified"),
          "Contact the original depot desk to dispute this payment first.",
        );
      const plan = refundPlan(t, p.id, o.id, o.qty);
      need(
        plan,
        "No complete unused purchased quantity is refundable. Free, used and unverifiable legacy supplies cannot be returned for credits.",
        "NOT_REFUNDABLE",
      );
      need(
        (p.bag[o.item] || 0) >= o.qty,
        "You need the refundable supplies in your backpack.",
      );
      const amounts: Record<string, number> = {};
      for (const row of plan) {
        row.lot.qty -= row.qty;
        amounts[row.lot.payer] = (amounts[row.lot.payer] || 0) + row.amount;
      }
      t.lots = t.lots.filter((l) => l.qty > 0);
      add(p.bag, o.item, -o.qty);
      for (const [payer, amount] of Object.entries(amounts)) {
        if (payer === "shared") t.funds += amount;
        else {
          const original = t.players.find((p) => p.id === payer);
          need(original, "Original payer is unavailable.");
          original.money += amount;
        }
        record(
          t,
          `Returned unused ${o.name} to original payer`,
          amount,
          payer,
          "expense",
        );
      }
      message =
        "Unused purchase refunded to its original payer. Used units and free supplies are not refundable.";
    } else if (c.type === "accept" || c.type === "renegotiate") {
      const pr = projects.find((x) => x.id === target);
      need(pr, "Project not found.");
      near(p, pr.district);
      need(t.contracts[target]?.status !== "active", "Already accepted.");
      const previousContract = t.contracts[target];
      t.contracts[target] = {
        due: t.day + pr.deadline,
        status: "active",
        baseline: financials(t),
        variant:
          (t.contracts[target] ? t.contracts[target].variant + 1 : 0) % 2,
      };
      t.projectWork[target] = {};
      if (previousContract && target !== "garden") {
        const reset = target === "market" ? ["receipt"] : ["verified", "terms"];
        t.evidence = t.evidence.filter((e) => !reset.includes(e));
        for (const resident of t.players)
          resident.seen = resident.seen.filter((e) => !reset.includes(e));
      }
      if (target === "garden") {
        t.variant = t.contracts[target].variant;
        const reset = ["leak", "diagnosis", "sizes"];
        if (previousContract) {
          t.evidence = t.evidence.filter((e) => !reset.includes(e));
          for (const resident of t.players)
            resident.seen = resident.seen.filter((e) => !reset.includes(e));
        }
      }
      if (target === "garden") {
        delete t.gardenRepair;
        t.contributions = {};
      }
      record(
        t,
        `${pr.name} accepted: due day ${t.day + pr.deadline}. Cancel without fee; keep supplies.`,
      );
    } else if (c.type === "abandon") {
      const pr = projects.find((x) => x.id === target);
      need(pr, "Project not found.");
      near(p, pr.district);
      need(t.contracts[target]?.status === "active", "No active project.");
      delete t.contracts[target];
      record(t, `${pr.name} canceled without fee.`);
    } else if (c.type === "complete") {
      const pr = projects.find((x) => x.id === target);
      need(pr, "Project not found.");
      near(p, pr.district);
      const contract = t.contracts[target];
      need(contract?.status === "active", "Accept this project first.");
      need(contract.due >= t.day, "Renegotiate this expired project.");
      if (target === "garden") {
        need(
          t.gardenRepair?.tested,
          "Fit a compatible part and test the water at the Garden before completing the project.",
        );
      }
      if (target === "market") {
        need(t.evidence.includes("receipt"), "Check the delivery board first.");
        consumeAt(t, p.id, { parcel: contract.variant === 1 ? 2 : 1 });
      }
      if (target === "evening") {
        need(
          ["verified", "terms"].every((x) => t.evidence.includes(x)),
          "Check the hire agreement and verify the message with the depot desk.",
        );
        consumeAt(t, p.id, { repair: contract.variant === 1 ? 2 : 1 });
        if (p.bag.meal) consumeAt(t, p.id, { meal: 1 });
        else consumeAt(t, p.id, { parcel: 1 });
        if (!t.upgrades.includes("event")) consumeAt(t, p.id, { lamp: 1 });
      }
      contract.status = "complete";
      const reward =
        pr.reward +
        (target === "market" && t.upgrades.includes("shelves") ? 5 : 0);
      t.funds += reward;
      record(t, `${pr.name}: completed together`, reward);
      const end = financials(t),
        base = contract.baseline;
      t.outcomes.push({
        project: target,
        reward,
        spending: base ? -(end.expense - base.expense) : null,
        income: base ? end.income - base.income : null,
        net: base
          ? end.income - base.income + end.expense - base.expense
          : null,
        contributions: structuredClone(t.projectWork[target] || {}),
      });
      t.outcomes = t.outcomes.slice(-12);
      message = `${pr.name} complete! The neighborhood changes because of your work.`;
    } else if (c.type === "return-kitchen") {
      near(p, "hall");
      t.upgrades = t.upgrades.filter((x) => x !== "kitchen");
      message =
        "Kitchen returned. No new bills accrue; existing charges remain payable.";
    } else if (c.type === "negotiate-bill") {
      near(p, "hall");
      need(t.bill > 0, "No overdue bill.");
      need(!p.daily.includes("bill-help"), "Already negotiated today.");
      t.bill = Math.max(0, t.bill - 5);
      p.daily.push("bill-help");
      record(t, "Caretaker exchanged setup work for 5 credits of bill relief.");
    } else if (c.type === "companion") {
      need(
        t.players.filter((x) => x.online).length === 1,
        "EMBER helps when playing solo.",
      );
      near(p, "home");
      need(c.item && p.bag[c.item] > 0, "Choose a carried item.");
      need(
        count(t.storage) < 30 + (t.upgrades.includes("storage") ? 30 : 0),
        "Storage is full.",
        "INVENTORY_FULL",
      );
      consumeAt(t, p.id, { [c.item]: 1 }, "storage");
      add(t.storage, c.item, 1);
      message = "EMBER stored one item at the clubhouse.";
    } else throw new GameRuleError("Unknown action.");
  }
  t.processed.push(id + ":" + c.id);
  t.processed = t.processed.slice(-1000);
  if (["move", "ping", "ack"].includes(c.type)) t.movementSequence++;
  else t.revision++;
  return { town: t, message };
}
export function tick(t: Town, dt: number) {
  if (!t.players.some((p) => p.online) || t.review) return;
  const oldTime = t.simTime,
    oldSeconds = t.seconds;
  const moving = t.players.some((p) => p.online && p.target);
  t.simTime += dt;
  // Full protocol-v1 states are needed for visible changes, not every idle clock tick.
  if (
    moving ||
    (t.mode === "life" &&
      Math.floor(oldSeconds) !== Math.floor(oldSeconds + dt)) ||
    (t.crops.length > 0 && Math.floor(oldTime) !== Math.floor(t.simTime))
  )
    t.movementSequence++;
  for (const p of t.players) {
    if (!p.online) continue;
    let budget = dt * 5;
    while (p.target && budget > 0) {
      const dx = p.target.x - p.x,
        dz = p.target.z - p.z,
        d = Math.hypot(dx, dz);
      if (d <= budget) {
        p.x = p.target.x;
        p.z = p.target.z;
        budget -= d;
        p.target = p.path?.shift();
      } else {
        p.x += (dx / d) * budget;
        p.z += (dz / d) * budget;
        budget = 0;
      }
    }
  }
  if (t.mode === "life") {
    t.seconds += dt;
    if (t.seconds >= 1200) {
      t.seconds = 1200;
      t.review = true;
      t.revision++;
    }
  }
}
export function snapshot(t: Town, id: string) {
  return {
    ...t,
    processed: undefined,
    lots: undefined,
    evidenceDocuments: Object.fromEntries(
      t.evidence.map((e) => [e, evidenceText(t, e)]),
    ),
    refundAmounts: Object.fromEntries(
      townOffers(t).map((o) => [
        o.id,
        refundPlan(t, id, o.id, o.qty)?.reduce((n, row) => n + row.amount, 0) ||
          0,
      ]),
    ),
    refundable: Object.fromEntries(
      townOffers(t).map((o) => [
        o.id,
        refundPlan(t, id, o.id, o.qty) ? o.qty : 0,
      ]),
    ),
    players: t.players.map(({ token, ...p }) => ({
      ...p,
      seen: p.id === id ? p.seen : undefined,
    })),
    you: id,
  };
}
export function restore(raw: any): Town {
  need(
    (raw?.schema === 1 || raw?.schema === 2 || raw?.schema === 3) &&
      Array.isArray(raw.players) &&
      Array.isArray(raw.ledger) &&
      !!raw.contracts &&
      typeof raw.code === "string",
    "Unsupported save schema; preserve this database and upgrade the server.",
  );
  const t = raw as Town;
  const migrated = raw.schema === 1;
  t.schema = 3;
  t.lots ??= [];
  need(
    Array.isArray(t.lots) &&
      t.lots.every(
        (l) =>
          typeof l.id === "string" &&
          typeof l.offer === "string" &&
          typeof l.item === "string" &&
          (l.payer === "shared" || t.players.some((p) => p.id === l.payer)) &&
          offers.some((o) => o.id === l.offer && o.item === l.item) &&
          Number.isSafeInteger(l.qty) &&
          l.qty > 0 &&
          Number.isSafeInteger(l.unitPaid) &&
          l.unitPaid > 0 &&
          (l.location === "storage" ||
            t.players.some((p) => p.id === l.location)),
      ),
    "Invalid purchase provenance; preserve this backup.",
  );
  for (const location of ["storage", ...t.players.map((p) => p.id)])
    for (const item of new Set(
      t.lots.filter((l) => l.location === location).map((l) => l.item),
    ))
      need(
        t.lots
          .filter((l) => l.location === location && l.item === item)
          .reduce((a, l) => a + l.qty, 0) <=
          (inventoryAt(t, location)[item] || 0),
        "Invalid refundable inventory; preserve this backup.",
      );
  t.projectWork ??= {};
  t.outcomes ??= [];
  t.movementSequence ??= 0;
  t.contributions ??= {};
  t.decisions ??= [];
  if (!t.totals) {
    t.totals = {};
    for (const row of t.ledger || []) {
      const total = (t.totals[row.account] ??= {
        income: 0,
        expense: 0,
        transfer: 0,
      });
      if (row.category && row.category !== "note")
        total[row.category] += row.amount;
    }
    t.totalsComplete = false;
  }
  if (migrated && t.contracts.garden?.status === "complete")
    t.gardenRepair ??= { part: "legacy", by: "", tested: true };
  t.simTime ??= 0;
  t.crops ??= [];
  for (const p of t.players) {
    p.online = false;
    p.target = undefined;
    p.path = [];
  }
  t.pending = [];
  return t;
}
