# Balancer Grants Proposal Draft

**Project:** Quantir Risk Monitoring for Balancer Pools  
**Target Program:** Balancer Grants  
**Funding Request:** $35,000  
**Delivery Window:** 10 weeks

## 1. Project Overview

Quantir proposes to build a risk monitoring layer specifically for Balancer pools. The system will extend the existing Quantir risk engine into a Balancer-aware monitoring product focused on pool imbalance, structural anomalies, unusual flow, and operational stress across pool types.

The proposed system will:

- monitor pool-level events via on-chain logs
- decode protocol-specific contracts for Balancer pools
- apply a risk scoring model to pool state and anomaly signals
- generate explanations for elevated-risk conditions
- stream alerts through API and WebSocket interfaces

For Balancer, the primary objective is to monitor pool imbalance and structural anomalies before they become visible only through degraded execution, unusual reserve behavior, or secondary market consequences.

### Current Baseline vs Grant-Funded Expansion

Quantir already has a working monitoring stack in the public repository, including:

- on-chain ingestion and collectors
- a risk-scoring core
- explainability and alerting services
- baseline protocol coverage that already includes `BalancerV2` in the current operating universe

The requested grant would fund the Balancer-specific expansion needed to make that baseline useful for Balancer operators:

- pool-type-aware monitoring
- Balancer-specific anomaly taxonomy
- protocol-specific case-study validation
- integration-ready outputs for external consumers

### Initial Supported Scope

The first funded release will target:

- Ethereum mainnet
- Balancer V2 baseline support
- an initial subset of pool types rather than all Balancer pool designs at once
- selected weighted and stable pool categories for the first release

This draft intentionally narrows the first release to a verifiable and reviewable scope instead of claiming universal Balancer pool coverage on day one.

### Initial Monitored Pool-Type Scope

For reviewer clarity, the first release is intended to monitor a constrained Balancer pool set rather than all Balancer pool designs at once.

The initial monitored scope is expected to include:

- Ethereum mainnet Balancer V2
- selected weighted pools
- selected stable pools
- a first release focused on structural imbalance, reserve asymmetry, and stress episodes within the monitored pool-type scope

The final target pool list will be fixed at milestone kickoff and published in the release documentation.

The first-release pool set is expected to prioritize:

- pools with clear structural interpretation value
- weighted and stable pools where imbalance and reserve asymmetry are easier to review operationally
- pools where structural stress matters more than simple transaction counting

## 2. Problem Statement

Balancer is a programmable AMM with multiple pool designs and integration surfaces. That flexibility is a strength, but it also makes monitoring harder. Weighted pools, stable pools, boosted structures, and custom extensions can behave differently under stress, and raw event streams alone do not provide a useful risk picture.

The main problems for Balancer-specific monitoring are:

- pool imbalance can develop gradually and then surface abruptly in trading conditions
- abnormal joins, exits, swaps, or reserve shifts are difficult to interpret without protocol-aware decoding
- heterogeneous pool designs make one-size-fits-all alerting ineffective
- ecosystem operators and integrators need a normalized risk layer, not only analytics dashboards
- structural anomalies often require combining pool state, transaction behavior, and pattern detection rather than observing one metric in isolation

Because Balancer serves as a programmable liquidity layer, there is value in an external monitoring system that produces consistent and explainable pool-risk outputs across pool types.

For the first release, the main target users are:

- Balancer ecosystem operators who need pool-level anomaly visibility
- dashboards and monitoring teams that want alert feeds instead of passive analytics only
- integrators who need machine-readable pool-risk outputs

## 3. Proposed Solution

We will adapt Quantir into a Balancer-specific monitoring layer that continuously evaluates pool behavior and produces actionable alerts.

The solution will include:

- Balancer pool ingestion and event decoding
- protocol-specific support for targeted pool types in the initial phase
- derived features for imbalance, abnormal flow, reserve stress, and structural anomaly detection
- a risk scoring layer for pool-level monitoring
- an explainability layer that summarizes the detected issue
- API and WebSocket delivery for ecosystem consumers
- historical validation on selected pools and periods

The initial anomaly taxonomy will include:

- abnormal join and exit patterns
- reserve or balance asymmetry beyond expected conditions
- stress episodes where multiple signals deteriorate together
- protocol-sensitive contract or relayer activity relevant to monitored pools

For the first release, scoring and interpretation will be documented separately for the selected weighted and stable pool categories rather than treated as one undifferentiated pool universe.

## 4. Integration Plan

The implementation will reuse the existing Quantir stack:

- on-chain engine for ingestion and entity-specific collectors
- risk model for normalized scoring
- strategy layer for event-driven escalation
- explain service for human-readable risk narratives
- API and WebSocket layers for downstream integration

Planned Balancer integration steps:

