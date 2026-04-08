# Explain Service

## Overview

The explain service is a standalone reasoning service that converts normalized risk context into durable, queryable explanation jobs.

Its responsibility is not to compute protocol risk. That work already happens inside the risk engine. The explain service operates one layer later:

- accept a normalized explain request
- persist an `explain_jobs` record
- run several LLM-backed agents in parallel against the same hypothesis set
- normalize partial provider responses into a fixed-width hypothesis vector
- fuse successful outputs into one ranked explanation
- expose the result through a small HTTP API for the dashboard and API layer

This service is intended for three main use cases:

- daily protocol refresh explanations
- event-triggered explanations dispatched by the on-chain engine
- manual operator or dashboard explain requests

## Goals

- produce stable, UI-friendly explanation artifacts
- tolerate partial provider failure without losing the whole job
- apply dedupe and cooldown rules close to the point of submission
- keep raw provider output available for debugging and product rendering
- make the final explanation reproducible from stored context and stored agent outputs

## Non-Goals

- replacing the core risk score
- acting as a real-time transaction classifier
- implementing a formal Bayesian inference engine
- guaranteeing that every provider returns valid JSON on every call
- guaranteeing that the conceptual N2M2 diagrams are implemented literally in code

## Conceptual N2M2 Reference

This folder contains three diagrams that describe the conceptual architecture the service is modeled after.

### Architecture Reference

![N2M2 Architecture](./n2m2_architecture_scheme_20260327_165952.png)

### Reference Agent Weighting

![N2M2 Agent Weights](./n2m2_agent_weights_20260327_165952.png)

### Example Hypothesis Distribution

![N2M2 Hypothesis Probabilities](./n2m2_hypothesis_probabilities_20260327_165858.png)

## Important Implementation Note

The current codebase is a practical provider ensemble, not a literal implementation of three hard-specialized agents such as `A1_Rules`, `A2_Market`, and `A3_Onchain`.

Current implementation:

- `OpenAIProvider`
- `ClaudeProvider`
- `GeminiProvider`

All three providers receive the same normalized context and the same hypothesis pool. The final fusion stage then weights each provider contribution by its returned per-hypothesis confidence.

That means:

- the diagrams are accurate as architectural intent
- the current system does perform multi-agent competition plus judge fusion
- the static weights shown in the diagrams are not hardcoded in the current production code
- current weighting is endogenous to provider output confidence, not a fixed prior table

## File Map

- [index.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/index.js): process bootstrap and dependency wiring
- [server.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/server.js): HTTP server and JSON response contract
- [config.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/config.js): environment parsing and runtime defaults
- [hypotheses.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/hypotheses.js): default hypothesis pool
- [prompts/hypothesisPrompt.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/prompts/hypothesisPrompt.js): shared prompt contract used by all providers
- [providers/OpenAIProvider.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/providers/OpenAIProvider.js): OpenAI adapter
- [providers/ClaudeProvider.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/providers/ClaudeProvider.js): Anthropic adapter
- [providers/GeminiProvider.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/providers/GeminiProvider.js): Gemini adapter with extra recovery and debug logging
- [services/explainJobService.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/services/explainJobService.js): explain job creation and manual-context construction
- [services/requestDeduper.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/services/requestDeduper.js): dedupe and cooldown decisions
- [services/explainOrchestrator.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/services/explainOrchestrator.js): async execution and job state transitions
- [services/hypothesisAggregator.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/services/hypothesisAggregator.js): judge/fusion logic
- [utils.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/utils.js): JSON parsing, clamping, trimming, and normalization helpers

Persistence layer outside this folder:

- [ExplainJob.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/db/ExplainJob.js): Mongoose schema for `explain_jobs`
- [ExplainJobRepository.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/db/ExplainJobRepository.js): repository methods used by the service

## Runtime Architecture

### Bootstrap Sequence

[index.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/index.js) starts the service in this order:

1. parse config from environment
2. validate that a Mongo URI is present
3. connect to MongoDB
4. construct `RequestDeduper`
5. construct `ExplainJobService`
6. construct enabled providers
7. construct `HypothesisAggregator`
8. construct `ExplainOrchestrator`
9. start the HTTP server

### Main Components

#### RequestDeduper

Decides whether a new request should be accepted, rejected due to cooldown, rejected because a similar event already exists, or allowed as a manual retry.

