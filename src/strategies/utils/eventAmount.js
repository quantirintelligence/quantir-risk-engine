function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function resolveEventAmountUsd(event, fallbackTokenPriceUsd = 0) {
  const explicitUsd = Math.abs(toFiniteNumber(event?.amount_usd, 0));
  if (explicitUsd > 0) return explicitUsd;

  const amount = Math.abs(toFiniteNumber(event?.amount, 0));
  if (amount <= 0) return 0;

  const tokenPriceUsd = Math.max(0, toFiniteNumber(event?.price_usd, fallbackTokenPriceUsd));
  if (tokenPriceUsd <= 0) return 0;

  return amount * tokenPriceUsd;
}
