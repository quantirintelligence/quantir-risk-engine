import mongoose from "mongoose";

const ProtocolChartPayloadSchema = new mongoose.Schema(
  {
    protocol: { type: String, required: true, index: true },
    network: { type: String, default: null, index: true },
    chart_end_timestamp: { type: Date, default: null },
    chart_series_by_range: { type: mongoose.Schema.Types.Mixed, default: {} },
    source: { type: String, default: "precomputed" }
  },
  {
    collection: "protocolchartpayloads",
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

// Keep precomputed chart payloads scoped by protocol+network.
ProtocolChartPayloadSchema.index({ protocol: 1, network: 1 }, { unique: true });

export default mongoose.models.ProtocolChartPayload ||
  mongoose.model("ProtocolChartPayload", ProtocolChartPayloadSchema);
