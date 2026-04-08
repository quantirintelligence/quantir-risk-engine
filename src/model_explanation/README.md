# Model Explanation Loop

## Purpose

`src/model_explanation/` generates periodic AI summaries that explain why the current model risk looks the way it does for each protocol.

This is separate from `src/explain_service/`:

- `model_explanation`
  - explains the model state over a recent time window
- `explain_service`
  - explains a specific event or trigger using multi-provider hypothesis fusion

## Runtime Role

The loop is started by the on-chain engine via `startProtocolRiskExplanationLoop(...)`.

For each protocol, it:

1. selects a recent time window
2. loads the latest available `ProtocolSnapshot` per network
3. loads recent `TxRiskEvent` documents
4. builds a protocol-level prompt payload for the LLM
5. requests a concise explanation
6. persists the result into `protocol_risk_explanations`

## Protocol-Level Semantics

This module is intentionally protocol-wide.

It does **not** explain the currently selected dashboard network. Instead, it explains the latest overall protocol state across all supported networks.

The input set is built as:

- take the freshest snapshot for each protocol network inside the active window
- if a network has no fresh snapshot inside the window, fall back to its latest available snapshot
- keep those rows labeled by `network` in the prompt payload

## Risk Score Aggregation

The stored `risk_score` for this module is a protocol-level aggregate.

Current behavior:

- each network contributes its latest normalized risk score
- each network also contributes its latest usable TVL
- the protocol explanation risk is calculated as a TVL-weighted average:

`aggregate_risk = sum(risk_i * tvl_i) / sum(tvl_i)`

This means larger networks influence the final explanation more than smaller ones.

Fallback behavior:

- if TVL weights are not usable, the module falls back to a plain arithmetic mean of available network risk scores
- if no valid network risk scores exist, the explanation is skipped

## Prompt Context

The LLM prompt receives both:

- `protocol_summary`
  - aggregated TVL
  - aggregated 24h volume
  - freshest positive price
  - max positive market cap / FDV
  - max whale concentration
- `snapshots`
  - one latest snapshot per network with explicit `network` labels

This keeps the explanation global while still showing the model what is happening on each chain.

## Outputs

Stored fields include:

- `risk_score`
- `summary`
- `why_now`
- `key_drivers`
- `confidence`
- `window_start`
- `window_end`
- `snapshot_at`

These records are later exposed through `api/src/modules/model-explanation/service.ts`.

## Key Controls

- `MODEL_EXPLANATION_ENABLED`
- `MODEL_EXPLANATION_INTERVAL_MINUTES`
- `MODEL_EXPLANATION_WINDOW_MINUTES`
- `MODEL_EXPLANATION_MAX_SNAPSHOTS`
- `MODEL_EXPLANATION_MAX_TX_EVENTS`
- `MODEL_EXPLANATION_TIMEOUT_MS`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

## Key File

- `index.js`
  - contains the full loop, prompt preparation, LLM call, and persistence flow

## Relationship To Other Modules

- reads from `src/db/ProtocolSnapshot.js`
- reads from `src/db/TxRiskEvent.js`
- writes through `src/db/ProtocolRiskExplanationRepository.js`
- is surfaced to users through `api/src/app/api/me/model-explanations/route.ts`
