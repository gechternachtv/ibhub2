
// apiChecker.js
export function apiChecker({ json, path, prev }) {
  if (!path || typeof path !== "string") {
    return { updated: false, value: "" };
  }

  // remove leading dot
  const parts = path.replace(/^\./, "").split(".");

  let current = json;
  for (const p of parts) {
    if (current == null) break;
    current = current[p];
  }

  if (current == null) {
    return { updated: false, value: "" };
  }

  let value = "";

  if (Array.isArray(current)) {
    if (!current.length) return { updated: false, value: "" };
    value = String(current[current.length - 1]);
  } else {
    value = String(current);
  }

  if (String(prev) !== value) {
    return { updated: true, value };
  }

  return { updated: false, value };
}
