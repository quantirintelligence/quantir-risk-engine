# Shared Runtime Modules

## Purpose

`src/modules/` contains a small set of shared domain modules that sit between the older service layer and the newer Next.js API service.

## Current Modules

- `monitor/`
  - watchlist-oriented helpers
- `plans/`
  - plan-to-limit mapping
- `userContext/`
  - authenticated user resolution helpers

## Notes

- Parts of this folder overlap conceptually with `api/src/modules/`.
- When extending the current product backend, prefer the `api/src/modules/` implementations as the source of truth.
