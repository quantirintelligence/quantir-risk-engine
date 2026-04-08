import BoostOnLargeWhaleShift from "./BoostOnLargeWhaleShift.js";
import BoostOnLiquidityShock from "./BoostOnLiquidityShock.js";
import FlaggedMethodsStrategy from "./FlaggedMethodsStrategy.js";
import OwnerAdminActionStrategy from "./OwnerAdminActionStrategy.js";
import WhaleLargeTransferStrategy from "./WhaleLargeTransferStrategy.js";
import FailedTxBurstStrategy from "./FailedTxBurstStrategy.js";
import { buildModelExplanation } from "./meta/index.js";

export default class RiskStrategyManager {
  constructor(protocolConfig, registry) {
    this.protocolConfig = protocolConfig;
    this.registry = registry;

    this.strategies = [
      new BoostOnLargeWhaleShift(this.protocolConfig?.whaleTransferMin),
      new BoostOnLiquidityShock(this.protocolConfig?.liquidityShockAmount),
      new FlaggedMethodsStrategy(),
      new OwnerAdminActionStrategy(),
      new WhaleLargeTransferStrategy(),
      new FailedTxBurstStrategy()
    ]
  }

  async handle(event, snapshot) {
    const triggered = [];
    const ctx = { protocol: this.protocolConfig, registry: this.registry }

    for (const strategy of this.strategies) {
      if (!strategy.shouldTrigger(event, ctx)) {
        continue;
      }

      const beforeScore = Number(snapshot?.risk?.score || 0);
      const beforeFlags = Array.isArray(snapshot?.risk?.flags)
        ? snapshot.risk.flags.length
        : 0;

      const updated = await strategy.execute(event, snapshot, ctx);
      snapshot = updated;
      const afterScore = Number(snapshot?.risk?.score || 0);
      const afterFlags = Array.isArray(snapshot?.risk?.flags)
        ? snapshot.risk.flags.length
        : 0;

      // Count as triggered only if strategy actually changed the risk snapshot.
      if (afterScore !== beforeScore || afterFlags > beforeFlags) {
        triggered.push(strategy.constructor.name);
      }
    }

    return {
      triggered: triggered.length > 0,
      strategies: triggered,
      explanation: buildModelExplanation(event, triggered),
      snapshot
    };
  }
}
