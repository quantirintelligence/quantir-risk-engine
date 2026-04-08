# Sandbox DB Testing

Goal: test UI/forecast against real-looking data without touching the main DB.

## 1) Refresh sandbox from prod

```bash
SRC_DB=perseus \
DST_DB=perseus_sandbox \
DAYS=30 \
PROTOCOLS=aave,uniswap,curve \
USER_EMAIL=you@example.com \
COPY_USER_STATE=1 \
mongosh "$MONGODB_URI" --file scripts/sandbox/refresh_sandbox.mongosh.js
```

- `PROTOCOLS` optional (empty = all).
- `COPY_USER_STATE=1` optional (copies one user's auth/watchlist rows).

## 2) Point local services to sandbox

- root `.env`:
  - `MONGODB_DB=perseus_sandbox`
  - `TEST_RUN=true`
- `api/.env.local`:
  - `MONGODB_URI=.../perseus_sandbox?...`
  - `MONGODB_DB=perseus_sandbox`

## 3) Run locally

```bash
# terminal 1
cd api && npm run dev

# terminal 2
cd risk-ui && npm run dev

# optional terminal 3 (read-only behavior from TEST_RUN)
node src/onchain_data/index.js
```

## 4) Verify

- `http://localhost:3001/api/health` should show `"mongo.db": "perseus_sandbox"`.
- In UI, you should see populated history but writes stay in sandbox only.
