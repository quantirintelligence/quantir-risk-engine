# Bootstrap

## Purpose

`src/bootstrap/` contains startup helpers used to initialize persistent state before the long-running engine loops begin.

## Current Scope

- `initProtocols.js`
  - reads `src/onchain_data/config/protocols.json`
  - upserts protocol metadata into Mongo
  - ensures the runtime protocol catalog exists in the `Protocol` collection

## Notes

- This folder is intentionally small today, but it is part of the engine startup contract.
- Future bootstrap concerns should live here rather than being buried directly in service entrypoints.
