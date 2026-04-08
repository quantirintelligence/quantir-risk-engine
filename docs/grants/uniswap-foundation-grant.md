# Uniswap Foundation Grant Proposal Draft

**Project:** Quantir Risk Monitoring for Uniswap  
**Target Program:** Uniswap Foundation Grants  
**Funding Request:** $40,000  
**Delivery Window:** 10 weeks

## 1. Project Overview

Quantir proposes to build a risk monitoring layer specifically for Uniswap pools. The system will extend the existing Quantir risk engine into a protocol-specific monitoring product for Uniswap liquidity venues, with an initial focus on Ethereum mainnet Uniswap V3 pools and pool-level anomaly detection.

The proposed system will:

- monitor pool-level events via on-chain logs
- decode protocol-specific contracts and pool activity
- apply a risk scoring model to pool and market state
- generate explanations for abnormal behavior
- stream alerts through API and WebSocket interfaces

For Uniswap, the core goal is to detect liquidity stress and abnormal pool behavior before price impact becomes obvious to integrators, LPs, or ecosystem operators.

This work fits the current Uniswap Foundation funding direction toward ecosystem support, protocol tooling, analytics, security, and infrastructure for builders operating on top of Uniswap and related deployment environments.

### Current Baseline vs Grant-Funded Expansion

Quantir already has a working multi-service monitoring stack in the public repository, including:

- on-chain ingestion and collectors
- a Rust risk-scoring service
- event-driven risk adjustments
- explainability and alert delivery
- baseline protocol coverage that already includes `UniswapV3` in the current operating universe

The requested grant is not for building a monitoring stack from zero. It is for turning that existing baseline into a Uniswap-specific monitoring product with:

- pool-aware event coverage
- pool-class scoping and validation
- Uniswap-specific alert logic
- protocol-specific documentation and case studies
- integration-ready delivery for external consumers

### Initial Supported Scope

The first funded release will target:

- Ethereum mainnet
- Uniswap V3
- a selected set of high-TVL and high-volume pools
- LPs, integrators, and risk operators as the primary users

This draft deliberately scopes the first release to Uniswap V3 rather than over-claiming support for all Uniswap versions or hook-based custom surfaces on day one.

### Initial Monitored Pool Scope

For reviewer clarity, the first release is intended to monitor a constrained pool set rather than the entire Uniswap universe at once.

The initial monitored scope is expected to include:

- a curated set of high-TVL Ethereum mainnet Uniswap V3 pools
- a preference for major quote-asset pools where liquidity movement and routing quality matter operationally
- a release design that can later expand pool coverage after the first calibrated launch

The final target pool list will be fixed at milestone kickoff and published in the release documentation.

The first-release pool list is expected to prioritize:

- major quote-asset pools
- deep-liquidity routing pools
- pools where liquidity migration or abnormal withdrawal behavior has clearer operational impact for LPs and integrators

## 2. Problem Statement

Uniswap is the most important on-chain liquidity layer in DeFi, but pool-level risk monitoring is still fragmented across dashboards, block explorers, and ad hoc bots. Integrators and liquidity providers can observe raw swaps and liquidity changes, but they usually do not receive an interpretable early-warning view of emerging pool stress.

For Uniswap specifically, several operational problems matter:

- concentrated liquidity can vanish quickly, causing sudden execution degradation
- large swaps, liquidity withdrawals, and asymmetric flow can materially alter pool quality before obvious price dislocation
- pool-level stress is difficult to compare across pools and chains in a normalized way
- teams integrating with Uniswap generally lack a reusable risk API for alerting and downstream automation
- new hook-based and custom-pool architectures increase the need for protocol-aware monitoring infrastructure

The result is that liquidity degradation is often noticed only after users already experience poor execution, abnormal slippage, or unstable market conditions.

For the first release, the main target users are:

- liquidity providers monitoring concentrated-liquidity exposure
- teams integrating Uniswap liquidity into products or execution flows
- desks or operators whose cost of delayed reaction is measurable in slippage, hedge quality, or exit conditions

## 3. Proposed Solution

We will adapt Quantir into a Uniswap-specific risk monitoring layer that continuously evaluates pool state and produces machine-readable alerts plus human-readable explanations.

The solution will include:

- Uniswap event ingestion for swaps, mint/burn liquidity actions, pool updates, and other protocol-relevant events
- protocol-specific decoding for target Uniswap contracts and pool entities
- derived pool stress features such as liquidity change intensity, flow imbalance, volume spikes, and abnormal transaction patterns
- a risk scoring layer that converts normalized inputs into a pool risk score
- an explainability layer that summarizes why a pool is being flagged
- API and WebSocket delivery for real-time integrations
- historical validation on selected pools and stress periods

Example alert classes in the first release:

- rapid liquidity withdrawal from a monitored pool
- abnormal swap pressure relative to pool depth
- multi-signal deterioration where pool stress rises before visible price dislocation
- protocol-sensitive contract activity that materially changes monitored conditions

## 4. Integration Plan

The integration will build on the existing Quantir architecture already present in the public repository:

