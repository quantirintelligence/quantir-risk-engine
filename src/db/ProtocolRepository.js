// src/db/repositories/ProtocolRepository.js
import Protocol from "../models/Protocol.js";

class ProtocolRepository {
    static async upsertProtocol(protocolData) {
        return Protocol.findOneAndUpdate(
            { protocol: protocolData.protocol },
            { $set: protocolData },
            { upsert: true, new: true }
        );
    }

    static async getProtocol(protocol) {
        return Protocol.findOne({ protocol });
    }

    static async exists(protocol) {
        const count = await ProtocolSnapshot.countDocuments({ protocol });
        return count > 0;
    }

    static async getLastN(protocol, limit = 7) {
        return ProtocolSnapshot
            .find({ protocol })
            .sort({ snapshot_at: -1 })
            .limit(limit)
            .lean();
    }
}

export default ProtocolRepository;
