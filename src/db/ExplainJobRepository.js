import ExplainJob from "./ExplainJob.js";

function normalizeStatuses(statuses) {
  return Array.isArray(statuses)
    ? statuses.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
}

class ExplainJobRepository {
  static async create(payload) {
    return ExplainJob.create(payload);
  }

  static async getById(id) {
    if (!id) return null;
    return ExplainJob.findById(id).lean();
  }

  static async getByEventId(eventId) {
    const value = String(eventId || "").trim();
    if (!value) return null;
    return ExplainJob.findOne({ event_id: value })
      .sort({ created_at: -1 })
      .lean();
  }

  static async getLatestByProtocol(protocol, limit = 10, statuses = []) {
    const query = { protocol: String(protocol || "").trim() };
    const normalizedStatuses = normalizeStatuses(statuses);
    if (normalizedStatuses.length > 0) {
      query.status = { $in: normalizedStatuses };
    }

    return ExplainJob.find(query)
      .sort({ created_at: -1 })
      .limit(Math.max(1, Number(limit) || 10))
      .lean();
  }

  static async getLatestCompletedByProtocol(protocol) {
    return ExplainJob.findOne({
      protocol: String(protocol || "").trim(),
      status: "completed"
    })
      .sort({ created_at: -1 })
      .lean();
  }

  static async getLatestCompletedListByProtocol(protocol, limit = 50) {
    return ExplainJob.find({
      protocol: String(protocol || "").trim(),
      status: "completed"
    })
      .sort({ created_at: -1 })
      .limit(Math.max(1, Number(limit) || 50))
      .lean();
  }

  static async getActiveByProtocol(protocol) {
    return ExplainJob.findOne({
      protocol: String(protocol || "").trim(),
      status: { $in: ["pending", "running"] }
    })
      .sort({ created_at: -1 })
      .lean();
  }

  static async updateStatus(id, status, extra = {}) {
    return ExplainJob.findByIdAndUpdate(
      id,
      {
        $set: {
          status,
          updated_at: new Date(),
          ...extra
        }
      },
      { new: true }
    ).lean();
  }

  static async appendAgentOutput(id, output) {
    return ExplainJob.findByIdAndUpdate(
      id,
      {
        $push: { agent_outputs: output },
        $set: { updated_at: new Date() }
      },
      { new: true }
    ).lean();
  }

  static async complete(id, { judgeResult, summary, confidence }) {
    return ExplainJob.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "completed",
          judge_result: judgeResult,
          final_summary: String(summary || ""),
          confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : null,
          completed_at: new Date(),
          updated_at: new Date(),
          last_error: ""
        }
      },
      { new: true }
    ).lean();
  }

  static async fail(id, error) {
    return ExplainJob.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "failed",
          last_error: String(error || "Unknown explain job error"),
          updated_at: new Date(),
          completed_at: new Date()
        }
      },
      { new: true }
    ).lean();
  }
}

export default ExplainJobRepository;
