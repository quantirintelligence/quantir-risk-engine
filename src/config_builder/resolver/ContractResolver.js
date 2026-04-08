import axios from "axios";

const CHAIN_META = {
  eth: {
    chainId: 1,
    explorerApi: "https://api.etherscan.io/api"
  },
  bsc: {
    chainId: 56,
    explorerApi: "https://api.bscscan.com/api"
  },
  polygon: {
    chainId: 137,
    explorerApi: "https://api.polygonscan.com/api"
  },
  arbitrum: {
    chainId: 42161,
    explorerApi: "https://api.arbiscan.io/api"
  },
  avalanche: {
    chainId: 43114,
    explorerApi: "https://api.snowtrace.io/api"
  }
};

function isAddress(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function normalizeAddress(value) {
  return isAddress(value) ? value.toLowerCase() : null;
}

function uniqueAddresses(values = []) {
  return [...new Set(values.map(normalizeAddress).filter(Boolean))];
}

export class ContractResolver {
  constructor(options = {}) {
    this.options = options;
  }

  static getChainMeta(network = "eth") {
    return CHAIN_META[network] ?? CHAIN_META.eth;
  }

  async resolve({
    protocolSlug,
    protocolName,
    protocolSymbol,
    network = "eth",
    tokenAddress,
    seedContracts = []
  }) {
    const chain = ContractResolver.getChainMeta(network);
    const protocols = await this.fetchDefiLlamaProtocols();

    const match = this.findBestDefiLlamaMatch({
      protocols,
      protocolSlug,
      protocolName,
      protocolSymbol
    });

    const fromLlama = [
      match?.address,
      tokenAddress
    ];

    return {
      chainId: chain.chainId,
      explorerApi: chain.explorerApi,
      contracts: uniqueAddresses([...seedContracts, ...fromLlama]),
      protocolContracts: uniqueAddresses([...seedContracts, ...fromLlama]),
      tvl: {
        symbol: (protocolSymbol || match?.symbol || "").toLowerCase(),
        source: "defillama",
        id: match?.slug || protocolSlug,
        api: "https://api.llama.fi/protocols"
      },
      defillama: match ?? null
    };
  }

  async fetchDefiLlamaProtocols() {
    try {
      const res = await axios.get("https://api.llama.fi/protocols", {
        timeout: 15_000
      });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  findBestDefiLlamaMatch({ protocols, protocolSlug, protocolName, protocolSymbol }) {
    const slug = String(protocolSlug || "").toLowerCase();
    const name = String(protocolName || "").toLowerCase();
    const symbol = String(protocolSymbol || "").toLowerCase();

    return protocols.find((p) => {
      const pSlug = String(p?.slug || "").toLowerCase();
      const pName = String(p?.name || "").toLowerCase();
      const pSymbol = String(p?.symbol || "").toLowerCase();
      return pSlug === slug || pName === name || (symbol && pSymbol === symbol);
    }) ?? null;
  }
}
