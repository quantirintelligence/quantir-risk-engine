// src/db/repositories/ProtocolSnapshotRepository.js
import ProtocolSnapshot from "./ProtocolSnapshot.js";

class ProtocolSnapshotRepository {
  // Build a scope filter that keeps legacy protocol-only callers working.
  static buildScopeFilter(protocol, network = null) {
    return {
      protocol,
      ...(network ? { network } : {})
    };
  }

  static async save(snapshot) {
    return ProtocolSnapshot.create(snapshot);
  }

  static async getLatest(protocol, network = null) {
    return ProtocolSnapshot
      .findOne(this.buildScopeFilter(protocol, network))
      .sort({ snapshot_at: -1 });
  }

  static async exists(protocol, network = null) {
    const count = await ProtocolSnapshot.countDocuments(
      this.buildScopeFilter(protocol, network)
    );
    return count > 0;
  }

  static async getLastN(protocol, network = null, limit = 7) {
    return ProtocolSnapshot
      .find(this.buildScopeFilter(protocol, network))
      .sort({ snapshot_at: -1 })
      .limit(limit)
      .lean();
  }

  static async getLatestBefore(protocol, network = null, before = new Date()) {
    return ProtocolSnapshot
      .findOne({
        ...this.buildScopeFilter(protocol, network),
        snapshot_at: {
          $lte: before
        }
      })
      .sort({ snapshot_at: -1 })
      .lean();
  }

  static async getHistory(protocol, network = null, from, to) {
    return ProtocolSnapshot.find({
      ...this.buildScopeFilter(protocol, network),
      snapshot_at: {
        $gte: from,
        $lte: to
      }
    }).sort({ snapshot_at: 1 }).lean();
  }
}

export default ProtocolSnapshotRepository;
