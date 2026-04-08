import { getStrategyMeta } from "./meta/index.js";
import { resolveEventAmountUsd } from "./utils/eventAmount.js";

const TRANSFER_LIKE_METHODS = new Set(["transfer", "transferfrom"]);
const LARGE_ALLOWANCE_METHODS = new Set(["approve"]);

function normalizeMethod(value) {
  return String(value || "").trim().toLowerCase();
}

class FlaggedMethodsStrategy {
  shouldTrigger(event, ctx) {
    const method = normalizeMethod(event.method);
    const flagged = new Set(
      (ctx.protocol.flaggedMethods || []).map(normalizeMethod).filter(Boolean)
    );

    if (!flagged.has(method)) {
      return false;
    }

    if (LARGE_ALLOWANCE_METHODS.has(method)) {
      const amountUsd = resolveEventAmountUsd(event);
      const min = Number(ctx.protocol.whaleTransferMin ?? 1000);
      const whaleOrOwner = ctx.registry.isWhale(event.from) || ctx.registry.isOwner(event.from);

      if (!whaleOrOwner) {
        return false;
      }

      if (!Number.isFinite(amountUsd) || !Number.isFinite(min)) {
        return false;
      }

      return amountUsd >= min;
    }

    if (!TRANSFER_LIKE_METHODS.has(method)) {
      return true;
    }

    const amountUsd = resolveEventAmountUsd(event);
    const min = Number(ctx.protocol.whaleTransferMin ?? 1000);

    if (!Number.isFinite(amountUsd) || !Number.isFinite(min)) {
      return false;
    }

    return amountUsd >= min;
  }

  async execute(event, snapshot) {
    const boost = event.type === "pending" ? 0.05 : 0.1;

    snapshot.risk.score = Math.min(1, snapshot.risk.score + boost);
    snapshot.risk.flags.push("FLAGGED_METHOD");

    return snapshot;
  }
}

FlaggedMethodsStrategy.meta = getStrategyMeta("FlaggedMethodsStrategy");

export default FlaggedMethodsStrategy;
