export type DistrictId =
  "home" | "market" | "workshop" | "garden" | "depot" | "hall";
export const districts: {
  id: DistrictId;
  name: string;
  subtitle: string;
  x: number;
  z: number;
  color: string;
  icon: string;
}[] = [
  {
    id: "home",
    name: "Home Street",
    subtitle: "Make room for better days",
    x: -15,
    z: -12,
    color: "#e9b679",
    icon: "⌂",
  },
  {
    id: "market",
    name: "Market Square",
    subtitle: "Good value takes a closer look",
    x: 0,
    z: -12,
    color: "#e7947e",
    icon: "▤",
  },
  {
    id: "workshop",
    name: "Workshop Yard",
    subtitle: "Find the fault. Make it work.",
    x: 15,
    z: -12,
    color: "#a4b8ce",
    icon: "⚒",
  },
  {
    id: "garden",
    name: "Community Gardens",
    subtitle: "Small care, lasting growth",
    x: -15,
    z: 12,
    color: "#a1bd82",
    icon: "❧",
  },
  {
    id: "depot",
    name: "Delivery Depot",
    subtitle: "Get the right things there",
    x: 0,
    z: 12,
    color: "#d8b967",
    icon: "▣",
  },
  {
    id: "hall",
    name: "Community Hall",
    subtitle: "Build something together",
    x: 15,
    z: 12,
    color: "#b8a3c5",
    icon: "⚑",
  },
];
export const items: Record<string, string> = {
  tool: "Basic tools",
  connector: "20 mm connector",
  wrong: "25 mm connector",
  hose: "Replacement hose",
  seed: "Seed packet",
  produce: "Harvest crate",
  pack: "Paper packaging",
  reused: "Reusable crates",
  parcel: "Packed order",
  lamp: "Event lantern",
  filter: "Filter insert",
  repair: "Repaired stool",
  meal: "Prepared food",
  water: "Water can",
};
export type Activity = {
  id: string;
  district: DistrictId;
  name: string;
  description: string;
  input?: Record<string, number>;
  output?: Record<string, number>;
  pay?: number;
  evidence?: string;
  observation?: string;
  requires?: string;
  onceDay?: boolean;
};
export const activities: Activity[] = [
  {
    id: "audit",
    district: "home",
    name: "Read the meter",
    description:
      "Compare equal light output: old lamp uses 6 credits/day; efficient lamp 2. A low purchase price alone does not show running cost.",
    evidence: "meter",
  },
  {
    id: "maintain",
    district: "home",
    name: "Repair a loose shelf",
    description:
      "Use the shared tools to secure a shelf. Earn 8 credits for a useful repair.",
    pay: 8,
    onceDay: true,
  },
  {
    id: "plan",
    district: "home",
    name: "Pack tomorrow’s supplies",
    description: "Refill a reusable water can at home for use in the garden.",
    output: { water: 1 },
    onceDay: true,
  },
  {
    id: "compare",
    district: "market",
    name: "Compare the parts counter",
    description:
      "The garden fitting needs 20 mm. The 25 mm bargain is cheaper but incompatible. Nia’s unfamiliar stall sells a tested 20 mm connector for 18 credits.",
    evidence: "sizes",
  },
  {
    id: "sell",
    district: "market",
    name: "Fill a produce order",
    description:
      "Deliver one harvest crate in paper packaging. Customer pays 30 credits; your ledger also shows supply costs.",
    input: { produce: 1, pack: 1 },
    pay: 30,
  },
  {
    id: "restock",
    district: "market",
    name: "Sort the shop stock",
    description:
      "Help the shopkeeper sort labels and quantities. Earn 10 personal credits, once per day.",
    pay: 10,
    onceDay: true,
  },
  {
    id: "diagnose",
    district: "workshop",
    name: "Measure and pressure-test",
    description:
      "The hose is sound; its split connector measures 20 mm. Replacing only that part or replacing the hose will both work.",
    evidence: "diagnosis",
  },
  {
    id: "repair",
    district: "workshop",
    name: "Repair a donated stool",
    description:
      "Use one filter insert as a protective sanding pad and the shared tools. Creates a stool for the hall.",
    input: { filter: 1 },
    output: { repair: 1 },
  },
  {
    id: "test",
    district: "workshop",
    name: "Test the replacement claim",
    description:
      "The repair bench demonstrates that the whole assembly does not need replacing. Inspect the failure before paying for a replacement.",
    evidence: "repair-test",
  },
  {
    id: "water",
    district: "garden",
    name: "Water and tend a bed",
    description:
      "Plant a seed and water a bed. It becomes ready to harvest after 30 seconds of active play. Irrigation removes the need to carry water.",
    input: { seed: 1 },
    requires: "water",
  },
  {
    id: "harvest",
    district: "garden",
    name: "Harvest a ready bed",
    description:
      "Collect one mature crop into your backpack for a market order or community meal.",
    requires: "harvest",
  },
  {
    id: "inspect",
    district: "garden",
    name: "Inspect the dry bed",
    description:
      "Trace the dry soil to a leaking connector. The notice calling a growth tonic “essential” gives no trial results.",
    evidence: "leak",
  },
  {
    id: "trial",
    district: "garden",
    name: "Run a small growing trial",
    description:
      "Compare two beds with the same water and light. The labeled demonstration shows no added growth from the advertised tonic.",
    evidence: "trial",
  },
  {
    id: "pack",
    district: "depot",
    name: "Pack an order",
    description:
      "Protect one harvest crate with paper packaging or a reusable crate. Creates an order ready to deliver.",
    requires: "pack",
    output: { parcel: 1 },
  },
  {
    id: "route",
    district: "depot",
    name: "Check the delivery board",
    description:
      "Market → Depot → Hall is the short loop. The original order says delivery is included; the message asking for an extra 25 credits is not from the depot.",
    evidence: "receipt",
  },
  {
    id: "trace",
    district: "depot",
    name: "Contact the depot desk",
    description:
      "Use the contact printed on the original receipt. The clerk confirms no extra payment is due and locates the parcel on shelf B.",
    evidence: "verified",
  },
  {
    id: "cater",
    district: "hall",
    name: "Prepare the community table",
    description:
      "Turn a harvest crate into prepared food using the rented kitchen.",
    input: { produce: 1 },
    output: { meal: 1 },
    requires: "kitchen",
  },
  {
    id: "jobs",
    district: "hall",
    name: "Help set up chairs",
    description:
      "Help the caretaker arrange seating. Earn 12 personal credits without buying any equipment.",
    pay: 12,
    onceDay: true,
  },
  {
    id: "terms",
    district: "hall",
    name: "Read the hire agreement",
    description:
      "Kitchen hire costs 10 credits now and 8 per day from tomorrow. The event lantern hire is 24 credits total; the new payment message conflicts with the signed agreement.",
    evidence: "terms",
  },
];
const investigationPrompts: Record<string, string> = {
  audit:
    "Compare the meter readings for two lamps with the same light output. What changes the running cost?",
  compare:
    "Inspect the parts counter: compare fitting sizes, quantities and complete prices before choosing.",
  diagnose:
    "Use the workshop gauge to measure the garden fitting and pressure-test the hose.",
  test: "Put the damaged assembly on the bench and test which component actually fails.",
  inspect:
    "Follow the water from the tap to the dry bed. Inspect the connection and the nearby advertisement.",
  trial:
    "Observe two labeled trial beds kept under equal water and light. Compare the advertised tonic with the untreated bed.",
  route:
    "Look up the original order and its agreed route at the depot. Compare it with the new delivery message.",
  trace:
    "Contact the depot using the number on the original order, rather than the payment message.",
  terms:
    "Read the signed kitchen and lantern agreements. Check upfront charges, recurring charges and delivery terms.",
};
for (const activity of activities) {
  if (activity.evidence) {
    activity.observation = activity.description;
    activity.description =
      investigationPrompts[activity.id] || activity.description;
  }
}

