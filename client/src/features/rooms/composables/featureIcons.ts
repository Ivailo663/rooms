export const featureIconMap: Record<string, string> = {
  ball: "fa-futbol",
  showers: "fa-shower",
  parking: "fa-square-parking",
  lights: "fa-sun",
  water: "fa-bottle-water",
};

// The API types features as JSON, so a slot may carry null or something that
// isn't a list; treat that as no features rather than crash a tile.
export const slotFeatures = (features: unknown): string[] =>
  Array.isArray(features) ? (features as string[]) : [];
