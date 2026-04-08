import TxRiskEvent from "./TxRiskEvent.js";

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class TxRiskEventRepository {
  static async save(event) {
    const data = event?.data || {};
    const explanation =
      event?.explanation && typeof event.explanation === "object"
        ? event.explanation
        : undefined;
    const matchedStrategies = Array.isArray(event?.matched_strategies)
      ? event.matched_strategies.filter(Boolean)
      : [];

    return TxRiskEvent.create({
      protocol: event?.protocol ?? "none",
      source: event?.source ?? "tx_stream",
      type: data.type ?? "confirmed",
      method: data.method,
      event: data.event,
      from: data.from,
      to: data.to,
      amount: data.amount,
      amount_usd: data.amount_usd,
      tx_hash: data.tx_hash ?? data.hash,
      matched_strategies: matchedStrategies,
      explanation,
      observed_at: data.observed_at ?? new Date()
    });
  }

  static async getLatestByProtocol(protocol, limit = 100) {
    return TxRiskEvent.find({ protocol })
      .sort({ observed_at: -1 })
      .limit(limit)
      .lean();
  }

  static async getLatest(limit = 100) {
    return TxRiskEvent.find({})
      .sort({ observed_at: -1 })
      .limit(limit)
      .lean();
  }

  static async getLatestByProtocols(protocols, limit = 100) {
    const values = Array.isArray(protocols)
      ? protocols.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    if (values.length === 0) return [];

    const caseInsensitiveMatch = values.map((value) => ({
      protocol: { $regex: `^${escapeRegex(value)}$`, $options: "i" }
    }));

    return TxRiskEvent.find({ $or: caseInsensitiveMatch })
      .sort({ observed_at: -1 })
      .limit(limit)
      .lean();
  }

  static async getLargeTransfers(protocol, minAmount) {
    return TxRiskEvent.find({
      protocol,
      amount: { $gte: minAmount }
    })
      .sort({ observed_at: -1 })
      .lean();
  }

  static async getByProtocolSince(protocol, since, limit = 500) {
    return TxRiskEvent.find({
      protocol,
      observed_at: { $gte: since }
    })
      .sort({ observed_at: -1 })
      .limit(Math.max(1, Number(limit) || 500))
      .lean();
  }
}

export default TxRiskEventRepository;
