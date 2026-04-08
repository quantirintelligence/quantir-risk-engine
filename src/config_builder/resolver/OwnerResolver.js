import axios from "axios";

const OWNER_SELECTOR = "0x8da5cb5b"; // owner()
const ADMIN_SELECTOR = "0xf851a440"; // admin()

function isAddress(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function normalizeAddress(value) {
  return isAddress(value) ? value.toLowerCase() : null;
}

function uniqAddresses(values = []) {
  return [...new Set(values.map(normalizeAddress).filter(Boolean))];
}

function decodeAddressFromEthCall(hexData) {
  if (!hexData || typeof hexData !== "string" || !hexData.startsWith("0x")) {
    return null;
  }
  const body = hexData.slice(2);
  if (body.length < 64) return null;
  const addr = `0x${body.slice(-40)}`;
  return normalizeAddress(addr);
}

function normalizeRpcUrl(explicitRpcUrl) {
  if (explicitRpcUrl) return explicitRpcUrl;

  const wsUrl = process.env.ALCHEMY_WS_URL;
  if (wsUrl && typeof wsUrl === "string") {
    if (wsUrl.startsWith("wss://")) return wsUrl.replace("wss://", "https://");
    if (wsUrl.startsWith("ws://")) return wsUrl.replace("ws://", "http://");
  }

  return (
    process.env.ETH_RPC_URL ||
    process.env.ALCHEMY_HTTP_URL ||
    process.env.ALCHEMY_URL ||
    null
  );
}

export class OwnerResolver {
  constructor(options = {}) {
    this.options = options;
  }

  async resolve({
    contracts = [],
    sourceByAddress = {},
    rpcUrl
  }) {
    const resolvedRpcUrl = normalizeRpcUrl(rpcUrl);
    const owners = new Set();
    const discoveredProtocolContracts = new Set();

    for (const contract of contracts) {
      const address = normalizeAddress(contract);
      if (!address) continue;

      const source = sourceByAddress[address];
      const implementation = normalizeAddress(source?.Implementation);
      if (implementation) discoveredProtocolContracts.add(implementation);

      const proxyAddress = normalizeAddress(source?.Proxy);
      if (proxyAddress) discoveredProtocolContracts.add(proxyAddress);

      if (resolvedRpcUrl) {
        const [ownerCall, adminCall] = await Promise.all([
          this.ethCallAddress({ rpcUrl: resolvedRpcUrl, to: address, data: OWNER_SELECTOR }),
          this.ethCallAddress({ rpcUrl: resolvedRpcUrl, to: address, data: ADMIN_SELECTOR })
        ]);

        if (ownerCall) owners.add(ownerCall);
        if (adminCall) owners.add(adminCall);
      }
    }

    return {
      owners: uniqAddresses([...owners]),
      protocolContracts: uniqAddresses([...discoveredProtocolContracts])
    };
  }

  async ethCallAddress({ rpcUrl, to, data }) {
    try {
      const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [
          {
            to,
            data
          },
          "latest"
        ]
      };

      const res = await axios.post(rpcUrl, payload, { timeout: 12_000 });
      return decodeAddressFromEthCall(res?.data?.result);
    } catch {
      return null;
    }
  }
}
