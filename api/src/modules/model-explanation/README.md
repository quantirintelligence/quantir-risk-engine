# Model Explanation Module

## Purpose

Exposes stored interval-level AI explanations describing recent model risk state.

These explanations are protocol-level, not selected-network-level.

## Responsibilities

- list latest explanations by protocol
- filter explanations to the current user's monitored protocols
- normalize explanation documents for dashboard rendering

## Data Source

- `protocol_risk_explanations`

## Current Semantics

- explanations are generated from the latest available snapshot of each protocol network
- the stored `risk_score` is a protocol-wide aggregate, not a single-network score
- the aggregate currently uses a TVL-weighted average across networks, with a plain-mean fallback if TVL weights are unavailable

## Key Files

- `service.ts`
- `protocol-risk-explanation.model.ts`

## Main Consumers

- `api/src/app/api/me/model-explanations/route.ts`
- dashboard bootstrap aggregation
