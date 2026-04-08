import axios from "axios";
import { uniqAddresses } from "./utils.js";

export class CoinGeckoWhaleProvider {
  constructor(options = {}) {
    this.options = options;
    this.id = "coingecko";
  }

  async fetch({ tokenAddress, network = "eth", topN = 10, coingeckoApiKey = process.env.COINGECKO_KEY }) {
    try {
      const url = `https://api.coingecko.com/api/v3/coins/${network}/contract/${tokenAddress}/token_holders`;
      const headers = { accept: "application/json" };
      if (coingeckoApiKey) headers["x-cg-demo-api-key"] = coingeckoApiKey;

      const res = await axios.get(url, { headers, timeout: 15_000 });
      const rows = res?.data?.token_holders || res?.data?.data || res?.data || [];
      const addrs = Array.isArray(rows)
        ? rows.slice(0, topN).map((row) => row?.holder_address || row?.address)
        : [];

      return uniqAddresses(addrs);
    } catch {
      return [];
    }
  }
}

