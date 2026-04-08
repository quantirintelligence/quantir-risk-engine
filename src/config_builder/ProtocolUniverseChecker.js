import fs from "fs/promises";
import path from "path";
import axios from "axios";

const DEFAULT_WHALE_PROVIDERS = "ethplorer,coingecko,moralis";
const DEFAULT_OUT = "src/onchain_data/config/protocols.json";
const DEFAULT_ETHERSCAN_KEY = "<YOUR_ETHERSCAN_KEY>";

const SUPPORTED_PLATFORM_TO_NETWORK = {
  ethereum: "eth",
  "binance-smart-chain": "bsc",
  polygon: "polygon",
  "arbitrum-one": "arbitrum",
  avalanche: "avalanche"
};

const DEFAULT_TOP = 15;

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeProtocolKey(value) {
  return normalize(value)
    .replace(/v[0-9]+/g, "")
    .replace(/dex/g, "")
    .replace(/finance/g, "")
    .replace(/dao/g, "")
    .trim();
}

function safeNameForCli(name) {
  return String(name || "").replace(/[^a-zA-Z0-9]/g, "");
}

function parseArgValue(argv, key) {
  const idx = argv.indexOf(key);
  return idx >= 0 ? argv[idx + 1] : undefined;
}

function parseIntArg(argv, key, fallback) {
  const raw = parseArgValue(argv, key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCsv(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseProtocolsFromArg(raw) {
  const values = parseCsv(raw);
  return values.map((name) => {
    const words = String(name)
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .map((w) => w.trim())
      .filter(Boolean);
    return {
      key: normalize(name) || "protocol",
      name,
      aliases: [...new Set(words)]
    };
  });
}

function scoreTextMatch(queryNorm, candidateNorm) {
  if (!queryNorm || !candidateNorm) return 0;
  if (queryNorm === candidateNorm) return 100;
  if (candidateNorm.startsWith(queryNorm)) return 90;
  if (candidateNorm.includes(queryNorm)) return 70;
  if (queryNorm.includes(candidateNorm)) return 50;
  return 0;
}

function bestMatch({ queries, candidates, getCandidateTexts, minScore = 70 }) {
  let best = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const texts = getCandidateTexts(candidate)
      .map((entry) =>
        typeof entry === "string" ? { text: entry, weight: 1 } : { text: entry?.text, weight: entry?.weight ?? 1 }
      )
      .map((entry) => ({ ...entry, text: normalize(entry.text) }))
      .filter((entry) => entry.text);
    if (!texts.length) continue;
    let localBest = 0;

    for (const q of queries) {
      const qNorm = normalize(q);
      if (!qNorm) continue;
      for (const txt of texts) {
        const score = scoreTextMatch(qNorm, txt.text) * txt.weight;
        if (score > localBest) localBest = score;
      }
    }

    if (localBest > bestScore) {
      bestScore = localBest;
      best = candidate;
    }
  }

  return bestScore >= minScore ? { match: best, score: bestScore } : { match: null, score: 0 };
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function readExistingProtocolConfig() {
  const payload = await readJsonIfExists(
    path.resolve(process.cwd(), "src/onchain_data/config/protocols.json")
  );
  return payload && typeof payload === "object" ? payload : {};
}

async function fetchDefiLlamaProtocols() {
  try {
    const res = await axios.get("https://api.llama.fi/protocols", { timeout: 15_000 });
    if (Array.isArray(res.data) && res.data.length) return res.data;
  } catch {
    // fallback below
  }
  const fallback = await readJsonIfExists(path.resolve(process.cwd(), "llama_protocols.json"));
  return Array.isArray(fallback) ? fallback : [];
}

async function fetchCoinGeckoCoinList() {
  try {
    const res = await axios.get("https://api.coingecko.com/api/v3/coins/list", { timeout: 15_000 });
    if (Array.isArray(res.data) && res.data.length) return res.data;
  } catch {
    // fallback below
  }
  const fallback = await readJsonIfExists(path.resolve(process.cwd(), "coingecko_coins.json"));
  return Array.isArray(fallback) ? fallback : [];
}

async function fetchCoinGeckoCoinDetails(coinId, apiKey) {
  if (!coinId) return null;
  try {
    const headers = {};
    if (apiKey) headers["x-cg-demo-api-key"] = apiKey;
    const res = await axios.get(`https://api.coingecko.com/api/v3/coins/${coinId}`, {
      timeout: 15_000,
      headers,
      params: {
        localization: false,
        tickers: false,
        market_data: false,
        community_data: false,
        developer_data: false,
        sparkline: false
      }
    });
    return res.data || null;
  } catch {
    return null;
  }
}

function resolveSupportedContractFromDetails(coinDetails) {
  const platforms = coinDetails?.platforms || {};
  for (const [platform, contractAddress] of Object.entries(platforms)) {
    const network = SUPPORTED_PLATFORM_TO_NETWORK[platform];
    if (network && /^0x[a-fA-F0-9]{40}$/.test(String(contractAddress || ""))) {
      return { network, tokenAddress: String(contractAddress).toLowerCase(), platform };
    }
  }
  return null;
}

function findTokenFromExistingConfig(existingConfig, { queries, slug, symbol }) {
  const rows = Object.entries(existingConfig || {}).map(([cfgSlug, cfg]) => ({
    cfgSlug,
    cfg
  }));

  let winner = null;
  let winnerScore = 0;

  for (const row of rows) {
    const cfg = row.cfg || {};
    const texts = [
      row.cfgSlug,
      cfg?.name,
      cfg?.tvl?.id,
      cfg?.tvl?.symbol,
      cfg?.whale?.token_address
    ]
      .map(normalize)
      .filter(Boolean);

    let localBest = 0;
    for (const q of [...queries, slug, symbol]) {
      const qNorm = normalize(q);
      if (!qNorm) continue;
      for (const txt of texts) {
        const score = scoreTextMatch(qNorm, txt);
        if (score > localBest) localBest = score;
      }
    }

    if (localBest > winnerScore) {
      winnerScore = localBest;
      winner = row;
    }
  }

  if (!winner || winnerScore < 70) return null;

  const cfg = winner.cfg || {};
  const token =
    cfg?.whale?.token_address ||
    (Array.isArray(cfg?.contracts) ? cfg.contracts[0] : null) ||
    null;
  const network = cfg?.whale?.network || "eth";

  if (!/^0x[a-fA-F0-9]{40}$/.test(String(token || ""))) return null;

  return {
    tokenAddress: String(token).toLowerCase(),
    network,
    source: "existing_config",
    matchedSlug: winner.cfgSlug
  };
}

function buildCommand({
  slug,
  name,
  symbol,
  network,
  tokenAddress,
  whaleProviders,
  out,
  etherscanKey
}) {
  const safeName = safeNameForCli(name) || "Protocol";
  const safeSymbol = (symbol || "token").toLowerCase();
  const resolvedSlug = slug || normalize(name) || "protocol";
  const resolvedNetwork = network || "eth";
  const resolvedToken = tokenAddress || "<TOKEN_ADDRESS_REQUIRED>";
  const contracts = /^0x[a-fA-F0-9]{40}$/.test(resolvedToken) ? resolvedToken : "<CONTRACTS_REQUIRED>";

  return `node src/config_builder/ProtocolConfigBuilder.js --slug ${resolvedSlug} --name ${safeName} --symbol ${safeSymbol} --network ${resolvedNetwork} --token ${resolvedToken} --contracts ${contracts} --etherscan-key ${etherscanKey} --whale-providers ${whaleProviders} --out ${out}`;
}

function buildTargetFromLlama(llama, coin) {
  return {
    key: String(llama?.slug || llama?.name || "protocol"),
    name: String(llama?.name || coin?.name || "Protocol"),
    aliases: [llama?.slug, llama?.name, coin?.name].filter(Boolean),
    symbolHint: String(llama?.symbol || coin?.symbol || "").toLowerCase(),
    presetLlama: llama || null,
    presetCoin: coin || null
  };
}

function buildLlamaQueries(llama) {
  const name = String(llama?.name || "");
  const slug = String(llama?.slug || "");
  const symbol = String(llama?.symbol || "").toLowerCase();
  const baseName = name
    .replace(/\bv\d+\b/gi, " ")
    .replace(/\bdex\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const baseSlug = slug
    .replace(/-v\d+$/i, "")
    .replace(/-dex$/i, "")
    .trim();

  return [name, slug, symbol, baseName, baseSlug].filter(Boolean);
}

function selectTopIntersectingTargets({ llamaProtocols, coinList, existingConfig, top }) {
  const sorted = [...llamaProtocols].sort(
    (a, b) => Number(b?.tvl || 0) - Number(a?.tvl || 0)
  );

  const targets = [];
  const scanLimit = Math.max(top * 60, 200);
  for (const llama of sorted) {
    if (targets.length >= scanLimit) break;
    const queries = buildLlamaQueries(llama);
    const coin = bestMatch({
      queries,
      candidates: coinList,
      minScore: 55,
      getCandidateTexts: (c) => [
        { text: c?.id, weight: 1 },
        { text: c?.name, weight: 1 },
        { text: c?.symbol, weight: 0.9 }
      ]
    });

    if (!coin.match) continue;
    targets.push(buildTargetFromLlama(llama, coin.match));
  }

  return targets;
}

function selectSeedTargetsFromExistingConfig({ existingConfig, llamaProtocols, coinList }) {
  const seeds = [];
  for (const [cfgSlug, cfg] of Object.entries(existingConfig || {})) {
    const queries = [
      cfgSlug,
      cfg?.name,
      cfg?.tvl?.id,
      cfg?.tvl?.symbol,
      cfg?.whale?.token_address
    ].filter(Boolean);

    const llama = bestMatch({
      queries,
      candidates: llamaProtocols,
      minScore: 60,
      getCandidateTexts: (p) => [
        { text: p?.slug, weight: 1 },
        { text: p?.name, weight: 1 },
        { text: p?.symbol, weight: 0.8 }
      ]
    });
    const coin = bestMatch({
      queries,
      candidates: coinList,
      minScore: 60,
      getCandidateTexts: (c) => [
        { text: c?.id, weight: 1 },
        { text: c?.name, weight: 1 },
        { text: c?.symbol, weight: 0.7 }
      ]
    });

    if (!llama.match || !coin.match) continue;
    seeds.push(buildTargetFromLlama(llama.match, coin.match));
  }
  return seeds;
}

function mergeTargets(primary = [], secondary = []) {
  const out = [];
  const seen = new Set();

  for (const target of [...primary, ...secondary]) {
    const key = normalize(target?.presetLlama?.slug || target?.key || target?.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(target);
  }

  return out;
}

function buildExistingSlugSet(existingConfig = {}) {
  const set = new Set();
  for (const [cfgSlug, cfg] of Object.entries(existingConfig)) {
    for (const raw of [cfgSlug, cfg?.name, cfg?.tvl?.id]) {
      const n1 = normalize(raw);
      const n2 = normalizeProtocolKey(raw);
      if (n1) set.add(n1);
      if (n2) set.add(n2);
    }
  }
  return set;
}

function shouldKeepAutoResult(row) {
  if (!row?.defillama?.found || !row?.coingecko?.found) return false;
  return true;
}

async function run() {
  const argv = process.argv.slice(2);
  const customProtocols = parseArgValue(argv, "--protocols");
  const top = parseIntArg(argv, "--top", DEFAULT_TOP);
  const whaleProviders = parseArgValue(argv, "--whale-providers") || DEFAULT_WHALE_PROVIDERS;
  const out = parseArgValue(argv, "--out") || DEFAULT_OUT;
  const etherscanKey = parseArgValue(argv, "--etherscan-key") || DEFAULT_ETHERSCAN_KEY;
  const coingeckoApiKey = parseArgValue(argv, "--coingecko-key") || process.env.COINGECKO_KEY;

  const [llamaProtocols, coinList, existingConfig] = await Promise.all([
    fetchDefiLlamaProtocols(),
    fetchCoinGeckoCoinList(),
    readExistingProtocolConfig()
  ]);
  const targets = customProtocols
    ? parseProtocolsFromArg(customProtocols)
    : mergeTargets(
        selectSeedTargetsFromExistingConfig({ existingConfig, llamaProtocols, coinList }),
        selectTopIntersectingTargets({ llamaProtocols, coinList, existingConfig, top })
      );

  const results = [];
  const deferredRows = [];
  const resultLimit = customProtocols ? Number.POSITIVE_INFINITY : top;
  const existingSlugSet = buildExistingSlugSet(existingConfig);
  for (const target of targets) {
    const queries = [target.name, ...(target.aliases || []), target.key, target.symbolHint].filter(Boolean);

    const llama = target.presetLlama
      ? { match: target.presetLlama, score: 100 }
      : bestMatch({
      queries,
      candidates: llamaProtocols,
      getCandidateTexts: (p) => [
        { text: p?.slug, weight: 1 },
        { text: p?.name, weight: 1 },
        { text: p?.symbol, weight: 0.8 }
      ]
    });

    const coin = target.presetCoin
      ? { match: target.presetCoin, score: 100 }
      : bestMatch({
      queries,
      candidates: coinList,
      getCandidateTexts: (c) => [
        { text: c?.id, weight: 1 },
        { text: c?.name, weight: 1 },
        { text: c?.symbol, weight: 0.6 }
      ]
    });

    const coinDetails = coin.match ? await fetchCoinGeckoCoinDetails(coin.match.id, coingeckoApiKey) : null;
    const contractInfo = resolveSupportedContractFromDetails(coinDetails);

    const symbol = String(
      coin.match?.symbol || llama.match?.symbol || target.symbolHint || "token"
    ).toLowerCase();

    const slug = llama.match?.slug || normalize(target.key || target.name);
    const name = llama.match?.name || coin.match?.name || target.name;
    const fromExistingConfig = customProtocols
      ? findTokenFromExistingConfig(existingConfig, {
          queries,
          slug,
          symbol
        })
      : null;
    const network = contractInfo?.network || fromExistingConfig?.network || "eth";
    const tokenAddress = contractInfo?.tokenAddress || fromExistingConfig?.tokenAddress || null;

    const command = buildCommand({
      slug,
      name,
      symbol,
      network,
      tokenAddress,
      whaleProviders,
      out,
      etherscanKey
    });

    const row = {
      input: target.name,
      defillama: llama.match
        ? { found: true, slug: llama.match.slug, name: llama.match.name, symbol: llama.match.symbol }
        : { found: false },
      coingecko: coin.match
        ? { found: true, id: coin.match.id, name: coin.match.name, symbol: coin.match.symbol }
        : { found: false },
      token: tokenAddress
        ? {
            found: true,
            network,
            address: tokenAddress,
            platform: contractInfo?.platform || null,
            source: contractInfo ? "coingecko_details" : fromExistingConfig?.source || "unknown"
          }
        : { found: false, reason: "no_supported_evm_contract" },
      command
    };

    if (!customProtocols) {
      const rowKeys = [
        row?.defillama?.slug,
        row?.defillama?.name,
        row?.input
      ].flatMap((raw) => [normalize(raw), normalizeProtocolKey(raw)]);
      if (rowKeys.some((k) => k && existingSlugSet.has(k))) {
        continue;
      }
    }

    if (!customProtocols && !shouldKeepAutoResult(row)) {
      if (row?.defillama?.found && row?.coingecko?.found) {
        deferredRows.push(row);
      }
      continue;
    }

    results.push(row);
    if (results.length >= resultLimit) break;
  }

  if (!customProtocols && results.length < resultLimit) {
    for (const row of deferredRows) {
      results.push(row);
      if (results.length >= resultLimit) break;
    }
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: customProtocols ? "custom_protocols" : "top_intersection",
        requestedTop: customProtocols ? null : top,
        total: results.length,
        results
      },
      null,
      2
    )
  );
  console.log("\n# Commands");
  for (const row of results) {
    console.log(row.command);
  }
}

run().catch((err) => {
  console.error("Protocol universe check failed:", err.message);
  process.exitCode = 1;
});
