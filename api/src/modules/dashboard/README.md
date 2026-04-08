# Dashboard Module

## Purpose

Builds the main user-facing dashboard payload consumed by `risk-ui`.

## Responsibilities

- aggregate watched protocols
- load latest snapshots and precomputed charts
- merge alerts, news, AI explanations, and contract-audit data
- expose compact and full bootstrap variants
- provide dashboard metrics and price candle fallbacks

## Key Files

- `service.ts`
- `protocol-snapshot.model.ts`
- `protocol-chart-payload.model.ts`
- `market-candle.model.ts`

## Main Consumers

- `api/src/app/api/me/bootstrap/route.ts`
- `api/src/app/api/dashboard/bootstrap/route.ts`
- `api/src/app/api/me/dashboard-metrics/route.ts`
