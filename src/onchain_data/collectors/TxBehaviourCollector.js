import { WebSocketProvider, Interface, formatUnits } from "ethers";
import { WSClient } from "../base/WSClient.js";
import { CollectorEnvelope } from "../base/CollectorEnvelope.js";
import { logger } from "../utils/logger.js";

const FALLBACK_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function approve(address spender, uint256 amount)",
  "function transfer(address to, uint256 amount)",
  "function transferFrom(address from, address to, uint256 amount)",
  "function transferOwnership(address newOwner)",
  "function upgradeTo(address newImplementation)",
  "function upgradeToAndCall(address newImplementation, bytes data)"
];

export class TxBehaviourCollector extends WSClient {
  constructor(wsUrl, cfg, options = {}) {
    const protocolLabel = String(cfg?.protocol || cfg?.name || "unknown");
    super(wsUrl, { label: `tx:${protocolLabel}` });
    this.cfg = cfg;
    this.options = options;
    this.targets = this.resolveTargets(cfg);
    this.targetSet = new Set(this.targets);
    this.provider = (options.watchPending || options.watchConfirmedInputs)
      ? new WebSocketProvider(wsUrl)
      : null;
    this.iface = null;
    this.ifaceKey = "";
    this.flaggedMethods = this.cfg.flaggedMethods ?? [];
    this.adminMethods = this.cfg.adminMethods ?? [];
    this.protocolName = this.cfg.name;
    this.decimals = Number.isFinite(Number(cfg?.tokenDecimals))
      ? Number(cfg.tokenDecimals)
      : 18;
    this.confirmedInputMethods = new Set(
      [...this.flaggedMethods, ...this.adminMethods]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
    );
    this.lastProcessedBlock = 0;
  }

  resolveTargets(cfg) {
    const input = [
      ...(cfg.contracts || []),
      ...(cfg.protocolContracts || [])
    ];

    return [...new Set(input.map((x) => String(x || "").toLowerCase()).filter(Boolean))];
  }

  /**
   * Emit normalized risk event
   */
  emitRisk(payload) {
    const normalized = CollectorEnvelope.wrap({
      protocol: this.protocolName,
      collector: "TxBehaviourCollector",
      data: payload
    });

    this.emit("risk_event", normalized);
  }

  getInterface() {
    const fragments = Array.isArray(this.cfg?.txAbi) && this.cfg.txAbi.length > 0
      ? this.cfg.txAbi
      : FALLBACK_ABI;
    const nextKey = fragments.join("|");
    if (this.iface && this.ifaceKey === nextKey) {
      return this.iface;
    }

    try {
      this.iface = new Interface(fragments);
      this.ifaceKey = nextKey;
    } catch {
      this.iface = new Interface(FALLBACK_ABI);
      this.ifaceKey = FALLBACK_ABI.join("|");
    }

    return this.iface;
  }

  resolveNamedArg(args, candidates = []) {
    for (const candidate of candidates) {
      if (typeof candidate === "number" && candidate in args) {
        return args[candidate];
      }
      if (typeof candidate === "string" && candidate in args) {
        return args[candidate];
      }
    }
    return null;
  }

  resolveTransferEndpoints(args) {
    const from = this.resolveNamedArg(args, ["from", "src", "_from", "sender", 0]);
    const to = this.resolveNamedArg(args, ["to", "dst", "_to", "recipient", 1]);
    return {
      from: from != null ? String(from) : "",
      to: to != null ? String(to) : ""
    };
  }

  resolveTransferRawAmount(args) {
    const value = this.resolveNamedArg(args, ["value", "wad", "amount", "_value", 2]);
    return value != null ? String(value) : null;
  }

  resolvePendingPayload(tx, method, args) {
    return this.resolveDecodedTxPayload(tx, method, args, "pending");
  }

  resolveDecodedTxPayload(tx, method, args, type = "confirmed") {
    const normalizedMethod = String(method || "").trim().toLowerCase();
    let to = String(tx?.to || "");
    let amount = 0;
    let rawAmount = null;

    if (normalizedMethod === "transfer") {
      to = this.resolveNamedArg(args, ["to", "recipient", 0]) || to;
      rawAmount = this.resolveNamedArg(args, ["amount", "value", 1]);
      amount = this.normalizeTokenAmount(rawAmount);
    } else if (normalizedMethod === "transferfrom") {
      to = this.resolveNamedArg(args, ["to", "recipient", 1]) || to;
      rawAmount = this.resolveNamedArg(args, ["amount", "value", 2]);
      amount = this.normalizeTokenAmount(rawAmount);
    } else if (normalizedMethod === "approve") {
      to = this.resolveNamedArg(args, ["spender", 0]) || to;
      rawAmount = this.resolveNamedArg(args, ["amount", "value", 1]);
      amount = this.normalizeTokenAmount(rawAmount);
    }

    return {
      type,
      method,
      from: tx.from,
      to: String(to || tx?.to || ""),
      amount: Number.isFinite(amount) ? amount : 0,
      raw_amount: rawAmount != null ? String(rawAmount) : null,
      hash: tx.hash
    };
  }

