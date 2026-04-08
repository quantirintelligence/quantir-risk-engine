import { getStrategyMeta } from "./meta/index.js";
import { resolveEventAmountUsd } from "./utils/eventAmount.js";

const TRANSFER_LIKE_METHODS = new Set(["transfer", "transferfrom"]);

function isTransferLikeMethod(event) {
  const method = String(event?.method || event?.event || "").trim().toLowerCase();
  return TRANSFER_LIKE_METHODS.has(method);
}

class BoostOnLiquidityShock {
  constructor(threshold = 5000) {
    const numericThreshold = Number(threshold);
    this.threshold = Number.isFinite(numericThreshold) ? numericThreshold : 5000;
  }

  shouldTrigger(event, ctx) {
    if (!isTransferLikeMethod(event)) {
      return false;
    }

    return ctx.registry.isProtocolContract(event.from);
  }

  async execute(event, snapshot) {
    const amountUsd = resolveEventAmountUsd(event);
    if (amountUsd < this.threshold) {
      return snapshot;
    }

    snapshot.risk.score = Math.min(1, snapshot.risk.score + 0.15);
    snapshot.risk.flags.push("LIQUIDITY_SHOCK");

    return snapshot;
  }
}

BoostOnLiquidityShock.meta = getStrategyMeta("BoostOnLiquidityShock");

export default BoostOnLiquidityShock;