export const offers = [
  {
    id: "delivery-fee",
    district: "depot",
    name: "Message: release your parcel",
    price: 25,
    item: "disputed-payment",
    qty: 1,
    detail:
      "A message claims you must pay 25 credits before delivery. Compare it with your original order or contact the depot independently. Payment does not guarantee delivery.",
  },
  {
    id: "connector",
    district: "market",
    name: "Connector · 20 mm",
    price: 18,
    item: "connector",
    qty: 1,
    detail: "Nia’s stall · one fitting for 20 mm sockets · full refund unused",
  },
  {
    id: "wrong",
    district: "market",
    name: "Bargain connector · 25 mm",
    price: 9,
    item: "wrong",
    qty: 1,
    detail: "One fitting for 25 mm sockets · full refund unused",
  },
  {
    id: "hose",
    district: "market",
    name: "Complete replacement hose",
    price: 36,
    item: "hose",
    qty: 1,
    detail: "One complete hose with a 20 mm fitting · full refund unused",
  },
  {
    id: "seed",
    district: "market",
    name: "Seeds · pack of 3",
    price: 12,
    item: "seed",
    qty: 3,
    detail: "4 credits per packet · enough for three beds",
  },
  {
    id: "pack",
    district: "market",
    name: "Paper sleeves · pack of 3",
    price: 6,
    item: "pack",
    qty: 3,
    detail: "2 credits each · used once",
  },
  {
    id: "reused",
    district: "depot",
    name: "Reusable delivery crate",
    price: 12,
    item: "reused",
    qty: 1,
    detail: "Returned after packing · worthwhile for repeated deliveries",
  },
  {
    id: "filter",
    district: "workshop",
    name: "Protective repair pad",
    price: 4,
    item: "filter",
    qty: 1,
    detail: "For finishing donated furniture",
  },
  {
    id: "lamp",
    district: "hall",
    name: "Hire event lantern",
    price: 24,
    item: "lamp",
    qty: 1,
    detail: "Single event hire · no additional delivery charge",
  },
];
export const upgrades = [
  {
    id: "storage",
    district: "home",
    name: "Storage shelves",
    cost: 30,
    detail: "Raises shared storage capacity from 30 to 60 items.",
  },
  {
    id: "insulation",
    district: "home",
    name: "Insulate the clubhouse",
    cost: 45,
    detail: "Reduces rented kitchen utility bill from 8 to 5 credits/day.",
  },
  {
    id: "stall",
    district: "market",
    name: "Stall equipment",
    cost: 35,
    detail: "Adds 5 credits to each produce sale.",
  },
  {
    id: "stock",
    district: "market",
    name: "Stock cupboard",
    cost: 25,
    detail: "Adds 20 shared storage spaces.",
  },
  {
    id: "bench",
    district: "workshop",
    name: "Tool bench",
    cost: 30,
    detail: "Repaired stools yield a 3-credit workmanship payment.",
  },
  {
    id: "station",
    district: "workshop",
    name: "Repair station",
    cost: 40,
    detail: "Donated repair pads are available once per day.",
  },
  {
    id: "irrigation",
    district: "garden",
    name: "Irrigation",
    cost: 40,
    detail: "Tending beds no longer requires carrying a water can.",
  },
  {
    id: "rain",
    district: "garden",
    name: "Rain collection",
    cost: 25,
    detail: "Receive two water cans at the start of each day.",
  },
  {
    id: "cart",
    district: "depot",
    name: "Cargo cart",
    cost: 35,
    detail: "Personal carrying capacity increases from 8 to 14 items.",
  },
  {
    id: "shelves",
    district: "depot",
    name: "Parcel shelving",
    cost: 25,
    detail: "Adds 10 shared storage spaces and 5 credits to delivery rewards.",
  },
  {
    id: "kitchen",
    district: "hall",
    name: "Rent the shared kitchen",
    cost: 10,
    detail: "Prepare food. Bill of 8/day starts tomorrow; return at any time.",
  },
  {
    id: "event",
    district: "hall",
    name: "Event equipment",
    cost: 45,
    detail:
      "Community evenings can use owned lighting instead of lantern hire.",
  },
];
export const projects = [
  {
    id: "garden",
    name: "Open the garden",
    district: "garden",
    reward: 55,
    description:
      "Find the leak, inspect a compatible repair, then fit a connector or replacement hose.",
    requirements:
      "Inspect garden, measure at Workshop, compare at Market; bring a connector or hose.",
    deadline: 3,
  },
  {
    id: "market",
    name: "Run a neighborhood market",
    district: "market",
    reward: 65,
    description:
      "Grow and pack an order, check its route, then deliver it to the market.",
    requirements:
      "One packed order; inspect delivery board. Paper or reusable packaging both work.",
    deadline: 3,
  },
  {
    id: "evening",
    name: "Host a community evening",
    district: "hall",
    reward: 90,
    description:
      "Verify the hire terms and payment message, then furnish and supply the gathering.",
    requirements:
      "Repaired stool; prepared food or packed produce; hired lantern or owned event equipment; verified receipt.",
    deadline: 4,
  },
];
export const pings = [
  "Inspect this",
  "Compare this",
  "Bring this",
  "Approve purchase",
] as const;
