import axios from "axios";

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class ThresholdsResolver {
  constructor(options = {}) {
    this.options = options;
  }

  async resolve({
    protocolSlug,
    protocolName,
    tokenAddress,
    defillamaTvlUsd,
    coingeckoApiKey = process.env.COINGECKO_KEY
  }) {
    const [tvlUsd, tokenPriceUsd, dexLiquidityUsd] = await Promise.all([
      this.resolveTvl({ protocolSlug, protocolName, initialValue: defillamaTvlUsd }),
      this.resolveTokenPrice({ tokenAddress, coingeckoApiKey }),
      this.resolveDexLiquidity({ tokenAddress })
    ]);

    const whaleTransferMin = this.computeWhaleTransferMin({
      tvlUsd,
      tokenPriceUsd
    });

    const liquidityShockAmount = this.computeLiquidityShock({
      whaleTransferMin,
      dexLiquidityUsd
    });

    return {
      whaleTransferMin,
      liquidityShockAmount
    };
  }

  computeWhaleTransferMin({ tvlUsd, tokenPriceUsd }) {
    const effectiveTvl = toNumber(tvlUsd, 0);
    const effectivePrice = toNumber(tokenPriceUsd, 0);

    const whaleUsdThreshold = clamp(
      Math.max(50_000, effectiveTvl * 0.001),
      50_000,
      2_500_000
    );

    if (effectivePrice <= 0) return 1000;

    const tokens = whaleUsdThreshold / effectivePrice;
    return Math.round(clamp(tokens, 1000, 1_000_000));
  }

  computeLiquidityShock({ whaleTransferMin, dexLiquidityUsd }) {
    const fallback = Math.max(whaleTransferMin * 5, 5000);
    const liq = toNumber(dexLiquidityUsd, 0);
    if (!liq) return fallback;

    const basedOnLiquidity = Math.round(liq * 0.01);
    return Math.max(fallback, basedOnLiquidity);
  }

  async resolveTvl({ protocolSlug, protocolName, initialValue }) {
    if (Number.isFinite(initialValue)) return initialValue;
    try {
      const res = await axios.get("https://api.llama.fi/protocols", {
        timeout: 15_000
      });
      const protocols = Array.isArray(res.data) ? res.data : [];

      const slug = String(protocolSlug || "").toLowerCase();
      const name = String(protocolName || "").toLowerCase();

      const match = protocols.find((p) => {
        const pSlug = String(p?.slug || "").toLowerCase();
        const pName = String(p?.name || "").toLowerCase();
        return pSlug === slug || pName === name;
      });

      return toNumber(match?.tvl, 0);
    } catch {
      return 0;
    }
  }

  async resolveTokenPrice({ tokenAddress, coingeckoApiKey }) {
    if (!tokenAddress) return 0;
    try {
      const res = await axios.get(
        "https://api.coingecko.com/api/v3/simple/token_price/ethereum",
        {
          params: {
            contract_addresses: tokenAddress,
            vs_currencies: "usd"
          },
          headers: coingeckoApiKey
            ? {
                accept: "application/json",
                "x-cg-demo-api-key": coingeckoApiKey
              }
            : { accept: "application/json" },
          timeout: 15_000
        }
      );

      const row = res?.data?.[String(tokenAddress).toLowerCase()];
      return toNumber(row?.usd, 0);
    } catch {
      return 0;
    }
  }

  async resolveDexLiquidity({ tokenAddress }) {
    if (!tokenAddress) return 0;
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
      const res = await axios.get(url, { timeout: 15_000 });
      const pairs = Array.isArray(res?.data?.pairs) ? res.data.pairs : [];

      return pairs.reduce((acc, pair) => {
        return acc + toNumber(pair?.liquidity?.usd, 0);
      }, 0);
    } catch {
      return 0;
    }
  }
}
