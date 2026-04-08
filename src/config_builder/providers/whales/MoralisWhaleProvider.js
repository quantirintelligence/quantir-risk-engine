import axios from "axios";
import { uniqAddresses } from "./utils.js";

export class MoralisWhaleProvider {
  constructor(options = {}) {
    this.options = options;
    this.id = "moralis";
  }

  async fetch({ tokenAddress, network = "eth", topN = 10, moralisApiKey = process.env.MORALIS_API_KEY }) {
    if (!moralisApiKey) return [];

    try {
      const url = `https://deep-index.moralis.io/api/v2/erc20/${tokenAddress}/holders`;
      const res = await axios.get(url, {
        params: {
          chain: network,
          limit: topN
        },
        headers: {
          accept: "application/json",
          "X-API-Key": moralisApiKey
        },
        timeout: 15_000
      });

      const rows = res?.data?.result || res?.data?.holders || [];
      return uniqAddresses(rows.map((row) => row?.holder_address || row?.address));
    } catch {
      return [];
    }
  }
}