- on-chain engine for ingestion and protocol-specific collectors
- Rust risk model for normalized base scoring
- strategy layer for event-driven risk adjustment
- explain service for human-readable risk narratives
- API service and WebSocket delivery for downstream consumers

Planned Uniswap integration steps:

1. Define the initial monitored pool set on Ethereum mainnet Uniswap V3.
2. Implement Uniswap-specific event decoding and pool mapping.
3. Build pool-level feature extraction for liquidity stress, flow anomalies, and sudden state changes.
4. Calibrate risk scoring on historical pool behavior and recent events.
5. Expose alerts and explanations through API and WebSocket.
6. Publish documentation and example integration flows for ecosystem teams.

Initial deliverables will support:

- pool-level monitoring
- alert feeds for risk events
- explanation payloads for why a pool is flagged
- backend-ready interfaces for dashboards, bots, and internal risk tooling

### Existing Components Reused

The grant-funded work will reuse the existing Quantir stack for:

- ingestion runtime
- risk scoring service
- explainability service
- alert distribution
- persistence and dashboard-facing APIs

### New Deliverables Funded By This Grant

The grant-funded work will add:

- Uniswap pool-aware entity mapping
- protocol-specific alert definitions
- case-study validation on selected pools
- documented output contracts for external consumers
- a narrowed, verifiable first release rather than generic protocol coverage

## 5. Milestones & Timeline

**Milestone 1: Uniswap protocol adapter and event map**  
Weeks 1-3

- finalize supported pool scope
- implement log ingestion and decoding
- map core entities and pool metadata
- validate event coverage on live and historical data

**Milestone 2: Risk scoring and signal layer**  
Weeks 4-6

- define Uniswap-specific features
- calibrate pool stress heuristics
- integrate scores into the Quantir risk engine
- implement explanation triggers for abnormal behavior

**Milestone 3: API, WebSocket, and operator workflows**  
Weeks 7-8

- expose alert and status payloads
- add stream delivery for real-time consumers
- produce sample alert schemas and integration examples

**Milestone 4: Validation, documentation, and release**  
Weeks 9-10

- run case studies on selected Uniswap pools
- refine thresholds and explanations
- deliver final technical documentation and public repo updates

### Success Metrics

The release will be evaluated against practical operating metrics:

- support for the initial target pool set on Ethereum mainnet Uniswap V3
- end-to-end alert delivery through API and WebSocket
- documented alert schema and integration examples
- at least two historical case-study writeups showing what the system would have surfaced
- measured alert latency and reviewable evidence for triggered alerts
- manual review process for false-positive reduction during calibration

### Acceptance Criteria

For grant evaluation, the first release should be considered successful if it delivers:

- a published initial monitored pool list for the first Uniswap V3 release
- a working alert pipeline for the selected pool scope
- at least two written validation examples tied to real monitored pool behavior
- documented interpretation rules for the main alert classes
- a calibration note explaining how noisy alerts were reviewed and reduced before release

## 6. Budget

**Total request: $40,000**

- $14,000 for Uniswap-specific indexing, decoding, and protocol adapter work
- $10,000 for risk model calibration and signal engineering
- $8,000 for API, WebSocket, alert delivery, and integration interfaces
- $5,000 for validation, testing, and protocol-specific documentation
- $3,000 for project management, reporting, and grant communication

This budget is structured around milestone delivery rather than open-ended research. The output is an implementation-focused monitoring layer that can be tested by ecosystem teams.

## 7. Team

The work will be delivered by the Quantir core team, with responsibilities split across protocol engineering, risk modeling, and product integration.

- Ilya Berdar: founding / lead engineer, owns system design, protocol integration, and delivery
- Alexey Grischenko: risk engineer / model engineer, owns feature design, calibration, and alert logic
- Tony Novaselsky: backend / platform engineer, owns API, WebSocket, and delivery interfaces

For final submission, this section can be further expanded with short bios, previous shipped work, and relevant DeFi or monitoring experience.

## 8. Expected Impact

This grant would produce reusable monitoring infrastructure for one of the most important liquidity layers in DeFi.

Expected impact for Uniswap:

- earlier detection of liquidity stress before severe execution deterioration
- better monitoring for LPs, integrators, and ecosystem operators
- reusable machine-readable alerts for wallets, dashboards, and bots
- explainable risk outputs instead of raw event firehoses
- a stronger analytics and safety layer around pool behavior

For the Uniswap ecosystem, the practical value is not only more data, but better decision support. The proposed system turns raw pool activity into actionable operational intelligence.

## 9. Evidence and Validation Case

Quantir already publishes a companion evidence page titled `Use Cases` that documents a `multi-stage risk accumulation and delayed market reaction` pattern. That case matters because it shows the exact product claim this proposal is trying to operationalize: internal deterioration can accumulate first, while the stronger visible market reaction arrives later.

For grant evaluation, that case supports the following framing:

- the system is intended as a leading-indicator surface rather than a price-only dashboard
- lead-time has operational value when users still have time to reduce exposure or rotate liquidity
- corroborating evidence can matter before visible price breakdown fully confirms the problem

