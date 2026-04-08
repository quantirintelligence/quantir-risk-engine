import {
  evaluateAdminAction,
  evaluateCriticalCapitalMovement,
  evaluateRiskJump,
  evaluateSignalConfluence
} from "./ExplainRules.js";

function toSeverity(score) {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export class ExplainRuleEngine {
  constructor({ threshold = 70 } = {}) {
    this.threshold = Math.max(1, Number(threshold) || 70);
  }

  evaluate(context = {}) {
    const ruleMatches = [
      evaluateAdminAction(context),
      evaluateCriticalCapitalMovement(context),
      evaluateRiskJump(context),
      evaluateSignalConfluence(context)
    ].filter(Boolean);

    const totalScore = ruleMatches.reduce((maxScore, rule) => Math.max(maxScore, Number(rule?.score) || 0), 0);
    const primary = [...ruleMatches].sort((a, b) => (b?.score || 0) - (a?.score || 0))[0] || null;

    return {
      trigger: totalScore >= this.threshold,
      score: totalScore,
      severity: primary?.severity || toSeverity(totalScore),
      primary_reason: primary?.reason || "",
      matched_rules: ruleMatches.map((rule) => rule.name),
      matched_rule_details: ruleMatches
    };
  }
}

export default ExplainRuleEngine;
