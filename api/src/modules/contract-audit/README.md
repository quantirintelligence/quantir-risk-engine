# Contract Audit Module

## Purpose

Exposes persisted contract-audit artifacts produced by the engine-side audit flow.

## Responsibilities

- list audits only for protocols monitored by the current user
- normalize methods, findings, owners, contracts, and metadata for UI display

## Data Source

- `protocol_contract_audits`

## Key Files

- `service.ts`
- `protocol-contract-audit.model.ts`

## Main Consumers

- `api/src/app/api/me/contract-audits/route.ts`