1. Select initial Balancer pool types and target pools on Ethereum mainnet.
2. Implement Balancer-specific event decoding and pool mapping.
3. Build features for imbalance, reserve stress, and structural anomaly detection.
4. Calibrate pool-risk scoring across selected historical cases.
5. Expose alerts, explanations, and real-time streams for integration partners.
6. Publish documentation and example integration patterns.

The first release will focus on:

- pool-level anomaly monitoring
- imbalance and stress detection
- explainable alerts for external dashboards or bots
- reusable interfaces for Balancer ecosystem tooling

### Existing Components Reused

The grant-funded work will reuse the existing Quantir stack for:

- ingestion runtime
- scoring service
- explanation service
- alert distribution
- persistence and API delivery

### New Deliverables Funded By This Grant

The grant-funded work will add:

- pool-type-aware Balancer monitoring
- explicit anomaly taxonomy for the selected pool scope
- protocol-specific validation and case studies
- documented output schemas and integration examples
- a narrowed first release with reviewable deliverables

## 5. Milestones & Timeline

**Milestone 1: Balancer protocol adapter and pool-type support**  
Weeks 1-3

- define initial scope by pool type
- implement pool event decoding
- map pool metadata and monitoring entities
- validate ingestion quality on historical data

**Milestone 2: Pool-risk and anomaly signal layer**  
Weeks 4-6

- design Balancer-specific stress features
- implement imbalance and anomaly heuristics
- integrate protocol-aware scoring into the Quantir engine
- add explanation triggers for structural anomalies

**Milestone 3: Alert interfaces and delivery**  
Weeks 7-8

- expose API and WebSocket payloads
- standardize alert schemas
- support integration with dashboards and monitoring services

**Milestone 4: Validation, documentation, and release**  
Weeks 9-10

- run case studies across selected pools
- refine thresholds and explanations
- deliver final public documentation and release materials

### Success Metrics

The release will be evaluated against practical operating metrics:

- support for the initial target pool set on Ethereum mainnet
- end-to-end alert delivery through API and WebSocket
- documented alert schema and integration examples
- at least two historical case-study writeups for selected Balancer pools
- reviewable anomaly evidence for each alert class
- manual review loop for false-positive reduction during calibration

### Acceptance Criteria

For grant evaluation, the first release should be considered successful if it delivers:

- a published initial pool list for the selected weighted and stable pool scope
- a working alert pipeline for the selected Balancer release scope
- at least two written validation examples tied to monitored Balancer pools
- documented interpretation rules for the main anomaly classes
- a calibration note explaining how structural high-risk readings were reviewed before release

## 6. Budget

**Total request: $35,000**

- $13,000 for Balancer-specific pool decoding and protocol integration
- $9,000 for anomaly detection and risk-scoring logic
- $7,000 for API, WebSocket, and alert delivery
- $4,000 for validation, testing, and documentation
- $2,000 for project management and grant reporting

This is sized as a focused ecosystem tooling grant aimed at shipping a concrete monitoring layer rather than a broad research program.

## 7. Team

The project will be delivered by the Quantir core team with shared ownership across protocol engineering, risk intelligence, and platform delivery.

- Ilya Berdar: founding / lead engineer, owns Balancer integration scope and delivery
- Alexey Grischenko: risk engineer / analyst, owns anomaly detection and pool-risk calibration
- Tony Novaselsky: backend / platform engineer, owns API, WebSocket, and alert distribution

For final submission, this section can be expanded with short biographies and prior protocol or DeFi work.

## 8. Expected Impact

This grant would create a protocol-aware monitoring layer for Balancer’s programmable liquidity ecosystem.

Expected impact for Balancer:

- earlier visibility into pool imbalance and abnormal structural behavior
- more actionable alerting for integrators and ecosystem operators
- reusable machine-readable risk feeds for external tools
- explainable anomaly outputs instead of isolated raw metrics
- stronger observability for a multi-pool, programmable AMM environment

The practical outcome is a better safety and analytics layer for Balancer pools, delivered as open, integration-ready infrastructure.

## 9. Evidence and Validation Case

Quantir already publishes a companion evidence page documenting `multi-stage risk accumulation and delayed market reaction`. That matters for Balancer-style monitoring because pool deterioration or structural imbalance can accumulate before broader market effects become obvious.

For grant evaluation, that case supports the following Balancer-specific framing:

- useful monitoring should surface internal deterioration before the market fully reacts
- lead-time matters when operators can still adjust exposure or monitoring posture
- protocol-specific evidence is more valuable than post-factum chart commentary

Quantir also already has recent internal protocol data that supports the existence of usable Balancer-specific structural signals. In the latest 24-hour sample in the current Mongo-backed operating environment:

