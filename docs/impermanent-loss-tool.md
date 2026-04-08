# Impermanent Loss Tool Proposal

## Why This Should Be A Separate Tool

Impermanent loss is not the same type of signal as the current protocol risk score.

- The existing engine is protocol-centric.
- Impermanent loss is position-centric.
- The current platform stores user watchlists and protocol preferences, but it does not store user LP positions.
- The current market history is mostly protocol-token history, while LP analysis requires pool-specific pair price history.

Because of that, IL should start as a separate user-facing analytics tool, not as a direct input into the core protocol risk score.

## Quant Logic Summary

### Realized IL

For a constant-product AMM like Uniswap v2, impermanent loss is the difference between:

- the current LP position value
- and the value of simply holding the originally deposited assets

Using the normalized price ratio `r = P_t / P_0`, the standard v2 IL percentage is:

`IL_v2(r) = 2 * sqrt(r) / (1 + r) - 1`

This is a percentage loss versus HODL. It does **not** depend on the deposit size by itself.

### Position Size Nuance

This is the main product point that matters for this repository.

- IL percentage is mostly path/range dependent.
- Dollar PnL depends on the deposited notional.
- Net LP outcome depends on fees, and fee income depends on the position's share of active liquidity.

So the user is right that the useful runtime metric is position-aware. But the core IL formula itself does not require full vault machinery to exist first. We can model it from a saved scenario.

### Expected IL

The GammaSwap article models expected IL under Geometric Brownian Motion.

For v2, if log returns follow GBM with drift `mu` and volatility `sigma`, expected IL has a closed form:

`E[IL_v2(t)] = exp(-(sigma^2 * t) / 8) / cosh((mu * t) / 2) - 1`

This is useful because it gives a fast heatmap over:

- horizon
- volatility
- drift

For concentrated liquidity in Uniswap v3, the payoff is piecewise because the position behaves differently:

- below the range
- inside the range
- above the range

For non-trivial ranges there is no simple closed form that is practical here. A Monte Carlo approach is the right MVP path.

## What This Repository Already Has

The project already has several pieces that are reusable:

- `risk-ui/app/tools/page.js`
  There is already a separate tools surface in the UI.
- `api/src/modules/dashboard/service.ts`
  There is already a user-scoped aggregation layer and chart payload loading.
- `src/onchain_data/chartHelpers/ChartPayloadBuilder.js`
  The project already builds multi-range chart payloads for the frontend.
- `src/onchain_data/index.js`
  Derived metrics already include `liquidity_usd`, `liquidity_to_tvl_ratio`, `primary_pool_share`, and network-scoped snapshots.
- `src/db/UserProtocol.js` and `src/db/UserSettings.js`
  The project already has user-scoped persistence patterns that can be mirrored for LP scenarios.

This means the clean integration pattern is:

1. create a new tool
2. give it its own user-scoped scenario storage
3. reuse the existing chart and dashboard conventions where useful

## What The Repository Does Not Have Yet

There are two hard blockers for accurate IL analytics:

### 1. No User LP Position Storage

There is no entity that stores:

- pool
- token pair
- fee tier
- range lower bound
- range upper bound
- entry price
- deposit amounts
- rebalance assumptions

### 2. No Pool-Specific Pair Price History

Current candles are protocol-level market candles. That is not enough for LP analytics.

Examples:

- Uniswap protocol token price is not the same thing as ETH/USDC pool price.
- A user LP position is tied to `token0/token1` in a specific pool, not to the governance token of the protocol.

So an IL tool must be pool-aware, not only protocol-aware.

## Recommended Product Approach

### Recommendation

Do **not** build full vaults first.

Start with **virtual LP scenarios**:

- they are user-defined
- they are persisted
- they behave like lightweight paper positions
- they produce runtime analytics without requiring onchain execution or custody

This is the fastest way to get useful data into the product.

### Suggested Product Modes

#### Mode A: Quick Calculator

Ephemeral calculation without persistence.

User enters:

- protocol / network
- pool or token pair
- current price or fetch current price automatically
- fee tier
- position type: v2 or v3
- range bounds for v3
- deposit amounts or notional
- horizon
- volatility assumption
- drift assumption

Output:

- current IL %
- expected IL %
- dollar PnL estimate
- probability of leaving the selected range
- break-even fee estimate

This mode is enough for an MVP and does not require user state beyond the request payload.

#### Mode B: Saved LP Scenarios

Persist the scenario and recompute it in runtime.

This is the feature that gives the user the "vault-like" experience without building real vaults:

- save multiple scenarios per user
- refresh them on each page load
- attach alerts
- compare scenarios side by side

This is the best first durable version for this repository.

#### Mode C: Imported Real Positions

Later, add import from:

- wallet address
- Uniswap NFT position manager data
- external LP position APIs

This should be a later phase because it adds indexing, auth, and chain-specific sync complexity.

## Proposed Data Model

### UserLpScenario

Suggested fields:

- `userId`
- `name`
- `protocol`
- `network`
- `dex`
- `poolAddress`
- `poolType` (`uniswap-v2`, `uniswap-v3`)
- `token0Symbol`
- `token1Symbol`
- `token0Address`
- `token1Address`
- `feeTierBps`
- `entryPrice`
- `currentPriceSource`
- `rangeLower`
- `rangeUpper`
- `depositToken0`
- `depositToken1`
- `depositUsd`
- `assumedVolatility`
- `assumedDrift`
- `assumedHorizonDays`
- `rebalanceMode` (`none`, `range-reset`, `manual`)
- `status`
- `createdAt`
- `updatedAt`

