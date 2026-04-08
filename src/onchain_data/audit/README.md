# Contract Audit Module

## Overview

This module performs a shallow contract capability audit for protocol onboarding and runtime enrichment.

It is not a full smart-contract security audit. Its purpose is to:

- discover privileged and high-risk callable methods from ABI and verified source code
- resolve likely owner and protocol-controlled addresses
- generate a concise surface-level audit summary and findings
- persist the result to MongoDB
- push the discovered methods, owners, contracts, and ABI fragments back into the runtime protocol config

The module is executed from the on-chain engine bootstrap path and can also rehydrate runtime protocol entries from previously stored audit records.

## Goals

- Improve protocol bootstrap quality without manual per-protocol ABI curation
- Detect admin-sensitive or operationally dangerous methods early
- Enrich `flaggedMethods`, `adminMethods`, `owners`, `protocolContracts`, and `txAbi`
- Provide a UI/API-friendly audit artifact for dashboard consumption

## Non-Goals

- Formal security review
- Vulnerability proof or exploit validation
- Bytecode-level auditing
- Accurate upgradeability classification in all proxy patterns

## File Map

- [index.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/onchain_data/audit/index.js): main orchestration and runtime mutation
- [openai.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/onchain_data/audit/openai.js): LLM generation client and response sanitization
- [source.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/onchain_data/audit/source.js): source extraction, trimming, and function name parsing
- [abiStore.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/onchain_data/audit/abiStore.js): ABI fragment normalization and optional file persistence
- [configStore.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/onchain_data/audit/configStore.js): writes audit-enriched protocol config back to `protocols.json`
- [repository.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/onchain_data/audit/repository.js): MongoDB persistence API
- [model.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/onchain_data/audit/model.js): Mongoose schema for stored audit documents
- [query.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/onchain_data/audit/query.js): API-facing read model conversion
- [constants.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/onchain_data/audit/constants.js): feature flags, limits, and method heuristics

## Execution Flow

### 1. Bootstrap entrypoint

`bootstrapProtocolContractAudits(protocolEntries)` iterates over protocol entries when contract audits are enabled.

For each entry:

- resolve protocol slug and network
- collect root contract candidates from `config.contracts`, `config.protocolContracts`, and `config.whale.token_address`
- reuse a previously completed audit if refresh is not forced
- otherwise create or update a `pending` audit record

### 2. Explorer and contract metadata resolution

The module uses:

- `AbiMethodResolver` to fetch ABI, function names, and verified source bundles
- `OwnerResolver` to infer owner addresses and protocol-controlled contracts

Resolved data is normalized into:

- `txAbi`
- method name list
- owner list
- protocol contract list
- source artifacts

### 3. Method classification

Methods are split into:

- `adminMethods`
- `flaggedMethods`

Classification is heuristic and based on:

- exact method lists from [constants.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/onchain_data/audit/constants.js)
- normalized token matching
- keyword hints such as `admin`, `owner`, `guardian`, `pause`, `mint`, `burn`, `approve`, `transfer`

### 4. LLM audit generation

If `OPENAI_API_KEY` is available, the module asks the model for:

- `summary`
- `findings`
- `confidence`

The prompt explicitly instructs the model to treat the result as a shallow onboarding review, not a full audit.

If the LLM path fails or is unavailable, the module generates a deterministic fallback audit.

### 5. Persistence

The final result is saved into the `protocol_contract_audits` collection with status:

- `completed`
- or `failed`

### 6. Runtime mutation

The module then mutates the in-memory runtime config for the protocol entry and persists selected fields back to config storage:

- `flaggedMethods`
- `adminMethods`
- `owners`
- `protocolContracts`
- `txAbi`

This is the main side effect that improves transaction analysis and strategy matching later in the engine lifecycle.

## Runtime Rehydration

`hydrateProtocolEntriesWithStoredAudits(protocolEntries)` loads the latest completed audit per protocol and reapplies:

- `flagged_methods`
- `admin_methods`
- `owners`
- `contracts`
- `tx_abi`

This allows the engine to start with previously discovered audit intelligence even when a fresh audit is not executed in the current process.

## Data Sources

The module depends on the following upstream sources:

- protocol config from `src/onchain_data/config/protocols.json`
- ABI and source metadata fetched by `AbiMethodResolver`
- ownership inference from `OwnerResolver`
- OpenAI or compatible chat completion endpoint

## Storage Model

Mongo collection: `protocol_contract_audits`

Primary fields:

- `protocol`
- `network`
- `root_contract`
- `status`
- `flagged_methods`
- `admin_methods`
- `owners`
- `contracts`
- `tx_abi`
- `summary`
- `findings`
- `confidence`
- `source_available`
- `abi_available`
- `model`
- `error`
- `created_at`
- `updated_at`

