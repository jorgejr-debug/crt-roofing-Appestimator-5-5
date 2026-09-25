// Older settings may contain serialized JSON; never spread arrays or strings
// into the company's pricing and travel defaults.
export function toPlainObject(value, fallback = {}) {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return fallback; }
  }
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}
