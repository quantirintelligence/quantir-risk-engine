# Grant Proof Appendix

This appendix summarizes the provenance, interpretation boundaries, and practical meaning of the evidence blocks referenced in the protocol-specific grant proposals.

## Purpose

The grant drafts for Uniswap, Aave, and Balancer now include internal validation figures taken from Quantir's current operating environment. These figures are included to demonstrate that:

- the monitoring stack is already live in a working form
- protocol-specific signals are already being generated
- the grant request is for protocol-specific expansion and validation, not for a zero-to-one build

These figures are not presented as a final benchmark paper, external audit, or statistically complete model-evaluation report.

## Data Sources

The evidence blocks were derived from the existing Mongo-backed runtime data model used by the Quantir system.

Relevant collections:

- `protocolsnapshots`
- `tx_risk_events`

Relevant fields used in the summary:

- snapshot counts by protocol
- event counts by protocol
- `risk.score`
- `risk.base_score`
- `risk.tx_pressure_score`
- `risk.tx_delta`
- `risk.tx_events_considered`
- `derived.volume_spike`
- large recent `amount_usd` observations in flagged events

## Sampling Logic

The summary figures in the grant drafts were taken from the latest available 24-hour sample at query time.

Protocol filters used:

- `uniswapv3`
- `aave`
- `balancer`

The point of the appendix is not to claim that 24-hour summaries alone are sufficient proof of long-term product value. The point is to show that protocol-specific monitoring signals already exist in the current runtime and can be reviewed, calibrated, and expanded through grant-funded work.

## Interpretation Boundaries

These internal figures should be read with the following constraints:

- they are internal operating-environment outputs, not external third-party validation
- they demonstrate signal existence, not final precision/recall claims
- they are supportive evidence for grant readiness, not a substitute for a research paper
- they do not claim exploit confirmation, liquidation certainty, or deterministic prediction

The correct interpretation is:

- Quantir already produces protocol-specific monitoring evidence
- the grant would fund protocol-specific packaging, calibration, documentation, and validation
- the funded work would transform internal evidence into ecosystem-facing deliverables

## Why This Matters

Grant reviewers typically want to know whether a proposal is:

1. only a concept
2. an internal prototype
3. an already-running baseline that needs protocol-specific expansion

This appendix is meant to support category `3`.

The current evidence shows that:

- Aave already exhibits strong transaction-pressure and event-driven stress behavior in the current stack
- UniswapV3 already exhibits measurable event-driven monitoring behavior above baseline
- Balancer already exhibits strong structural and market-state stress behavior even without transaction-pressure uplift

This matters because the grant asks are not framed as generic “AI monitoring” ideas. They are framed as protocol-specific expansions of an already-running evidence pipeline.

## What The Grant Still Needs To Produce

Even with the current internal proof blocks, the funded work should still deliver stronger reviewer-facing outputs:

- protocol-specific historical case studies
- documented alert classes and review logic
- calibration notes and interpretation boundaries
- integration examples for external consumers
- more formal validation artifacts than a single internal snapshot summary

## Protocol-Specific Summary

### Aave

The current internal evidence for Aave is the strongest of the three proposals because it already shows:

- high event count
- meaningful transaction-pressure contribution
- large flagged events
- clear lift of total risk above the base model score

This supports the thesis that Aave-specific monitoring can become operationally useful when transaction-driven stress is layered onto the baseline model.

### Uniswap

The current internal evidence for UniswapV3 is weaker in raw magnitude than Aave, but still useful because it shows:

- live protocol-specific snapshots
- event-driven activity
- measurable transaction-pressure contribution
- non-zero protocol-specific signal behavior above a near-zero base risk

This supports the thesis that pool-aware monitoring can be grant-funded as a focused ecosystem tooling layer rather than a purely conceptual analytics idea.

### Balancer

The current internal evidence for Balancer is distinct from the others because the highlighted signal is structural rather than transaction-pressure-driven. The high modeled risk with zero tx-pressure in the highlighted sample supports the thesis that Balancer monitoring should not be reduced to transaction-event alerting alone.

This is relevant to selected weighted and stable pool monitoring, where structural and market-state behavior may matter even when tx-event pressure is not the dominant source of risk movement.

## Review Position

The appendix does not claim that internal Mongo-backed figures are enough by themselves to eliminate all reviewer skepticism. A hostile reviewer may still ask for:

- reproducible benchmark methodology
- protocol-specific historical writeups
- false-positive framing
- more explicit operational outcomes

That criticism would be fair.

The appendix is intended to narrow the gap between:

- “this is only a polished proposal”
- and
- “this is a proposal built on an already-running evidence stack”

That is the standard this appendix is designed to satisfy.
