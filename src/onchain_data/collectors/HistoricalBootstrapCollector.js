import axios from "axios";
import { request } from "undici";

export class HistoricalBootstrapCollector {
    constructor({ protocol, cgId, llamaSlug, days = 30 }) {
        this.protocol = protocol;
        this.cgId = cgId;
        this.llamaSlug = llamaSlug;
        this.days = days;
    }

    // ---------- Public API ----------
    async run() {
        const tvlHistory = await this.fetchHistoricalTVL();
        const priceHistory = await this.fetchPriceHistory();

        if (!tvlHistory.length || !priceHistory.length) {
            return null;
        }

        const merged = this.mergeHistory(tvlHistory, priceHistory);
        const engineered = this.engineerProtocol(merged);

        if (!engineered.length) return null;

        const last = engineered[engineered.length - 1];

        return {
            tvl_delta_1d: last.tvl_delta_1d,
            tvl_delta_7d: last.tvl_delta_7d,
            price_delta_1d: last.price_delta_1d,
            price_delta_7d: last.price_delta_7d,
            volume_spike: last.volume_spike,
            mcap_tvl_ratio: last.mcap_tvl_ratio
        };
    }

    // ---------- Fetchers ----------

    async fetchPriceHistory() {
        try {
            const res = await axios.get(
                `https://api.coingecko.com/api/v3/coins/${this.cgId}/market_chart`,
                {
                    params: {
                        vs_currency: "usd",
                        days: this.days
                    }
                }
            );

            const data = res.data;

            return data.prices.map((p, i) => ({
                ts: p[0],
                price_usd: p[1],
                market_cap_usd: data.market_caps[i]?.[1] ?? null,
                volume_usd: data.total_volumes[i]?.[1] ?? null
            }));

        } catch (err) {
            console.error(`CoinGecko failed ${this.cgId}:`, err.message);
            return [];
        }
    }

    async fetchHistoricalTVL() {
        try {
            const { body } = await request(
                `https://api.llama.fi/protocol/${this.llamaSlug}`
            );

            const data = await body.json();

            const cutoff = Date.now() - this.days * 24 * 60 * 60 * 1000;

            return (data.tvl || [])
                .map(item => ({
                    ts: item.date * 1000,
                    tvl_usd: item.totalLiquidityUSD
                }))
                .filter(row => row.ts >= cutoff);

        } catch (err) {
            console.error(`DefiLlama failed ${this.llamaSlug}:`, err.message);
            return [];
        }
    }

    // ---------- Merge ----------
    mergeHistory(tvlHistory, priceHistory) {
        const priceMap = new Map(
            priceHistory.map(p => [this.normalizeDay(p.ts), p])
        );

        return tvlHistory
            .map(t => {
                const key = this.normalizeDay(t.ts);
                const price = priceMap.get(key);
                if (!price) return null;

                return {
                    ts: key,
                    tvl_usd: t.tvl_usd,
                    price_usd: price.price_usd,
                    market_cap_usd: price.market_cap_usd,
                    volume_usd: price.volume_usd
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.ts - b.ts);
    }

    // ---------- Feature Engineering ----------
    engineerProtocol(rows) {
        const result = [];

        for (let i = 7; i < rows.length; i++) {
            const today = rows[i];
            const prev1 = rows[i - 1];
            const prev7 = rows[i - 7];

            const last7Volumes = rows
                .slice(i - 7, i)
                .map(r => r.volume_usd || 0);

            const avgVol7 = this.average(last7Volumes);

            result.push({
                ts: today.ts,

                // --- TVL ---
                tvl_delta_1d: this.pctChange(today.tvl_usd, prev1.tvl_usd),
                tvl_delta_7d: this.pctChange(today.tvl_usd, prev7.tvl_usd),

                // --- PRICE ---
                price_delta_1d: this.pctChange(today.price_usd, prev1.price_usd),
                price_delta_7d: this.pctChange(today.price_usd, prev7.price_usd),

                // --- VOLUME ---
                volume_spike:
                    avgVol7 > 0
                        ? (today.volume_usd || 0) / avgVol7
                        : 0,

                // --- MCAP / TVL ---
                mcap_tvl_ratio:
                    today.tvl_usd > 0
                        ? (today.market_cap_usd || 0) / today.tvl_usd
                        : 0
            });
        }

        return result;
    }

    // ---------- Utils ----------
    pctChange(curr, prev) {
        if (!prev || prev === 0) return 0;
        return (curr - prev) / prev;
    }

    average(arr) {
        if (!arr.length) return 0;
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    normalizeDay(ts) {
        return Math.floor(ts / 86400000) * 86400000;
    }
}
