export const worldThemes = [
  {
    id: "forest",
    name: "Forest",
    outfit: "everyday",
    sky: "#c6dde4",
    ground: "#8ca67c",
    road: "#e4d7be",
    wall: "#d5b38a",
    roof: "#637b73",
    foliage: "#537c60",
    accent: "#e6bf74",
    sun: "#fff2ce",
    shelter: false,
    description: "Woodland paths · everyday clothes",
  },
  {
    id: "city",
    name: "City",
    outfit: "everyday",
    sky: "#c7d4e0",
    ground: "#9eaba2",
    road: "#6e7b83",
    wall: "#bbc6ce",
    roof: "#4b6073",
    foliage: "#4e7968",
    accent: "#f2ca69",
    sun: "#fff2db",
    shelter: false,
    description: "City skyline · neighborhood streets",
  },
  {
    id: "mountains",
    name: "Snowy mountains",
    outfit: "winter",
    sky: "#c7ddeb",
    ground: "#e2ebed",
    road: "#b1bec4",
    wall: "#a9bdc9",
    roof: "#edf3f3",
    foliage: "#6b9290",
    accent: "#d8ae70",
    sun: "#edf5ff",
    shelter: true,
    description: "Snowy peaks · jackets & hats · sheltered garden",
  },
  {
    id: "island",
    name: "Island & beach",
    outfit: "beach",
    sky: "#a8dce9",
    ground: "#e8d5a1",
    road: "#eddfb9",
    wall: "#ead7a8",
    roof: "#b68f59",
    foliage: "#4a9978",
    accent: "#e87968",
    sun: "#fff0c6",
    shelter: false,
    description: "Ocean & palms · beachwear",
  },
  {
    id: "space",
    name: "Space station",
    outfit: "space",
    sky: "#10162f",
    ground: "#4c5870",
    road: "#91a7b7",
    wall: "#c4d3df",
    roof: "#657a96",
    foliage: "#76b4ac",
    accent: "#86dce9",
    sun: "#dce8ff",
    shelter: true,
    description: "Orbital outpost · spacesuits · growing habitat",
  },
  {
    id: "moon",
    name: "Moon",
    outfit: "space",
    sky: "#0d1124",
    ground: "#9e9fa9",
    road: "#c6c7d0",
    wall: "#d2d8e1",
    roof: "#78859a",
    foliage: "#82ad9a",
    accent: "#e7c27c",
    sun: "#edf1ff",
    shelter: true,
    description: "Lunar craters · spacesuits · growing habitat",
  },
  {
    id: "mars",
    name: "Mars",
    outfit: "space",
    sky: "#b87d70",
    ground: "#b76c4c",
    road: "#d89c73",
    wall: "#dfc6ab",
    roof: "#846e66",
    foliage: "#96aa80",
    accent: "#8bd2e0",
    sun: "#ffd8bd",
    shelter: true,
    description: "Red-rock frontier · spacesuits · growing habitat",
  },
] as const;
export type WorldTheme = (typeof worldThemes)[number];
export type WorldThemeId = WorldTheme["id"];
export function getWorldTheme(id: string | null | undefined): WorldTheme {
  return worldThemes.find((theme) => theme.id === id) || worldThemes[0];
}
/** Only authored scene colors are remapped. Gameplay plants keep their health cues. */
export function themeColor(color: string, theme: WorldTheme) {
  if (theme.id === "forest") return color;
  if (["#96ad83", "#8ca67c", "#cfcea9"].includes(color)) return theme.ground;
  if (["#e4d7be", "#e8ddc6", "#c9bda6"].includes(color)) return theme.road;
  if (["#e9b679", "#e7947e", "#a4b8ce", "#d8b967", "#b8a3c5"].includes(color))
    return theme.wall;
  if (["#657b73", "#637b73", "#536c65"].includes(color)) return theme.roof;
  if (["#537c60", "#789968", "#79996d", "#668969"].includes(color))
    return theme.foliage;
  return color;
}
