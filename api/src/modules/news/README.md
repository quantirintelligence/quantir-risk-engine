# News Module

## Purpose

Exposes off-chain protocol news stored by the RSS ingestion worker.

## Responsibilities

- normalize protocol aliases
- deduplicate articles by canonicalized URL/title/date
- sanitize summaries for UI display
- return latest news per protocol or per user watchlist

## Data Source

- `protocol_news`

## Key Files

- `service.ts`
- `protocol-news.model.ts`

## Main Consumers

- `api/src/app/api/me/news/route.ts`
- dashboard bootstrap aggregation
