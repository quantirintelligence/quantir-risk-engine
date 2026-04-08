# Legacy Service Helpers

## Purpose

`src/services/` contains older service helpers from the Express-era API surface.

These files are still useful for understanding historical flows, but the main actively used product backend now lives in `api/src/modules/`.

## Files

- `monitorService.js`
  - legacy watchlist/protocol listing helpers
- `subscriptionService.js`
  - simple plan-limit check helper
- `userContext.js`
  - legacy request-based user resolution and settings bootstrap

## Notes

- Treat this folder as legacy/shared runtime code.
- New user-facing API work should prefer `api/src/modules/`.
