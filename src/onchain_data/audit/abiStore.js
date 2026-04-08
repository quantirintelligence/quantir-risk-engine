import fs from "fs/promises";
import path from "path";

const ABI_DIR = path.resolve(process.cwd(), "src/onchain_data/config/abis");

function sanitizeIdentifier(value) {
  return String(value || "").trim();
}

function normalizeInputType(input = {}) {
  const baseType = sanitizeIdentifier(input?.type);
  if (!baseType) {
    return "";
  }

  if (baseType !== "tuple" && !baseType.startsWith("tuple[")) {
    return baseType;
  }

  const components = Array.isArray(input?.components)
    ? input.components.map(normalizeInputType).filter(Boolean)
    : [];
  const tupleBody = components.length > 0 ? `(${components.join(",")})` : "()";

  if (baseType === "tuple") {
    return tupleBody;
  }

  return baseType.replace(/^tuple/, tupleBody);
}

function normalizeFragmentString(value) {
  const text = String(value || "").trim();
  return text.replace(/\s+/g, " ");
}

function getFragmentName(value) {
  const text = typeof value === "string" ? normalizeFragmentString(value) : "";
  const match = text.match(/^(function|event)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  return match?.[2] || "";
}

export function toInterfaceFragmentSignature(fragment) {
  if (typeof fragment === "string") {
    return normalizeFragmentString(fragment);
  }
  if (!fragment || typeof fragment !== "object") {
    return "";
  }

  const type = sanitizeIdentifier(fragment?.type);
  const name = sanitizeIdentifier(fragment?.name);
  if ((type !== "function" && type !== "event") || !name) {
    return "";
  }

  const inputs = Array.isArray(fragment?.inputs)
    ? fragment.inputs
        .map((input, index) => {
          const inputType = normalizeInputType(input);
          if (!inputType) return "";
          const indexed = type === "event" && input?.indexed ? " indexed" : "";
          const inputName = sanitizeIdentifier(input?.name || `arg${index}`);
          return `${inputType}${indexed}${inputName ? ` ${inputName}` : ""}`.trim();
        })
        .filter(Boolean)
        .join(", ")
    : "";

  return `${type} ${name}(${inputs})`;
}

export function mergeInterfaceFragments(values = []) {
  const out = [];
  const seen = new Set();

  for (const value of Array.isArray(values) ? values : []) {
    const signature = toInterfaceFragmentSignature(value);
    if (!signature || seen.has(signature)) continue;
    seen.add(signature);
    out.push(signature);
  }

  return out;
}

export async function writeProtocolAbiFile(slug, txAbi = []) {
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  if (!normalizedSlug) return null;

  const filePath = path.join(ABI_DIR, `${normalizedSlug}.json`);
  const nextFragments = mergeInterfaceFragments(txAbi);

  let existing = [];
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    existing = mergeInterfaceFragments([
      ...(Array.isArray(parsed?.functions) ? parsed.functions : []),
      ...(Array.isArray(parsed?.events) ? parsed.events : [])
    ]);
  } catch {
    existing = [];
  }

  const merged = mergeInterfaceFragments([...existing, ...nextFragments]);
  const functions = merged.filter((item) => item.startsWith("function "));
  const events = merged.filter((item) => item.startsWith("event ") && getFragmentName(item) === "Transfer");

  await fs.mkdir(ABI_DIR, { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify(
      {
        protocol: normalizedSlug,
        functions,
        events,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );

  return {
    filePath,
    fragments: mergeInterfaceFragments([...functions, ...events])
  };
}

export async function loadProtocolAbiFile(slug) {
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  if (!normalizedSlug) return [];

  const filePath = path.join(ABI_DIR, `${normalizedSlug}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return mergeInterfaceFragments([
      ...(Array.isArray(parsed?.functions) ? parsed.functions : []),
      ...(Array.isArray(parsed?.events) ? parsed.events : [])
    ]);
  } catch {
    return [];
  }
}
