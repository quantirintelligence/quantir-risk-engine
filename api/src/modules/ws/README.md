# WebSocket Token Module

## Purpose

Issues short-lived JWTs used to authenticate the frontend against the alerts websocket.

## Responsibilities

- sign HS256 websocket tokens
- derive the signing secret from `WS_TOKEN_SECRET` or `AUTH_SECRET`

## Key File

- `token.ts`

## Main Consumers

- `api/src/app/api/ws/token/route.ts`
