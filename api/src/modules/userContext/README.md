# User Context Module

## Purpose

Resolves the authenticated user from the current NextAuth session and loads the corresponding Mongo user document.

## Key File

- `server.ts`

## Main Consumers

- authenticated route handlers using `withUser(...)`
