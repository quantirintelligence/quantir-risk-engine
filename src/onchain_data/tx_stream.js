//daemon
import dotenv from "dotenv";

import MongoConnection from "../db/Mongo.js";
import { TxBehaviourCollector } from "./collectors/TxBehaviourCollector.js";
import TxRiskEventRepository from "../db/TxRiskEventRepository.js";
import { loadProtocolsConfig } from "./utils/protocolConfig.js";

dotenv.config();
const { data: config } = await loadProtocolsConfig();

await MongoConnection.connect(
  process.env.MONGODB_URI,
  process.env.MONGODB_DB
);

const txCollector = new TxBehaviourCollector(process.env.ALCHEMY_WS_URL, config.curve);

txCollector.on("risk_event", async (event) => {
  try {
    await TxRiskEventRepository.save(event);
  } catch (err) {
    console.error("tx_stream:", err.message);
  }
});

txCollector.start();
