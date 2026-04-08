const DASHBOARD_RANGE_WINDOWS_HOURS = {
  "15m": 12,
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30
};
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const FORECAST_FORWARD_WINDOW_MINUTES = 30;
const FORECAST_STEP_MINUTES = 15;

function normalizeRiskScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return Number.NaN;
  return num <= 1 ? num * 100 : num;
}

function finiteOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function averageNumbers(values) {
  const list = Array.isArray(values) ? values.filter((value) => Number.isFinite(value)) : [];
  if (list.length === 0) return null;
  return list.reduce((sum, value) => sum + value, 0) / list.length;
}

function getLatestRowWithForecast(rows) {
  const list = Array.isArray(rows) ? rows : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const row = list[index];
    if (Array.isArray(row?.riskForecast) && row.riskForecast.length > 0) {
      return row;
    }
  }
  return null;
}

function decimateSeries(points, maxPoints = 240) {
  const list = Array.isArray(points) ? points : [];
  if (list.length <= maxPoints) return list;
  if (maxPoints < 3) return [list[0], list[list.length - 1]];

  const result = [list[0]];
  const interior = maxPoints - 2;
  const step = (list.length - 2) / interior;
  for (let i = 0; i < interior; i += 1) {
    const index = 1 + Math.round(i * step);
    result.push(list[Math.min(index, list.length - 2)]);
  }
  result.push(list[list.length - 1]);
  return result;
}

function normalizeForecastRow(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item) => {
      const tsRaw = item?.timestamp || item?.bucket_ts || item?.bucketTs;
      if (!tsRaw) return null;
      const ts = new Date(tsRaw).getTime();
      if (!Number.isFinite(ts)) return null;

      const value = finiteOrNull(item?.value);
      const p50 = finiteOrNull(item?.p50);
      if (!Number.isFinite(value) && !Number.isFinite(p50)) return null;

      const normalizedValue = normalizeRiskScore(Number.isFinite(value) ? value : p50);
      const normalizedP50 = normalizeRiskScore(Number.isFinite(p50) ? p50 : normalizedValue);
      return {
        step: Number.isFinite(Number(item?.step)) ? Number(item.step) : null,
        ts,
        value: normalizedValue,
        p50: normalizedP50,
        tvl: finiteOrNull(item?.tvl),
        fdv: finiteOrNull(item?.fdv),
        confidence: finiteOrNull(item?.confidence)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts);
}

function buildFlatSeries(value = 0, durationHours = 24) {
  const hours = Number.isFinite(Number(durationHours)) && Number(durationHours) > 0
    ? Number(durationHours)
    : 24;
  return [{ time: 0, value }, { time: hours, value }];
}

function buildEmptyChartSeriesByRange(riskValue = 0, priceValue = 0) {
  return {
    "15m": {
      risk: buildFlatSeries(riskValue, DASHBOARD_RANGE_WINDOWS_HOURS["15m"]),
      price: buildFlatSeries(priceValue, DASHBOARD_RANGE_WINDOWS_HOURS["15m"]),
      priceCandles: [],
      tvl: [],
      fdv: [],
      predictionPast: [],
      predictionFuture: []
    },
    "24h": {
      risk: buildFlatSeries(riskValue, DASHBOARD_RANGE_WINDOWS_HOURS["24h"]),
      price: buildFlatSeries(priceValue, DASHBOARD_RANGE_WINDOWS_HOURS["24h"]),
      priceCandles: [],
      tvl: [],
      fdv: [],
      predictionPast: [],
      predictionFuture: []
    },
    "7d": {
      risk: buildFlatSeries(riskValue, DASHBOARD_RANGE_WINDOWS_HOURS["7d"]),
      price: buildFlatSeries(priceValue, DASHBOARD_RANGE_WINDOWS_HOURS["7d"]),
      priceCandles: [],
      tvl: [],
      fdv: [],
      predictionPast: [],
      predictionFuture: []
    },
    "30d": {
      risk: buildFlatSeries(riskValue, DASHBOARD_RANGE_WINDOWS_HOURS["30d"]),
      price: buildFlatSeries(priceValue, DASHBOARD_RANGE_WINDOWS_HOURS["30d"]),
      priceCandles: [],
      tvl: [],
      fdv: [],
      predictionPast: [],
      predictionFuture: []
    },
    all: {
      risk: buildFlatSeries(riskValue, DASHBOARD_RANGE_WINDOWS_HOURS["30d"]),
      price: buildFlatSeries(priceValue, DASHBOARD_RANGE_WINDOWS_HOURS["30d"]),
      priceCandles: [],
      tvl: [],
      fdv: [],
      predictionPast: [],
      predictionFuture: []
    }
  };
}

