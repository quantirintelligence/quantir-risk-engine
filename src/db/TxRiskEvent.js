import mongoose from "mongoose";

const TxRiskEventSchema = new mongoose.Schema(
  {
    protocol: {
      type: String,
      required: true,
      index: true
    },

    source: {
      type: String,
      default: "tx_stream"
    },

    type: {
      type: String,
      enum: ["pending", "confirmed", "failed"],
      required: true,
      index: true
    },

    method: String, // pending tx
    event: String,  // log event

    from: {
      type: String,
      index: true
    },

    to: {
      type: String,
      index: true
    },

    amount: Number,
    amount_usd: Number,

    tx_hash: {
      type: String,
      required: true,
      index: true
    },

    matched_strategies: {
      type: [String],
      default: [],
      index: true
    },

    explanation: {
      type: {
        type: String,
        enum: ["deterministic", "model"],
        default: "deterministic"
      },

      flag: String,

      title: String,

      summary: String,

      why_flagged: String,

      contextual_risk: String,

      category: String,

      severity: String,

      impact_vector: {
        type: [String],
        default: []
      },

      confidence: {
        type: Number,
        min: 0,
        max: 1
      }
    },

    observed_at: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    versionKey: false,
    collection: "tx_risk_events"
  }
);

TxRiskEventSchema.index({ protocol: 1, observed_at: -1 });

export default mongoose.model("TxRiskEvent", TxRiskEventSchema);
