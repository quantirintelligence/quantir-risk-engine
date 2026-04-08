# Chronos Predictor on Kubernetes

## 1) Build and Push Image

From repository root:

```bash
docker build -f Dockerfile.chronos -t ghcr.io/your-org/defi-risk-engine-chronos:<tag> .
docker push ghcr.io/your-org/defi-risk-engine-chronos:<tag>
```

Update `deployment.yaml` image tag.

## 2) Optional Secret for Hugging Face

If you use a gated/private model:

```bash
kubectl -n defi-risk-engine create secret generic chronos-secrets \
  --from-literal=HUGGINGFACE_HUB_TOKEN='hf_...'
```

If model is public, this secret is not required.

## 3) Deploy

```bash
kubectl apply -k deploy/k8s/chronos
```

## 4) Verify

```bash
kubectl -n defi-risk-engine get pods -l app.kubernetes.io/name=chronos
kubectl -n defi-risk-engine logs deploy/chronos --tail=100
kubectl -n defi-risk-engine get svc chronos
```

In-cluster URL:

- `http://chronos.defi-risk-engine.svc.cluster.local:8000/invocations`
