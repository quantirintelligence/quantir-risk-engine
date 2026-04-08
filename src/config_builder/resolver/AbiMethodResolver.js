import axios from "axios";
import { ContractResolver } from "./ContractResolver.js";

const DEFAULT_FLAGGED_METHODS = [
  "upgradeTo",
  "upgradeToAndCall",
  "transferOwnership",
  "acceptOwnership",
  "approve",
  "transfer",
  "transferFrom",
  "setOwner",
  "setAdmin"
];

const DEFAULT_ADMIN_METHODS = [
  "upgradeTo",
  "upgradeToAndCall",
  "transferOwnership",
  "acceptOwnership",
  "setOwner",
  "setAdmin",
  "changeAdmin"
];

function isAddress(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function normalizeAddress(value) {
  return isAddress(value) ? value.toLowerCase() : null;
}

function uniq(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function parseAbiString(result) {
  if (!result || typeof result !== "string") return [];
  try {
    const parsed = JSON.parse(result);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pickMethodNamesFromAbi(abi = []) {
  return abi
    .filter((item) => item?.type === "function" && typeof item?.name === "string")
    .map((item) => item.name);
}

export class AbiMethodResolver {
  constructor(options = {}) {
    this.options = options;
    this.explorerMinIntervalMs = 220; // <= ~4.5 req/sec for free-plan safety
    this.lastExplorerCallTs = 0;
  }

  async resolve({
    contracts = [],
    network = "eth",
    chainId,
    etherscanApiKey = process.env.ETHERSCAN_API_KEY,
    flaggedMethods = DEFAULT_FLAGGED_METHODS,
    adminMethods = DEFAULT_ADMIN_METHODS
  }) {
    const chain = ContractResolver.getChainMeta(network);
    const effectiveChainId = chainId || chain.chainId;
    const explorerApi = chain.explorerApi;
    const normalized = uniq(contracts.map(normalizeAddress).filter(Boolean));

    const abiByAddress = {};
    const sourceByAddress = {};
    const allMethods = new Set();

    for (const address of normalized) {
      const abi = await this.fetchAbi({
        address,
        explorerApi,
        chainId: effectiveChainId,
        etherscanApiKey
      });
      const source = await this.fetchSourceCode({
        address,
        explorerApi,
        chainId: effectiveChainId,
        etherscanApiKey
      });

      abiByAddress[address] = abi;
      sourceByAddress[address] = source;

      for (const method of pickMethodNamesFromAbi(abi)) {
        allMethods.add(method);
      }
    }

    const methods = [...allMethods];
    const flagged = uniq(methods.filter((m) => flaggedMethods.includes(m)));
    const admins = uniq(methods.filter((m) => adminMethods.includes(m)));

    return {
      methods,
      flaggedMethods: flagged,
      adminMethods: admins,
      abiByAddress,
      sourceByAddress
    };
  }

  async fetchAbi({ address, explorerApi, chainId, etherscanApiKey }) {
    const fromExplorer = await this.fetchAbiFromExplorer({
      address,
      explorerApi,
      chainId,
      etherscanApiKey
    });
    if (fromExplorer.length) return fromExplorer;

    const fromSourcify = await this.fetchAbiFromSourcify({ address, chainId });
    if (fromSourcify.length) return fromSourcify;

    const fromBlockscout = await this.fetchAbiFromBlockscout({ address });
    return fromBlockscout;
  }

  async fetchAbiFromExplorer({ address, explorerApi, chainId, etherscanApiKey }) {
    try {
      const { url, params } = this.buildExplorerParams({
        explorerApi,
        chainId,
        address,
        action: "getabi",
        etherscanApiKey
      });

      const res = await this.throttledExplorerGet(url, params);
      return parseAbiString(res?.data?.result);
    } catch {
      return [];
    }
  }

  async fetchSourceCode({ address, explorerApi, chainId, etherscanApiKey }) {
    try {
      const { url, params } = this.buildExplorerParams({
        explorerApi,
        chainId,
        address,
        action: "getsourcecode",
        etherscanApiKey
      });

      const res = await this.throttledExplorerGet(url, params);
      const result = res?.data?.result;
      if (!Array.isArray(result) || !result.length) return null;
      return result[0] ?? null;
    } catch {
      return null;
    }
  }

  buildExplorerParams({ explorerApi, chainId, address, action, etherscanApiKey }) {
    const isEtherscanMain = String(explorerApi).includes("api.etherscan.io");
    if (isEtherscanMain) {
      const params = {
        chainid: chainId,
        module: "contract",
        action,
        address
      };
      if (etherscanApiKey) params.apikey = etherscanApiKey;

      return {
        url: "https://api.etherscan.io/v2/api",
        params
      };
    }

    const params = {
      module: "contract",
      action,
      address
    };
    if (etherscanApiKey) params.apikey = etherscanApiKey;

    return {
      url: explorerApi,
      params
    };
  }

  async throttledExplorerGet(url, params) {
    const now = Date.now();
    const diff = now - this.lastExplorerCallTs;
    if (diff < this.explorerMinIntervalMs) {
      const waitMs = this.explorerMinIntervalMs - diff;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    this.lastExplorerCallTs = Date.now();
    return axios.get(url, { params, timeout: 15_000 });
  }

  async fetchAbiFromSourcify({ address, chainId }) {
    try {
      const url = `https://sourcify.dev/server/files/any/${chainId}/${address}/metadata.json`;
      const res = await axios.get(url, { timeout: 15_000 });
      const abi = res?.data?.output?.abi;
      return Array.isArray(abi) ? abi : [];
    } catch {
      return [];
    }
  }

  async fetchAbiFromBlockscout({ address }) {
    try {
      const res = await axios.get("https://blockscout.com/xdai/mainnet/api", {
        params: {
          module: "contract",
          action: "getabi",
          address
        },
        timeout: 15_000
      });
      return parseAbiString(res?.data?.result);
    } catch {
      return [];
    }
  }
}
