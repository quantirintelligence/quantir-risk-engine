# Database Layer

## Purpose

`src/db/` contains the shared Mongo connection, Mongoose schemas, and repository helpers used by the engine-side services.

This layer is the persistence contract between ingestion/runtime components and the API layer.

## Main Collections

- `Protocol.js`
  - protocol registry and metadata
- `ProtocolSnapshot.js`
  - time-series snapshots stored in `protocolsnapshots`
- `ProtocolChartPayload.js`
  - precomputed dashboard chart payloads stored in `protocolchartpayloads`
- `MarketCandle.js`
  - price candles stored in `marketcandles`
- `TxRiskEvent.js`
  - normalized transaction risk events stored in `tx_risk_events`
- `ExplainJob.js`
  - explain-service job state stored in `explain_jobs`
- `ProtocolRiskExplanation.js`
  - AI-generated interval explanations stored in `protocol_risk_explanations`
- `User.js`
  - user accounts stored in `users`
- `UserProtocol.js`
  - watchlist entries stored in `user_protocols`
- `UserAlertProtocol.js`
  - alert subscriptions stored in `user_alert_protocols`
- `UserSettings.js`
  - per-user settings stored in `user_settings`
- `UserNotification.js`
  - in-app notifications stored in `user_notifications`

## Repository Helpers

- `Mongo.js`
  - shared Mongo connection bootstrap
- `ProtocolRepository.js`
  - protocol persistence helpers
- `ProtocolSnapshotRepository.js`
  - snapshot lookup helpers
- `ProtocolChartPayloadRepository.js`
  - chart payload writes/reads
- `MarketCandleRepository.js`
  - candle storage helpers
- `TxRiskEventRepository.js`
  - transaction event writes/reads
- `ExplainJobRepository.js`
  - explain job persistence
- `ProtocolRiskExplanationRepository.js`
  - model explanation persistence
- `ProtocolSnapshotBuilder.js`
  - snapshot assembly helper used by the engine

## Ownership

This folder is primarily written by:

- `src/onchain_data/`
- `src/explain_service/`
- `src/model_explanation/`
- alerting and user-facing flows

It is primarily read by:

- `api/src/modules/*`

## Notes For Docs Portal

- This folder is the right source for a future “Data Model” page.
- The API and engine share several collection names, so this should stay treated as a canonical contract layer.
