import strategyMetadata from "./strategyMetadata.json" with { type: "json" };

const SEVERITY_RANK = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const ADMIN_METHOD_HINTS = new Set([
  "transferownership",
  "acceptownership",
  "renounceownership",
  "upgrade",
  "upgradeto",
  "upgradetoandcall",
  "setowner",
  "setadmin",
  "changeadmin",
  "setgovernor",
  "setguardian",
  "setpendingadmin",
  "setimplementation"
]);

const TRANSFER_LIKE_METHOD_HINTS = new Set([
  "transfer",
  "transferfrom",
  "approve",
  "permit",
  "increaseallowance",
  "decreaseallowance"
]);

export function getStrategyMeta(strategyName) {
  if (!strategyName) {
    return null;
  }

  const meta = strategyMetadata?.[strategyName];
  if (!meta || typeof meta !== "object") {
    return null;
  }

  return meta;
}

function toFiniteConfidence(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }

  return Math.max(0, Math.min(1, num));
}

function pickPrimaryMeta(metadataList) {
  if (!Array.isArray(metadataList) || metadataList.length === 0) {
    return null;
  }

  return [...metadataList].sort((a, b) => {
    const severityDelta = (SEVERITY_RANK?.[b?.severity] || 0) - (SEVERITY_RANK?.[a?.severity] || 0);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const confidenceDelta = (Number(b?.base_confidence) || 0) - (Number(a?.base_confidence) || 0);
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    return 0;
  })[0];
}

function resolveWhyFlagged(meta, event) {
  if (meta?.flag !== "FLAGGED_METHOD") {
    return meta?.why_flagged;
  }

  const method = String(event?.method || event?.event || "").trim();
  if (!method) {
    return meta?.why_flagged;
  }

  const methodLower = method.toLowerCase();
  const isAdminMethod = ADMIN_METHOD_HINTS.has(methodLower);
  if (methodLower === "approve") {
    return "A whale or owner wallet granted a very large token allowance, which can enable outsized delegated token movement.";
  }

  if (!isAdminMethod) {
    return `The method '${method}' matched a configured flagged-method rule for anomaly monitoring.`;
  }

  return `The method '${method}' is commonly associated with administrative control changes.`;
}

function resolveImpactVector(meta, event) {
  if (meta?.flag !== "FLAGGED_METHOD") {
    return Array.isArray(meta?.impact_vector) ? meta.impact_vector : [];
  }

  const methodLower = String(event?.method || event?.event || "").trim().toLowerCase();
  if (!methodLower) {
    return Array.isArray(meta?.impact_vector) ? meta.impact_vector : [];
  }

  if (ADMIN_METHOD_HINTS.has(methodLower)) {
    return ["governance", "liquidity", "volatility"];
  }

  if (methodLower === "approve") {
    return ["liquidity", "delegated-spend", "volatility"];
  }

  if (TRANSFER_LIKE_METHOD_HINTS.has(methodLower)) {
    return ["liquidity", "volatility"];
  }

  return Array.isArray(meta?.impact_vector) ? meta.impact_vector : [];
}

export function buildModelExplanation(event, strategyNames = []) {
  const metadataWithStrategy = (Array.isArray(strategyNames) ? strategyNames : [])
    .map((strategyName) => ({
      strategyName,
      meta: getStrategyMeta(strategyName)
    }))
    .filter((entry) => Boolean(entry.meta));

  const metadataList = metadataWithStrategy
    .map((entry) => entry.meta)
    .filter(Boolean);

  if (metadataList.length === 0) {
    return null;
  }

  const primaryMeta = pickPrimaryMeta(metadataList);
  if (!primaryMeta) {
    return null;
  }

  const impactVector = Array.from(
    new Set(
      metadataWithStrategy.flatMap((entry) => resolveImpactVector(entry.meta, event))
    )
  );

  const confidences = metadataList
    .map((meta) => toFiniteConfidence(meta.base_confidence))
    .filter((value) => value !== null);

  const confidence = confidences.length > 0
    ? Number(Math.max(...confidences).toFixed(2))
    : undefined;

  return {
    type: "model",
    flag: primaryMeta.flag,
    title: primaryMeta.title,
    summary: primaryMeta.summary,
    why_flagged: resolveWhyFlagged(primaryMeta, event),
    contextual_risk: primaryMeta.contextual_risk,
    category: primaryMeta.category,
    severity: primaryMeta.severity,
    impact_vector: impactVector,
    confidence
  };
}
