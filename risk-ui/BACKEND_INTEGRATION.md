# Backend Integration Map

This file documents all frontend interface points where backend data is consumed or sent.

## 1) Dashboard

- File: `/Users/pc/Desktop/github/risk-ui/app/page.js`
- Status: currently mock-driven (`dashboardApiMock`), but the full backend contract is already described in the top JSDoc comment.
- What to replace:
  - Replace `dashboardApiMock` with your API response using the same structure.
  - Keep fields for:
    - protocol-level KPIs
    - risk breakdown
    - time-series (`risk`, `price`)
    - suspicious transactions
    - risk news

## 2) Watchlist (Monitor tab)

- API file: `/Users/pc/Desktop/github/risk-ui/app/lib/watchlistApi.js`
- Used by: `/Users/pc/Desktop/github/risk-ui/app/monitor/page.js`
- Functions:
  - `fetchUserWatchlist(userId)`
    - GET: `/api/watchlist?userId={userId}`
    - Expected: `{ watchlist: [{ protocolId, addedAt }] }` or array
  - `addProtocolToWatchlist({ userId, protocolId, addedAt })`
    - POST: `/api/watchlist`
    - Body:
      ```json
      {
        "userId": "demo-user-001",
        "protocolId": "aave",
        "addedAt": "2026-02-22T10:00:00.000Z"
      }
      ```
- Local fallback: `localStorage` key prefix `risk-ui:watchlist:`

## 3) Alerts + Socket

- API file: `/Users/pc/Desktop/github/risk-ui/app/lib/alertsApi.js`
- Used by: `/Users/pc/Desktop/github/risk-ui/app/alerts/page.js`
- Functions:
  - `fetchAlerts(userId)`
    - GET: `/api/alerts?userId={userId}`
    - Expected: `{ alerts: [...] }` or array
  - `connectAlertsSocket({ userId, onSnapshot, onAlert, onStatus, onError })`
    - WS URL:
      - `NEXT_PUBLIC_ALERTS_WS_URL`, or
      - derived from `NEXT_PUBLIC_API_BASE_URL` + `/ws/alerts`
    - Query param: `?userId={userId}`
    - Supported message types:
      - `snapshot` with list
      - `alert_created`
      - `alert_updated`

## 4) Tools subscriptions / upgrade

- API file: `/Users/pc/Desktop/github/risk-ui/app/lib/toolsApi.js`
- Used by: `/Users/pc/Desktop/github/risk-ui/app/tools/page.js`
- Functions:
  - `fetchUserToolSubscriptions(userId)`
    - GET: `/api/tool-subscriptions?userId={userId}`
    - Expected: `{ subscriptions: [{ toolId, status, subscribedAt, requestedAt }] }` or array
  - `requestToolUpgrade({ userId, toolId, requestedAt })`
    - POST: `/api/tool-upgrade-requests`
    - Body:
      ```json
      {
        "userId": "demo-user-001",
        "toolId": "arbitrage-risk-engine",
        "requestedAt": "2026-02-22T10:00:00.000Z"
      }
      ```
- Local fallback: `localStorage` key prefix `risk-ui:tool-subscriptions:`

## 5) Changelog

- API file: `/Users/pc/Desktop/github/risk-ui/app/lib/changelogApi.js`
- Used by: `/Users/pc/Desktop/github/risk-ui/app/changelog/page.js`
- Functions:
  - `fetchChangelog(userId)`
    - GET: `/api/changelog?userId={userId}`
    - Expected: `{ changelog: [...] }` or array
    - Entry shape:
      - `id`
      - `version`
      - `date` (`YYYY-MM-DD`)
      - `featuresAdded: string[]`
      - `modelImprovements: string[]`
      - optional `notes`

## 6) Settings

- API file: `/Users/pc/Desktop/github/risk-ui/app/lib/settingsApi.js`
- Used by: `/Users/pc/Desktop/github/risk-ui/app/settings/page.js`
- Functions:
  - `fetchUserSettings(userId)`
    - GET: `/api/settings?userId={userId}`
    - Expected: `{ settings: {...} }` or object
  - `saveUserSettings({ userId, settings })`
    - POST: `/api/settings`
  - `sendTestAlert({ userId })`
    - POST: `/api/settings/test-alert`
- Settings object fields:
  - `email`
  - `telegram`
  - `defaultSeverityThreshold`
  - `alertFrequency`
  - `networkSelection`
  - `whaleMovementTriggerPct`
  - `tvlAnomalyTriggerPct`
  - `governanceRiskTrigger`
  - `currentPlan`
  - `renewalDate`
  - `notes`

## 7) Current Plan / plan upgrade

- API file: `/Users/pc/Desktop/github/risk-ui/app/lib/planApi.js`
- Used by: `/Users/pc/Desktop/github/risk-ui/app/current-plan/page.js`
- Functions:
  - `fetchUserPlanState(userId)`
    - GET: `/api/current-plan?userId={userId}`
    - Expected:
      ```json
      {
        "currentPlanId": "base",
        "requestStatusByPlanId": {
          "pro": "requested"
        }
      }
      ```
  - `requestPlanUpgrade({ userId, targetPlanId })`
    - POST: `/api/current-plan/upgrade`
    - Body:
      ```json
      {
        "userId": "demo-user-001",
        "targetPlanId": "pro",
        "requestedAt": "2026-02-22T10:00:00.000Z"
      }
      ```
- Local fallback: `localStorage` key prefix `risk-ui:plan:`

## 8) Logout

- API file: `/Users/pc/Desktop/github/risk-ui/app/lib/authApi.js`
- Used by: `/Users/pc/Desktop/github/risk-ui/app/components/AccountMenu.js`
- Functions:
  - `logoutUser({ userId })`
    - POST: `/api/auth/logout` (with `credentials: include`)
    - Then clears client session keys
  - `clearClientSession()`
    - Clears:
      - `risk-user-session`
      - `dashboard:selectedProtocolId`
      - all keys with `risk-ui:` prefix
    - Keeps `risk-theme`

## 9) Environment variables

- `NEXT_PUBLIC_API_BASE_URL` (used by all REST helpers)
- `NEXT_PUBLIC_ALERTS_WS_URL` (optional, explicit alerts websocket URL)

## 10) Quick wiring checklist

1. Set `NEXT_PUBLIC_API_BASE_URL` in your env.
2. Implement REST routes listed above.
3. Implement alerts websocket endpoint (optional but recommended).
4. Replace placeholder `userId = 'demo-user-001'` in:
   - `/Users/pc/Desktop/github/risk-ui/app/monitor/page.js`
   - `/Users/pc/Desktop/github/risk-ui/app/tools/page.js`
   - `/Users/pc/Desktop/github/risk-ui/app/settings/page.js`
   - `/Users/pc/Desktop/github/risk-ui/app/changelog/page.js`
   - `/Users/pc/Desktop/github/risk-ui/app/current-plan/page.js`
   - `/Users/pc/Desktop/github/risk-ui/app/components/AccountMenu.js`
5. Connect dashboard payload in `/Users/pc/Desktop/github/risk-ui/app/page.js` replacing `dashboardApiMock`.
