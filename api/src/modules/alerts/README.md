# Alerts Module

## Purpose

Reads normalized transaction risk events and exposes them as UI-ready alerts.

## Responsibilities

- derive alert severity from amount thresholds
- normalize model explanation payloads attached to transactions
- expand protocol aliases and names when filtering
- list alerts and count alerts for watched protocols

## Data Source

- `tx_risk_events`

## Key Files

- `service.ts`
- `tx-risk-event.model.ts`

## Main Consumers

- `api/src/app/api/me/alerts/route.ts`
- `api/src/app/api/me/alerts/count/route.ts`
