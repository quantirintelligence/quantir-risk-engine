import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../../../");

function uniqueValues(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function resolvePathFromCwd(rawPath) {
  const value = String(rawPath || "").trim();
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

export function getProtocolsConfigCandidates() {
  return uniqueValues([
    resolvePathFromCwd(process.env.PROTOCOLS_CONFIG_PATH),
    path.resolve(process.cwd(), "config/protocols.json"),
    path.resolve(process.cwd(), "src/onchain_data/config/protocols.json"),
    path.resolve(ROOT, "src/onchain_data/config/protocols.json")
  ]);
}

export function resolveProtocolsConfigPath(customPath = null) {
  const explicitPath = resolvePathFromCwd(customPath);
  if (explicitPath) return explicitPath;

  return getProtocolsConfigCandidates()[0] || path.resolve(ROOT, "src/onchain_data/config/protocols.json");
}

export async function readProtocolsConfig() {
  for (const filePath of getProtocolsConfigCandidates()) {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") continue;

      return {
        data: parsed,
        path: filePath
      };
    } catch {
      // try next candidate
    }
  }

  return null;
}

export async function loadProtocolsConfig() {
  const loaded = await readProtocolsConfig();
  if (!loaded?.data || typeof loaded.data !== "object") {
    throw new Error(
      `Unable to load protocols config from any candidate path: ${getProtocolsConfigCandidates().join(", ")}`
    );
  }
  return loaded;
}
