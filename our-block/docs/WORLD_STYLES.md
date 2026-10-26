# Same neighborhood, seven worlds

Implemented October 23, 2026 and deployed publicly. Security release `2026.10.24-rc2` was subsequently verified live; submission text is maintained in `submission/`.

Use the **World** dropdown above the game. It switches the scenery, palette and every visible resident's outfit together. The preference is remembered on this browser. It is a personal visual style: another resident can choose a different view of the same shared town. Switching never sends a game command, changes inventory, resets projects or relocates a district.

| World | Landscape | Outfit | Garden |
| --- | --- | --- | --- |
| Forest | Hills, woodland and original neighborhood palette | Everyday clothes | Open garden |
| City | Towers and lit window rows around the block; paved streets | Everyday clothes | Open garden |
| Snowy mountains | Snowy peaks, frosty ground and evergreen palette | Jacket, scarf, knit hat and winter boots | Open-sided covered growing shelter |
| Island & beach | Ocean, sandy island, palms and distant wave lines | Short outfit, shorts, sun hat and sandals | Open garden |
| Space station | Star field, distant planet, solar arrays and station ground | Helmet, visor, suit, backpack and boots | Enclosed growing habitat with automatic sliding entrance |
| Moon | Gray rock field, craters and stars | Spacesuit | Enclosed growing habitat with automatic sliding entrance |
| Mars | Red ground, rocky terrain, craters and dusty sky | Spacesuit | Enclosed growing habitat with automatic sliding entrance |

These are authored visual layers over the same map, not weather, oxygen, gravity or temperature simulations. Clothing changes automatically with the style; there are no clothing purchases. Existing action requirements, movement limits, collision map and project rules remain authoritative.

Static scenery remains a single merged vertex-colored mesh per selected world, below 10,000 triangles. Only the selected world exists in the scene. Theme changes dispose the previous renderer, controls, geometries and materials, including habitat roof and selection ring. Reduced motion still disables camera damping and limb movement. Accessible map remains available and uses the chosen palette.

Validation: all seven scenes have finite geometry, remain below the scenery triangle budget and leave the existing main walking lanes clear. Theme identities, fallback for an invalid saved preference, clothing/shelter assignment and existing movement/world behavior pass: 20 focused checks. TypeScript and production build passed. On October 25, browser access was available and all seven styles were selected and captured from the deployed game in full town overview. The captures are in `../submission/`; this visual capture does not establish new physical-phone performance results. Play the public build at https://our-block-1ooe.onrender.com/.

Mars, Moon and Space Station now use a fully enclosed translucent garden habitat: continuous roof, perimeter walls and a framed twin-panel door on the east side facing the town lane. The door opens when any online resident comes within four world units and closes when the entrance is clear; reduced motion switches it instantly. This remains a visual enclosure over the existing shared movement rules, not a pressure/oxygen or new collision simulation.
