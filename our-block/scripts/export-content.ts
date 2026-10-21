import { worldPlan } from "../shared/world.ts";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  districts,
  activities,
  offers,
  upgrades,
  projects,
  items,
  pings,
} from "../shared/content.ts";
mkdirSync("unity/Assets/Resources", { recursive: true });
writeFileSync(
  "unity/Assets/Resources/Content.json",
  JSON.stringify(
    {
      districts,
      activities,
      offers,
      upgrades,
      projects,
      items,
      pings,
      worldPlan,
    },
    null,
    2,
  ),
);
