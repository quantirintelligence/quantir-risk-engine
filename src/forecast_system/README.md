# Forecast System (Chronos)

Standalone Node.js service for short-horizon protocol forecasting.

Pipeline inside this module:

1. Read protocol snapshots and tx risk events from MongoDB.
2. Build fixed time buckets (`15m` or `1h`) and store them in `protocol_metrics_ts`.
3. Send metric series to local Chronos endpoint (Python adapter).
4. Recompute future risk from forecasted metrics.
5. Store future bars in `predicted_risk_ts`.

## Components

- Node orchestrator: `src/forecast_system`
- Python predictor adapter: `src/forecast_system/predictor`

## Run

1) Start Python predictor (port `8000` by default):

```bash
cd src/forecast_system/predictor
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

2) Start Node forecast service from project root:

```bash
npm run forecast:service
```

## What data goes into Chronos

Per protocol and interval, Node builds 5 numeric series in chronological order:

- `risk_score`
- `tvl_usd`
- `price_usd`
- `fdv_usd`
- `alerts_count`

Each series is a vector of last N bucket values (for example N=256 for 15m buckets).
Then Node sends request:

```json
{
  "inputs": [
    { "metric": "risk_score", "item_id": "risk_score", "target": [12.1, 12.4, 12.0] },
    { "metric": "tvl_usd", "item_id": "tvl_usd", "target": [100, 98, 97] }
  ],
  "parameters": {
    "prediction_length": 2,
    "quantile_levels": [0.1, 0.5, 0.9]
  }
}
```

`prediction_length` is clamped to 2..4 in this module.

## API (Node service)

### Health

```bash
curl -s http://127.0.0.1:8095/health
```

### Predict

```bash
curl -s -X POST http://127.0.0.1:8095/predict \
  -H 'Content-Type: application/json' \
  -d '{
    "protocol": "aave",
    "interval": "15m",
    "horizon": 2,
    "lookbackPoints": 256,
    "rebuildFeatures": false,
    "persist": true
  }'
```

### Read latest predicted bars

```bash
curl -s "http://127.0.0.1:8095/predicted/latest?protocol=aave&interval=15m&limit=4"
```
