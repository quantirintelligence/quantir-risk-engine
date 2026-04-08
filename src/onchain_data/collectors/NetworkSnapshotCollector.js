import { BaseCollector } from "../base/BaseCollector.js";
import { getLogger } from "../utils/logger.js";
import NetworkAdapter from "../adapters/NetworkAdapter.js";
import { normalizeNetworkName } from "../utils/normalizeNetwork.js";

export class NetworkSnapshotCollector extends BaseCollector {
  // Keep network-scoped market inputs in one collector so the main loop stays small.
  constructor(cgApiKey, entry) {
    super(entry?.name || entry?.slug, entry?.config);
    this.entry = entry || {};
    this.network = normalizeNetworkName(entry?.network);
    this.logger = getLogger("network_snapshot");
    this.adapter = new NetworkAdapter({
      cgApiKey,
      protocol: entry?.slug,
      config: entry?.config,
      network: this.network
    });
  }

  // Collect the current TVL, liquidity, volume and primary pool for one network.
  async collect() {
    try {
      // Resolve TVL and pool snapshot independently so one missing endpoint does not zero the whole payload.
      const [tvlResult, poolResult] = await Promise.allSettled([
        this.adapter.getTVL(this.entry?.slug, this.network),
        this.adapter.getPoolSnapshot(this.entry?.slug, this.network)
      ]);

      const tvlUsd = tvlResult.status === "fulfilled" ? tvlResult.value : 0;
      const poolSnapshot = poolResult.status === "fulfilled"
        ? poolResult.value
        : {
            supported: false,
            volume_usd_24h: 0,
            liquidity_usd: 0,
            primary_pool_address: null,
            primary_pool_dex: null,
            primary_pool_reserve_usd: 0,
            primary_pool_share: 0,
            pools_count: 0
          };

      const partialErrors = [
        tvlResult.status === "rejected" ? tvlResult.reason?.message || "tvl_failed" : null,
        poolResult.status === "rejected" ? poolResult.reason?.message || "pool_snapshot_failed" : null
      ].filter(Boolean);

      if (partialErrors.length > 0) {
        this.logger.warn(
          "NetworkSnapshotCollector partial fallback | protocol=%s network=%s errors=%o",
          this.entry?.slug || this.protocolName,
          this.network,
          partialErrors
        );
      }

      return this.normalizeOutput({
        collector: "NetworkSnapshotCollector",
        data: {
          network: this.network,
          tvl_usd: Number(tvlUsd || 0),
          // Surface source availability so debugging can distinguish "unsupported" from "zero".
          tvl_source_available: tvlResult.status === "fulfilled" && Number(tvlUsd || 0) > 0,
          pool_snapshot_supported: Boolean(poolSnapshot?.supported),
          volume_usd_24h: Number(poolSnapshot?.volume_usd_24h || 0),
          liquidity_usd: Number(poolSnapshot?.liquidity_usd || 0),
          primary_pool_address: poolSnapshot?.primary_pool_address || null,
          primary_pool_dex: poolSnapshot?.primary_pool_dex || null,
          primary_pool_reserve_usd: Number(poolSnapshot?.primary_pool_reserve_usd || 0),
          primary_pool_share: Number(poolSnapshot?.primary_pool_share || 0),
          pools_count: Number(poolSnapshot?.pools_count || 0)
        },
        error: partialErrors.length > 0 ? partialErrors.join(" | ") : null
      });
    } catch (error) {
      this.logger.error(
        "NetworkSnapshotCollector error | protocol=%s network=%s message=%s",
        this.entry?.slug || this.protocolName,
        this.network,
        error?.message || "unknown"
      );

      return this.normalizeOutput({
        collector: "NetworkSnapshotCollector",
        data: {
          network: this.network,
          tvl_usd: 0,
          tvl_source_available: false,
          pool_snapshot_supported: false,
          volume_usd_24h: 0,
          liquidity_usd: 0,
          primary_pool_address: null,
          primary_pool_dex: null,
          primary_pool_reserve_usd: 0,
          primary_pool_share: 0,
          pools_count: 0
        },
        error: error?.message || "unknown error"
      });
    }
  }
}

export default NetworkSnapshotCollector;
