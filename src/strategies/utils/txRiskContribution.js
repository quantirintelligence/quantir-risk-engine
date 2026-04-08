function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, toFiniteNumber(value, 0)));
}

export function resolveTxRiskConfig(protocolConfig = {}) {
  const txRiskConfig = protocolConfig?.txRiskConfig || {};

  // Tunable parameters for transaction-to-risk conversion.
  return {
    enabled: Boolean(protocolConfig?.txRiskContributionEnabled ?? true),
    windowMs: Math.max(60_000, toFiniteNumber(txRiskConfig.windowMs, 60 * 60 * 1000)),
    tauMs: Math.max(60_000, toFiniteNumber(txRiskConfig.tauMs, 45 * 60 * 1000)),
    fdvScaleK: Math.max(1e-6, toFiniteNumber(txRiskConfig.fdvScaleK, 0.001)),
    cap: clamp01(toFiniteNumber(txRiskConfig.cap, 0.2)),
    strategyWeights: {
      BoostOnLargeWhaleShift: 0.55,
      BoostOnLiquidityShock: 0.7,
      FlaggedMethodsStrategy: 0.5,
      OwnerAdminActionStrategy: 1,
      WhaleLargeTransferStrategy: 0.6,
      FailedTxBurstStrategy: 0.8,
      default: 0.35,
      ...(txRiskConfig.strategyWeights || {})
    }
  };
}

function resolveReferenceUsd(snapshot = {}) {
  // Prefer FDV for normalization, fallback to market cap, then TVL.
  const tokenData = snapshot?.collectors?.TokenRiskProfileCollector?.data;
  const fdv = toFiniteNumber(tokenData?.price?.fdv_usd, 0);
  if (fdv > 0) return fdv;

  const marketCap = toFiniteNumber(tokenData?.price?.market_cap_usd, 0);
  if (marketCap > 0) return marketCap;

  const tvl = toFiniteNumber(snapshot?.collectors?.TVLCollector?.data?.tvl_usd, 0);
  if (tvl > 0) return tvl;

  return 0;
}

function resolveEventWeight(event, strategyWeights = {}) {
  const matched = Array.isArray(event?.matched_strategies)
    ? event.matched_strategies.filter(Boolean)
    : [];

  if (matched.length === 0) {
    // Event without explicit strategy match gets the default weight.
    return toFiniteNumber(strategyWeights.default, 0.35);
  }

  // Use the strongest matched strategy weight for this event.
  const maxWeight = matched
    .map((name) => toFiniteNumber(strategyWeights?.[name], toFiniteNumber(strategyWeights.default, 0.35)))
    .reduce((max, w) => Math.max(max, w), 0);

  return Math.max(0, maxWeight);
}

function resolveEventAmountUsd(event, tokenPriceUsd) {
  // Preferred path: precomputed USD amount in event payload.
  const explicitUsd = Math.abs(toFiniteNumber(event?.amount_usd, 0));
  if (explicitUsd > 0) return explicitUsd;

  // Fallback path: approximate USD via token amount * current token USD price.
  const tokenAmount = Math.abs(toFiniteNumber(event?.amount, 0));
  if (tokenAmount <= 0) return 0;

  return tokenAmount * Math.max(0, toFiniteNumber(tokenPriceUsd, 0));
}

export function computeTxRiskContribution({
  events = [],
  snapshot,
  nowTs = Date.now(),
  config
}) {
  // Reference size used in severity denominator: FDV (or market cap/TVL fallback).
  const referenceUsd = resolveReferenceUsd(snapshot);
  const tokenPriceUsd = toFiniteNumber(
    snapshot?.collectors?.TokenRiskProfileCollector?.data?.price?.usd,
    0
  );
  const fdvDenominator = referenceUsd * config.fdvScaleK;

  if (!Number.isFinite(fdvDenominator) || fdvDenominator <= 0) {
    return {
      txPressureScore: 0,
      txDelta: 0,
      rawSignal: 0,
      eventsConsidered: 0,
      referenceUsd: 0
    };
  }

  let rawSignal = 0;
  let eventsConsidered = 0;

  for (const event of events) {
    const amountUsd = resolveEventAmountUsd(event, tokenPriceUsd);
    if (amountUsd <= 0) continue;

    const observedAtTs = new Date(event?.observed_at || 0).getTime();
    const ageMs = Math.max(0, nowTs - observedAtTs);
    // Time decay: older events contribute less.
    const decay = Math.exp(-ageMs / config.tauMs);
    const weight = resolveEventWeight(event, config.strategyWeights);
    // severity_i = w_strategy * log1p(amount_usd / (FDV * k))
    const severity = weight * Math.log1p(amountUsd / fdvDenominator);

    // Delta_tx_raw = sum_i(severity_i * exp(-age_i / tau))
    rawSignal += severity * decay;
    eventsConsidered += 1;
  }

  // tx_pressure = 1 - exp(-Delta_tx_raw), bounded in [0, 1].
  const txPressureScore = clamp01(1 - Math.exp(-rawSignal));
  // Delta_tx = cap * tx_pressure, final additive transaction delta.
  const txDelta = clamp01(config.cap * txPressureScore);

  return {
    txPressureScore,
    txDelta,
    rawSignal,
    eventsConsidered,
    referenceUsd
  };
}

export function applyRiskWithTxContribution({ baseRiskScore, txDelta }) {
  // R_total = clamp01(R_base + Delta_tx)
  return clamp01(toFiniteNumber(baseRiskScore, 0) + toFiniteNumber(txDelta, 0));
}
