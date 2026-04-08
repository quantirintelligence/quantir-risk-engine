# Risk Model on Kubernetes

## 1) Build and Push Image

From repository root:

```bash
docker build -f Dockerfile.risk-model -t ghcr.io/your-org/defi-risk-engine-risk-model:<tag> .
docker push ghcr.io/your-org/defi-risk-engine-risk-model:<tag>
```

Update `deployment.yaml` image tag.

## 2) Deploy

```bash
kubectl apply -k deploy/k8s/risk-model
```

## 3) Verify

```bash
kubectl -n defi-risk-engine get pods -l app.kubernetes.io/name=risk-model
kubectl -n defi-risk-engine logs deploy/risk-model --tail=100
kubectl -n defi-risk-engine get svc risk-model
```

In-cluster URL for consumers:

- `http://risk-model.defi-risk-engine.svc.cluster.local:8080/score`
