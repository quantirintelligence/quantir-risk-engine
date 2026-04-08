import axios from "axios";
import { uniqAddresses } from "./utils.js";

export class EthplorerWhaleProvider {
  constructor(options = {}) {
    this.options = options;
    this.id = "ethplorer";
  }

  async fetch({ tokenAddress, topN = 10, ethplorerApiKey = process.env.ETHPLORER_API_KEY || "freekey" }) {
    try {
      const url = `https://api.ethplorer.io/getTopTokenHolders/${tokenAddress}`;
      const res = await axios.get(url, {
        params: {
          apiKey: ethplorerApiKey,
          limit: topN
        },
        timeout: 15_000
      });

      const rows = res?.data?.holders || [];
      return uniqAddresses(rows.map((row) => row?.address));
    } catch {
      return [];
    }
  }
}

