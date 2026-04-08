import dotenv from "dotenv";

import MongoConnection from "../db/Mongo.js";
import ProtocolSnapshotBuilder from "../db/ProtocolSnapshotBuilder.js";
import ProtocolSnapshotRepository from "../db/ProtocolSnapshotRepository.js";
import TxRiskEventRepository from "../db/TxRiskEventRepository.js";
import { initProtocolsFromConfig } from "../bootstrap/initProtocols.js";
import { TVLCollector } from "./collectors/TVLCollector.js";
import { WhaleCollector } from "./collectors/WhaleCollector.js";
import { TokenRiskProfileCollector } from "./collectors/TokenRiskProfileCollector.js";
import { CandleCollector } from "./collectors/CandleCollector.js";
import { NetworkSnapshotCollector } from "./collectors/NetworkSnapshotCollector.js";
import { logger } from "./utils/logger.js";
import {
  normalizeNetworkName,
  resolveNetworkCollectorConfig,
  resolveProtocolNetworks
} from "./utils/normalizeNetwork.js";
import { loadProtocolsConfig } from "./utils/protocolConfig.js";
import { loadProtocolAbiFile } from "./audit/abiStore.js";
import {
  applyRiskWithTxContribution,
  computeTxRiskContribution,
  resolveTxRiskConfig
} from "../strategies/utils/txRiskContribution.js";

/*
  Public grant-repo runner for the on-chain engine core.

  Kept here:
  - protocol config loading
  - network-aware collector orchestration
  - snapshot persistence
  - base risk scoring
  - transaction-pressure contribution

  Intentionally omitted from this public entrypoint:
  - alerts websocket runtime
  - explain-service dispatch
  - model-explanation loop
  - forecast-service integration
  - contract-audit refresh/bootstrap
*/

dotenv.config();

const cgApiKey = process.env.COINGECKO_KEY || "";
const riskModelUrl = String(process.env.RISK_MODEL_URL || "http://localhost:8080/score");
const COLLECTOR_INTERVAL_MS = Math.max(20_000, Number(process.env.COLLECTOR_INTERVAL_MS || 20_000));
const COLLECTOR_CONCURRENCY = Math.max(1, Number(process.env.COLLECTOR_CONCURRENCY || 4));
const PUBLIC_ENGINE_MODE = String(process.env.PUBLIC_ENGINE_MODE || "once").trim().toLowerCase();
const DAY_MS = 24 * 60 * 60 * 1000;
const DERIVED_LOOKBACK_DAYS = 7;

const { data: config, path: protocolsConfigPath } = await loadProtocolsConfig();

const protocolCatalogEntries = Object.entries(config)
  .filter(([_, cfg]) => cfg && typeof cfg === "object")
  .map(([slug, cfg]) => ({
    slug,
    name: cfg.name || slug,
    config: cfg
  }));

const protocolRuntimeEntries = buildProtocolRuntimeEntries(protocolCatalogEntries);

logger.info(
  "Public on-chain runner config loaded | path=%s | protocols=%d | runtime_scopes=%d",
  protocolsConfigPath,
  protocolCatalogEntries.length,
  protocolRuntimeEntries.length
);

function buildProtocolRuntimeEntries(entries = []) {
  return entries.flatMap((entry) => {
    const runtimeNetworks = resolveProtocolNetworks(entry?.config);

    return runtimeNetworks
      .map((network) => ({
        ...entry,
        network,
        networkConfig: resolveNetworkCollectorConfig(entry?.config, network)
      }))
      .filter((runtimeEntry) => runtimeEntry?.networkConfig?.enabled !== false);
  });
}

function getScopeLabel(protocol, network = null) {
  const slug = String(protocol || "unknown").trim();
  const scopeNetwork = String(network || "").trim();
  return scopeNetwork ? `${slug}:${scopeNetwork}` : slug;
}

function resolveCollectorResult(snapshot, key) {
  if (!snapshot?.collectors) return null;
  if (typeof snapshot.collectors.get === "function") {
    return snapshot.collectors.get(key) || null;
  }
  return snapshot.collectors?.[key] || null;
}

