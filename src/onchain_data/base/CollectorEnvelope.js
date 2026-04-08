// src/onchain_data/base/CollectorEnvelope.js
export class CollectorEnvelope {
  static wrap({ protocol, collector, data, error = null }) {
    return {
      protocol,
      collector,
      collected_at: new Date().toISOString(),
      data,
      ...(error ? { error } : {})
    };
  }
}
