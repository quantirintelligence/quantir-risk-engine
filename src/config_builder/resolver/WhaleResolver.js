import { normalizeAddress } from "../providers/whales/utils.js";
import { EthplorerWhaleProvider } from "../providers/whales/EthplorerWhaleProvider.js";
import { CoinGeckoWhaleProvider } from "../providers/whales/CoinGeckoWhaleProvider.js";
import { MoralisWhaleProvider } from "../providers/whales/MoralisWhaleProvider.js";

const DEFAULT_PROVIDER_ORDER = ["ethplorer", "coingecko", "moralis"];

export class WhaleResolver {
  constructor(options = {}) {
    this.options = options;
    this.providers = {
      ethplorer: new EthplorerWhaleProvider(options),
      coingecko: new CoinGeckoWhaleProvider(options),
      moralis: new MoralisWhaleProvider(options)
    };
  }

  async resolve({
    tokenAddress,
    network = "eth",
    topN = 10,
    moralisApiKey = process.env.MORALIS_API_KEY,
    coingeckoApiKey = process.env.COINGECKO_KEY,
    ethplorerApiKey = process.env.ETHPLORER_API_KEY || "freekey",
    providerOrder
  }) {
    const token = normalizeAddress(tokenAddress);
    if (!token) return { whales: [] };

    const order = this.resolveProviderOrder(providerOrder);
    const context = {
      tokenAddress: token,
      network,
      topN,
      moralisApiKey,
      coingeckoApiKey,
      ethplorerApiKey
    };

    for (const providerId of order) {
      const provider = this.providers[providerId];
      if (!provider) continue;
      const whales = await provider.fetch(context);
      if (whales.length) {
        return { whales, source: provider.id };
      }
    }

    return { whales: [], source: null };
  }

  resolveProviderOrder(explicitOrder) {
    const fromOptions = this.options.whaleProviderOrder;
    const rawOrder = explicitOrder || fromOptions || DEFAULT_PROVIDER_ORDER;
    const order = Array.isArray(rawOrder) ? rawOrder : DEFAULT_PROVIDER_ORDER;
    return order.filter((id, idx) => DEFAULT_PROVIDER_ORDER.includes(id) && order.indexOf(id) === idx);
  }
}
