import ProtocolRiskExplanation from "./ProtocolRiskExplanation.js";

class ProtocolRiskExplanationRepository {
  static async existsByRisk(protocol, riskScore) {
    const normalizedRisk = Number(riskScore);
    if (!Number.isFinite(normalizedRisk)) {
      return false;
    }

    const found = await ProtocolRiskExplanation.findOne({
      protocol,
      risk_score: normalizedRisk
    })
      .select({ _id: 1 })
      .lean();

    return Boolean(found);
  }

  static async save(payload) {
    return ProtocolRiskExplanation.create(payload);
  }

  static async getLatestByProtocol(protocol, limit = 10) {
    return ProtocolRiskExplanation.find({ protocol })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean();
  }
}

export default ProtocolRiskExplanationRepository;
