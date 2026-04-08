# Chronos Python Predictor Adapter

Python service that loads Chronos once at startup and exposes HTTP endpoints for inference.

## Why this exists

- Chronos model inference runs in Python.
- `src/forecast_system` (Node.js) builds feature series from MongoDB and calls this adapter over HTTP.

## Run locally

```bash
cd src/forecast_system/predictor
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

`requirements.txt` pins CPU-only PyTorch (`torch==2.5.1+cpu`) to avoid downloading CUDA runtime packages in non-GPU environments.

## Environment variables

- `CHRONOS_MODEL_NAME` (default: `amazon/chronos-t5-small`)
- `CHRONOS_DEVICE` (default: `cpu`)
- `CHRONOS_DTYPE` (default: `float32`)
- `CHRONOS_NUM_SAMPLES` (default: `64`)
- `PREDICTOR_LOG_LEVEL` (default: `INFO`)

## Endpoints

- `GET /health`
- `GET /metadata`
- `POST /predict`
- `POST /invocations` (alias for `/predict`)

## Request contract

```json
{
  "inputs": [
    {
      "metric": "risk_score",
      "target": [12.4, 12.9, 13.1, 12.7, 12.8]
    },
    {
      "metric": "tvl_usd",
      "target": [1000000, 998000, 1004000, 995000, 989000]
    }
  ],
  "parameters": {
    "prediction_length": 2,
    "quantile_levels": [0.1, 0.5, 0.9],
    "num_samples": 64
  }
}
```

## Response contract

```json
{
  "model": "amazon/chronos-t5-small",
  "prediction_length": 2,
  "predictions": [
    {
      "metric": "risk_score",
      "mean": [13.0, 13.2],
      "0.1": [12.7, 12.9],
      "0.5": [13.0, 13.2],
      "0.9": [13.3, 13.6]
    }
  ],
  "predictions_by_metric": {
    "risk_score": {
      "mean": [13.0, 13.2],
      "0.1": [12.7, 12.9],
      "0.5": [13.0, 13.2],
      "0.9": [13.3, 13.6]
    }
  }
}
```
