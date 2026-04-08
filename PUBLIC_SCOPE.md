# Public Scope

This repository is a curated public snapshot of the internal `defi-risk-engine` monorepo prepared for grant submissions.

Snapshot intent:

- preserve the main repository structure and module-level `README.md` files
- expose the protocol-facing monitoring core relevant to Uniswap and Balancer grants
- avoid publishing unrelated SaaS/product, user, billing, and operational code

## Why This Scope

As of April 8, 2026:

- the Uniswap Foundation public builder page states that its grants program funds teams building across the Uniswap ecosystem, including protocols, tooling, research, governance, and community work: [Uniswap Foundation Build](https://www.uniswapfoundation.org/build)
- the Balancer Grants public reports emphasize Balancer V3 adoption, tooling, devrel, hooks, and direct contributions around the core Balancer codebase: [Balancer Grants Wave 12 Final Report](https://forum.balancer.fi/t/grants-wave-12-q2-2024-final-report/5861)

Because of that, this public snapshot centers on protocol-facing monitoring and integration artifacts rather than the full product perimeter.

## Opened In This Public Repo

- on-chain ingestion core under `src/onchain_data/`
- Uniswap and Balancer protocol configs and ABI fragments
- risk-scoring core under `src/risk_model/`
- transaction-strategy layer under `src/strategies/`
- shared persistence contracts under `src/db/` that relate to snapshots, alerts, explanations, and charts
- protocol onboarding/config tooling under `src/config_builder/`
- grant materials and architecture docs under `docs/`
- structure-preserving `README.md` files for other modules

## Intentionally Not Published

- user account, auth, watchlist, billing, subscription, and notification persistence
- NextAuth and multi-tenant product backend implementation
- full alert delivery/user-routing implementation
- deployment manifests and environment-specific operational wiring
- LLM provider orchestration internals that are not required to evaluate the protocol-monitoring core
- private datasets, trained model weights, and other runtime artifacts

## Practical Reading Guide

If you are reviewing this repository for a grant:

1. Start with [README.md](./README.md)
2. Then review:
   - [docs/grants/uniswap-foundation-grant.md](./docs/grants/uniswap-foundation-grant.md)
   - [docs/grants/balancer-grants-proposal.md](./docs/grants/balancer-grants-proposal.md)
   - [docs/grants/proof-appendix.md](./docs/grants/proof-appendix.md)
3. For technical proof, focus on:
   - [src/onchain_data/README.md](./src/onchain_data/README.md)
   - [src/strategies/README.md](./src/strategies/README.md)
   - [src/risk_model/README.md](./src/risk_model/README.md)
   - [docs/onchain-provider-plane-architecture.md](./docs/onchain-provider-plane-architecture.md)

## Note On Runtime Completeness

This public snapshot is intentionally narrower than the internal monorepo. Some preserved README paths describe components whose full runtime implementation remains private in this grant-oriented repository.
