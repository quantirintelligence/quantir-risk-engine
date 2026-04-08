import { getStrategyMeta } from "./meta/index.js";
import { resolveEventAmountUsd } from "./utils/eventAmount.js";

const TRANSFER_LIKE_METHODS = new Set(["transfer", "transferfrom"]);

function isTransferLikeMethod(event) {
  const method = String(event?.method || event?.event || "").trim().toLowerCase();
  return TRANSFER_LIKE_METHODS.has(method);
}

class WhaleLargeTransferStrategy {
  shouldTrigger(event, ctx) {
    if (!isTransferLikeMethod(event)) {
      return false;
    }

    return ctx.registry.isWhale(event.from);
  }

  async execute(event, snapshot, ctx) {
    const min = ctx.protocol.whaleTransferMin || 1000;
    const amountUsd = resolveEventAmountUsd(event);

    if (amountUsd < min) {
      return snapshot;
    }

    const boost = event.type === "pending" ? 0.05 : 0.15;

    snapshot.risk.score = Math.min(1, snapshot.risk.score + boost);
    snapshot.risk.flags.push("WHALE_TRANSFER");

    return snapshot;
  }
}

WhaleLargeTransferStrategy.meta = getStrategyMeta("WhaleLargeTransferStrategy");

export default WhaleLargeTransferStrategy;
