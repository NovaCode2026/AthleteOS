const namespace = "athleteos";

export function readStore(key, fallback) {
  try {
    const value = localStorage.getItem(`${namespace}:${key}`);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStore(key, value) {
  localStorage.setItem(`${namespace}:${key}`, JSON.stringify(value));
}

export function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}