Indexes:

- `{ protocol: 1 }`
- `{ status: 1 }`
- `{ created_at: 1 }`
- `{ updated_at: 1 }`
- unique `{ protocol: 1, root_contract: 1 }`

Schema definition lives in [model.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/onchain_data/audit/model.js).

## File Persistence

When file writes are enabled, the module also updates:

- protocol config file: `src/onchain_data/config/protocols.json`
- per-protocol ABI file: `src/onchain_data/config/abis/<slug>.json`

This behavior is controlled by `CONTRACT_AUDIT_WRITE_FILES`.

In production, file writes are disabled by default unless explicitly enabled.

## Environment Variables

### Core flags

- `CONTRACT_AUDIT_ENABLED`
  - disables the module when set to `0`
- `CONTRACT_AUDIT_FORCE_REFRESH`
  - forces regeneration even if a completed stored audit exists
- `CONTRACT_AUDIT_WRITE_FILES`
  - controls whether config and ABI artifacts are written to disk

### LLM settings

- `CONTRACT_AUDIT_MODEL`
  - defaults to `gpt-4.1-mini`
- `CONTRACT_AUDIT_TIMEOUT_MS`

### Size and scope limits

- `CONTRACT_AUDIT_MAX_CONTRACTS`
- `CONTRACT_AUDIT_SOURCE_CHAR_BUDGET`
- `CONTRACT_AUDIT_MAX_ABI_FRAGMENTS`

### API access

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `ETHERSCAN_API_KEY`

## LLM Request Contract

The module asks the model to return JSON with:

- `summary`
- `findings`
- `confidence`

The response is sanitized before persistence:

- summary is trimmed
- findings are coerced into an array of short strings
- confidence is clamped to `[0, 1]`

If JSON parsing fails, the result is discarded and the deterministic fallback path is used instead.

## Heuristics and Classification Rules

The module treats the following as privileged or suspicious:

- upgrade methods
- ownership transfer methods
- admin setters
- pause / unpause
- supply-affecting methods such as mint / burn
- list control methods such as blacklist / whitelist
- token flow methods such as approve / transfer / transferFrom

This intentionally over-classifies some surfaces to improve downstream transaction visibility.

## Failure Modes

### Missing contract root

If no valid root contract can be resolved, the module returns `null` and skips the audit.

### Missing explorer data

If neither ABI nor source code can be fetched:

- the module logs a warning
- the fallback audit is still generated
- confidence is reduced

### LLM unavailable

If `OPENAI_API_KEY` is missing or the model call fails:

- the module still completes using `buildFallbackAudit(...)`
- the stored record remains usable

### Audit execution failure

Any uncaught protocol-level error is persisted with status `failed` through [repository.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/onchain_data/audit/repository.js).

## API Read Layer

[query.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/onchain_data/audit/query.js) exposes read-friendly helpers that map stored Mongo documents into frontend/API payloads.

Key exported helpers:

- `listLatestContractAuditsByProtocols(...)`
- `listContractAudits(...)`

These functions normalize field naming for API consumers:

- `root_contract` -> `rootContract`
- `flagged_methods` -> `flaggedMethods`
- `admin_methods` -> `adminMethods`
- timestamps -> ISO strings

## Operational Notes

- Completed audits are reused unless forced refresh is enabled
- Runtime protocol entries are mutated in place
- The module is intended to run before normal transaction monitoring so flagged methods are available to downstream strategies
- Explorer availability and verified source quality directly affect result quality

## Extension Points

Recommended future extensions:

- provider abstraction for Anthropic / Gemini / self-hosted models
- richer proxy detection and implementation resolution
- bytecode fingerprint caching
- per-network explorer routing
- confidence scoring based on data availability rather than only LLM output
- explicit audit versioning to invalidate older onboarding audits after logic changes

## Troubleshooting

### Audit reuses stale result

Check:

- `CONTRACT_AUDIT_FORCE_REFRESH`
- existing `completed` record in `protocol_contract_audits`

### No file changes on disk

Check:

- `CONTRACT_AUDIT_WRITE_FILES`
- filesystem permissions
- whether the protocol slug exists in `protocols.json`

### No AI-generated summary

Check:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- model availability
- timeout value

### Methods look incomplete

Check:

- ABI availability
- source verification status
- `CONTRACT_AUDIT_MAX_ABI_FRAGMENTS`
- source truncation budget

## Summary

This module is a bootstrap-time contract surface analysis layer. It combines explorer metadata, ABI extraction, source parsing, shallow LLM summarization, Mongo persistence, and runtime config enrichment. Its main value is operational: it turns unknown protocol contracts into immediately usable flagged/admin method sets and audit summaries for the rest of the monitoring stack.
