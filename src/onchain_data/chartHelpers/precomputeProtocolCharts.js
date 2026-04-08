import ProtocolSnapshotRepository from "../../db/ProtocolSnapshotRepository.js";
import MarketCandleRepository from "../../db/MarketCandleRepository.js";
import ProtocolChartPayloadRepository from "../../db/ProtocolChartPayloadRepository.js";
import { logger } from "../utils/logger.js";
import { buildChartPayload } from "./ChartPayloadBuilder.js";

const CHART_HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function extractSnapshotPriceUsd(snapshot) {
  return Number(
    snapshot?.collectors?.TokenRiskProfileCollector?.data?.price?.usd ??
    snapshot?.derived?.price_usd ??
    0
  ) || 0;
}

function extractSnapshotTvl(snapshot) {
  // Fall back to the legacy TVL collector when the network TVL source is unavailable.
  const hasNetworkCollector = Boolean(snapshot?.collectors?.NetworkSnapshotCollector);
  const networkTvl = Number(snapshot?.collectors?.NetworkSnapshotCollector?.data?.tvl_usd);
  const networkTvlSourceAvailable = snapshot?.collectors?.NetworkSnapshotCollector?.data?.tvl_source_available === true;
  if (hasNetworkCollector && networkTvlSourceAvailable) {
    return Number.isFinite(networkTvl) ? networkTvl : 0;
  }

  return Number(
    snapshot?.collectors?.TVLCollector?.data?.tvl_usd ??
    snapshot?.derived?.tvl ??
    snapshot?.derived?.tvl_usd ??
    0
  ) || 0;
}

function extractSnapshotFdv(snapshot) {
  return Number(
    snapshot?.collectors?.TokenRiskProfileCollector?.data?.price?.fdv_usd ??
    snapshot?.derived?.fdv ??
    snapshot?.derived?.fdv_usd ??
    0
  ) || 0;
}

// Precompute chart payloads per protocol+network while keeping price candles global.
export async function precomputeProtocolChartPayload(protocol, network = null) {
  const slug = String(protocol || "").trim();
  if (!slug) return null;

  const from = new Date(Date.now() - CHART_HISTORY_WINDOW_MS);
  const to = new Date();

  const [history, candles] = await Promise.all([
    ProtocolSnapshotRepository.getHistory(slug, network, from, to),
    MarketCandleRepository.getHistory(slug, "30m", from, to)
  ]);

  const historyRows = (Array.isArray(history) ? history : []).map((row) => ({
    timestamp: row?.snapshot_at ? new Date(row.snapshot_at).toISOString() : null,
    riskScore: Number(row?.risk?.score ?? 0),
    priceUsd: extractSnapshotPriceUsd(row),
    tvl: extractSnapshotTvl(row),
    fdv: extractSnapshotFdv(row),
    riskForecast: Array.isArray(row?.risk_forecast) ? row.risk_forecast : []
  })).filter((row) => row.timestamp);

  const candleRows = (Array.isArray(candles) ? candles : []).map((row) => ({
    timestamp: row?.bucket_start ? new Date(row.bucket_start).toISOString() : null,
    open: Number(row?.open),
    high: Number(row?.high),
    low: Number(row?.low),
    close: Number(row?.close)
  })).filter((row) => row.timestamp);

  const payload = buildChartPayload({
    historyRows,
    priceCandleRows: candleRows,
    fallbackRisk: Number(historyRows[historyRows.length - 1]?.riskScore || 0),
    fallbackPrice: Number(historyRows[historyRows.length - 1]?.priceUsd || 0)
  });

  await ProtocolChartPayloadRepository.save({
    protocol: slug,
    network,
    chartEndTimestamp: payload.chartEndTimestamp,
    chartSeriesByRange: payload.chartSeriesByRange,
    source: "precomputed"
  });

  logger.info(
    "[%s:%s] ChartPayload persisted | history=%d candles=%d end=%s",
    slug,
    String(network || "global"),
    historyRows.length,
    candleRows.length,
    payload.chartEndTimestamp || "-"
  );

  return payload;
}

export default precomputeProtocolChartPayload;
