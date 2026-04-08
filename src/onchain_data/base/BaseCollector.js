import { CollectorEnvelope } from "./CollectorEnvelope.js";

export class BaseCollector {
  constructor(protocolName, config) {
    this.protocolName = protocolName;
    this.config = config;
  }

  normalizeOutput({ collector, data, error = null }) {
    return CollectorEnvelope.wrap({
      protocol: this.protocolName,
      collector,
      data,
      error
    });
  }
}
