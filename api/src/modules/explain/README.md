# Explain Module

## Purpose

Provides API-side access to stored explain jobs and forwards manual explain requests to `explain-service`.

## Responsibilities

- list explain jobs for monitored protocols
- validate that manual explain requests target watched protocols
- forward manual requests to `EXPLAIN_SERVICE_URL`
- normalize explain job documents for the frontend

## Data Source

- `explain_jobs`

## Key Files

- `service.ts`
- `explain-job.model.ts`

## Main Consumers

- `api/src/app/api/me/explain-jobs/route.ts`
