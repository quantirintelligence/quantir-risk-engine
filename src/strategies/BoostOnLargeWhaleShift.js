import { ZERO_ADDRESS } from "./utils/constants.js";
import { getStrategyMeta } from "./meta/index.js";
import { resolveEventAmountUsd } from "./utils/eventAmount.js";

const TRANSFER_LIKE_METHODS = new Set(["transfer", "transferfrom"]);

function isTransferLikeMethod(event) {
  const method = String(event?.method || event?.event || "").trim().toLowerCase();
  return TRANSFER_LIKE_METHODS.has(method);
}

class BoostOnLargeWhaleShift {
  constructor(threshold = 1000) {
    const numericThreshold = Number(threshold);
    this.threshold = Number.isFinite(numericThreshold) ? numericThreshold : 1000;
  }

  shouldTrigger(event, ctx) {
    if (!isTransferLikeMethod(event)) {
      return false;
    }

    const whaleSender = ctx.registry.isWhale(event.from);
    const whaleReseiver = ctx.registry.isWhale(event.to);
    const mint = event.from === ZERO_ADDRESS;

    return whaleSender || whaleReseiver || mint;
  }

  async execute(event, snapshot) {
    const amountUsd = resolveEventAmountUsd(event);
    if (amountUsd < this.threshold) {
      return snapshot;
    }

    snapshot.risk.score = Math.min(1, snapshot.risk.score + 0.1);
    snapshot.risk.flags.push("WHALE_SHIFT");

    return snapshot;
  }
}

BoostOnLargeWhaleShift.meta = getStrategyMeta("BoostOnLargeWhaleShift");

export default BoostOnLargeWhaleShift;