function pickLatestTimestamp(...values) {
  const timestamps = values
    .map((value) => new Date(value || 0).getTime())
    .filter((value) => Number.isFinite(value) && value > 0);
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

function buildRawPriceCandles(candles, startTs, endTs) {
  return candles
    .filter((row) => row.ts >= startTs && row.ts <= endTs)
    .map((row) => ({
      time: (row.ts - startTs) / ONE_HOUR_MS,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      timestamp: new Date(row.ts).toISOString()
    }));
}

function buildAggregatedPriceCandlesFromRawCandles(candles, startTs, endTs, bucketSizeMs) {
  if (!Array.isArray(candles) || candles.length === 0) return [];
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) return [];
  const bucketMs = Math.max(1, Math.round(Number(bucketSizeMs) || ONE_HOUR_MS));
  const sourceCandles = candles
    .filter((row) => (
      Number.isFinite(row?.ts) &&
      row.ts >= startTs &&
      row.ts <= endTs &&
      Number.isFinite(row?.open) &&
      Number.isFinite(row?.high) &&
      Number.isFinite(row?.low) &&
      Number.isFinite(row?.close) &&
      Number(row.open) > 0 &&
      Number(row.high) > 0 &&
      Number(row.low) > 0 &&
      Number(row.close) > 0
    ))
    .sort((a, b) => a.ts - b.ts);
  if (sourceCandles.length === 0) return [];

  const buckets = new Map();
  for (const row of sourceCandles) {
    const bucketIndex = Math.max(0, Math.floor((row.ts - startTs) / bucketMs));
    const bucketTs = startTs + bucketIndex * bucketMs;
    const existing = buckets.get(bucketTs);
    if (!existing) {
      buckets.set(bucketTs, {
        ts: bucketTs,
        open: Number(row.open),
        high: Math.max(Number(row.open), Number(row.high), Number(row.low), Number(row.close)),
        low: Math.min(Number(row.open), Number(row.high), Number(row.low), Number(row.close)),
        close: Number(row.close)
      });
      continue;
    }
    existing.high = Math.max(
      existing.high,
      Number(row.open),
      Number(row.high),
      Number(row.low),
      Number(row.close)
    );
    existing.low = Math.min(
      existing.low,
      Number(row.open),
      Number(row.high),
      Number(row.low),
      Number(row.close)
    );
    existing.close = Number(row.close);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.ts - b.ts)
    .map((row) => ({
      time: (row.ts - startTs) / ONE_HOUR_MS,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      timestamp: new Date(row.ts).toISOString()
    }));
}

