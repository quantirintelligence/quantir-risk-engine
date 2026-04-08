import ProtocolChartPayload from "./ProtocolChartPayload.js";

class ProtocolChartPayloadRepository {
  // Persist precomputed chart payloads per protocol+network scope.
  static async save({
    protocol,
    network = null,
    chartEndTimestamp = null,
    chartSeriesByRange = {},
    source = "precomputed"
  }) {
    if (!protocol) return null;
    return ProtocolChartPayload.findOneAndUpdate(
      { protocol, network },
      {
        $set: {
          network,
          chart_end_timestamp: chartEndTimestamp ? new Date(chartEndTimestamp) : null,
          chart_series_by_range: chartSeriesByRange,
          source
        }
      },
      {
        upsert: true,
        new: true
      }
    );
  }
}

export default ProtocolChartPayloadRepository;
