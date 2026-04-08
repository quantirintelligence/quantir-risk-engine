# Forecast Service on Kubernetes

## 1) Build and Push Image

From repository root:

```bash
docker build -f Dockerfile.forecast-service -t ghcr.io/your-org/defi-risk-engine-forecast-service:<tag> .
docker push ghcr.io/your-org/defi-risk-engine-forecast-service:<tag>
```

Update `deployment.yaml` image tag.

## 2) Create Secret

Option A (recommended):

```bash
kubectl -n defi-risk-engine create secret generic forecast-service-secrets \
  --from-literal=MONGODB_URI='mongodb+srv://...'
```

Option B: copy `secret.example.yaml` to a private file and apply it.

## 3) Deploy

```bash
kubectl apply -k deploy/k8s/forecast-service
```

## 4) Verify

```bash
kubectl -n defi-risk-engine get pods -l app.kubernetes.io/name=forecast-service
kubectl -n defi-risk-engine logs deploy/forecast-service --tail=100
kubectl -n defi-risk-engine get svc forecast-service
```

In-cluster URL:

- `http://forecast-service.defi-risk-engine.svc.cluster.local:8095`
