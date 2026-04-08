function getCollectorData(snapshot, key) {
  if (!snapshot?.collectors) return null;
  if (typeof snapshot.collectors.get === "function") {
    return snapshot.collectors.get(key)?.data || null;
  }
  return snapshot.collectors?.[key]?.data || null;
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function toRiskScore(snapshot) {
  const score = Number(snapshot?.risk?.score || 0);
  return Number.isFinite(score) ? score : 0;
}

export class ContextBuilder {
  build({
    protocol,
    requestSource = "auto",
    triggerDecision,
    triggerType,
    triggerName,
    event = null,
    snapshot = null,
    previousSnapshot = null,
    strategies = [],
    flags = {}
  }) {
    const tvlData = getCollectorData(snapshot, "TVLCollector");
    const tokenData = getCollectorData(snapshot, "TokenRiskProfileCollector");
    const currentRisk = toRiskScore(snapshot);
    const previousRisk = previousSnapshot ? toRiskScore(previousSnapshot) : 0;

    return {
      schema_version: 1,
      protocol: String(protocol || "").trim().toLowerCase(),
      event_id: String(event?._id || event?.tx_hash || `${protocol}:${triggerType}:${Date.now()}`),
      request_source: requestSource,
      trigger: {
        type: String(triggerType || ""),
        name: String(triggerName || ""),
        severity: String(triggerDecision?.severity || ""),
        score: Number(triggerDecision?.score || 0),
        reason: String(triggerDecision?.primary_reason || ""),
        matched_rules: Array.isArray(triggerDecision?.matched_rules) ? triggerDecision.matched_rules : [],
        matched_strategies: Array.isArray(strategies) ? strategies : [],
        source: requestSource === "manual" ? "api" : "onchain-engine"
      },
      current_risk: {
        score: currentRisk,
        previous_score: previousRisk,
        delta: currentRisk - previousRisk
      },
      transaction: event
        ? {
          tx_hash: String(event?.tx_hash || ""),
          type: String(event?.type || ""),
          method: String(event?.method || event?.event || ""),
          from: String(event?.from || ""),
          to: String(event?.to || ""),
          amount: Number(event?.amount || 0),
          amount_usd: Number(event?.amount_usd || 0),
          observed_at: toIso(event?.observed_at)
        }
        : null,
      market_context: {
        tvl: Number(tvlData?.tvl_usd || 0),
        tvl_delta_1d: Number(snapshot?.derived?.tvl_delta_1d || 0),
        price_delta_1d: Number(snapshot?.derived?.price_delta_1d || 0),
        volume_spike: Number(snapshot?.derived?.volume_spike || 0)
      },
      flags: {
        whale: Boolean(flags?.whale),
        admin: Boolean(flags?.admin),
        protocol_contract: Boolean(flags?.protocol_contract)
      },
      triggered_strategies: Array.isArray(strategies) ? strategies : [],
      observed_at: toIso(event?.observed_at || snapshot?.snapshot_at),
      latest_price_usd: Number(tokenData?.price?.usd || 0)
    };
  }
}

export default ContextBuilder;
