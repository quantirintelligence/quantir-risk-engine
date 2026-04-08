# Offchain News Worker on Kubernetes

## 1) Build and Push Image

From repository root:

```bash
docker build -f Dockerfile.offchain-news -t ghcr.io/your-org/defi-risk-engine-offchain-news:<tag> .
docker push ghcr.io/your-org/defi-risk-engine-offchain-news:<tag>
```

Update `deployment.yaml` image tag.

## 2) Create Secret

Option A (recommended):

```bash
kubectl -n defi-risk-engine create secret generic offchain-news-secrets \
  --from-literal=MONGODB_URI='mongodb+srv://...'
```

Option B: copy `secret.example.yaml` to a private file and apply it.

## 3) Deploy

```bash
kubectl apply -k deploy/k8s/offchain-news
```

## 4) Verify

```bash
kubectl -n defi-risk-engine get pods -l app.kubernetes.io/name=offchain-news
kubectl -n defi-risk-engine logs deploy/offchain-news --tail=100
```

Scaling note: keep this worker at `1` replica unless you intentionally want concurrent ingestion loops.
