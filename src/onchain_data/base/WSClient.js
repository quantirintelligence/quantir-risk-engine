import WebSocket from "ws";
import { EventEmitter } from "events";
import { logger } from "../utils/logger.js";

export class WSClient extends EventEmitter {
  constructor(wsUrl, options = {}) {
    super();
    this.wsUrl = wsUrl;
    this.ws = null;
    this.label = String(options.label || "ws");
    this.reconnectDelayMs = Math.max(500, Number(options.reconnectDelayMs || 3000));
    this.reconnectAttempts = 0;
  }

  connect() {
    logger.info(
      "[%s] Connecting WebSocket: %s (attempt=%d)",
      this.label,
      this.wsUrl,
      this.reconnectAttempts + 1
    );
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on("open", () => {
      this.reconnectAttempts = 0;
      logger.info("[%s] WS opened", this.label);
      this.onOpen?.();
    });

    this.ws.on("message", (data) => {
      try {
        const json = JSON.parse(data.toString());
        this.onMessage?.(json);
      } catch (err) {
        logger.error("[%s] WS message error: %o", this.label, err);
      }
    });

    this.ws.on("close", (code, reasonBuffer) => {
      this.reconnectAttempts += 1;
      const reason =
        reasonBuffer && Buffer.isBuffer(reasonBuffer)
          ? reasonBuffer.toString("utf8").trim()
          : String(reasonBuffer || "").trim();
      logger.warn(
        "[%s] WS closed (code=%s reason=%s) → reconnecting in %dms",
        this.label,
        String(code ?? "n/a"),
        reason || "n/a",
        this.reconnectDelayMs
      );
      setTimeout(() => this.connect(), this.reconnectDelayMs);
    });

    this.ws.on("error", (err) => {
      logger.error("[%s] WS error: %o", this.label, err);
    });
  }

  send(payload) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }
}