#### ExplainJobService

Creates the durable explain job payload and, for manual requests without a fully provided context, reconstructs a best-effort `explain_context` from the latest snapshot plus recent transaction events.

#### Providers

Each provider implements the same conceptual method:

- `isEnabled()`
- `assessHypotheses({ context, hypothesisPool })`

#### ExplainOrchestrator

Runs enabled providers in parallel, appends provider outputs to Mongo, and marks the job as `completed` or `failed`.

#### HypothesisAggregator

Consumes only successful provider outputs, calculates a fused distribution, and generates the final explanation summary and confidence.

## Request Lifecycle

### 1. Request submission

Client sends `POST /explain` with:

- `protocol`
- optional `event_id`
- `request_source`
- `requested_by`
- `trigger`
- optional `explain_context`

### 2. Dedupe decision

[requestDeduper.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/services/requestDeduper.js) evaluates the request in this order:

1. reject if an active job already exists for the protocol
2. reject if the latest completed job is still inside the cooldown window
3. reject if the same `event_id` already exists
4. special-case allow a retry when the request is `manual` and the previous job for the same `event_id` failed
5. otherwise accept

Returned decision reasons include:

- `JOB_IN_PROGRESS`
- `COOLDOWN_ACTIVE`
- `EVENT_ALREADY_EXPLAINED`
- `RETRY_FAILED_MANUAL_EVENT`
- `ACCEPTED`

### 3. Job creation

If accepted, [explainJobService.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/services/explainJobService.js) creates a `pending` record in `explain_jobs`.

### 4. Async execution

[explainOrchestrator.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/services/explainOrchestrator.js) schedules `processJob(jobId)` asynchronously and moves the job into `running`.

### 5. Parallel provider assessment

All enabled providers run in parallel through `Promise.allSettled(...)`.

For each provider:

- a `completed` or `failed` provider output is produced
- the output is appended to `agent_outputs`
- provider latency, raw summary, normalized hypotheses, and error are stored

### 6. Fusion

If at least one provider succeeds:

- only successful provider outputs are passed into the aggregator
- `judge_result`, `final_summary`, and `confidence` are persisted
- job becomes `completed`

If all providers fail:

- job becomes `failed`
- `last_error` is populated

## Explain Context Contract

The service expects an already normalized context object. In practice it is usually produced by the on-chain engine or reconstructed for manual requests.

Typical fields inside `explain_context`:

- `schema_version`
- `protocol`
- `event_id`
- `request_source`
- `trigger`
- `current_risk`
- `transaction`
- `market_context`
- `flags`
- `triggered_strategies`
- `observed_at`
- `latest_price_usd`

### Manual Request Reconstruction

If `POST /explain` is called without a full `explain_context`, `ExplainJobService` tries to build one from:

- the latest protocol snapshot
- up to five latest transaction risk events for the protocol

This path is mainly intended for manual dashboard-driven explains.

## Event ID Strategy

### Automatic requests

Automatic requests use a stable day-key style identifier:

`<request_source>:<protocol>:YYYY-MM-DD`

Example:

`daily:lido:2026-03-28`

This prevents uncontrolled daily fan-out and makes cooldown behavior predictable.

### Manual requests

Manual requests default to a unique identifier:

`manual:<protocol>:<requested_by>:<time-random-suffix>`

This allows operator-driven retries and ad hoc explain sessions without colliding with the daily key.

## Hypothesis Pool

Default hypothesis pool from [hypotheses.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/hypotheses.js):

- `Whale Exit`
- `Market Manipulation`
- `Liquidity Migration`
- `Smart Contract Exploit`
- `Treasury Movement`

The pool can be overridden through `EXPLAIN_HYPOTHESIS_POOL`, but the rest of the service assumes a fixed-width pool for normalization and fusion.

## HTTP API

### `GET /health`

Returns:

- service identity
- configured model names
- auto cooldown hours
- manual cooldown hours

Example shape:

```json
{
  "ok": true,
  "service": "explain_service",
  "models": {
    "openai": "gpt-5-mini",
    "anthropic": "claude-sonnet-4-20250514",
    "gemini": "gemini-2.5-flash"
  },
  "auto_cooldown_hours": 24,
  "manual_cooldown_hours": 3
}
```

### `POST /explain`

Creates or deduplicates an explain request.

Possible behaviors:

