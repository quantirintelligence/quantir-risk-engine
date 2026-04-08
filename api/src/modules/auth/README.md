# Auth Module

## Purpose

Defines the NextAuth configuration used by the API service.

## Responsibilities

- Google OAuth provider setup
- credentials provider setup
- user auto-provisioning on sign-in
- JWT/session enrichment with `userId`, `role`, and `plan`
- redirect origin allowlisting

## Key File

- `auth.config.ts`

## Main Consumers

- `api/src/app/api/auth/[...nextauth]/route.ts`
- `api/src/modules/userContext/server.ts`