function getCollectorData(snapshot, key) {
  return resolveCollectorResult(snapshot, key)?.data || null;
}

function hasUsefulTokenRiskData(envelope) {
  const data = envelope?.data;
  if (!data || typeof data !== "object") return false;
  const priceUsd = Number(data?.price?.usd ?? 0);
  const marketCap = Number(data?.price?.market_cap_usd ?? 0);
  const fdv = Number(data?.price?.fdv_usd ?? 0);
  return (
    (Number.isFinite(priceUsd) && priceUsd > 0) ||
    (Number.isFinite(marketCap) && marketCap > 0) ||
    (Number.isFinite(fdv) && fdv > 0)
  );
}

function hasUsefulWhaleData(envelope) {
  const data = envelope?.data;
  if (!data || typeof data !== "object") return false;
  const top10 = Number(data?.distribution?.top10 ?? 0);
  const holders = Number(data?.total_holders ?? 0);
  return (Number.isFinite(top10) && top10 > 0) || (Number.isFinite(holders) && holders > 0);
}

function hasUsefulNetworkSnapshotData(envelope) {
  const data = envelope?.data;
  if (!data || typeof data !== "object") return false;
  const tvlUsd = Number(data?.tvl_usd ?? 0);
  return Number.isFinite(tvlUsd) && tvlUsd > 0;
}

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeRatio(current, previous) {
  const prev = Number(previous);
  if (!Number.isFinite(prev) || prev <= 0) return 0;

  const curr = Number(current);
  if (!Number.isFinite(curr)) return 0;
  return (curr - prev) / prev;
}

function makeDefaultDerived() {
  return {
    tvl_delta_1d: 0,
    tvl_delta_7d: 0,
    price_delta_1d: 0,
    price_delta_7d: 0,
    volume_spike: 0,
    mcap_tvl_ratio: 0,
    liquidity_usd: 0,
    volume_to_tvl_ratio: 0,
    liquidity_to_tvl_ratio: 0,
    pools_count: 0,
    primary_pool_share: 0,
    single_pool_dependency: 0
  };
}

function resolveScopedTvl(snapshot) {
  const networkTvl = Number(getCollectorData(snapshot, "NetworkSnapshotCollector")?.tvl_usd ?? 0);
  if (Number.isFinite(networkTvl) && networkTvl > 0) {
    return networkTvl;
  }

  const legacyTvl = Number(getCollectorData(snapshot, "TVLCollector")?.tvl_usd ?? 0);
  return Number.isFinite(legacyTvl) ? legacyTvl : 0;
}

function setupCollectors(entry) {
  const protocolConfig = entry.config;

  return [
    new NetworkSnapshotCollector(cgApiKey, entry),
    new TVLCollector(protocolConfig),
    new WhaleCollector(cgApiKey, protocolConfig),
    new TokenRiskProfileCollector(cgApiKey, { ...protocolConfig, runtime_network: entry.network }),
    new CandleCollector(cgApiKey, entry.slug, protocolConfig)
  ];
}

function getSharedCollectorCacheKey(entry, collector) {
  const collectorName = String(collector?.constructor?.name || "").trim();
  if (!collectorName) return null;

  if (
    collectorName !== "TVLCollector" &&
    collectorName !== "WhaleCollector" &&
    collectorName !== "TokenRiskProfileCollector" &&
    collectorName !== "CandleCollector"
  ) {
    return null;
  }

  const protocol = String(entry?.slug || "").trim();
  return protocol ? `${protocol}:${collectorName}` : null;
}

async function runCollectorWithSharedCache(entry, collector, sharedCollectorCache = null) {
  const cacheKey = sharedCollectorCache instanceof Map
    ? getSharedCollectorCacheKey(entry, collector)
    : null;

  if (!cacheKey) {
    return collector.collect();
  }

  const existing = sharedCollectorCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const pending = Promise.resolve()
    .then(() => collector.collect())
    .catch((error) => {
      sharedCollectorCache.delete(cacheKey);
      throw error;
    });

  sharedCollectorCache.set(cacheKey, pending);
  return pending;
}

