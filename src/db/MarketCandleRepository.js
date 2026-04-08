import MarketCandle from "./MarketCandle.js";

class MarketCandleRepository {
  static async bulkUpsert(candles = []) {
    const rows = Array.isArray(candles) ? candles : [];
    if (rows.length === 0) return { upsertedCount: 0 };

    const operations = rows.map((row) => ({
      updateOne: {
        filter: {
          protocol: row.protocol,
          interval: row.interval,
          bucket_start: row.bucket_start
        },
        update: {
          $set: {
            open: row.open,
            high: row.high,
            low: row.low,
            close: row.close,
            source: row.source,
            raw_points: row.raw_points,
            is_interpolated: row.is_interpolated,
            timezone: row.timezone
          }
        },
        upsert: true
      }
    }));

    return MarketCandle.bulkWrite(operations, { ordered: false });
  }

  static async getLatestBefore(protocol, interval = "30m", before) {
    if (!protocol || !before) return null;
    return MarketCandle
      .findOne({
        protocol,
        interval,
        bucket_start: { $lt: before }
      })
      .sort({ bucket_start: -1 })
      .lean();
  }

  static async getHistory(protocol, interval = "30m", from, to) {
    return MarketCandle.find({
      protocol,
      interval,
      bucket_start: {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {})
      }
    })
      .sort({ bucket_start: 1 })
      .lean();
  }
}

export default MarketCandleRepository;