### Pool Metadata Cache

Suggested fields:

- `protocol`
- `network`
- `poolAddress`
- `dex`
- `poolType`
- `token0`
- `token1`
- `feeTier`
- `tickSpacing`
- `currentLiquidityUsd`
- `volumeUsd24h`
- `updatedAt`

### Pool Candle History

Suggested fields:

- `poolAddress`
- `interval`
- `bucketStart`
- `open`
- `high`
- `low`
- `close`
- `source`

This is the minimum required to estimate:

- realized volatility
- range breach frequency
- historical realized IL

## Proposed API Surface

### User Scenario Endpoints

- `GET /api/me/lp-scenarios`
- `POST /api/me/lp-scenarios`
- `PATCH /api/me/lp-scenarios/:id`
- `DELETE /api/me/lp-scenarios/:id`

### Runtime Calculation Endpoints

- `POST /api/tools/impermanent-loss/quote`
- `POST /api/tools/impermanent-loss/simulate`
- `GET /api/tools/impermanent-loss/pools?protocol=...&network=...`

### Response Shape For Runtime Quote

The response should be opinionated and visualization-ready:

- `currentIlPct`
- `expectedIlPct`
- `expectedIlUsd`
- `holdValueUsd`
- `lpValueUsd`
- `netAfterFeesUsd`
- `breakEvenFeesUsd`
- `breakEvenApr`
- `rangeExitProbability`
- `insideRangeProbability`
- `pricePathBands`
- `heatmap`
- `payoffCurve`
- `assumptions`

## Where To Put The Logic

### API Layer

Add a new module:

- `api/src/modules/impermanent-loss/service.ts`

This service should:

- validate scenario inputs
- normalize price/range inputs
- calculate current IL
- calculate expected IL
- return chart-ready payloads

### UI Layer

Add a dedicated route instead of overloading the main dashboard:

- `risk-ui/app/tools/impermanent-loss/page.js`

And add a card to:

- `risk-ui/app/tools/page.js`

This keeps the new feature aligned with the current product structure.

### Data Collection Layer

Do not place user-position computations in the main protocol snapshot loop.

Instead, add one of these:

- a small API-side service that computes on demand from cached pool data
- or a dedicated collector/cache for pool metadata and pool candles

This avoids coupling position analytics to the global protocol risk runtime.

## Visualization Ideas

### 1. Payoff Curve

X-axis:

- future price ratio relative to entry

Y-axis:

- IL %
- or net LP outcome after fees

Add markers for:

- current price
- lower bound
- upper bound

This is the most intuitive chart for v3.

### 2. Expected IL Heatmap

Two good variants:

- `volatility x horizon`
- `range width x horizon`

This matches the GammaSwap article well and is easy to understand.

### 3. Range Overlay On Price Chart

Reuse the existing multi-range chart patterns from the dashboard:

- show historical pair price candles
- draw the LP range band
- show the percentage of recent time spent in range

This is a strong bridge between the current frontend style and LP analytics.

### 4. Probability Fan

Show:

- median path
- lower quantile
- upper quantile
- range breach zones

This works especially well if the project later reuses forecast quantiles instead of pure GBM.

### 5. Break-Even Panel

Actionable output matters more than raw IL.

The tool should show:

- expected fees needed to offset expected IL
- observed 24h/7d pool fee proxy
- whether the scenario is likely fee-positive or fee-negative

## Best MVP For This Repository

The best MVP is:

1. manual scenario input
2. saved "virtual vault" scenarios
3. current IL + expected IL
4. payoff chart + heatmap
5. no wallet import yet

This is enough to validate product demand while keeping implementation manageable.

## Suggested Rollout Phases

### Phase 1: Calculator

- add tool card
- add page
- add quote endpoint
- use manual inputs
- use protocol/pool lookup plus external current price

### Phase 2: Saved Scenarios

- add `UserLpScenario`
- persist user presets
- recompute on load
- add alert thresholds

### Phase 3: Pool Data Cache

- persist pool metadata
- persist pair candles
- estimate realized volatility from actual pool pair history
- add historical backtest mode

### Phase 4: Fee-Aware Net LP Analytics

- estimate fee income from pool volume and active liquidity assumptions
- show `fees - IL`
- add break-even and scenario ranking

### Phase 5: Wallet Sync

- import real positions
- sync position NFTs
- support runtime updates without manual inputs

## Important Design Guardrails

### Keep It Separate From Core Risk Score

Protocol risk and LP strategy risk should not be mixed early.

Examples:

- a safe protocol can still be a poor LP strategy
- a risky protocol can still have a profitable short-term LP window

### Do Not Use Protocol Token Price As A Hidden Proxy

If pair price data is unavailable, the UI must clearly label the result as a proxy or refuse the calculation.

Silent substitution would make the tool misleading.

### Make Assumptions Explicit

Every quote should disclose:

- price source
- volatility source
- drift assumption
- fee assumption
- rebalance assumption

Without this, users will read a model output as a deterministic truth.

## Bottom Line

The right way to "play around" the missing vault mechanics is not to wait for full vault infrastructure.

The right abstraction is:

- lightweight user-scoped LP scenarios
- pool-aware data
- a separate impermanent-loss tool
- visual outputs that explain range risk and fee break-even

That gets the repository to a useful LP analytics product quickly while staying consistent with the current architecture.
