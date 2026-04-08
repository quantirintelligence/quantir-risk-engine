# Config Builder

Protocol config generator for `src/onchain_data/config/protocols.json`.

## What It Generates

Builds these fields:

- `contracts`
- `flaggedMethods`
- `adminMethods`
- `protocolContracts`
- `whales`
- `owners`
- `whaleTransferMin`
- `liquidityShockAmount`
- `tvl`
- `whale`
- `token_health`

## Run

From repository root:

```bash
node src/config_builder/ProtocolConfigBuilder.js --slug curve --name CurveFinance --symbol crv --network eth --token 0x4c9edd5852cd905f086c759e8383e09bff1e68b3 --contracts 0x4c9edd5852cd905f086c759e8383e09bff1e68b3 --etherscan-key <YOUR_ETHERSCAN_KEY> --whale-providers ethplorer,coingecko,moralis --out src/onchain_data/config/protocols.json
```

By default, output is merged into the target JSON by `slug`.

## Mass Protocol Discovery (DefiLlama + CoinGecko)

Use this helper to auto-check protocol presence in both sources and print ready-to-run builder commands.
By default it returns top protocols by DeFiLlama TVL that are present in CoinGecko too:

```bash
node src/config_builder/ProtocolUniverseChecker.js
```

Pick count explicitly:

```bash
node src/config_builder/ProtocolUniverseChecker.js --top 10
```

Custom list (CSV, overrides `--top`):

```bash
node src/config_builder/ProtocolUniverseChecker.js --protocols "Aave,Uniswap,Curve,Lido,Maker / Sky"
```

Optional flags:

- `--protocols` CSV of protocol names (if omitted, built-in default list is used)
- `--top` number of most popular protocols (default `10`) that exist in both DefiLlama and CoinGecko
- `--protocols` CSV of protocol names (manual mode; overrides `--top`)
- `--etherscan-key` value injected into generated commands (default `<YOUR_ETHERSCAN_KEY>`)
- `--whale-providers` CSV order for generated commands (default `ethplorer,coingecko,moralis`)
- `--out` output path for generated commands (default `src/onchain_data/config/protocols.json`)
- `--coingecko-key` CoinGecko API key for details lookup (or use `COINGECKO_KEY` in `.env`)

Output includes JSON match status and generated commands in this format:

```bash
node src/config_builder/ProtocolConfigBuilder.js --slug curve --name CurveFinance --symbol crv --network eth --token 0x... --contracts 0x... --etherscan-key <YOUR_ETHERSCAN_KEY> --whale-providers ethplorer,coingecko,moralis --out src/onchain_data/config/protocols.json
```

## CLI Arguments

- `--slug` required, protocol key in output JSON (for example `curve`)
- `--name` required, human-readable protocol name (for example `CurveFinance`)
- `--symbol` optional, token symbol (for example `crv`)
- `--network` optional, defaults to `eth`
- `--token` required, token contract address
- `--contracts` optional, CSV list of contract addresses
- `--etherscan-key` optional, Etherscan V2 API key
- `--whale-providers` optional, whale provider order as CSV
- `--out` optional, output JSON path (default `src/onchain_data/config/protocols.json`)

## Data Sources (Current Architecture)

- ABI/source: Etherscan-like API (V2 for ETH), fallback Blockscout
- TVL: DefiLlama
- Whales: provider chain (`ethplorer`, `coingecko`, `moralis`) in configured order
- Thresholds: CoinGecko simple token price + DexScreener liquidity

## Free Plan Notes

- Etherscan free tier: 5 calls/sec limit (throttling is already implemented in resolver)
- Moralis is not required for MVP
- For ETH whales, `ethplorer` first in provider order is usually sufficient
