// src/db/MongoConnection.js
import mongoose from "mongoose";
import { logger } from "../onchain_data/utils/logger.js";

class MongoConnection {
  static isConnected = false;

  static async connect(uri, dbName) {
    if (this.isConnected) {
      return;
    }

    if (!uri) {
      throw new Error("MongoConnection: uri is required");
    }

    try {
      await mongoose.connect(uri, {
        dbName,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000
      });

      this.isConnected = true;

      logger.info(
        "MongoDB connected | db=%s | host=%s",
        mongoose.connection.name,
        mongoose.connection.host
      );
    } catch (err) {
      logger.error("MongoDB connection error: %o", err);
      throw err;
    }
  }
}

export default MongoConnection;
