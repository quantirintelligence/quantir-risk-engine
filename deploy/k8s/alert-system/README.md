# Alert System on Kubernetes

This directory contains manifests for running the alert microservice as two workloads:

- `alerts-router` (ingest/filter/enqueue)
- `alerts-worker` (consume/deliver/retry/dlq)
- `alerts-tg-link-bot` (Telegram `/start <token>` account linking)

## 1) Build and Push Image

From repository root:

```bash
docker build -f Dockerfile.alert-system -t ghcr.io/your-org/defi-risk-engine-alert-system:<tag> .
docker push ghcr.io/your-org/defi-risk-engine-alert-system:<tag>
```

Update image in:

- `deployment-router.yaml`
- `deployment-worker.yaml`

## 2) Create Secrets

Option A (recommended): create secret via `kubectl`:

```bash
kubectl -n defi-risk-engine create secret generic alert-system-secrets \
  --from-literal=MONGODB_URI='mongodb+srv://...' \
  --from-literal=ALERT_MANAGER_WS_TOKEN='' \
  --from-literal=TELEGRAM_BOT_TOKEN='' \
  --from-literal=TELEGRAM_LINK_API_SECRET=''
```

Option B: copy `secret.example.yaml` to a private file and apply it.

## 3) Deploy

```bash
kubectl apply -k deploy/k8s/alert-system
```

## 4) Verify

```bash
kubectl -n defi-risk-engine get pods -l app.kubernetes.io/component=alert-system
kubectl -n defi-risk-engine logs deploy/alerts-router --tail=100
kubectl -n defi-risk-engine logs deploy/alerts-worker --tail=100
kubectl -n defi-risk-engine logs deploy/alerts-tg-link-bot --tail=100
```

## Scaling

```bash
kubectl -n defi-risk-engine scale deploy/alerts-router --replicas=3
kubectl -n defi-risk-engine scale deploy/alerts-worker --replicas=10
```

`alerts-worker` replicas safely scale horizontally because jobs are consumed through Redis Streams consumer group.
