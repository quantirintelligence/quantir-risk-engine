// src/db/models/Protocol.js
import mongoose from "mongoose";

const ProtocolSchema = new mongoose.Schema(
    {
        protocol: { type: String, required: true, unique: true, index: true }, // "slug"
        name: { type: String, required: true },

        enabled: { type: Boolean, default: true, index: true },

        networks: { type: [String], default: [] },
        contracts: { type: [String], default: [] },
        flaggedMethods: { type: [String], default: [] },
        adminMethods: { type: [String], default: [] },

        collectors: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        metadata: {
            website: String,
            category: String
        }
    },
    { timestamps: true }
);

export default mongoose.models.Protocol ||
    mongoose.model("Protocol", ProtocolSchema);