async function hydrateCollectorsFromLatestSnapshot(protocol, network, snapshot) {
  try {
    const latestSameNetwork = await ProtocolSnapshotRepository.getLatest(protocol, network);
    const latestProtocolWide = latestSameNetwork || await ProtocolSnapshotRepository.getLatest(protocol);
    if (!latestSameNetwork && !latestProtocolWide) return;

    const currCollectors = snapshot.collectors || {};

    const currentNetwork = currCollectors.NetworkSnapshotCollector;
    const previousNetwork = resolveCollectorResult(latestSameNetwork, "NetworkSnapshotCollector");
    if (!hasUsefulNetworkSnapshotData(currentNetwork) && hasUsefulNetworkSnapshotData(previousNetwork)) {
      currCollectors.NetworkSnapshotCollector = {
        ...previousNetwork,
        error: currentNetwork?.error || "fallback_from_previous_network_snapshot",
        stale: true
      };
    }

    const currentToken = currCollectors.TokenRiskProfileCollector;
    const prevToken = resolveCollectorResult(latestProtocolWide, "TokenRiskProfileCollector");
    if (!hasUsefulTokenRiskData(currentToken) && hasUsefulTokenRiskData(prevToken)) {
      currCollectors.TokenRiskProfileCollector = {
        ...prevToken,
        error: currentToken?.error || "fallback_from_previous_snapshot",
        stale: true
      };
    }

    const currentWhale = currCollectors.WhaleCollector;
    const prevWhale = resolveCollectorResult(latestProtocolWide, "WhaleCollector");
    if (!hasUsefulWhaleData(currentWhale) && hasUsefulWhaleData(prevWhale)) {
      currCollectors.WhaleCollector = {
        ...prevWhale,
        error: currentWhale?.error || "fallback_from_previous_snapshot",
        stale: true
      };
    }

    snapshot.collectors = currCollectors;
  } catch (error) {
    logger.warn(
      "[%s] collector fallback skipped: %s",
      getScopeLabel(protocol, network),
      error?.message || "unknown"
    );
  }
}

async function collectSnapshot(entry, sharedCollectorCache = null) {
  const builder = new ProtocolSnapshotBuilder(entry.slug, entry.network);

  for (const collector of setupCollectors(entry)) {
    const result = await runCollectorWithSharedCache(entry, collector, sharedCollectorCache);
    builder.add(result);
  }

  const snapshot = builder.build();
  await hydrateCollectorsFromLatestSnapshot(entry.slug, entry.network, snapshot);
  return snapshot;
}

async function loadDailyAnchoredSnapshots(snapshot, days = DERIVED_LOOKBACK_DAYS) {
  const timestampMs = new Date(snapshot?.snapshot_at || Date.now()).getTime();
  const anchors = Array.from(
    { length: days },
    (_, index) => new Date(timestampMs - ((index + 1) * DAY_MS))
  );

  return Promise.all(
    anchors.map((anchor) => ProtocolSnapshotRepository.getLatestBefore(
      snapshot.protocol,
      snapshot.network,
      anchor
    ))
  );
}

