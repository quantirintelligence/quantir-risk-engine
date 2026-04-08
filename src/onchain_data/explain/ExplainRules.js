const ADMIN_METHOD_HINTS = new Set([
  "upgrade",
  "upgradeto",
  "upgradetoandcall",
  "transferownership",
  "acceptownership",
  "renounceownership",
  "setowner",
  "setadmin",
  "changeadmin",
  "setgovernor",
  "setguardian",
  "setpendingadmin",
  "setimplementation"
]);

function normalizeMethod(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeAmount(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeRiskScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }

  return Math.abs(num) <= 1 ? num * 100 : num;
}

export function evaluateAdminAction({ event, flags }) {
  const method = normalizeMethod(event?.method || event?.event);
  if (!flags?.admin && !ADMIN_METHOD_HINTS.has(method)) {
    return null;
  }

  return {
    name: "ADMIN_ACTION",
    score: 100,
    severity: "critical",
    reason: flags?.admin
      ? "Administrative or owner-controlled address executed a sensitive action."
      : "Privileged or upgrade-related method was executed."
  };
}

export function evaluateCriticalCapitalMovement({ event, snapshot, flags }) {
  const amountUsd = normalizeAmount(event?.amount_usd);
  const tvl = Number(snapshot?.market_context?.tvl || 0);
  const whaleThreshold = Math.max(1_000_000, tvl * 0.005);
  const treasuryThreshold = Math.max(500_000, tvl * 0.0025);

  if (flags?.whale && amountUsd >= whaleThreshold) {
    return {
      name: "CRITICAL_WHALE_MOVEMENT",
      score: 80,
      severity: "critical",
      reason: `Whale-sized transfer exceeded dynamic explain threshold (${Math.round(whaleThreshold)} USD).`
    };
  }

  if (flags?.protocol_contract && amountUsd >= treasuryThreshold) {
    return {
      name: "CRITICAL_TREASURY_MOVEMENT",
      score: 75,
      severity: "critical",
      reason: `Protocol-controlled transfer exceeded treasury movement threshold (${Math.round(treasuryThreshold)} USD).`
    };
  }

  return null;
}

export function evaluateRiskJump({ currentRisk, previousRisk }) {
  const current = normalizeRiskScore(currentRisk);
  const previous = normalizeRiskScore(previousRisk);
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }

  const delta = current - previous;
  const crossedHighBand = previous < 65 && current >= 65;
  const crossedCriticalBand = previous < 80 && current >= 80;

  if (delta < 15 && !crossedHighBand && !crossedCriticalBand) {
    return null;
  }

  return {
    name: "SHARP_RISK_JUMP",
    score: crossedCriticalBand ? 85 : 70,
    severity: crossedCriticalBand ? "critical" : "high",
    reason: `Risk score moved sharply from ${previous.toFixed(2)} to ${current.toFixed(2)}.`
  };
}

export function evaluateSignalConfluence({ strategies = [], snapshot, flags }) {
  const matchedStrategies = Array.isArray(strategies) ? strategies.filter(Boolean) : [];
  const hasFailedBurst = matchedStrategies.includes("FailedTxBurstStrategy");
  const marketStress = Number(snapshot?.market_context?.volume_spike || 0) >= 2.5
    || Math.abs(Number(snapshot?.market_context?.price_delta_1d || 0)) >= 0.08
    || Math.abs(Number(snapshot?.market_context?.tvl_delta_1d || 0)) >= 0.1;

  if (hasFailedBurst && (flags?.admin || matchedStrategies.length >= 2)) {
    return {
      name: "EXPLOIT_LIKE_CONFLUENCE",
      score: 85,
      severity: "critical",
      reason: "Failed transaction burst aligned with privileged or multi-signal anomalous behavior."
    };
  }

  if (matchedStrategies.length >= 2 && marketStress) {
    return {
      name: "MULTI_SIGNAL_STRESS",
      score: 72,
      severity: "high",
      reason: "Multiple suspicious signals aligned with concurrent market stress."
    };
  }

  return null;
}
