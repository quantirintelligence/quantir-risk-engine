# Onchain Engine on Kubernetes

`onchain-engine` should normally run as a single replica to avoid duplicated collectors/tx monitors.
Before deploying, ensure `risk-model` and `forecast-service` are already running in cluster.

## 1) Build and Push Image

From repository root:

```bash
docker build -f Dockerfile.onchain-engine -t ghcr.io/your-org/defi-risk-engine-onchain-engine:<tag> .
docker push ghcr.io/your-org/defi-risk-engine-onchain-engine:<tag>
```

Update `deployment.yaml` image tag.

## 2) Create Secret

Option A (recommended):

```bash
kubectl -n defi-risk-engine create secret generic onchain-engine-secrets \
  --from-literal=MONGODB_URI='mongodb+srv://...' \
  --from-literal=COINGECKO_KEY='' \
  --from-literal=ALCHEMY_WS_URL='wss://...' \
  --from-literal=WS_TOKEN_SECRET='' \
  --from-literal=AUTH_SECRET=''
```

Option B: copy `secret.example.yaml` to a private file and apply it.

## 3) Deploy

```bash
kubectl apply -k deploy/k8s/onchain-engine
```

## 4) Verify

```bash
kubectl -n defi-risk-engine get pods -l app.kubernetes.io/name=onchain-engine
kubectl -n defi-risk-engine logs deploy/onchain-engine --tail=100
kubectl -n defi-risk-engine get svc onchain-engine
```

Exposed in-cluster WS/API endpoint:

- `ws://onchain-engine.defi-risk-engine.svc.cluster.local:8090/ws/alerts`
