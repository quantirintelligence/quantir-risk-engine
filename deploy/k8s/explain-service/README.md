# Explain Service on Kubernetes

## 1) Build and Push Image

From repository root:

```bash
docker build -f Dockerfile.explain-service -t ghcr.io/your-org/defi-risk-engine-explain-service:<tag> .
docker push ghcr.io/your-org/defi-risk-engine-explain-service:<tag>
```

Update `deployment.yaml` image tag.

## 2) Create Secret

Option A (recommended):

```bash
kubectl -n defi-risk-engine create secret generic explain-service-secrets \
  --from-literal=MONGODB_URI='mongodb+srv://...' \
  --from-literal=OPENAI_API_KEY='' \
  --from-literal=ANTHROPIC_API_KEY='' \
  --from-literal=GEMINI_API_KEY=''
```

Option B: copy `secret.example.yaml` to a private file and apply it.

## 3) Deploy

```bash
kubectl apply -k deploy/k8s/explain-service
```

## 4) Verify

```bash
kubectl -n defi-risk-engine get pods -l app.kubernetes.io/name=explain-service
kubectl -n defi-risk-engine logs deploy/explain-service --tail=100
kubectl -n defi-risk-engine get svc explain-service
```

In-cluster URL:

- `http://explain-service.defi-risk-engine.svc.cluster.local:8096`
