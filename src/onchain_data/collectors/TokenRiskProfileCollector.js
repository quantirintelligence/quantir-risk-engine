// src/onchain_data/collectors/TokenRiskProfileCollector.js
import axios from "axios";
import { BaseCollector } from "../base/BaseCollector.js";
import { logger } from "../utils/logger.js";

export class TokenRiskProfileCollector extends BaseCollector {
    constructor(cgApiKey, config) {
        super(config.name, config);
        this.cgApiKey = cgApiKey;
    }

    buildHeaderVariants() {
        const key = String(this.cgApiKey || "").trim();
        if (!key) return [{ accept: "application/json" }];
        return [
            { accept: "application/json", "x-cg-demo-api-key": key },
            { accept: "application/json", "x-cg-pro-api-key": key }
        ];
    }

    buildNetworkCandidates(network) {
        const raw = String(network || "").trim().toLowerCase();
        const out = new Set([raw || "eth"]);
        if (raw === "eth") out.add("ethereum");
        if (raw === "ethereum") out.add("eth");
        return Array.from(out).filter(Boolean);
    }

    async collect() {
        const cfg = this.config.token_health || {};
        const { network, token_address: address, api_endpoint_root: apiRoot } = cfg;
        // Runtime network can differ from token_health.network when one protocol fan-outs into multiple scopes.
        const runtimeNetwork = String(this.config?.runtime_network || network || "").trim();

        try {
            if (!network || !address || !apiRoot || !this.cgApiKey) {
                throw new Error(`Invalid token_health config for ${this.protocolName}`);
            }

            const tokenAddress = String(address || "").toLowerCase();
            const networks = this.buildNetworkCandidates(network);
            let response;
            let lastErr;

            const headerVariants = this.buildHeaderVariants();
            for (const net of networks) {
                const url = `${apiRoot}/onchain/networks/${net}/tokens/${tokenAddress}`;
                for (const headers of headerVariants) {
                    try {
                        response = await axios.get(url, { headers, timeout: 10000 });
                        lastErr = null;
                        break;
                    } catch (firstErr) {
                        if (firstErr?.response?.status === 429) {
                            await new Promise((resolve) => setTimeout(resolve, 1200));
                            try {
                                response = await axios.get(url, { headers, timeout: 10000 });
                                lastErr = null;
                                break;
                            } catch (retryErr) {
                                lastErr = retryErr;
                            }
                        } else {
                            lastErr = firstErr;
                        }
                    }
                }
                if (response) break;
            }

            if (!response) throw lastErr || new Error("TokenRiskProfileCollector request failed");

            const data = response.data?.data?.attributes ?? {};

            const prices7d = data.prices?.last_7d || [];
            let volatility7d = null;

            if (prices7d.length > 2) {
                const mean = prices7d.reduce((a, b) => a + b, 0) / prices7d.length;
                const variance = prices7d.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices7d.length;
                volatility7d = Math.sqrt(variance) / mean;
            }

            const reservesUsd = parseFloat(data.total_reserve_in_usd || 0);

            // Simple slippage approximation (placeholder → replace with DEX calc later)
            const slippage_10k = 10000 / Math.max(reservesUsd, 1);
            const slippage_100k = 100000 / Math.max(reservesUsd, 1);

            const liquidityScore = Math.min(reservesUsd / 10_000_000, 1.0);
            const volatilityScore = volatility7d ? Math.min(volatility7d * 5, 1.0) : null;

            return this.normalizeOutput({
                collector: "TokenRiskProfileCollector",
                data: {
                    token_metadata: {
                        name: data.name,
                        symbol: data.symbol,
                        decimals: data.decimals,
                        address: data.address,
                        coingecko_id: data.coingecko_coin_id,
                    },
                    price: {
                        usd: parseFloat(data.price_usd || 0),
                        market_cap_usd: parseFloat(data.market_cap_usd || 0),
                        fdv_usd: parseFloat(data.fdv_usd || 0),
                    },
                    liquidity_risk: {
                        reserves_usd: reservesUsd,
                        slippage_10k,
                        slippage_100k,
                        liquidity_score: liquidityScore
                    },
                    market_risk: {
                        volatility_7d: volatility7d,
                        volatility_score: volatilityScore,
                        volume_usd_24h: parseFloat(data.volume_usd?.h24 || 0)
                    },
                    flags: {
                        high_price_volatility: volatilityScore > 0.8,
                        low_liquidity: liquidityScore < 0.2,
                    },
                    score_components: {
                        liquidity: liquidityScore,
                        volatility: volatilityScore
                    }
                }
            });

        } catch (err) {
            const status = err?.response?.status ?? "n/a";
            const statusText = err?.response?.statusText ?? "";
            const message = err?.message ?? "unknown error";
            const address = this.config?.token_health?.token_address ?? "n/a";

            logger.error(
                "TokenRiskProfileCollector error | protocol=%s token=%s status=%s %s message=%s",
                this.protocolName,
                address,
                status,
                statusText,
                message
            );

            // Keep the fallback price global, but avoid leaking Ethereum-only volume semantics into non-Ethereum risk.
            const fallback = await this.fetchFallbackSimplePrice({ address, network: runtimeNetwork });
            if (fallback) {
                logger.warn(
                    "TokenRiskProfileCollector fallback used | protocol=%s token=%s provider=coingecko-simple-token-price",
                    this.protocolName,
                    address
                );
                return fallback;
            }

            return this.normalizeOutput({
                collector: "TokenRiskProfileCollector",
                data: null,
                error: err.message
            });
        }
    }

    async fetchFallbackSimplePrice({ address, network }) {
        try {
            // Simple token price fallback is Ethereum-scoped; only reuse its 24h volume on Ethereum.
            const isEthereumNetwork = ["eth", "ethereum"].includes(String(network || "").trim().toLowerCase());
            const url = "https://api.coingecko.com/api/v3/simple/token_price/ethereum";
            const response = await axios.get(url, {
                params: {
                    contract_addresses: address,
                    vs_currencies: "usd",
                    include_market_cap: "true",
                    include_24hr_vol: "true"
                },
                headers: this.buildHeaderVariants()[0],
                timeout: 10_000
            });

            const row = response.data?.[String(address).toLowerCase()];
            if (!row) return null;

            return this.normalizeOutput({
                collector: "TokenRiskProfileCollector",
                data: {
                    token_metadata: {
                        address
                    },
                    price: {
                        usd: parseFloat(row.usd || 0),
                        market_cap_usd: parseFloat(row.usd_market_cap || 0),
                        fdv_usd: 0
                    },
                    liquidity_risk: {
                        reserves_usd: 0,
                        slippage_10k: 0,
                        slippage_100k: 0,
                        liquidity_score: 0
                    },
                    market_risk: {
                        volatility_7d: null,
                        volatility_score: null,
                        volume_usd_24h: isEthereumNetwork ? parseFloat(row.usd_24h_vol || 0) : 0
                    },
                    flags: {
                        high_price_volatility: false,
                        low_liquidity: false
                    },
                    score_components: {
                        liquidity: 0,
                        volatility: null
                    },
                    unavailable: true,
                    fallback: "coingecko-simple-token-price",
                    fallback_volume_scope: isEthereumNetwork ? "ethereum" : "disabled_for_non_ethereum"
                }
            });
        } catch {
            return null;
        }
    }
}
