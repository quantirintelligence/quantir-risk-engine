import { BaseCollector } from "../base/BaseCollector.js";
import { logger } from "../utils/logger.js";

export class WhaleCollector extends BaseCollector {
  constructor(cgApiKey, config) {
    super(config.name, config);
    this.cfg = config.whale;
    this.tokenAddress = this.cfg.token_address.toLowerCase();
    this.apiRoot = this.cfg.api_endpoint_root;
    this.network = this.cfg.network;
    this.cgApiKey = cgApiKey;
  }

  buildRequestVariants() {
    const key = String(this.cgApiKey || "").trim();
    const apiRoots = this.buildApiRootCandidates();
    if (!key) {
      return apiRoots.map((apiRoot) => ({
        apiRoot,
        headers: { accept: "application/json" }
      }));
    }

    const variants = [];
    for (const apiRoot of apiRoots) {
      if (apiRoot.includes("://pro-api.coingecko.com/")) {
        variants.push({
          apiRoot,
          headers: { accept: "application/json", "x-cg-pro-api-key": key }
        });
      } else {
        variants.push({
          apiRoot,
          headers: { accept: "application/json", "x-cg-demo-api-key": key }
        });
      }
    }

    return variants;
  }

  buildNetworkCandidates() {
    const raw = String(this.network || "").trim().toLowerCase();
    const out = new Set([raw || "eth"]);
    if (raw === "eth") out.add("ethereum");
    if (raw === "ethereum") out.add("eth");
    return Array.from(out).filter(Boolean);
  }

  buildApiRootCandidates() {
    const raw = String(this.apiRoot || "").trim();
    if (!raw) return [];

    const out = new Set([raw]);
    if (raw.includes("://pro-api.coingecko.com/")) {
      out.add(raw.replace("://pro-api.coingecko.com/", "://api.coingecko.com/"));
    }
    if (raw.includes("://api.coingecko.com/")) {
      out.add(raw.replace("://api.coingecko.com/", "://pro-api.coingecko.com/"));
    }

    return Array.from(out).filter(Boolean);
  }

  async collect() {
    try {
      logger.info(
        "Fetching whale distribution → protocol=%s token=%s",
        this.protocolName,
        this.tokenAddress
      );

      const json = await this.fetchTokenInfo();
      const attr = json.data?.attributes || {};
      const holders = attr.holders || {};
      const dist = holders.distribution_percentage || {};

      return this.normalizeOutput({
        collector: "WhaleCollector",
        data: {
          distribution: {
            top10: Number(dist?.top_10 || 0),
            top11_30: Number(dist?.["11_30"] || 0),
            top31_50: Number(dist?.["31_50"] || 0),
            rest: Number(dist?.rest || 0)
          },
          total_holders: Number(holders?.count || 0)
        }
      });

    } catch (err) {
      if (String(err?.message || "").includes("HTTP 404")) {
        logger.warn(
          "WhaleCollector: token not indexed in CoinGecko onchain yet | protocol=%s token=%s",
          this.protocolName,
          this.tokenAddress
        );

        return this.normalizeOutput({
          collector: "WhaleCollector",
          data: {
            distribution: {
              top10: 0,
              top11_30: 0,
              top31_50: 0,
              rest: 0
            },
            total_holders: 0,
            unavailable: true
          }
        });
      }

      logger.error(
        "WhaleCollector error | protocol=%s token=%s err=%o",
        this.protocolName,
        this.tokenAddress,
        err
      );

      return this.normalizeOutput({
        collector: "WhaleCollector",
        data: null,
        error: err.message
      });
    }
  }

  async fetchTokenInfo() {
    const endpoints = [];
    const requestVariants = this.buildRequestVariants();
    for (const { apiRoot, headers } of requestVariants) {
      for (const network of this.buildNetworkCandidates()) {
        endpoints.push({
          url: `${apiRoot}/onchain/networks/${network}/tokens/${this.tokenAddress}/info`,
          headers
        });
        endpoints.push({
          url: `${apiRoot}/onchain/networks/${network}/tokens/${this.tokenAddress}`,
          headers
        });
      }
    }

    let lastErr = null;
    let lastEmptyPayload = null;
    for (const endpoint of endpoints) {
      const { url, headers } = endpoint;
      try {
        let res = await fetch(url, { headers });
        if (res.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          res = await fetch(url, { headers });
        }

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status}${body ? ` body=${body.slice(0, 240)}` : ""}`);
        }

        const json = await res.json();
        if (this.hasHolderDistribution(json)) {
          return json;
        }

        lastEmptyPayload = {
          url,
          body: json
        };
      } catch (err) {
        lastErr = err;
      }
    }

    if (lastEmptyPayload) {
      throw new Error(
        `WhaleCollector upstream payload missing holders for ${lastEmptyPayload.url}`
      );
    }

    throw lastErr || new Error("Unknown WhaleCollector error");
  }

  hasHolderDistribution(json) {
    const holders = json?.data?.attributes?.holders || {};
    const distribution = holders?.distribution_percentage || {};
    const count = Number(holders?.count || 0);
    const top10 = Number(distribution?.top_10 || distribution?.top10 || 0);
    return (Number.isFinite(count) && count > 0) || (Number.isFinite(top10) && top10 > 0);
  }
}
