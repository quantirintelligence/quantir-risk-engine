# API Modules

## Purpose

`api/src/modules/` contains the service-layer code used by the Next.js API routes.

Each module translates persisted data into contracts that are easier for `risk-ui` to consume.

## Core Modules

- `dashboard/`
  - builds the main bootstrap payload, metrics, chart payloads, and price candle fallbacks
- `monitor/`
  - manages watched protocols and alert subscriptions for the current user
- `alerts/`
  - reads `tx_risk_events` and converts them into alert cards with severity and model explanation metadata
- `news/`
  - reads `protocol_news`, normalizes protocol aliases, and deduplicates articles
- `model-explanation/`
  - exposes stored `protocol_risk_explanations`
- `explain/`
  - lists `explain_jobs` and sends manual explain requests to `EXPLAIN_SERVICE_URL`
- `contract-audit/`
  - exposes `protocol_contract_audits`

## Support Modules

- `subscription/`
  - resolves plan capabilities such as protocol limits and realtime availability
- `protocol/`
  - caches enabled protocols for low-latency reads
- `auth/`
  - NextAuth configuration
- `userContext/`
  - authenticated user resolution
- `ws/`
  - short-lived websocket JWT signing
- `plans/`
  - plan-to-limit mapping
- `users/`, `notifications/`
  - Mongoose models for user-side persistence

## Data Model Convention

Most modules follow the same shape:

- `*.model.ts`
  - Mongo schema mapped to an existing collection
- `service.ts`
  - query logic and response normalization

## Current Coverage Gaps

This folder did not previously have a README, and most submodules still do not have their own local docs.

For the future docs portal, the highest-value pages to split out from here are:

- dashboard
- monitor
- alerts
- explain
- news
- auth / ws
