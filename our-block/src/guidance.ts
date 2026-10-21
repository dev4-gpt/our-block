export type Guidance = "Guided" | "Light" | "Off";
/** Prompts describe tasks and controls; never recommend an offer, part or seller. */
export function gardenSteps(s: any) {
  const evidence = s.evidence || [];
  return [
    { label: "Agree on a plan at the dry garden", done: !!s.contracts?.garden },
    { label: "Inspect the connection", done: evidence.includes("leak") },
    {
      label: "Measure and investigate at Workshop",
      done: evidence.includes("diagnosis"),
    },
    {
      label: "Compare specifications and total costs at Market",
      done: evidence.includes("sizes"),
    },
    {
      label: "Bring supplies and fit your chosen repair",
      done: !!s.gardenRepair,
    },
    { label: "Test the water connection", done: !!s.gardenRepair?.tested },
    {
      label: "Reconcile the completed project",
      done: s.contracts?.garden?.status === "complete",
    },
  ];
}

export function projectSteps(s: any, id: string) {
  if (id === "garden") return gardenSteps(s);
  const bags = s.players || [],
    has = (key: string, n = 1) =>
      bags.reduce((a: number, p: any) => a + (p.bag[key] || 0), 0) >= n;
  const ev = s.evidence || [],
    variant = s.contracts[id]?.variant || 0;
  return id === "market"
    ? [
        {
          label: "Read the original delivery order at Depot",
          done: ev.includes("receipt"),
        },
        {
          label: "Grow, harvest and pack the required order(s)",
          done: has("parcel", variant ? 2 : 1),
        },
        {
          label: "Deliver and reconcile at Market",
          done: s.contracts.market?.status === "complete",
        },
      ]
    : [
        { label: "Read hire terms at Hall", done: ev.includes("terms") },
        {
          label:
            "Verify the changed payment request with the original Depot desk",
          done: ev.includes("verified"),
        },
        {
          label: "Prepare the required repaired stool(s)",
          done: has("repair", variant ? 2 : 1),
        },
        {
          label: "Prepare food or a packed produce order",
          done: has("meal") || has("parcel"),
        },
        {
          label: "Arrange hired lantern or owned event lighting",
          done: has("lamp") || s.upgrades.includes("event"),
        },
        {
          label: "Deliver and reconcile at Hall",
          done: s.contracts.evening?.status === "complete",
        },
      ];
}