  setTokenDecimals(value) {
    const decimals = Number(value);
    if (!Number.isFinite(decimals) || decimals < 0 || decimals > 255) {
      return;
    }
    this.decimals = decimals;
  }

  normalizeTokenAmount(rawValue) {
    if (rawValue === null || rawValue === undefined) {
      return 0;
    }

    try {
      const normalized = Number(formatUnits(rawValue, this.decimals));
      return Number.isFinite(normalized) ? normalized : 0;
    } catch {
      const fallback = Number(rawValue);
      return Number.isFinite(fallback) ? fallback : 0;
    }
  }

  isTransferLikeMethod(method) {
    const normalizedMethod = String(method || "").trim().toLowerCase();
    return normalizedMethod === "transfer" || normalizedMethod === "transferfrom";
  }

  async handleConfirmedBlock(blockNumber, bDebug = false) {
    if (!this.provider) return;
    if (!Number.isFinite(Number(blockNumber)) || Number(blockNumber) <= this.lastProcessedBlock) {
      return;
    }
    this.lastProcessedBlock = Number(blockNumber);

    const block = await this.provider.getBlock(Number(blockNumber), true).catch(() => null);
    const transactions = Array.isArray(block?.transactions) ? block.transactions : [];
    for (const item of transactions) {
      const tx = typeof item === "string"
        ? await this.provider.getTransaction(item).catch(() => null)
        : item;
      if (!tx?.hash || !tx?.to || !tx?.from || !tx?.data) {
        continue;
      }

      const to = String(tx.to || "").toLowerCase();
      if (!bDebug && !this.targetSet.has(to)) {
        continue;
      }

      let decoded;
      try {
        decoded = this.getInterface().parseTransaction({ data: tx.data, value: tx.value });
      } catch {
        continue;
      }

      const method = String(decoded?.name || "").trim();
      const normalizedMethod = method.toLowerCase();
      if (!method || this.isTransferLikeMethod(method)) {
        continue;
      }
      if (this.confirmedInputMethods.size > 0 && !this.confirmedInputMethods.has(normalizedMethod)) {
        continue;
      }

      const receipt = await this.provider.getTransactionReceipt(tx.hash).catch(() => null);
      const payload = this.resolveDecodedTxPayload(
        tx,
        method,
        decoded?.args,
        Number(receipt?.status) === 0 ? "failed" : "confirmed"
      );
      this.emitRisk(payload);
    }
  }

  start(bDebug = false) {
    if (bDebug) {
      logger.warn("Debug mode enabled!");
    }

    this.connect();
    logger.info("Monitoring logs for %s", this.protocolName);

    if (this.provider) {
      this.provider.on("pending", async (txHash) => {
        if (!this.options.watchPending) return;
        const tx = await this.provider.getTransaction(txHash).catch(() => null);
        if (!bDebug && (!tx || !tx.from || !tx.to)) {
          return;
        }

        const from = String(tx.from || "").toLowerCase();
        const to = String(tx.to || "").toLowerCase();

        if (!bDebug && !this.targetSet.has(from) && !this.targetSet.has(to)) {
          return;
        }

        let decoded;
        try {
          decoded = this.getInterface().parseTransaction({ data: tx.data });
        } catch (_) {
          return;
        }

        if (!decoded) return;
        const { name: method, args } = decoded;
        if (!method || !args) return;

        this.emitRisk(this.resolvePendingPayload(tx, method, args));
      });

      this.provider.on("block", async (blockNumber) => {
        if (!this.options.watchConfirmedInputs) return;
        await this.handleConfirmedBlock(blockNumber, bDebug).catch(() => null);
      });
    }
  }

  onOpen = () => {
    const addressFilter = this.targets.length > 1 ? this.targets : this.targets[0];
    logger.info("Subscribing logs for %s contracts=%d", this.protocolName, this.targets.length);

    this.send({
      id: 10,
      method: "eth_subscribe",
      params: ["logs", { address: addressFilter }]
    });
  };

  onMessage = (msg) => {
    if (msg.method !== "eth_subscription") return;

    const log = msg.params?.result;
    if (!log?.topics) return;

    try {
      const decoded = this.getInterface().parseLog(log);
      if (decoded.name !== "Transfer") {
        return;
      }
      const transferEndpoints = this.resolveTransferEndpoints(decoded.args);
      const rawAmount = this.resolveTransferRawAmount(decoded.args);
      logger.info(
        "[%s] LOG Event: %s | hash: %s | from: %s → to: %s",
        this.protocolName,
        decoded.name,
        log.transactionHash,
        transferEndpoints.from || "n/a",
        transferEndpoints.to || "n/a"
      );

      this.emitRisk({
        type: "confirmed",
        protocol: this.protocolName,
        method: decoded.name,
        from: transferEndpoints.from,
        to: transferEndpoints.to,
        amount: this.normalizeTokenAmount(rawAmount),
        raw_amount: rawAmount,
        hash: log.transactionHash
      });
    } catch {
      // ignore out-of-ABI logs
    }
  };
}
