// src/db/models/ProtocolSnapshot.js
import mongoose from "mongoose";

const CollectorResultSchema = new mongoose.Schema(
  {
    collected_at: { type: Date, required: true },
    data: mongoose.Schema.Types.Mixed,
    error: String
  },
  { _id: false }
);

const ProtocolSnapshotSchema = new mongoose.Schema({
  protocol: { type: String, index: true },
  network: { type: String, default: null, index: true },
  snapshot_at: { type: Date, required: true },

  collectors: {
    type: Map,
    of: CollectorResultSchema
  },

  derived: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  risk: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  risk_forecast: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  }
});
    
ProtocolSnapshotSchema.index({ protocol: 1, network: 1, snapshot_at: -1 });

export default mongoose.models.ProtocolSnapshot ||
  mongoose.model("ProtocolSnapshot", ProtocolSnapshotSchema);
