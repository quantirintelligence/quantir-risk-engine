import { getStrategyMeta } from "./meta/index.js";

function normalizeMethod(value) {
  return String(value || "").trim().toLowerCase();
}

class OwnerAdminActionStrategy {
  shouldTrigger(event, ctx) {
    const method = normalizeMethod(event.method);
    const adminMethods = new Set(
      (ctx.protocol.adminMethods || []).map(normalizeMethod).filter(Boolean)
    );
    const isAdmin = adminMethods.has(method);

    if (!isAdmin) {
      return false;
    }

    return ctx.registry.isOwner(event.from);
  }

  async execute(event, snapshot) {
    snapshot.risk.score = Math.min(1, snapshot.risk.score + 0.3);
    snapshot.risk.flags.push("OWNER_ADMIN_ACTION");

    return snapshot;
  }
}

OwnerAdminActionStrategy.meta = getStrategyMeta("OwnerAdminActionStrategy");

export default OwnerAdminActionStrategy;
