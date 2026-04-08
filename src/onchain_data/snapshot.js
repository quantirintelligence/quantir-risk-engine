import dotenv from "dotenv";

import MongoConnection from "../db/Mongo.js";
import ProtocolSnapshotBuilder from "../db/ProtocolSnapshotBuilder.js";
import ProtocolSnapshotRepository from "../db/ProtocolSnapshotRepository.js";
import { TVLCollector } from "./collectors/TVLCollector.js";
import { WhaleCollector } from "./collectors/WhaleCollector.js";
import { TokenRiskProfileCollector } from "./collectors/TokenRiskProfileCollector.js";
import { loadProtocolsConfig } from "./utils/protocolConfig.js";
import { logger } from "./utils/logger.js";

dotenv.config();

const protocolSlug = String(process.argv[2] || process.env.PUBLIC_SNAPSHOT_PROTOCOL || "uniswapv3")
  .trim()
  .toLowerCase();
const cgApiKey = process.env.COINGECKO_KEY || "";

async function main() {
  const { data: config } = await loadProtocolsConfig();
  const protocolConfig = config?.[protocolSlug];

  if (!protocolConfig) {
    throw new Error(`Unknown protocol slug: ${protocolSlug}`);
  }

  await MongoConnection.connect(process.env.MONGODB_URI, process.env.MONGODB_DB);

  const builder = new ProtocolSnapshotBuilder(protocolSlug);
  const collectors = [
    new WhaleCollector(cgApiKey, protocolConfig),
    new TVLCollector(protocolConfig),
    new TokenRiskProfileCollector(cgApiKey, protocolConfig)
  ];

  for (const collector of collectors) {
    const result = await collector.collect();
    builder.add(result);
  }

  await ProtocolSnapshotRepository.save(builder.build());
  logger.info("Public one-shot snapshot saved | protocol=%s", protocolSlug);
}

main().catch((error) => {
  logger.error("Public snapshot script failed: %o", error);
  process.exit(1);
});
