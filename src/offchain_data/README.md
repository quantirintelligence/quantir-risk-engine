# Off-chain Protocol News Worker

This folder contains an independent RSS ingestion worker for risk-impacting protocol news.

## What it does

- Reads RSS/Atom feeds from `config/protocol_rss_sources.json`
- If feed endpoint is unavailable, falls back to parsing article links from HTML page
- Matches each article to enabled protocols from MongoDB (`protocols` collection)
- Saves matched articles to `protocol_news`
- Deduplicates with unique key `(protocol, dedupeKey)`

## Run

Single pass:

```bash
npm run offchain:news:once
```

Polling loop (default every 10 minutes):

```bash
npm run offchain:news
```

Debug test run (without DB writes):

```bash
npm run offchain:news:test
```

## Worker config

`config/protocol_news_worker.json` controls runtime behavior:

- `sourcesPath`
- `pollMs`
- `maxItemsPerFeed`
- `httpTimeoutMs`
- `debug`
- `dryRun`
- `rssHostFallbacks`

You can override at runtime:

- `--config <path>`
- `--env-file <path>`
- `--debug`
- `--dry-run`
- `OFFCHAIN_NEWS_DEBUG=1`
- `OFFCHAIN_NEWS_DRY_RUN=1`
