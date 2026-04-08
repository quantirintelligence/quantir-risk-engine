import fs from "fs/promises";

import Protocol from "../db/Protocol.js";
import { logger } from "../onchain_data/utils/logger.js";
import { resolveProtocolsConfigPath } from "../onchain_data/utils/protocolConfig.js";
import { resolveProtocolNetworks } from "../onchain_data/utils/normalizeNetwork.js";

export async function initProtocolsFromConfig(protocol_Path = "src/onchain_data/config/protocols.json") {
    const configPath = resolveProtocolsConfigPath(protocol_Path);

    const raw = await fs.readFile(configPath, "utf-8");
    const cfg = JSON.parse(raw);
    const configuredSlugs = Object.keys(cfg).map((slug) => String(slug || "").trim()).filter(Boolean);

    let inserted = 0;

    for (const [slug, p] of Object.entries(cfg)) {
        // Keep DB protocol metadata in sync with additive multi-network config updates.
        const resolvedNetworks = resolveProtocolNetworks(p);

        const res = await Protocol.updateOne(
            { protocol: slug },
            {
                $set: {
                    name: p.name,
                    enabled: true,

                    networks: resolvedNetworks,
                    contracts: p.contracts ?? [],
                    flaggedMethods: p.flaggedMethods ?? [],
                    adminMethods: p.adminMethods ?? [],

                    collectors: {
                        tvl: p.tvl ?? null,
                        whale: p.whale ?? null,
                        token_health: p.token_health ?? null,
                        network_snapshot: p.network_snapshot ?? null
                    },

                    metadata: p.metadata ?? {}
                },
                $setOnInsert: {
                    protocol: slug
                }
            },
            { upsert: true }
        );

        if (res.upsertedCount === 1) inserted++;
    }

    const disableRes = await Protocol.updateMany(
        {
            protocol: { $nin: configuredSlugs },
            enabled: true
        },
        {
            $set: {
                enabled: false
            }
        }
    );

    logger.info(
        "[initProtocols] inserted=%d disabled_missing=%d",
        inserted,
        Number(disableRes?.modifiedCount || 0)
    );
}