- `202` when a new job is accepted
- `200` with `accepted: false` when dedupe or cooldown blocks creation
- `4xx` for malformed input
- `5xx` for service-side failure

Minimal request example:

```json
{
  "protocol": "aave",
  "event_id": "daily:aave:2026-03-28",
  "request_source": "auto",
  "requested_by": "onchain-engine",
  "trigger": {
    "type": "daily_protocol_refresh",
    "name": "Daily Protocol Refresh",
    "severity": "scheduled",
    "source": "onchain-engine",
    "reason": "Daily explain refresh requested during engine startup."
  },
  "explain_context": {}
}
```

Accepted response shape:

```json
{
  "ok": true,
  "accepted": true,
  "reason": "ACCEPTED",
  "data": {
    "id": "69c6cb49a31c5b3e3de903c1",
    "protocol": "lido",
    "status": "pending"
  }
}
```

### `GET /jobs/latest?protocol=<slug>&limit=<n>`

Returns the latest jobs for one protocol, newest first.

### `GET /jobs/:id`

Returns one job by Mongo id.

### Serialized Job Shape

[server.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/server.js) serializes jobs into an API-friendly shape:

- `id`
- `protocol`
- `eventId`
- `requestSource`
- `requestedBy`
- `status`
- `trigger`
- `explainContext`
- `hypothesisPool`
- `agentOutputs`
- `judgeResult`
- `finalSummary`
- `confidence`
- `error`
- `createdAt`
- `updatedAt`
- `startedAt`
- `completedAt`

## Provider Layer

All providers use the same prompt contract from [hypothesisPrompt.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/prompts/hypothesisPrompt.js).

The prompt requires JSON-only output with:

- `summary`
- `hypotheses[]`
- each hypothesis containing:
  - `hypothesis`
  - `score`
  - `confidence`
  - `reasoning`

### OpenAI

[OpenAIProvider.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/providers/OpenAIProvider.js)

Characteristics:

- uses `/chat/completions`
- requests `response_format: { type: "json_object" }`
- uses `AbortController` for hard timeouts
- returns a descriptive timeout error such as `OpenAI request timed out after ...s`

### Claude

[ClaudeProvider.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/providers/ClaudeProvider.js)

Characteristics:

- uses `/messages`
- retries transient failures
- treats `429`, `529`, and `5xx` as retryable
- joins text content blocks before parsing JSON

### Gemini

[GeminiProvider.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/providers/GeminiProvider.js)

Characteristics:

- uses `generateContent`
- sets `responseMimeType = "application/json"`
- parses `candidates[].content.parts[].text`
- performs recovery through:
  - code-fence stripping
  - first-object extraction
- supports verbose debug logging

Debug flags:

- `EXPLAIN_DEBUG_GEMINI`
- `EXPLAIN_DEBUG_PROVIDERS`

This provider is the most sensitive to truncation and malformed JSON. Historically, the common failure pattern has been successful HTTP `200` responses that still contain incomplete or non-parseable JSON payloads.

## Response Normalization

[utils.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/utils.js) standardizes provider output before aggregation.

Normalization guarantees:

- all hypothesis names are mapped back into the configured hypothesis pool
- all scores are clamped to `0..100`
- all confidence values are clamped to `0..1`
- missing hypotheses are backfilled with zero-score placeholders
- summaries and reasonings are trimmed

This fixed-width normalization step is important because it ensures the aggregator always receives one complete vector per successful provider even when the raw provider output is incomplete.

## Aggregation and Judge Fusion

[hypothesisAggregator.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/explain_service/services/hypothesisAggregator.js) implements the current judge stage.

### Per-Hypothesis fusion

For each hypothesis:

1. collect all successful provider assessments for that hypothesis
2. convert provider confidence into a weighting factor with a floor
3. compute weighted average score
4. compute average confidence
5. synthesize a short reasoning excerpt from up to two distinct provider reasonings

### Distribution fields

The fused distribution contains:

- `hypothesis`
- `score`
- `confidence`
- `share_pct`
- `reasoning_excerpt`

### Final judge result

The service persists:

- `primary_hypothesis`
- `runner_up_hypothesis`
- `confidence`
- `summary`
- `hypothesis_distribution`

### Overall confidence

The final job-level confidence is derived from:

- top hypothesis score
- top hypothesis confidence
- margin between first and second place

