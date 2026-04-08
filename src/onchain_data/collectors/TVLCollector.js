import axios from "axios";
import { BaseCollector } from "../base/BaseCollector.js";
import { getLogger } from "../utils/logger.js";

export class TVLCollector extends BaseCollector {
  static protocolsCache = {
    data: null,
    fetchedAt: 0
  };

  constructor(config) {
    super(config.name, config);
    this.logger = getLogger("tvl");
  }

  async collect() {
    try {
      const tvlCfg = this.config.tvl;

      if (!tvlCfg?.api || (!tvlCfg?.symbol && !tvlCfg?.id)) {
        throw new Error(`Missing TVL config for ${this.protocolName}`);
      }

      const { api, symbol, id } = tvlCfg;

      const protocols = await this.fetchProtocols(api);
      const slug = String(id || "").toLowerCase();
      const normalizedSymbol = String(symbol || "").toLowerCase();

      const match = protocols.find((p) =>
        (slug && String(p?.slug || "").toLowerCase() === slug) ||
        String(p?.name || "").toLowerCase() === this.protocolName.toLowerCase() ||
        (normalizedSymbol && String(p?.symbol || "").toLowerCase() === normalizedSymbol)
      );

      if (!match) {
        this.logger.warn(
          "TVLCollector: protocol not found in DefiLlama | protocol=%s slug=%s symbol=%s",
          this.protocolName,
          id || "n/a",
          symbol || "n/a"
        );

        return this.normalizeOutput({
          collector: "TVLCollector",
          data: {
            tvl_usd: 0,
            unavailable: true
          }
        });
      }

      const totalTVL = match.tvl ?? 0;

      this.logger.info(
        `TVL fetched for ${this.protocolName}: ${totalTVL.toLocaleString()} USD`
      );

      return this.normalizeOutput({
        collector: "TVLCollector",
        data: {
          tvl_usd: totalTVL
        }
      });

    } catch (err) {
      this.logger.error(
        `TVLCollector error [${this.protocolName}]: ${err.message}`
      );

      return this.normalizeOutput({
        collector: "TVLCollector",
        data: null,
        error: err.message
      });
    }
  }

  async fetchProtocols(api) {
    const now = Date.now();
    const ttlMs = 30_000;

    if (
      TVLCollector.protocolsCache.data &&
      now - TVLCollector.protocolsCache.fetchedAt < ttlMs
    ) {
      return TVLCollector.protocolsCache.data;
    }

    const response = await axios.get(api, { timeout: 15_000 });
    const protocols = Array.isArray(response.data) ? response.data : [];

    TVLCollector.protocolsCache = {
      data: protocols,
      fetchedAt: now
    };

    return protocols;
  }
}
