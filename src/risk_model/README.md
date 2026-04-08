# Risk Model

## Purpose

`src/risk_model/` is the Rust-based scoring service used by the on-chain engine to convert normalized protocol features into a base risk score.

It supports three modes:

- training
- one-off inference
- HTTP serving

## Input Features

The model consumes seven numeric features:

- `tvl`
- `tvl_delta_1d`
- `tvl_delta_7d`
- `price_delta_1d`
- `price_delta_7d`
- `volume_spike`
- `mcap_tvl_ratio`

Feature normalization lives in `src/features.rs`.

## Runtime Modes

### Train

```bash
cargo run -- train
```

Optional flags:

- `--data <path>`
- `--model <path>`

### Infer

```bash
cargo run -- infer --model data/model.safetensors \
  --tvl 1000000 \
  --tvl_d1 0.01 \
  --tvl_d7 -0.03 \
  --p_d1 0.02 \
  --p_d7 -0.09 \
  --vol 0.6 \
  --mcap_tvl 0.2
```

### Serve

```bash
cargo run -- serve --model data/model.safetensors
```

The HTTP server starts on `0.0.0.0:8080` and exposes:

- `POST /score`

Request contract:

```json
{
  "tvl": 1000000,
  "tvl_delta_1d": 0.01,
  "tvl_delta_7d": -0.03,
  "price_delta_1d": 0.02,
  "price_delta_7d": -0.09,
  "volume_spike": 0.6,
  "mcap_tvl_ratio": 0.2
}
```

Response contract:

```json
{
  "risk": 0.42
}
```

## File Map

- `src/main.rs`
  - CLI entrypoint for train / infer / serve
- `src/server.rs`
  - Axum HTTP server exposing `/score`
- `src/features.rs`
  - feature sanitization, clipping, and normalization
- `src/model.rs`
  - model definition
- `src/train.rs`
  - training loop
- `src/infer.rs`
  - model inference helpers
- `src/runtime.rs`
  - loaded runtime wrapper for serving
- `src/config.rs`
  - training configuration defaults

## Artifacts

- `data/model.safetensors`
  - saved trained weights
- `data/model.safetensors.norm.json`
  - normalizer statistics
- `data/dataset_ready.jsonl`
  - prepared dataset artifact checked into the repo

## Notes

- This service computes only the base model risk.
- Transaction-driven contribution is added later by `src/strategies/`.
- The on-chain engine is the main consumer of `/score`.
