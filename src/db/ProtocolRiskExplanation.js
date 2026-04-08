import mongoose from "mongoose";

const ProtocolRiskExplanationSchema = new mongoose.Schema(
  {
    protocol: {
      type: String,
      required: true,
      index: true
    },

    risk_score: {
      type: Number,
      required: true,
      index: true
    },

    summary: {
      type: String,
      default: ""
    },

    why_now: {
      type: String,
      default: ""
    },

    key_drivers: {
      type: [String],
      default: []
    },

    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null
    },

    window_start: {
      type: Date,
      required: true,
      index: true
    },

    window_end: {
      type: Date,
      required: true,
      index: true
    },

    snapshot_at: {
      type: Date,
      index: true
    },

    model: {
      type: String,
      default: ""
    },

    context_counts: {
      snapshots: {
        type: Number,
        default: 0
      },
      transactions: {
        type: Number,
        default: 0
      }
    },

    created_at: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    versionKey: false,
    collection: "protocol_risk_explanations"
  }
);

ProtocolRiskExplanationSchema.index({ protocol: 1, created_at: -1 });
ProtocolRiskExplanationSchema.index({ protocol: 1, risk_score: 1 }, { unique: true });

export default mongoose.models.ProtocolRiskExplanation ||
  mongoose.model("ProtocolRiskExplanation", ProtocolRiskExplanationSchema);
