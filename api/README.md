# API Service

## Purpose

`api/` is the authenticated Next.js backend used by the dashboard and user-facing product flows.

It does not compute protocol risk itself. Instead, it reads data already produced by the engine-side services and reshapes that data into UI-friendly contracts.

## Runtime Role

The service is responsible for:

- user authentication and session handling via NextAuth
- user-scoped dashboard/bootstrap responses
- watchlist and alert subscription management
- query access to alerts, news, model explanations, explain jobs, and contract audits
- short-lived websocket token issuance for the alerts socket
- health and development utility endpoints

## Main Route Groups

- `api/src/app/api/auth/[...nextauth]/route.ts`
  - NextAuth entrypoint
- `api/src/app/api/register/route.ts`
  - credentials-based registration
- `api/src/app/api/me/*`
  - authenticated dashboard-facing data APIs
- `api/src/app/api/monitor/*`
  - protocol monitor/watchlist and settings flows
- `api/src/app/api/ws/token/route.ts`
  - JWT issuance for the alerts websocket
- `api/src/app/api/telegram/*`
  - Telegram account linking
- `api/src/app/api/health/*`
  - liveness/readiness checks

## Module Map

Core business logic lives in `api/src/modules/`:

- `dashboard`
  - builds the main bootstrap payload and dashboard metrics
- `monitor`
  - manages watched protocols and alert subscriptions
- `alerts`
  - reads `tx_risk_events` and normalizes alert payloads
- `news`
  - reads `protocol_news` and deduplicates articles
- `model-explanation`
  - exposes stored AI-generated risk explanations
- `explain`
  - lists explain jobs and forwards manual explain requests to `explain-service`
- `contract-audit`
  - exposes stored contract audit artifacts
- `subscription`
  - resolves plan limits and capability flags
- `auth`, `userContext`, `ws`
  - auth/session helpers and websocket token signing

See `api/src/modules/README.md` for the detailed module-level map.

## Data Dependencies

The API primarily reads from Mongo collections populated outside this service:

- `protocolsnapshots`
- `protocolchartpayloads`
- `marketcandles`
- `tx_risk_events`
- `protocol_news`
- `protocol_risk_explanations`
- `protocol_contract_audits`
- `explain_jobs`
- `user_protocols`
- `user_alert_protocols`
- `user_settings`
- `user_notifications`
- `users`

## Request Flow

1. User authenticates via NextAuth.
2. Route handlers call `withUser(...)` to enforce authentication.
3. Module services query Mongo and normalize payloads.
4. The frontend consumes those payloads through `risk-ui`.
5. For realtime alerts, the frontend requests `POST /api/ws/token` and then connects to the websocket server exposed by the engine.

## Notes For Docs Portal

- This service already has a stable set of route files, but it still lacks a public-facing API reference.
- For the future Docs page, split this area into:
  - `Internal API`
  - `Authentication`
  - `Realtime / WS`
  - `Public API (Soon)`