Quantir also already has recent internal protocol data that supports the existence of usable Uniswap-specific signal behavior. In the latest 24-hour sample in the current Mongo-backed operating environment:

- `UniswapV3` produced `88` snapshots and `32` risk events
- the observed maximum protocol risk reached `0.0388`
- the maximum transaction-pressure score reached `0.1890`
- the highest-risk sampled snapshot included `6` transaction events considered by the score

One recent high-risk sample from `2026-04-01T03:16:42Z` showed:

- protocol risk `0.0388`
- transaction delta contribution `0.0378`
- `6` transaction events considered
- non-zero transaction pressure on top of a near-zero base score

This is useful for grant evaluation because it shows that the current stack already surfaces event-driven Uniswap-specific pressure above the model baseline, rather than merely replaying price movement. The funded work would convert this baseline signal into pool-aware alerting, validation, and external delivery.

The Uniswap-specific release will reuse this evaluation logic and produce at least two protocol-specific case-study writeups showing when pool deterioration became visible in the evidence stack relative to later market effects.

## 10. Methodology and Validation Notes

The evidence in this draft is drawn from Quantir's current internal operating environment and should be interpreted as baseline product evidence rather than as a finalized benchmark study.

For the current internal validation snapshot:

- the source collections were `protocolsnapshots` and `tx_risk_events`
- the protocol filter was `uniswapv3`
- the sampling window was the latest 24-hour period available at query time
- the reported figures summarize observed snapshot counts, event counts, maximum modeled risk, and transaction-pressure behavior

These figures are intended to demonstrate three things:

1. protocol-specific monitoring is already running
2. the current stack is already producing reviewable Uniswap-specific signals
3. the grant would fund the conversion of those baseline signals into a narrower, externally documented, pool-aware product release

This proposal does not claim that the current internal figures alone are a final scientific validation set. Instead, they establish that the system already produces live protocol-specific evidence and that the funded work would add:

- documented case studies
- protocol-specific alert definitions
- explicit calibration and review workflows
- more formal validation outputs suitable for ecosystem reviewers

### Evidence Packaging For Final Submission

For final submission or committee follow-up, the Uniswap package can include:

- the current proposal
- the shared [proof-appendix.md](/Users/pc/Desktop/github/defi-risk-engine-grants-public/docs/grants/proof-appendix.md)
- at least one chart or dashboard exhibit from the live monitoring environment
- at least two short protocol-specific validation notes derived from the monitored pool scope

For a consolidated summary of the evidence extraction logic and interpretation boundaries, see [proof-appendix.md](/Users/pc/Desktop/github/defi-risk-engine-grants-public/docs/grants/proof-appendix.md).

## 11. Why Quantir vs Existing Tools

This proposal is not positioned as a replacement for market dashboards, block explorers, or general analytics products. It is positioned as a protocol-specific monitoring layer built around three differences:

- Quantir combines on-chain event monitoring, model-based scoring, explainability, and alert delivery in one workflow rather than exposing only charts or raw feeds.
- Quantir is designed to elevate protocol deterioration before it is fully visible in price-only monitoring.
- Quantir produces machine-readable outputs through API and WebSocket delivery, which makes it easier to integrate into external workflows.
- Quantir is being scoped here as a protocol-specific operational layer for Uniswap V3 pools rather than as a generic DeFi monitoring surface.

The practical differentiator is not that Quantir claims to be the only monitoring tool in the ecosystem. The differentiator is that it connects evidence, scoring, and alert delivery into one protocol-aware workflow for a narrowed operational scope.

## 12. Post-Grant Sustainability

The grant is intended to fund the protocol-specific buildout, validation, and documentation of the first Uniswap release. It is not intended to imply that the product stops at the end of the grant window.

Post-grant sustainability is expected to come from a combination of:

- continued use of the shared Quantir core stack across multiple protocol integrations
- reuse of the same ingestion, scoring, and delivery infrastructure rather than maintaining a one-off code path
- protocol-specific documentation and integration outputs that reduce future maintenance friction
- potential paid or partner-supported monitoring usage after the grant-funded release is completed

The goal of the grant is therefore to reduce the cost of protocol-specific expansion and validation, not to create a dead-end prototype.

## 13. Project Risks and Mitigations

### Risk: False positives or low-signal alerts

Mitigation:

- initial scope is deliberately narrow
- first-release alert classes are documented explicitly
- calibration includes manual review and false-positive reduction before release

### Risk: Protocol changes or monitoring drift

Mitigation:

- the release is scoped to Ethereum mainnet Uniswap V3 rather than broader multi-version coverage
- protocol-specific mapping is part of the funded deliverables
- final documentation will include interpretation boundaries and monitored-scope assumptions

### Risk: Adoption friction for external users

Mitigation:

- delivery is exposed through API and WebSocket interfaces
- the grant includes documentation and integration examples
- the first release focuses on a narrow operational use case instead of trying to satisfy every user type at once
