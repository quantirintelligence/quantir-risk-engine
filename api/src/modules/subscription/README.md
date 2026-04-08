# Subscription Module

## Purpose

Maps a user plan to product limits and feature flags.

## Responsibilities

- resolve `maxProtocols`
- resolve realtime availability
- resolve AI prediction availability

## Key File

- `service.ts`

## Main Consumers

- `api/src/app/api/me/subscription/route.ts`
- `api/src/modules/dashboard/service.ts`
- `api/src/modules/monitor/service.ts`