async function calculateDerived(snapshot) {
  const dailyAnchors = await loadDailyAnchoredSnapshots(snapshot);
  const prev1 = dailyAnchors[0] || null;
  const prev7 = dailyAnchors[DERIVED_LOOKBACK_DAYS - 1] || null;

  const networkData = getCollectorData(snapshot, "NetworkSnapshotCollector") || {};
  const tokenData = getCollectorData(snapshot, "TokenRiskProfileCollector") || {};
  const currentTvl = resolveScopedTvl(snapshot);
  const currentPrice = toFiniteNumber(tokenData?.price?.usd, 0);
  const currentMcap = toFiniteNumber(tokenData?.price?.market_cap_usd, 0);
  const currentVolume = toFiniteNumber(networkData?.volume_usd_24h, 0);
  const currentLiquidity = toFiniteNumber(networkData?.liquidity_usd, 0);
  const currentPoolsCount = toFiniteNumber(networkData?.pools_count, 0);
  const currentPrimaryPoolShare = toFiniteNumber(networkData?.primary_pool_share, 0);

  const prev1Tvl = prev1 ? resolveScopedTvl(prev1) : 0;
  const prev7Tvl = prev7 ? resolveScopedTvl(prev7) : 0;
  const prev1Price = toFiniteNumber(getCollectorData(prev1, "TokenRiskProfileCollector")?.price?.usd, 0);
  const prev7Price = toFiniteNumber(getCollectorData(prev7, "TokenRiskProfileCollector")?.price?.usd, 0);

  const trailingVolumes = dailyAnchors
    .map((item) => toFiniteNumber(getCollectorData(item, "NetworkSnapshotCollector")?.volume_usd_24h, 0))
    .filter((value) => value > 0);

  const averageVolume = trailingVolumes.length > 0
    ? trailingVolumes.reduce((sum, value) => sum + value, 0) / trailingVolumes.length
    : 0;

  snapshot.derived = {
    ...makeDefaultDerived(),
    tvl_delta_1d: prev1 ? safeRatio(currentTvl, prev1Tvl) : 0,
    tvl_delta_7d: prev7 ? safeRatio(currentTvl, prev7Tvl) : 0,
    price_delta_1d: prev1 ? safeRatio(currentPrice, prev1Price) : 0,
    price_delta_7d: prev7 ? safeRatio(currentPrice, prev7Price) : 0,
    volume_spike: averageVolume > 0 ? currentVolume / averageVolume : 0,
    mcap_tvl_ratio: currentTvl > 0 ? currentMcap / currentTvl : 0,
    liquidity_usd: currentLiquidity,
    volume_to_tvl_ratio: currentTvl > 0 ? currentVolume / currentTvl : 0,
    liquidity_to_tvl_ratio: currentTvl > 0 ? currentLiquidity / currentTvl : 0,
    pools_count: currentPoolsCount,
    primary_pool_share: currentPrimaryPoolShare,
    single_pool_dependency: currentPrimaryPoolShare
  };

  return snapshot;
}

async function runInference(tvl, derived) {
  try {
    const response = await fetch(riskModelUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tvl: Number(tvl) || 0,
        tvl_delta_1d: Number(derived?.tvl_delta_1d) || 0,
        tvl_delta_7d: Number(derived?.tvl_delta_7d) || 0,
        price_delta_1d: Number(derived?.price_delta_1d) || 0,
        price_delta_7d: Number(derived?.price_delta_7d) || 0,
        volume_spike: Number(derived?.volume_spike) || 0,
        mcap_tvl_ratio: Number(derived?.mcap_tvl_ratio) || 0
      })
    });

    if (!response.ok) {
      logger.warn("Risk model request failed | status=%s", String(response.status || "n/a"));
      return 0;
    }

    const payload = await response.json();
    const risk = Number(payload?.risk);
    return Number.isFinite(risk) ? risk : 0;
  } catch (error) {
    logger.warn("Risk model request failed: %s", error?.message || "unknown");
    return 0;
  }
}

async function buildCombinedRisk(entry, snapshot, baseRiskScore) {
  const baseScore = Number.isFinite(Number(baseRiskScore)) ? Number(baseRiskScore) : 0;
  const txConfig = resolveTxRiskConfig(entry?.config);

  if (!txConfig.enabled) {
    return {
      score: baseScore,
      base_score: baseScore,
      tx_pressure_score: 0,
      tx_delta: 0,
      tx_events_considered: 0,
      tx_enabled: false
    };
  }

  try {
    const nowTs = Date.now();
    const since = new Date(nowTs - txConfig.windowMs);
    const recentEvents = await TxRiskEventRepository.getByProtocolSince(entry.slug, since, 500);
    const txContribution = computeTxRiskContribution({
      events: recentEvents,
      snapshot,
      nowTs,
      config: txConfig
    });

    return {
      score: applyRiskWithTxContribution({
        baseRiskScore: baseScore,
        txDelta: txContribution.txDelta
      }),
      base_score: baseScore,
      tx_pressure_score: txContribution.txPressureScore,
      tx_delta: txContribution.txDelta,
      tx_events_considered: txContribution.eventsConsidered,
      tx_enabled: true
    };
  } catch (error) {
    logger.warn(
      "[%s] tx risk contribution failed: %s",
      getScopeLabel(entry?.slug, entry?.network),
      error?.message || "unknown"
    );
    return {
      score: baseScore,
      base_score: baseScore,
      tx_pressure_score: 0,
      tx_delta: 0,
      tx_events_considered: 0,
      tx_enabled: false
    };
  }
}

