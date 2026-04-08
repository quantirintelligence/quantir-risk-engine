export function isAddress(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function normalizeAddress(value) {
  return isAddress(value) ? value.toLowerCase() : null;
}

export function uniqAddresses(values = []) {
  return [...new Set(values.map(normalizeAddress).filter(Boolean))];
}

