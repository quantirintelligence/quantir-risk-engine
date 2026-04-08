# Legacy Routers

## Purpose

`src/routers/` contains the earlier Express router layer used before the current Next.js API service became the primary user-facing backend.

## Current File

- `monitorRoutes.js`
  - exposes legacy monitor/watchlist routes using helpers from `src/services/`

## Notes

- This folder is useful as migration history and as a reference for earlier API contracts.
- New product-facing endpoints should be documented and implemented in `api/src/app/api/`.
