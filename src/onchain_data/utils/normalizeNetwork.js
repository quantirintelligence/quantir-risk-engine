// Map provider-specific aliases into one runtime network label.
const NETWORK_ALIAS_TO_NAME = new Map([
  ["eth", "Ethereum"],
  ["ethereum", "Ethereum"],
  ["arb", "Arbitrum"],
  ["arbitrum", "Arbitrum"],
  ["arbitrum-one", "Arbitrum"],
  ["base", "Base"],
  ["optimism", "Optimism"],
  ["op", "Optimism"],
  ["polygon", "Polygon"],
  ["polygon-pos", "Polygon"]
]);

// Keep the legacy UI fallback list in one place, but do not expand runtime
// collectors into unsupported chains just because the dashboard can display them.
export const DEFAULT_SUPPORTED_NETWORKS = ["Ethereum", "Arbitrum", "Base"];

// Normalize user-facing and provider-specific network names into one runtime label.
export function normalizeNetworkName(value, fallback = "Ethereum") {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (NETWORK_ALIAS_TO_NAME.has(raw)) {
    return NETWORK_ALIAS_TO_NAME.get(raw);
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// Resolve the config key that matches a normalized runtime network.
export function resolveConfiguredNetworkKey(networkMap = {}, network) {
  const normalizedTarget = normalizeNetworkName(network);

  return Object.keys(networkMap).find(
    (candidate) => normalizeNetworkName(candidate) === normalizedTarget
  ) || null;
}

function uniqueNetworks(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function hasConfiguredTokenAddress(value) {
  return String(value || "").trim().length > 0;
}

export function resolveDisplayProtocolNetworks(protocolConfig = {}) {
  const snapshotNetworks = protocolConfig?.network_snapshot?.networks || {};
  const primaryNetwork = normalizeNetworkName(
    protocolConfig?.token_health?.network ||
    protocolConfig?.whale?.network ||
    "Ethereum"
  );
  const primaryTokenAddress = (
    protocolConfig?.token_health?.token_address ||
    protocolConfig?.whale?.token_address ||
    ""
  );
  const configuredNetworks = Object.entries(snapshotNetworks)
    .filter(([_, cfg]) => cfg?.enabled !== false && hasConfiguredTokenAddress(cfg?.token_address))
    .map(([name]) => normalizeNetworkName(name))
    .filter(Boolean);
  const hasPrimarySnapshotCoverage = configuredNetworks.includes(primaryNetwork);

  return uniqueNetworks([
    hasConfiguredTokenAddress(primaryTokenAddress) || hasPrimarySnapshotCoverage ? primaryNetwork : null,
    ...configuredNetworks
  ]);
}

// Resolve runtime networks from the explicit protocol config, but only keep
// network scopes that have a real token market mapping. This keeps engine
// collection aligned with what the dashboard can honestly display.
export function resolveProtocolNetworks(protocolConfig = {}) {
  return resolveDisplayProtocolNetworks(protocolConfig);
}

// Convert a normalized runtime network into the CoinGecko Onchain slug.
export function toCoinGeckoOnchainNetwork(network) {
  const normalized = normalizeNetworkName(network);
  if (normalized === "Ethereum") return "ethereum";
  if (normalized === "Arbitrum") return "arbitrum";
  if (normalized === "Base") return "base";
  if (normalized === "Optimism") return "optimism";
  if (normalized === "Polygon") return "polygon_pos";
  return String(network || "").trim().toLowerCase();
}

// Resolve the network-specific collector config with legacy fallbacks.
export function resolveNetworkCollectorConfig(protocolConfig = {}, network) {
  const normalizedNetwork = normalizeNetworkName(network);
  const snapshotConfig = protocolConfig?.network_snapshot || {};
  const configuredNetworks = snapshotConfig?.networks || {};
  const configuredKey = resolveConfiguredNetworkKey(configuredNetworks, normalizedNetwork);
  const configuredNetwork = configuredKey ? configuredNetworks[configuredKey] || {} : {};
  // Only inherit the legacy token address on the token's primary network.
  const primaryTokenNetwork = normalizeNetworkName(
    protocolConfig?.token_health?.network ||
    protocolConfig?.whale?.network ||
    "Ethereum"
  );
  const inheritedTokenAddress = normalizedNetwork === primaryTokenNetwork
    ? protocolConfig?.token_health?.token_address || null
    : null;

  return {
    network: normalizedNetwork,
    enabled: configuredNetwork?.enabled !== false,
    defillama_id: configuredNetwork?.defillama_id || protocolConfig?.tvl?.id || null,
    defillama_chain: configuredNetwork?.defillama_chain || normalizedNetwork,
    llama_api_root: (
      configuredNetwork?.llama_api_root ||
      snapshotConfig?.llama_api_root ||
      "https://api.llama.fi/protocol"
    ),
    coingecko_api_root: (
      configuredNetwork?.coingecko_api_root ||
      snapshotConfig?.coingecko_api_root ||
      protocolConfig?.token_health?.api_endpoint_root ||
      "https://pro-api.coingecko.com/api/v3"
    ),
    coingecko_onchain_network: (
      configuredNetwork?.coingecko_onchain_network ||
      toCoinGeckoOnchainNetwork(normalizedNetwork)
    ),
    token_address: (
      configuredNetwork?.token_address ||
      inheritedTokenAddress ||
      null
    )
  };
}
