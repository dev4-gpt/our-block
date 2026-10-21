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