The result is clamped into `[0, 1]`.

## Mongo Storage Model

Collection: `explain_jobs`

Schema definition:

- [ExplainJob.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/db/ExplainJob.js)

Repository methods:

- [ExplainJobRepository.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/db/ExplainJobRepository.js)

### Top-level fields

- `protocol`
- `event_id`
- `request_source`
- `requested_by`
- `status`
- `trigger`
- `explain_context`
- `hypothesis_pool`
- `agent_outputs`
- `judge_result`
- `final_summary`
- `confidence`
- `last_error`
- `started_at`
- `completed_at`
- `created_at`
- `updated_at`

### Agent output fields

Each `agent_outputs[]` item stores:

- `provider`
- `model`
- `status`
- `latency_ms`
- `summary`
- `hypotheses[]`
- `error`
- `created_at`

### Status model

Top-level job statuses:

- `pending`
- `running`
- `completed`
- `failed`

Per-provider statuses:

- `completed`
- `failed`

### Indexes

- `{ protocol: 1, created_at: -1 }`
- `{ protocol: 1, request_source: 1, created_at: -1 }`
- `{ status: 1, created_at: -1 }`
- indexed `protocol`
- indexed `event_id`
- indexed `request_source`
- indexed `status`
- indexed `created_at`

## Repository Behavior

[ExplainJobRepository.js](/Users/pc/Desktop/github/defi-risk-engine-grants-public/src/db/ExplainJobRepository.js) exposes the exact storage API used by the service.

Methods:

- `create(payload)`
- `getById(id)`
- `getByEventId(eventId)`
- `getLatestByProtocol(protocol, limit, statuses)`
- `getLatestCompletedByProtocol(protocol)`
- `getActiveByProtocol(protocol)`
- `updateStatus(id, status, extra)`
- `appendAgentOutput(id, output)`
- `complete(id, { judgeResult, summary, confidence })`
- `fail(id, error)`

This repository is intentionally simple. The main business logic lives in the service layer, not in the database wrapper.

## Failure Modes

### Active job already exists

Request is not accepted. The API returns `accepted: false` with `JOB_IN_PROGRESS`.

### Cooldown window still active

Request is not accepted. The API returns `accepted: false` with `COOLDOWN_ACTIVE`.

### Duplicate automatic event

Request is not accepted. The API returns `accepted: false` with `EVENT_ALREADY_EXPLAINED`.

### Manual retry of previously failed event

Request is accepted with `RETRY_FAILED_MANUAL_EVENT`.

### Provider returns invalid JSON

That provider output is stored as `failed`. The job still completes if another provider succeeds.

### All providers fail

The whole job becomes `failed`.

### Manual request cannot build context

Job creation fails when no latest snapshot exists or when the minimal context cannot be constructed.

## Observability and Debugging

The service logs:

- provider start and completion
- provider failures
- job completion and failure
- optional Gemini raw-response previews

Useful runtime checks:

- `GET /health`
- `GET /jobs/latest?protocol=<slug>`
- `GET /jobs/:id`

Useful stored fields for debugging:

- `agent_outputs[].error`
- `agent_outputs[].latency_ms`
- `last_error`
- `judge_result.hypothesis_distribution`

## Integration Points

### On-chain engine

The on-chain engine dispatches automatic explain jobs for:

- daily refreshes
- risk-triggered events

### API layer

The API reads explain jobs and maps them into dashboard-facing response shapes.

### UI layer

The UI consumes:

- `finalSummary`
- `confidence`
- `judgeResult`
- `agentOutputs`

These values currently drive the `Reasoning` tab.

## Extension Points

The current design leaves room for several upgrades:

- replace provider-homogeneous agents with role-specialized agents
- add explicit static provider priors if desired
- insert an optional critic stage before final fusion
- add temporal belief revision instead of one-shot job aggregation
- calibrate confidence using historical explain outcomes
- add per-provider quality metrics and schema conformance telemetry

## Summary

The explain service is a production-oriented reasoning pipeline for post-hoc risk explanation. It accepts normalized context, persists durable explain jobs, runs several providers in parallel, normalizes their outputs into a consistent hypothesis space, and fuses the successful results into one final explanation artifact. The included N2M2 diagrams describe the intended conceptual architecture, while the current implementation uses a pragmatic provider-ensemble approximation designed to be robust enough for live dashboard and API usage.
