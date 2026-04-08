# Alert System Microservice

`src/alert_system` is a standalone alerts microservice split into two runtime stages:

1. `router`:
- listens to upstream risk/tx event streams,
- enriches and filters events (`severity`, `transactionTypeFilter`, `riskChangeTriggerPct`),
- maps alerts to subscribed users,
- enqueues delivery jobs into Redis Streams.

2. `worker`:
- consumes jobs from Redis Streams consumer group,
- delivers alerts to channels (Telegram/email placeholders),
- handles retries and dead-letter routing (DLQ).

This split removes direct `for user -> await deliver` bottlenecks and scales horizontally for large user counts.

## Files

- `alertManager.js`: router runtime (ingest/filter/fanout-to-queue).
- `queue/redisStreamQueue.js`: Redis Streams abstraction (enqueue/read/ack/requeue/dlq).
- `deliveryWorker.js`: queue consumer + delivery + retry policy.
- `index.js`: router entrypoint.
- `worker.js`: worker entrypoint.
- `telegramLinkBot.js`: Telegram `/start <link_token>` handler for account linking.

## Runtime Requirements

- Node.js 20+
- MongoDB (same data source as core platform)
- Redis 6+ (Streams + Consumer Groups)

## NPM Scripts

From repository root:

```bash
npm run alerts:router
npm run alerts:worker
npm run alerts:tg-link-bot
```

## Environment Variables

### Shared

- `MONGODB_URI`: Mongo connection string.
- `MONGODB_DB`: Mongo database name.
- `ALERT_QUEUE_REDIS_URL`: Redis URL (default `redis://127.0.0.1:6379`).
- `ALERT_QUEUE_STREAM`: stream name (default `alerts:delivery`).
- `ALERT_QUEUE_GROUP`: consumer group (default `alerts-delivery-group`).
- `ALERT_QUEUE_DLQ_STREAM`: DLQ stream (default `alerts:delivery:dlq`).
- `ALERT_QUEUE_MAXLEN`: max stream length (approx trim, default `100000`).

### Router (`alerts:router`)

- `ALERT_MANAGER_TX_WS_URL`: upstream tx events ws URL.
- `ALERT_MANAGER_RISK_WS_URL`: upstream risk events ws URL.
- `ALERT_MANAGER_WS_TOKEN`: optional auth token for upstream ws.
- `ALERT_MANAGER_ROUTING_REFRESH_MS`: user routing cache refresh interval (default `30000`).
- `ALERT_MANAGER_WS_RECONNECT_MS`: ws reconnect delay (default `5000`).
- `ALERT_MANAGER_PROCESS_SNAPSHOT`: process upstream `snapshot` payload on connect (`0`/`1`, default `0`).

### Worker (`alerts:worker`)

- `ALERT_WORKER_BATCH_SIZE`: stream read batch size (default `100`).
- `ALERT_WORKER_BLOCK_MS`: xreadgroup block timeout ms (default `5000`).
- `ALERT_WORKER_CONCURRENCY`: delivery concurrency per batch (default `25`).
- `ALERT_WORKER_MAX_RETRIES`: retries before DLQ (default `5`).
- `ALERT_WORKER_MAX_JOB_AGE_MS`: drop stale queued jobs older than this age in ms (default `0`, disabled).
- `ALERT_WORKER_SKIP_EXISTING_ON_START`: set `1` to skip existing stream backlog on worker startup (`XGROUP SETID ... $`).
- `ALERT_QUEUE_CONSUMER`: consumer name override (default `consumer-<pid>`).
- `TELEGRAM_BOT_TOKEN` or `TG_BOT_TOKEN`: Telegram Bot token.
- `SMTP_HOST`: SMTP host for email delivery.
- `SMTP_PORT`: SMTP port (default `587`).
- `SMTP_SECURE`: `1`/`true` to use SMTPS.
- `SMTP_USER`: SMTP username.
- `SMTP_PASS`: SMTP password.
- `ALERT_EMAIL_FROM` (optional): sender email address.

### Telegram Link Bot (`alerts:tg-link-bot`)

- `TELEGRAM_BOT_TOKEN` or `TG_BOT_TOKEN`: Telegram Bot token.
- `TELEGRAM_LINK_API_URL`: backend API endpoint for linking (default `http://localhost:3001/api/telegram/link`).
- `TELEGRAM_LINK_API_SECRET`: optional shared secret; sent in `x-telegram-link-secret`.
- `TELEGRAM_BOT_POLL_TIMEOUT_SEC`: long polling timeout in seconds (default `25`).
- `TELEGRAM_BOT_RECONNECT_MS`: retry delay on polling errors (default `3000`).

## Local Run Example

Terminal 1 (router):

```bash
ALERT_QUEUE_REDIS_URL=redis://localhost:6379 \
ALERT_MANAGER_TX_WS_URL=ws://localhost:8090/ws/alerts \
npm run alerts:router
```

Terminal 2 (worker):

```bash
ALERT_QUEUE_REDIS_URL=redis://localhost:6379 \
ALERT_QUEUE_CONSUMER=alerts-worker-1 \
npm run alerts:worker
```

Terminal 3 (telegram link bot):

```bash
TELEGRAM_BOT_TOKEN=<bot_token> \
TELEGRAM_LINK_API_URL=http://localhost:3001/api/telegram/link \
npm run alerts:tg-link-bot
```

## Delivery Semantics

- At-least-once delivery (Redis Streams consumer group pattern).
- Failed jobs are retried with incremented attempts.
- Jobs exceeding `ALERT_WORKER_MAX_RETRIES` are moved to DLQ stream.
- Worker is horizontally scalable via multiple replicas with distinct consumers.

## Telegram Integration Note

- `alerts:tg-link-bot` handles `/start <token>` and links Telegram account to user via backend API.
- `alerts:worker` uses linked Telegram destination (`alertPreferences.telegram`) as `chat_id`.
- `alerts:worker` also writes delivery records into `user_notifications` collection for in-app notification center (`System` filter).
