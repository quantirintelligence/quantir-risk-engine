# On-Chain Engine

## Purpose

`src/onchain_data/` is the core runtime engine of the platform.

It orchestrates protocol collectors, persists snapshots and risk events, triggers explain flows, hydrates forecast data, and exposes the alerts websocket used by the frontend.

## Bootstrap Sequence

`index.js` starts the engine in this order:

1. connect to MongoDB
2. sync protocol metadata from `config/protocols.json`
3. hydrate stored ABI and contract-audit intelligence
4. start the alerts websocket API
5. bootstrap missing snapshots
6. bootstrap scheduled explain requests
7. start transaction monitoring
8. start the model explanation loop
9. start periodic collector loops
10. asynchronously refresh contract audits

## `index.js` Runtime Stack

`index.js` is the runtime orchestrator. It wires together config loading, runtime scope expansion, collector execution, model scoring, forecast enrichment, persistence, alerts, and explain dispatch.

Startup stack:

```text
loadProtocolsConfig
  -> buildProtocolRuntimeEntries
  -> main
     -> MongoConnection.connect
     -> syncRuntimeIndexes
     -> initProtocolsFromConfig
     -> hydrateProtocolEntriesWithAbi
     -> hydrateProtocolEntriesWithStoredAudits
     -> alertsApi.start
     -> bootstrapMissingSnapshots
     -> startExplainRequestScheduler
     -> startProtocolRiskExplanationLoop
     -> startCollectorsLoop
     -> bootstrapProtocolContractAudits
```

Collector tick stack:

```text
startCollectorsLoop.tick
  -> runWithConcurrency(protocolRuntimeEntries)
     -> runCollectorsForProtocol(entry)
        -> collectSnapshot
           -> setupCollectors
           -> runCollectorWithSharedCache
           -> ProtocolSnapshotBuilder.build
           -> hydrateCollectorsFromLatestSnapshot
        -> calculateDerived
        -> runInference
        -> buildCombinedRisk
        -> requestForecast
        -> ProtocolSnapshotRepository.save
        -> precomputeProtocolChartPayload
        -> buildRiskAlertPayload / dispatchExplainJob
```

## Runtime Scope Model

The runtime unit inside `index.js` is `protocol + network`.

- `protocolCatalogEntries`
  protocols loaded from `protocols.json`
- `protocolRuntimeEntries`
  network-expanded scopes produced by `resolveProtocolNetworks()`
- one collector tick
  writes one snapshot and one chart payload per runtime scope

That is why risk and forecast can differ by network even when price candles remain protocol-global.

## Main Responsibilities

- collect protocol state from on-chain and market data sources
- compute derived metrics used by the risk model
- call the Rust risk model service
- request short-horizon forecasts from the forecast service
- persist `protocolsnapshots`, `tx_risk_events`, and chart payloads
- dispatch explain requests to `explain-service`
- publish websocket alert events

## Key Components

- `collectors/`
  - `TVLCollector`
  - `WhaleCollector`
  - `TxBehaviourCollector`
  - `TokenRiskProfileCollector`
  - `CandleCollector`
  - `HistoricalBootstrapCollector`
- `explain/`
  - explain rule matching, context construction, and explain request dispatch
- `chartHelpers/`
  - precomputed payload generation for dashboard charts
- `audit/`
  - protocol contract capability audit and ABI hydration
- `base/`
  - collector base abstractions and websocket client helpers

## Inputs

- protocol config from `config/protocols.json`
- on-chain websocket/RPC data
- CoinGecko and other market data providers
- stored audits and ABI artifacts
- risk model service at `RISK_MODEL_URL`
- forecast service at `FORECAST_URL`

## Outputs

- Mongo collections:
  - `protocolsnapshots`
  - `tx_risk_events`
  - `protocolchartpayloads`
  - `marketcandles`
  - `protocol_risk_explanations`
- outbound explain requests to `explain-service`
- realtime websocket stream from `src/api/alertsSocketApi.js`

## Important Files

- `index.js`
  - main runtime orchestration
- `snapshot.js`
  - snapshot building helpers
- `tx_stream.js`
  - websocket transaction monitoring flow
- `config/protocols.json`
  - protocol registry and collector configuration
- `utils/logger.js`
  - engine logger

## Environment

Common engine variables:

- `MONGODB_URI`
- `MONGODB_DB`
- `ALCHEMY_WS_URL`
- `COINGECKO_KEY`
- `RISK_MODEL_URL`
- `FORECAST_URL`
- `EXPLAIN_SERVICE_URL`
- `WS_TOKEN_SECRET` or `AUTH_SECRET`
- `PROTOCOLS_CONFIG_PATH`
  optional runtime override for `protocols.json`; container builds default to `/app/config/protocols.json`

Control flags used by the runtime include:

- `COLLECTOR_INTERVAL_MS`
- `COLLECTOR_CONCURRENCY`
- `TX_MONITOR_MAX_PROTOCOLS`
- `TX_MONITOR_PENDING`
- `EXPLAIN_RULE_THRESHOLD`
- `EXPLAIN_BOOTSTRAP_ON_START`

## Failure Modes

- if Mongo is unavailable, the engine fails at startup
- if the risk model or forecast service is unavailable, snapshots may still be collected but enriched outputs degrade
- if external market providers fail, collector envelopes may be persisted with partial data
- contract audit and explain dispatch are best-effort side flows and can fail independently

## Related Docs

- `../strategies/README.md`
- `./audit/README.md`
- `../model_explanation/README.md`
- `../../README.md`
