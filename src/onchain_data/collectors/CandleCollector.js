import { BaseCollector } from "../base/BaseCollector.js";
import { logger } from "../utils/logger.js";
import CandleBuilder from "../candles/CandleBuilder.js";
import MarketCandleRepository from "../../db/MarketCandleRepository.js";

// CoinGecko `market_chart/range` returns denser intraday samples only for a 1-day live window.
// Keep the normal collection window short for better 30m candles, but widen it during recovery
// so the worker can backfill after short outages.
const LIVE_FETCH_WINDOW_MS = 24 * 60 * 60 * 1000;
const RECOVERY_FETCH_WINDOW_MS = 48 * 60 * 60 * 1000;
const RECOVERY_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

function normalizeNetwork(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "ethereum";
  if (value === "eth") return "ethereum";
  if (value === "matic") return "polygon-pos";
  if (value === "arb") return "arbitrum-one";
  return value;
}

function normalizeApiRoot(raw) {
  const value = String(raw || "").trim();
  if (!value) return "https://api.coingecko.com/api/v3";
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export class CandleCollector extends BaseCollector {
  constructor(cgApiKey, protocolSlug, config) {
    super(protocolSlug, config);
    this.protocolSlug = protocolSlug;
    this.cgApiKey = cgApiKey;
  }

  buildHeaderVariants() {
    const key = String(this.cgApiKey || "").trim();
    if (!key) return [{ accept: "application/json" }];
    return [
      { accept: "application/json", "x-cg-demo-api-key": key },
      { accept: "application/json", "x-cg-pro-api-key": key }
    ];
  }

  resolveTokenConfig() {
    const tokenConfig =
      (this.config?.token_health && typeof this.config.token_health === "object" ? this.config.token_health : null) ||
      (this.config?.whale && typeof this.config.whale === "object" ? this.config.whale : null);

    if (!tokenConfig) return null;

    const tokenAddress = String(tokenConfig.token_address || "").trim().toLowerCase();
    if (!tokenAddress) return null;

    return {
      tokenAddress,
      network: normalizeNetwork(tokenConfig.network),
      apiRoot: normalizeApiRoot(tokenConfig.api_endpoint_root)
    };
  }

  async fetchRawPrices({ tokenAddress, network, apiRoot, windowMs = LIVE_FETCH_WINDOW_MS }) {
    const toSec = Math.ceil(Date.now() / 1000) + 60;
    const fromSec = Math.max(0, Math.floor((Date.now() - windowMs) / 1000) - 60);
    const url = `${apiRoot}/coins/${network}/contract/${tokenAddress}/market_chart/range?vs_currency=usd&from=${fromSec}&to=${toSec}`;

    let lastError = null;
    for (const headers of this.buildHeaderVariants()) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          headers,
          signal: controller.signal
        });

        if (response.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          continue;
        }
        if (!response.ok) {
          throw new Error(`HTTP_${response.status}`);
        }

        const payload = await response.json();
        return Array.isArray(payload?.prices) ? payload.prices : [];
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error("CANDLE_FETCH_FAILED");
  }

  async collect() {
    try {
      const tokenConfig = this.resolveTokenConfig();
      if (!tokenConfig) {
        throw new Error(`Invalid candle config for ${this.protocolName}`);
      }

      const previousCandle = await MarketCandleRepository.getLatestBefore(
        this.protocolName,
        "30m",
        new Date(Date.now() - RECOVERY_LOOKBACK_MS)
      );
      const previousBucketTs = new Date(previousCandle?.bucket_start || 0).getTime();
      const shouldUseRecoveryWindow =
        !Number.isFinite(previousBucketTs) ||
        previousBucketTs <= 0 ||
        Date.now() - previousBucketTs > LIVE_FETCH_WINDOW_MS;
      const fetchWindowMs = shouldUseRecoveryWindow ? RECOVERY_FETCH_WINDOW_MS : LIVE_FETCH_WINDOW_MS;
      const rawPrices = await this.fetchRawPrices({
        ...tokenConfig,
        windowMs: fetchWindowMs
      });
      const candles = CandleBuilder.build({
        protocol: this.protocolName,
        rawPrices,
        source: "coingecko",
        interval: "30m",
        previousCandle
      });

      await MarketCandleRepository.bulkUpsert(candles);
      logger.info(
        "[%s] CandleCollector persisted | source=%s raw_points=%d candles=%d interpolated=%d first=%s last=%s",
        this.protocolName,
        "coingecko",
        Array.isArray(rawPrices) ? rawPrices.length : 0,
        candles.length,
        candles.filter((row) => row.is_interpolated).length,
        candles[0]?.bucket_start?.toISOString?.() || "-",
        candles[candles.length - 1]?.bucket_start?.toISOString?.() || "-"
      );

      return this.normalizeOutput({
        collector: "CandleCollector",
        data: {
          interval: "30m",
          source: "coingecko",
          raw_points: Array.isArray(rawPrices) ? rawPrices.length : 0,
          persisted_candles: candles.length,
          interpolated_candles: candles.filter((row) => row.is_interpolated).length,
          first_bucket: candles[0]?.bucket_start?.toISOString?.() || null,
          last_bucket: candles[candles.length - 1]?.bucket_start?.toISOString?.() || null
        }
      });
    } catch (err) {
      logger.warn(
        "[%s] CandleCollector failed: %s",
        this.protocolName,
        err?.message || "unknown"
      );
      return this.normalizeOutput({
        collector: "CandleCollector",
        data: null,
        error: err?.message || "unknown"
      });
    }
  }
}