function buildDerivedPriceCandles(rows, startTs, endTs, bucketSizeMs) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) return [];
  const bucketMs = Math.max(1, Math.round(Number(bucketSizeMs) || ONE_DAY_MS));
  const priceRows = rows
    .filter((row) => (
      Number.isFinite(row?.ts) &&
      row.ts >= startTs &&
      row.ts <= endTs &&
      Number.isFinite(row?.price) &&
      Number(row.price) > 0
    ));
  if (priceRows.length === 0) return [];

  const buckets = new Map();
  for (const row of priceRows) {
    const bucketIndex = Math.max(0, Math.floor((row.ts - startTs) / bucketMs));
    const bucketTs = startTs + bucketIndex * bucketMs;
    const existing = buckets.get(bucketTs);
    if (!existing) {
      buckets.set(bucketTs, {
        ts: bucketTs,
        open: Number(row.price),
        high: Number(row.price),
        low: Number(row.price),
        close: Number(row.price)
      });
      continue;
    }
    existing.high = Math.max(existing.high, Number(row.price));
    existing.low = Math.min(existing.low, Number(row.price));
    existing.close = Number(row.price);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.ts - b.ts)
    .map((row) => ({
      time: (row.ts - startTs) / ONE_HOUR_MS,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      timestamp: new Date(row.ts).toISOString()
    }));
}

function resolvePriceCandlesForRange(rangeKey, rows, candles, startTs, endTs, windowHours) {
  if (rangeKey === "15m") {
    const derivedCandles = buildDerivedPriceCandles(rows, startTs, endTs, 15 * 60 * 1000);
    if (derivedCandles.length > 0) return derivedCandles;
    return buildRawPriceCandles(candles, startTs, endTs);
  }
  if (rangeKey === "24h") {
    const aggregatedRawCandles = buildAggregatedPriceCandlesFromRawCandles(candles, startTs, endTs, ONE_HOUR_MS);
    if (aggregatedRawCandles.length > 0) return aggregatedRawCandles;
    const derivedCandles = buildDerivedPriceCandles(rows, startTs, endTs, ONE_HOUR_MS);
    if (derivedCandles.length > 0) return derivedCandles;
    return buildRawPriceCandles(candles, startTs, endTs);
  }
  if (rangeKey === "7d" || rangeKey === "30d") {
    const aggregatedRawCandles = buildAggregatedPriceCandlesFromRawCandles(candles, startTs, endTs, ONE_DAY_MS);
    if (aggregatedRawCandles.length > 0) return aggregatedRawCandles;
    return buildDerivedPriceCandles(rows, startTs, endTs, ONE_DAY_MS);
  }
  const dynamicBucketMs = Math.max(
    ONE_DAY_MS,
    Math.round((Math.max(windowHours, 24) * ONE_HOUR_MS) / 30)
  );
  const aggregatedRawCandles = buildAggregatedPriceCandlesFromRawCandles(candles, startTs, endTs, dynamicBucketMs);
  if (aggregatedRawCandles.length > 0) return aggregatedRawCandles;
  const derivedCandles = buildDerivedPriceCandles(rows, startTs, endTs, dynamicBucketMs);
  return derivedCandles.length > 0 ? derivedCandles : buildRawPriceCandles(candles, startTs, endTs);
}

function buildSeriesByRangeFromCandlesOnly(candles, fallbackRisk, fallbackPrice) {
  const empty = buildEmptyChartSeriesByRange(fallbackRisk, fallbackPrice);
  if (!Array.isArray(candles) || candles.length === 0) return empty;
  const latestCandleTs = candles[candles.length - 1].ts;

  function mapRange(rangeKey, hoursWindow) {
    const startTs = latestCandleTs - hoursWindow * ONE_HOUR_MS;
    const priceCandles = resolvePriceCandlesForRange(rangeKey, [], candles, startTs, latestCandleTs, hoursWindow);
    const priceSeries = priceCandles.length > 0
      ? priceCandles.map((row) => ({
          time: Number(row.time),
          value: Number(row.close)
        }))
      : buildFlatSeries(fallbackPrice, hoursWindow);
    return {
      ...empty[rangeKey],
      price: decimateSeries(priceSeries),
      priceCandles
    };
  }

  const firstCandleTs = candles[0].ts;
  const allWindowHours = Math.max((latestCandleTs - firstCandleTs) / ONE_HOUR_MS, 24);
  const allPriceCandles = resolvePriceCandlesForRange("all", [], candles, firstCandleTs, latestCandleTs, allWindowHours);

  return {
    "15m": mapRange("15m", DASHBOARD_RANGE_WINDOWS_HOURS["15m"]),
    "24h": mapRange("24h", DASHBOARD_RANGE_WINDOWS_HOURS["24h"]),
    "7d": mapRange("7d", DASHBOARD_RANGE_WINDOWS_HOURS["7d"]),
    "30d": mapRange("30d", DASHBOARD_RANGE_WINDOWS_HOURS["30d"]),
    all: {
      ...empty.all,
      price: decimateSeries(
        allPriceCandles.length > 0
          ? allPriceCandles.map((row) => ({
              time: Number(row.time),
              value: Number(row.close)
            }))
          : buildFlatSeries(fallbackPrice, allWindowHours)
      ),
      priceCandles: allPriceCandles
    }
  };
}

