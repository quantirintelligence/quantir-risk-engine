export class ExplainDispatcher {
  constructor({
    serviceUrl = process.env.EXPLAIN_SERVICE_URL || "http://127.0.0.1:8096",
    timeoutMs = Number(process.env.EXPLAIN_DISPATCH_TIMEOUT_MS || 5_000),
    enabled = process.env.EXPLAIN_ENABLED !== "0",
    logger = console
  } = {}) {
    this.serviceUrl = String(serviceUrl || "").replace(/\/+$/, "");
    this.timeoutMs = Math.max(500, Number(timeoutMs) || 5_000);
    this.enabled = Boolean(enabled);
    this.logger = logger;
  }

  async dispatch({
    protocol,
    eventId,
    requestSource = "auto",
    trigger,
    explainContext,
    requestedBy = ""
  }) {
    if (!this.enabled || !this.serviceUrl) {
      return { ok: false, skipped: true, reason: "EXPLAIN_DISABLED" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.serviceUrl}/explain`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          protocol,
          event_id: eventId,
          request_source: requestSource,
          requested_by: requestedBy,
          trigger,
          explain_context: explainContext
        })
      });

      const payload = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        status: response.status,
        payload
      };
    } catch (error) {
      this.logger.warn(
        "[explain-dispatcher] dispatch failed | protocol=%s | err=%s",
        protocol,
        String(error?.message || error || "unknown")
      );
      return {
        ok: false,
        error: String(error?.message || error || "unknown")
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export default ExplainDispatcher;
