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

## Delivery Semantics

- At-least-once delivery (Redis Streams consumer group pattern).
- Failed jobs are retried with incremented attempts.
- Jobs exceeding `ALERT_WORKER_MAX_RETRIES` are moved to DLQ stream.
- Worker is horizontally scalable via multiple replicas with distinct consumers.

## Telegram Integration Note

- `alerts:tg-link-bot` handles `/start <token>` and links Telegram account to user via backend API.
- `alerts:worker` uses linked Telegram destination (`alertPreferences.telegram`) as `chat_id`.
- `alerts:worker` also writes delivery records into `user_notifications` collection for in-app notification center (`System` filter).
