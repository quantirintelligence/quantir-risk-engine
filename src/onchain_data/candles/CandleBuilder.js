const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const MAX_INTERPOLATION_GAP_BUCKETS = 8;
const MAX_SPIKE_MULTIPLIER = 4;

function toFiniteNumberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function bucketStartMs(ts) {
  return Math.floor(ts / THIRTY_MINUTES_MS) * THIRTY_MINUTES_MS;
}

function clampToRange(value, min, max) {
  if (!Number.isFinite(value)) return value;
  return Math.min(Math.max(value, min), max);
}

export class CandleBuilder {
  static build({
    protocol,
    rawPrices = [],
    source = "coingecko",
    interval = "30m",
    previousCandle = null
  } = {}) {
    const protocolId = String(protocol || "").trim();
    if (!protocolId) return [];

    const points = this.normalizeRawPrices(rawPrices);
    if (points.length === 0) return [];

    const baseCandles = this.buildBucketCandles(points);
    const filledCandles = this.interpolateGaps(baseCandles, previousCandle);
    const clampedCandles = this.clampSpikes(filledCandles, previousCandle);

    return clampedCandles.map((candle) => ({
      protocol: protocolId,
      interval,
      bucket_start: new Date(candle.bucket_start_ms),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      source,
      raw_points: candle.raw_points,
      is_interpolated: candle.is_interpolated,
      timezone: "UTC"
    }));
  }

  static normalizeRawPrices(rawPrices) {
    const deduped = new Map();

    for (const row of Array.isArray(rawPrices) ? rawPrices : []) {
      const ts = Number(Array.isArray(row) ? row[0] : row?.timestamp);
      const price = toFiniteNumberOrNull(Array.isArray(row) ? row[1] : row?.price);
      if (!Number.isFinite(ts) || ts <= 0 || !Number.isFinite(price) || price <= 0) continue;
      deduped.set(ts, { ts, price });
    }

    return Array.from(deduped.values()).sort((a, b) => a.ts - b.ts);
  }

  static buildBucketCandles(points) {
    const buckets = new Map();

    for (const point of points) {
      const startMs = bucketStartMs(point.ts);
      const current = buckets.get(startMs);
      if (!current) {
        buckets.set(startMs, {
          bucket_start_ms: startMs,
          open: point.price,
          high: point.price,
          low: point.price,
          close: point.price,
          raw_points: 1,
          is_interpolated: false
        });
        continue;
      }

      current.high = Math.max(current.high, point.price);
      current.low = Math.min(current.low, point.price);
      current.close = point.price;
      current.raw_points += 1;
    }

    return Array.from(buckets.values()).sort((a, b) => a.bucket_start_ms - b.bucket_start_ms);
  }

  static interpolateGaps(candles, previousCandle = null) {
    const rows = Array.isArray(candles) ? candles : [];
    if (rows.length === 0) return [];

    const output = [];
    let previous = previousCandle && Number.isFinite(Number(previousCandle.close))
      ? {
          bucket_start_ms: new Date(previousCandle.bucket_start || previousCandle.bucket_start_ms || 0).getTime(),
          close: Number(previousCandle.close)
        }
      : null;

    for (let index = 0; index < rows.length; index += 1) {
      const current = rows[index];
      const currentStart = current.bucket_start_ms;

      if (previous && Number.isFinite(previous.bucket_start_ms) && Number.isFinite(previous.close)) {
        const gapBuckets = Math.round((currentStart - previous.bucket_start_ms) / THIRTY_MINUTES_MS) - 1;
        const nextAnchor = rows[index];
        if (gapBuckets > 0) {
          const canInterpolateToNext = gapBuckets <= MAX_INTERPOLATION_GAP_BUCKETS;
          for (let step = 1; step <= gapBuckets; step += 1) {
            const syntheticStart = previous.bucket_start_ms + step * THIRTY_MINUTES_MS;
            const ratio = canInterpolateToNext ? step / (gapBuckets + 1) : 1;
            const interpolatedValue = canInterpolateToNext
              ? previous.close + (nextAnchor.open - previous.close) * ratio
              : previous.close;
            output.push({
              bucket_start_ms: syntheticStart,
              open: interpolatedValue,
              high: interpolatedValue,
              low: interpolatedValue,
              close: interpolatedValue,
              raw_points: 0,
              is_interpolated: true
            });
          }
        }
      }

      output.push(current);
      previous = current;
    }

    return output;
  }

  static clampSpikes(candles, previousCandle = null) {
    const rows = Array.isArray(candles) ? candles : [];
    if (rows.length === 0) return [];

    let previousClose = toFiniteNumberOrNull(previousCandle?.close);
    return rows.map((row) => {
      if (!Number.isFinite(previousClose) || previousClose <= 0) {
        previousClose = row.close;
        return row;
      }

      const upper = previousClose * MAX_SPIKE_MULTIPLIER;
      const lower = previousClose / MAX_SPIKE_MULTIPLIER;
      const open = clampToRange(row.open, lower, upper);
      const high = clampToRange(row.high, lower, upper);
      const low = clampToRange(row.low, lower, upper);
      const close = clampToRange(row.close, lower, upper);
      const normalizedHigh = Math.max(open, high, low, close);
      const normalizedLow = Math.min(open, high, low, close);

      previousClose = close;
      return {
        ...row,
        open,
        high: normalizedHigh,
        low: normalizedLow,
        close
      };
    });
  }
}

export default CandleBuilder;
