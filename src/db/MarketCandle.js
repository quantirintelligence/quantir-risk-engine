import mongoose from "mongoose";

const MarketCandleSchema = new mongoose.Schema(
  {
    protocol: { type: String, required: true, index: true },
    interval: { type: String, required: true, default: "30m" },
    bucket_start: { type: Date, required: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    source: { type: String, default: "coingecko" },
    raw_points: { type: Number, default: 0 },
    is_interpolated: { type: Boolean, default: false },
    timezone: { type: String, default: "UTC" }
  },
  {
    collection: "marketcandles",
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

MarketCandleSchema.index({ protocol: 1, interval: 1, bucket_start: 1 }, { unique: true });
MarketCandleSchema.index({ protocol: 1, bucket_start: -1 });

export default mongoose.models.MarketCandle ||
  mongoose.model("MarketCandle", MarketCandleSchema);
