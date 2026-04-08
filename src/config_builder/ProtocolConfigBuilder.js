import fs from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import { AbiMethodResolver } from "./resolver/AbiMethodResolver.js";
import { ContractResolver } from "./resolver/ContractResolver.js";
import { OwnerResolver } from "./resolver/OwnerResolver.js";
import { ThresholdsResolver } from "./resolver/ThresholdsResolver.js";
import { WhaleResolver } from "./resolver/WhaleResolver.js";

async function loadEnvFromRoot() {
  try {
    const rootEnvPath = path.resolve(process.cwd(), ".env");
    const raw = await fs.readFile(rootEnvPath, "utf-8");
    const lines = raw.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;

      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // no-op: .env is optional
  }
}

const DEFAULT_FLAGGED_METHODS = [
  "upgradeTo",
  "transferOwnership",
  "approve",
  "transfer",
  "Transfer"
];

const DEFAULT_ADMIN_METHODS = [
  "upgradeTo",
  "transferOwnership"
];

function isAddress(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function normalizeAddress(value) {
  return isAddress(value) ? value.toLowerCase() : null;
}

function uniqAddresses(values = []) {
  return [...new Set(values.map(normalizeAddress).filter(Boolean))];
}

function parseArgValue(argv, key) {
  const idx = argv.indexOf(key);
  return idx >= 0 ? argv[idx + 1] : undefined;
}

function parseCsv(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export class ProtocolConfigBuilder {
  constructor(options = {}) {
    this.options = options;
    this.contractResolver = new ContractResolver(options);
    this.abiMethodResolver = new AbiMethodResolver(options);
    this.ownerResolver = new OwnerResolver(options);
    this.thresholdsResolver = new ThresholdsResolver(options);
    this.whaleResolver = new WhaleResolver(options);
  }

  async build(params) {
    const payload = this.validateParams(params);
    const {
      slug,
      name,
      symbol,
      network,
      tokenAddress,
      contracts,
      etherscanApiKey,
      whaleProviders
    } = payload;

    const contractData = await this.contractResolver.resolve({
      protocolSlug: slug,
      protocolName: name,
      protocolSymbol: symbol,
      network,
      tokenAddress,
      seedContracts: contracts
    });

    const addressesForAbi = uniqAddresses([
      ...contractData.contracts,
      ...contractData.protocolContracts
    ]);

    const abiData = await this.abiMethodResolver.resolve({
      contracts: addressesForAbi,
      network,
      chainId: contractData.chainId,
      etherscanApiKey
    });

    const ownerData = await this.ownerResolver.resolve({
      contracts: addressesForAbi,
      sourceByAddress: abiData.sourceByAddress
    });

    const whaleData = await this.whaleResolver.resolve({
      tokenAddress,
      network,
      topN: 10,
      providerOrder: whaleProviders
    });

    const thresholds = await this.thresholdsResolver.resolve({
      protocolSlug: contractData.tvl.id,
      protocolName: name,
      tokenAddress,
      defillamaTvlUsd: contractData.defillama?.tvl
    });

    const protocolContracts = uniqAddresses([
      ...contractData.protocolContracts,
      ...ownerData.protocolContracts
    ]);

    const flaggedMethods = abiData.flaggedMethods?.length
      ? abiData.flaggedMethods
      : DEFAULT_FLAGGED_METHODS;

    const adminMethods = abiData.adminMethods?.length
      ? abiData.adminMethods
      : DEFAULT_ADMIN_METHODS;

    const owners = uniqAddresses(ownerData.owners);
    const finalContracts = uniqAddresses(contractData.contracts.length ? contractData.contracts : [tokenAddress]);

    const protocolConfig = {
      name,
      contracts: finalContracts,
      flaggedMethods,
      adminMethods,
      protocolContracts,
      whales: whaleData.whales,
      owners,
      whaleTransferMin: thresholds.whaleTransferMin,
      liquidityShockAmount: thresholds.liquidityShockAmount,
      tvl: contractData.tvl,
      whale: {
        provider: "coingecko",
        network,
        token_address: tokenAddress,
        api_endpoint_root: "https://api.coingecko.com/api/v3"
      },
      token_health: {
        provider: "coingecko",
        network,
        token_address: tokenAddress,
        api_endpoint_root: "https://api.coingecko.com/api/v3"
      },
      metadata: {
        generatedBy: "ProtocolConfigBuilder",
        generatedAt: new Date().toISOString(),
        whaleSource: whaleData.source
      }
    };

    return {
      [slug]: protocolConfig
    };
  }

  async writeToFile({ outputPath, config, merge = true }) {
    const absPath = path.resolve(outputPath);
    let payload = config;

    if (merge) {
      const existing = await this.readJsonFile(absPath);
      payload = { ...existing, ...config };
    }

    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
    return absPath;
  }

  async readJsonFile(filePath) {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  validateParams(params = {}) {
    const slug = String(params.slug || "").trim();
    const name = String(params.name || "").trim();
    const network = String(params.network || "eth").trim();
    const tokenAddress = normalizeAddress(params.tokenAddress);
    const symbol = String(params.symbol || "").trim();
    const contracts = uniqAddresses(params.contracts || []);
    const whaleProviders = Array.isArray(params.whaleProviders)
      ? params.whaleProviders
      : [];

    if (!slug) {
      throw new Error("Protocol slug is required");
    }
    if (!name) {
      throw new Error("Protocol name is required");
    }
    if (!tokenAddress) {
      throw new Error("Valid tokenAddress is required");
    }

    return {
      slug,
      name,
      symbol,
      network,
      tokenAddress,
      contracts: contracts.length ? contracts : [tokenAddress],
      etherscanApiKey: params.etherscanApiKey || process.env.ETHERSCAN_API_KEY,
      whaleProviders
    };
  }
}

async function runCli() {
  await loadEnvFromRoot();

  const argv = process.argv.slice(2);
  const slug = parseArgValue(argv, "--slug");
  const name = parseArgValue(argv, "--name");
  const symbol = parseArgValue(argv, "--symbol");
  const tokenAddress = parseArgValue(argv, "--token");
  const network = parseArgValue(argv, "--network") || "eth";
  const contractsRaw = parseArgValue(argv, "--contracts");
  const whaleProvidersRaw = parseArgValue(argv, "--whale-providers");
  const etherscanApiKey = parseArgValue(argv, "--etherscan-key");
  const outputPath =
    parseArgValue(argv, "--out") || "src/onchain_data/config/protocols.json";

  const builder = new ProtocolConfigBuilder();
  const config = await builder.build({
    slug,
    name,
    symbol,
    network,
    tokenAddress,
    contracts: parseCsv(contractsRaw),
    whaleProviders: parseCsv(whaleProvidersRaw),
    etherscanApiKey
  });

  const filePath = await builder.writeToFile({
    outputPath,
    config,
    merge: true
  });

  console.log(`Protocol config saved: ${filePath}`);
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && pathToFileURL(process.argv[1]).href === pathToFileURL(__filename).href) {
  runCli().catch((err) => {
    console.error("Config build failed:", err.message);
    process.exitCode = 1;
  });
}