- `Balancer` produced `88` snapshots
- the observed maximum protocol risk reached `0.9174`
- the maximum recorded volume spike reached `218.03`
- transaction-pressure contribution remained `0`, meaning the elevated reading was driven by market-state and structural inputs rather than by tx-event pressure

One recent high-risk sample from `2026-04-01T14:55:18Z` showed:

- protocol risk `0.9174`
- base score `0.9174`
- transaction delta contribution `0`
- transaction events considered `0`
- volume spike `218.03`

This is useful for grant evaluation because it shows a different but important monitoring mode: Balancer-style risk can become highly elevated through structural and market-state behavior even when there is no transaction-pressure uplift. The funded work would convert this baseline structural signal into pool-type-aware anomaly detection, validation, and protocol-specific delivery for selected weighted and stable pool categories.

The funded Balancer release will convert this general lead-time thesis into selected Balancer pool case studies tied to the initial supported pool scope.

## 10. Methodology and Validation Notes

The evidence in this draft is drawn from Quantir's current internal operating environment and should be interpreted as baseline product evidence rather than as a finalized benchmark study.

For the current internal validation snapshot:

- the source collection was primarily `protocolsnapshots`, with `tx_risk_events` checked for recent event activity
- the protocol filter was `balancer`
- the sampling window was the latest 24-hour period available at query time
- the reported figures summarize observed snapshot counts, maximum modeled risk, structural market-state behavior, and the absence of transaction-pressure uplift in the highlighted example

These figures are intended to demonstrate three things:

1. protocol-specific monitoring is already running
2. the current stack is already producing reviewable Balancer-specific structural signals
3. the grant would fund the conversion of those baseline signals into a narrower, externally documented, pool-type-aware anomaly-monitoring release

This proposal does not claim that the current internal figures alone are a final scientific validation set. Instead, they establish that the system already produces live protocol-specific evidence and that the funded work would add:

- documented pool-type-specific case studies
- explicit anomaly classes for the initial pool scope
- calibration and review workflows
- more formal validation outputs suitable for ecosystem reviewers

### Evidence Packaging For Final Submission

For final submission or committee follow-up, the Balancer package can include:

- the current proposal
- the shared [proof-appendix.md](/Users/pc/Desktop/github/defi-risk-engine-grants-public/docs/grants/proof-appendix.md)
- at least one chart or dashboard exhibit from the live monitoring environment
- at least two short protocol-specific validation notes derived from the monitored pool scope

For a consolidated summary of the evidence extraction logic and interpretation boundaries, see [proof-appendix.md](/Users/pc/Desktop/github/defi-risk-engine-grants-public/docs/grants/proof-appendix.md).

## 11. Why Quantir vs Existing Tools

This proposal is not positioned as a replacement for dashboards or general analytics products. It is positioned as a protocol-specific monitoring layer built around three differences:

- Quantir combines on-chain event monitoring, model-based scoring, explainability, and alert delivery in one workflow rather than exposing only charts or raw feeds.
- Quantir can surface structural and market-state stress even when transaction-pressure uplift is absent, which is relevant for selected Balancer pool types.
- Quantir produces machine-readable outputs through API and WebSocket delivery, which makes it easier to integrate Balancer-specific anomaly monitoring into external workflows.

The practical differentiator is not that Quantir claims to be the only monitoring tool in the ecosystem. The differentiator is that it connects evidence, scoring, and alert delivery into one protocol-aware workflow for a narrowed Balancer release scope.

## 12. Post-Grant Sustainability

The grant is intended to fund the protocol-specific buildout, validation, and documentation of the first Balancer release. It is not intended to imply that the product stops at the end of the grant window.

Post-grant sustainability is expected to come from a combination of:

- continued use of the shared Quantir core stack across multiple protocol integrations
- reuse of the same ingestion, scoring, and delivery infrastructure rather than maintaining a one-off code path
- protocol-specific documentation and integration outputs that reduce future maintenance friction
- potential paid or partner-supported monitoring usage after the grant-funded release is completed

The goal of the grant is therefore to reduce the cost of protocol-specific expansion and validation, not to create a dead-end prototype.

## 13. Project Risks and Mitigations

### Risk: Structural signals may be hard to interpret without calibration

Mitigation:

- initial scope is deliberately narrow
- first-release anomaly classes are documented explicitly
- calibration includes manual review and interpretation notes before release

### Risk: Pool-type heterogeneity increases monitoring complexity

Mitigation:

- the release is scoped to Ethereum mainnet Balancer V2
- the first release is narrowed to selected weighted and stable pools
- final documentation will include interpretation boundaries and monitored-scope assumptions

### Risk: Adoption friction for external teams

Mitigation:

- delivery is exposed through API and WebSocket interfaces
- the grant includes documentation and integration examples
- the first release focuses on a narrow operational use case instead of trying to satisfy every possible pool type or stakeholder at once
