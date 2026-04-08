import axios from "axios";

import { normalizeNetworkName, resolveNetworkCollectorConfig } from "../utils/normalizeNetwork.js";

export class NetworkAdapter {
  // Build one adapter instance per protocol+network runtime entry.
  constructor({ cgApiKey, protocol, config, network }) {
    this.cgApiKey = cgApiKey;
    this.protocol = String(protocol || "").trim();
    this.config = config || {};
    this.network = normalizeNetworkName(network);
  }

  // Build CoinGecko auth headers while keeping demo/pro fallback support.
  buildHeaderVariants() {
    const key = String(this.cgApiKey || "").trim();
    if (!key) return [{ accept: "application/json" }];

    return [
      { accept: "application/json", "x-cg-demo-api-key": key },
      { accept: "application/json", "x-cg-pro-api-key": key }
    ];
  }

  // Resolve the merged runtime config for the requested network.
  resolveRuntimeConfig(network = this.network) {
    return resolveNetworkCollectorConfig(this.config, network);
  }

  // Retry CoinGecko requests across supported auth headers.
  async requestWithHeaderFallback(url) {
    let lastError = null;

    for (const headers of this.buildHeaderVariants()) {
      try {
        return await axios.get(url, {
          headers,
          timeout: 15_000
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error(`Request failed for ${url}`);
  }

  // Extract the latest TVL point from the DefiLlama chain history payload.
  extractLatestTvlUsd(chainData) {
    if (!chainData) return 0;

    if (Number.isFinite(Number(chainData?.tvl))) {
      return Number(chainData.tvl);
    }

    const history = Array.isArray(chainData?.tvl) ? chainData.tvl : [];
    const latestRow = history[history.length - 1] || {};
    const tvlUsd = Number(
      latestRow?.totalLiquidityUSD ??
      latestRow?.totalLiquidityUsd ??
      latestRow?.tvl ??
      latestRow?.value ??
      0
    );

    return Number.isFinite(tvlUsd) ? tvlUsd : 0;
  }

  // Resolve a readable DEX label from the CoinGecko included payload.
  extractDexName(pool, dexById) {
    const dexId = String(pool?.relationships?.dex?.data?.id || "").trim();
    if (!dexId) return null;
    return dexById.get(dexId) || dexId;
  }

  // Fetch the latest chain-scoped TVL from DefiLlama.
  async getTVL(protocol = this.protocol, network = this.network) {
    const runtimeConfig = this.resolveRuntimeConfig(network);
    const defillamaId = String(runtimeConfig?.defillama_id || "").trim();
    if (!defillamaId) {
      throw new Error(`Missing DefiLlama id for ${protocol}`);
    }

    const apiRoot = String(runtimeConfig?.llama_api_root || "").replace(/\/+$/, "");
    const url = `${apiRoot}/${defillamaId}`;
    const response = await axios.get(url, { timeout: 15_000 });
    const chainTvls = response.data?.chainTvls || {};
    const chainData = chainTvls?.[runtimeConfig.defillama_chain];

    return this.extractLatestTvlUsd(chainData);
  }

  // Fetch and normalize the current top-pool snapshot for the requested network.
  async getPoolSnapshot(protocol = this.protocol, network = this.network) {
    const runtimeConfig = this.resolveRuntimeConfig(network);
    const apiRoot = String(runtimeConfig?.coingecko_api_root || "").replace(/\/+$/, "");
    const onchainNetwork = String(runtimeConfig?.coingecko_onchain_network || "").trim();
    const tokenAddress = String(runtimeConfig?.token_address || "").trim().toLowerCase();

    // Skip optional pool aggregation when this network has no token mapping yet.
    if (!apiRoot || !onchainNetwork || !tokenAddress) {
      return {
        network: normalizeNetworkName(network),
        supported: false,
        liquidity_usd: 0,
        volume_usd_24h: 0,
        primary_pool_address: null,
        primary_pool_dex: null,
        primary_pool_reserve_usd: 0,
        primary_pool_share: 0,
        pools_count: 0
      };
    }

    const url = `${apiRoot}/onchain/networks/${onchainNetwork}/tokens/${tokenAddress}/pools?page=1`;
    let response = null;
    try {
      response = await this.requestWithHeaderFallback(url);
    } catch (error) {
      // Treat a missing pool listing as an unsupported optional data source, not a hard failure.
      if (Number(error?.response?.status) === 404) {
        return {
          network: normalizeNetworkName(network),
          supported: false,
          liquidity_usd: 0,
          volume_usd_24h: 0,
          primary_pool_address: null,
          primary_pool_dex: null,
          primary_pool_reserve_usd: 0,
          primary_pool_share: 0,
          pools_count: 0
        };
      }
      throw error;
    }
    const pools = Array.isArray(response.data?.data) ? response.data.data : [];
    const included = Array.isArray(response.data?.included) ? response.data.included : [];
    const dexById = new Map(
      included
        .filter((item) => item?.type === "dex")
        .map((item) => [
          String(item?.id || ""),
          String(item?.attributes?.name || item?.id || "")
        ])
    );

    let liquidityUsd = 0;
    let volumeUsd24h = 0;
    let primaryPoolAddress = null;
    let primaryPoolDex = null;
    let maxReserveUsd = 0;

    for (const pool of pools) {
      const reserveUsd = Number(pool?.attributes?.reserve_in_usd || 0);
      const volume24h = Number(pool?.attributes?.volume_usd?.h24 || 0);

      liquidityUsd += Number.isFinite(reserveUsd) ? reserveUsd : 0;
      volumeUsd24h += Number.isFinite(volume24h) ? volume24h : 0;

      if (Number.isFinite(reserveUsd) && reserveUsd >= maxReserveUsd) {
        maxReserveUsd = reserveUsd;
        primaryPoolAddress = String(pool?.attributes?.address || "").trim() || null;
        primaryPoolDex = this.extractDexName(pool, dexById);
      }
    }

    return {
      network: normalizeNetworkName(network),
      supported: true,
      liquidity_usd: Number.isFinite(liquidityUsd) ? liquidityUsd : 0,
      volume_usd_24h: Number.isFinite(volumeUsd24h) ? volumeUsd24h : 0,
      primary_pool_address: primaryPoolAddress,
      primary_pool_dex: primaryPoolDex,
      primary_pool_reserve_usd: Number.isFinite(maxReserveUsd) ? maxReserveUsd : 0,
      primary_pool_share: liquidityUsd > 0 && Number.isFinite(maxReserveUsd)
        ? maxReserveUsd / liquidityUsd
        : 0,
      pools_count: pools.length
    };
  }

  // Expose the aggregated network volume so the engine can stay adapter-driven.
  async getVolume(protocol = this.protocol, network = this.network) {
    const snapshot = await this.getPoolSnapshot(protocol, network);
    return Number(snapshot?.volume_usd_24h || 0);
  }

  // Expose the aggregated network liquidity so the engine can stay adapter-driven.
  async getLiquidity(protocol = this.protocol, network = this.network) {
    const snapshot = await this.getPoolSnapshot(protocol, network);
    return Number(snapshot?.liquidity_usd || 0);
  }

  // Expose the primary pool metadata for the current network.
  async getPrimaryPool(protocol = this.protocol, network = this.network) {
    const snapshot = await this.getPoolSnapshot(protocol, network);
    return {
      address: snapshot?.primary_pool_address || null,
      dex: snapshot?.primary_pool_dex || null
    };
  }
}

export default NetworkAdapter;
