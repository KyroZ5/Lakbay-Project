/**
 * Query parameter sanitizers.
 */
export const parseLimit = (value, def = 50, max = 200) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return def;
  return Math.min(Math.floor(n), max);
};
