const PALETTE = [
  "#d9530f",
  "#378add",
  "#639922",
  "#ba7517",
  "#7f77dd",
  "#e24b4a",
  "#0c8a7a",
  "#a5670f",
];

const cache = new Map<string, string>();

export function colorForCategory(category: string): string {
  const cached = cache.get(category);
  if (cached) return cached;
  const color = PALETTE[cache.size % PALETTE.length];
  cache.set(category, color);
  return color;
}