export function buildChartSeriesByRange(historyRows, fallbackRisk, fallbackPrice, priceCandleRows = []) {
  const rows = Array.isArray(historyRows)
    ? historyRows
        .map((row) => ({
          ts: new Date(row?.timestamp || row?.snapshot_at || 0).getTime(),
          risk: normalizeRiskScore(row?.riskScore ?? row?.risk?.score ?? fallbackRisk),
          price: Number(row?.priceUsd ?? row?.price_usd ?? fallbackPrice),
          tvl: Number(row?.tvlUsd ?? row?.tvl ?? row?.tvl_usd),
          fdv: Number(row?.fdvUsd ?? row?.fdv ?? row?.fdv_usd),
          riskForecast: normalizeForecastRow(row?.riskForecast || row?.risk_forecast)
        }))
        .filter((row) => Number.isFinite(row.ts))
        .sort((a, b) => a.ts - b.ts)
    : [];
  const candles = Array.isArray(priceCandleRows)
    ? priceCandleRows
        .map((row) => ({
          ts: new Date(row?.timestamp || row?.bucket_start || 0).getTime(),
          open: Number(row?.open),
          high: Number(row?.high),
          low: Number(row?.low),
          close: Number(row?.close)
        }))
        .filter((row) =>
          Number.isFinite(row.ts) &&
          Number.isFinite(row.open) &&
          Number.isFinite(row.high) &&
          Number.isFinite(row.low) &&
          Number.isFinite(row.close)
        )
        .sort((a, b) => a.ts - b.ts)
    : [];

  if (rows.length < 2) {
    if (candles.length > 0) {
      return buildSeriesByRangeFromCandlesOnly(candles, fallbackRisk, fallbackPrice);
    }
    return buildEmptyChartSeriesByRange(fallbackRisk, fallbackPrice);
  }

  const latestHistoryTs = rows[rows.length - 1].ts;
  const latestCandleTs = candles.length > 0 ? candles[candles.length - 1].ts : Number.NaN;
  const timelineEndTs = Math.max(
    latestHistoryTs,
    Number.isFinite(latestCandleTs) ? latestCandleTs : latestHistoryTs
  );

  function toRange(rangeKey, hoursWindow) {
    const startTs = timelineEndTs - hoursWindow * ONE_HOUR_MS;
    const filtered = rows.filter((row) => row.ts >= startTs && row.ts <= timelineEndTs);
    const base = filtered.length > 1 ? filtered : rows.slice(-2);
    const carrySeedRow = [...rows].reverse().find((row) => row.ts < startTs) || null;
    const shouldAddCarrySeed = Boolean(carrySeedRow && (!base[0] || base[0].ts > startTs));
    const riskSeries = [
      ...(shouldAddCarrySeed && Number.isFinite(carrySeedRow?.risk)
        ? [{ time: 0, value: Number(carrySeedRow.risk) }]
        : []),
      ...base.map((row) => ({ time: (row.ts - startTs) / ONE_HOUR_MS, value: row.risk }))
    ];
    const priceSeries = [
      ...(shouldAddCarrySeed && Number.isFinite(carrySeedRow?.price)
        ? [{ time: 0, value: Number(carrySeedRow.price) }]
        : []),
      ...base.map((row) => ({ time: (row.ts - startTs) / ONE_HOUR_MS, value: row.price }))
    ];
    const tvlSeries = [
      ...(shouldAddCarrySeed && Number.isFinite(carrySeedRow?.tvl)
        ? [{ time: 0, value: Number(carrySeedRow.tvl) }]
        : []),
      ...base
        .filter((row) => Number.isFinite(row.tvl))
        .map((row) => ({ time: (row.ts - startTs) / ONE_HOUR_MS, value: row.tvl }))
    ];
    const fdvSeries = [
      ...(shouldAddCarrySeed && Number.isFinite(carrySeedRow?.fdv)
        ? [{ time: 0, value: Number(carrySeedRow.fdv) }]
        : []),
      ...base
        .filter((row) => Number.isFinite(row.fdv))
        .map((row) => ({ time: (row.ts - startTs) / ONE_HOUR_MS, value: row.fdv }))
    ];
    const priceCandles = resolvePriceCandlesForRange(rangeKey, rows, candles, startTs, timelineEndTs, hoursWindow);
    const forecastPastByTs = new Map();
    const latestForecastRow = getLatestRowWithForecast(base);
    const latestForecastFuture = Array.isArray(latestForecastRow?.riskForecast)
      ? latestForecastRow.riskForecast
      : [];
    const dynamicForwardMs = Math.max(
      FORECAST_FORWARD_WINDOW_MINUTES * 60 * 1000,
      ...latestForecastFuture.map((point) => {
        const byStep = Number(point?.step);
        if (Number.isFinite(byStep) && byStep > 0) return byStep * 15 * 60 * 1000;
        const pointTs = Number(point?.ts);
        return Number.isFinite(pointTs) ? Math.max(0, pointTs - latestHistoryTs) : 0;
      })
    );
    const forwardLimitTs = latestHistoryTs + dynamicForwardMs;

    for (const row of base) {
      const forecast = Array.isArray(row?.riskForecast) ? row.riskForecast : [];
      for (const point of forecast) {
        const rawTs = Number(point?.ts);
        const step = Number(point?.step);
        const resolvedTs =
          Number.isFinite(step) && step > 0
            ? row.ts + step * FORECAST_STEP_MINUTES * 60 * 1000
            : rawTs;
        if (!Number.isFinite(resolvedTs)) continue;
        if (resolvedTs < startTs || resolvedTs > timelineEndTs) continue;

        const current = forecastPastByTs.get(resolvedTs) || {
          riskValues: [],
          tvlValues: [],
          fdvValues: []
        };
        const value = Number(point?.p50);
        if (Number.isFinite(value)) current.riskValues.push(value);
        const tvl = Number(point?.tvl);
        if (Number.isFinite(tvl)) current.tvlValues.push(tvl);
        const fdv = Number(point?.fdv);
        if (Number.isFinite(fdv)) current.fdvValues.push(fdv);
        forecastPastByTs.set(resolvedTs, current);
      }
    }

    const predictionPast = decimateSeries(
      Array.from(forecastPastByTs.entries())
        .map(([ts, payload]) => {
          const avg = averageNumbers(payload?.riskValues || []);
          return Number.isFinite(avg)
            ? {
                time: (ts - startTs) / ONE_HOUR_MS,
                value: avg,
                p50: avg,
                tvl: averageNumbers(payload?.tvlValues || []),
                fdv: averageNumbers(payload?.fdvValues || []),
                timestamp: new Date(ts).toISOString(),
                step: null
              }
            : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.time - b.time),
      720
    );

    const predictionFuture = latestForecastFuture
      .map((point) => {
        const step = Number(point?.step);
        const ts = Number(point?.ts);
        const resolvedTs =
          Number.isFinite(step) && step > 0
            ? Number(latestForecastRow?.ts || latestHistoryTs) + step * FORECAST_STEP_MINUTES * 60 * 1000
            : ts;
        if (!Number.isFinite(resolvedTs) || resolvedTs <= latestHistoryTs || resolvedTs > forwardLimitTs) return null;
        return {
          time: (resolvedTs - startTs) / ONE_HOUR_MS,
          value: Number(point?.value),
          p50: Number(point?.p50),
          tvl: Number.isFinite(Number(point?.tvl)) ? Number(point.tvl) : null,
          fdv: Number.isFinite(Number(point?.fdv)) ? Number(point.fdv) : null,
          confidence: Number.isFinite(Number(point?.confidence)) ? Number(point.confidence) : null,
          timestamp: new Date(resolvedTs).toISOString(),
          step: Number.isFinite(step) ? step : null
        };
      })
      .filter(Boolean)
      .filter((point) => Number.isFinite(point.value))
      .sort((a, b) => a.time - b.time);

    return {
      risk: decimateSeries(riskSeries),
      price: decimateSeries(priceSeries),
      priceCandles,
      tvl: decimateSeries(tvlSeries),
      fdv: decimateSeries(fdvSeries),
      predictionPast,
      predictionFuture
    };
  }

  const allBaseTs = rows[0].ts;
  const allEndTs = timelineEndTs;
  const allWindowHours = Math.max((allEndTs - allBaseTs) / ONE_HOUR_MS, 24);
  const allPriceCandles = resolvePriceCandlesForRange("all", rows, candles, allBaseTs, allEndTs, allWindowHours);
  const allForecastPastByTs = new Map();
  for (const row of rows) {
    const forecast = Array.isArray(row?.riskForecast) ? row.riskForecast : [];
    for (const point of forecast) {
      const rawTs = Number(point?.ts);
      const step = Number(point?.step);
      const resolvedTs =
        Number.isFinite(step) && step > 0
          ? row.ts + step * FORECAST_STEP_MINUTES * 60 * 1000
          : rawTs;
      if (!Number.isFinite(resolvedTs)) continue;
      if (resolvedTs < allBaseTs || resolvedTs > allEndTs) continue;
      const current = allForecastPastByTs.get(resolvedTs) || {
        riskValues: [],
        tvlValues: [],
        fdvValues: []
      };
      const value = Number(point?.p50);
      if (Number.isFinite(value)) current.riskValues.push(value);
      const tvl = Number(point?.tvl);
      if (Number.isFinite(tvl)) current.tvlValues.push(tvl);
      const fdv = Number(point?.fdv);
      if (Number.isFinite(fdv)) current.fdvValues.push(fdv);
      allForecastPastByTs.set(resolvedTs, current);
    }
  }
  const allPredictionPast = decimateSeries(
    Array.from(allForecastPastByTs.entries())
      .map(([ts, payload]) => {
        const avg = averageNumbers(payload?.riskValues || []);
        return Number.isFinite(avg)
          ? {
              time: (ts - allBaseTs) / ONE_HOUR_MS,
              value: avg,
              p50: avg,
              tvl: averageNumbers(payload?.tvlValues || []),
              fdv: averageNumbers(payload?.fdvValues || []),
              timestamp: new Date(ts).toISOString(),
              step: null
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.time - b.time),
    720
  );
  const allLatestForecastRow = getLatestRowWithForecast(rows);
  const allLatestForecast = Array.isArray(allLatestForecastRow?.riskForecast)
    ? allLatestForecastRow.riskForecast
    : [];
  const allDynamicForwardMs = Math.max(
    FORECAST_FORWARD_WINDOW_MINUTES * 60 * 1000,
    ...allLatestForecast.map((point) => {
      const byStep = Number(point?.step);
      if (Number.isFinite(byStep) && byStep > 0) return byStep * 15 * 60 * 1000;
      const pointTs = Number(point?.ts);
      return Number.isFinite(pointTs) ? Math.max(0, pointTs - latestHistoryTs) : 0;
    })
  );
  const allForwardLimitTs = latestHistoryTs + allDynamicForwardMs;
  const allPredictionFuture = allLatestForecast
    .map((point) => {
      const step = Number(point?.step);
      const ts = Number(point?.ts);
      const resolvedTs =
        Number.isFinite(step) && step > 0
          ? Number(allLatestForecastRow?.ts || latestHistoryTs) + step * FORECAST_STEP_MINUTES * 60 * 1000
          : ts;
      if (!Number.isFinite(resolvedTs) || resolvedTs <= latestHistoryTs || resolvedTs > allForwardLimitTs) return null;
      return {
        time: (resolvedTs - allBaseTs) / ONE_HOUR_MS,
        value: Number(point?.value),
        p50: Number(point?.p50),
        tvl: Number.isFinite(Number(point?.tvl)) ? Number(point.tvl) : null,
        fdv: Number.isFinite(Number(point?.fdv)) ? Number(point.fdv) : null,
        confidence: Number.isFinite(Number(point?.confidence)) ? Number(point.confidence) : null,
        timestamp: new Date(resolvedTs).toISOString(),
        step: Number.isFinite(step) ? step : null
      };
    })
    .filter(Boolean)
    .filter((point) => Number.isFinite(point.value))
    .sort((a, b) => a.time - b.time);

  return {
    "15m": toRange("15m", DASHBOARD_RANGE_WINDOWS_HOURS["15m"]),
    "24h": toRange("24h", DASHBOARD_RANGE_WINDOWS_HOURS["24h"]),
    "7d": toRange("7d", DASHBOARD_RANGE_WINDOWS_HOURS["7d"]),
    "30d": toRange("30d", DASHBOARD_RANGE_WINDOWS_HOURS["30d"]),
    all: {
      risk: decimateSeries(rows.map((row) => ({ time: (row.ts - allBaseTs) / ONE_HOUR_MS, value: row.risk }))),
      price: decimateSeries(rows.map((row) => ({ time: (row.ts - allBaseTs) / ONE_HOUR_MS, value: row.price }))),
      priceCandles: allPriceCandles,
      tvl: decimateSeries(
        rows
          .filter((row) => Number.isFinite(row.tvl))
          .map((row) => ({ time: (row.ts - allBaseTs) / ONE_HOUR_MS, value: row.tvl }))
      ),
      fdv: decimateSeries(
        rows
          .filter((row) => Number.isFinite(row.fdv))
          .map((row) => ({ time: (row.ts - allBaseTs) / ONE_HOUR_MS, value: row.fdv }))
      ),
      predictionPast: allPredictionPast,
      predictionFuture: allPredictionFuture
    }
  };
}

export function buildChartPayload({ historyRows = [], priceCandleRows = [], fallbackRisk = 0, fallbackPrice = 0 } = {}) {
  const chartSeriesByRange = buildChartSeriesByRange(historyRows, fallbackRisk, fallbackPrice, priceCandleRows);
  const lastHistoryRow = Array.isArray(historyRows) && historyRows.length > 0
    ? historyRows[historyRows.length - 1]
    : null;
  const lastCandleRow = Array.isArray(priceCandleRows) && priceCandleRows.length > 0
    ? priceCandleRows[priceCandleRows.length - 1]
    : null;
  const chartEndTimestamp = pickLatestTimestamp(
    lastHistoryRow?.timestamp,
    lastHistoryRow?.snapshot_at,
    lastCandleRow?.timestamp,
    lastCandleRow?.bucket_start
  );

  return {
    chartSeriesByRange,
    chartEndTimestamp
  };
}

export default {
  buildChartPayload,
  buildChartSeriesByRange
};