async function hydrateProtocolEntriesWithAbi(entries = []) {
  for (const entry of entries) {
    const txAbi = await loadProtocolAbiFile(entry?.slug);
    if (Array.isArray(txAbi) && txAbi.length > 0) {
      entry.config.txAbi = txAbi;
    }
  }
}

async function processProtocolEntry(entry, sharedCollectorCache = null) {
  const snapshot = await collectSnapshot(entry, sharedCollectorCache);
  const enriched = await calculateDerived(snapshot);
  const currentTvl = resolveScopedTvl(enriched);
  const baseRisk = await runInference(currentTvl, enriched.derived);
  enriched.risk = await buildCombinedRisk(entry, enriched, baseRisk);
  await ProtocolSnapshotRepository.save(enriched);

  logger.info(
    "[%s] snapshot saved | base_risk=%f | tx_delta=%f | total_risk=%f",
    getScopeLabel(entry.slug, entry.network),
    Number(enriched?.risk?.base_score || 0),
    Number(enriched?.risk?.tx_delta || 0),
    Number(enriched?.risk?.score || 0)
  );
}

async function bootstrapMissingSnapshots(entries = []) {
  await runWithConcurrency(entries, COLLECTOR_CONCURRENCY, async (entry) => {
    const exists = await ProtocolSnapshotRepository.exists(entry.slug, entry.network);
    if (exists) return;

    logger.warn("[%s] no history found, creating initial snapshot", getScopeLabel(entry.slug, entry.network));
    await processProtocolEntry(entry);
  });
}

async function runOneTick(entries = []) {
  const sharedCollectorCache = new Map();
  await runWithConcurrency(entries, COLLECTOR_CONCURRENCY, async (entry) => {
    await processProtocolEntry(entry, sharedCollectorCache);
  });
}

function startCollectorsLoop(entries = []) {
  let running = false;

  const tick = async () => {
    if (running) {
      setTimeout(tick, COLLECTOR_INTERVAL_MS);
      return;
    }

    running = true;
    try {
      await runOneTick(entries);
    } catch (error) {
      logger.error("Public collectors loop error: %o", error);
    } finally {
      running = false;
      setTimeout(tick, COLLECTOR_INTERVAL_MS);
    }
  };

  setTimeout(tick, 0);
}

async function runWithConcurrency(items, limit, worker) {
  if (!Array.isArray(items) || items.length === 0) return;
  const concurrency = Math.max(1, Number(limit) || 1);
  const queue = [...items];

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      await worker(item);
    }
  });

  await Promise.all(workers);
}

async function main() {
  await MongoConnection.connect(process.env.MONGODB_URI, process.env.MONGODB_DB);
  await initProtocolsFromConfig();
  await hydrateProtocolEntriesWithAbi(protocolCatalogEntries);

  logger.info(
    "Public on-chain runner started | mode=%s | scopes=%d",
    PUBLIC_ENGINE_MODE,
    protocolRuntimeEntries.length
  );

  await bootstrapMissingSnapshots(protocolRuntimeEntries);

  if (PUBLIC_ENGINE_MODE === "loop") {
    startCollectorsLoop(protocolRuntimeEntries);
    return;
  }

  await runOneTick(protocolRuntimeEntries);
  logger.info("Public on-chain runner completed one tick");
}

main().catch((error) => {
  logger.error("Public on-chain runner failed: %o", error);
  process.exit(1);
});
