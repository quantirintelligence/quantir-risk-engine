import { getStrategyMeta } from "./meta/index.js";

class FailedTxBurstStrategy {
  constructor() {
    this.cache = new Map();
  }

  shouldTrigger(event) {
    return event.type === "failed";
  }

  async execute(event, snapshot) {
    const now = Date.now();

    const arr = this.cache.get(event.from) || [];
    arr.push(now);

    const recent = arr.filter((t) => now - t < 60000);

    this.cache.set(event.from, recent);

    if (recent.length < 5) {
      return snapshot;
    }

    snapshot.risk.score = Math.min(1, snapshot.risk.score + 0.2);
    snapshot.risk.flags.push("FAILED_TX_BURST");

    return snapshot;
  }
}

FailedTxBurstStrategy.meta = getStrategyMeta("FailedTxBurstStrategy");

export default FailedTxBurstStrategy;
