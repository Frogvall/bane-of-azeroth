export function parseHexColor(color, fallback = 0x00ff00) {
  if (typeof color !== "string") return fallback;

  const value = Number.parseInt(color.replace(/^#/, ""), 16);
  return Number.isFinite(value) ? value : fallback;
}
