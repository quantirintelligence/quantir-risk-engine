# Monitor Module

## Purpose

Handles user watchlists, alert protocol subscriptions, and persisted monitor settings.

## Responsibilities

- add and remove watched protocols
- enforce plan-based protocol limits
- resolve protocol slugs from DB or engine config
- store per-user monitor settings
- manage alert protocol subscriptions

## Key Files

- `service.ts`
- `protocol.model.ts`
- `user-protocol.model.ts`
- `user-alert-protocol.model.ts`
- `user-settings.model.ts`

## Main Consumers

- `api/src/app/api/monitor/protocols/route.js`
- `api/src/app/api/monitor/me/protocols/route.js`
- `api/src/app/api/monitor/settings/route.js`
- `api/src/app/api/monitor/subscription/renewal-date/route.js`
