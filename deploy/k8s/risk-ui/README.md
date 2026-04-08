# Risk UI on Kubernetes

## 1) Build and Push Image

From repository root:

```bash
docker build -f Dockerfile.risk-ui -t registry.digitalocean.com/quantir-registry/defi-risk-engine-risk-model:risk-ui-v1 .
docker push registry.digitalocean.com/quantir-registry/defi-risk-engine-risk-model:risk-ui-v1
```

Update `deployment.yaml` image tag if you are not using `risk-ui-v1`.

## 2) Configure API/WS URLs and Domain

Edit:

- `configmap.yaml`:
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXT_PUBLIC_ALERTS_WS_URL`
- `ingress.yaml`:
  - `app.quantirintelligence.com`
  - `app-quantir-tls`

## 3) Deploy

```bash
kubectl apply -k deploy/k8s/risk-ui
```

## 4) Verify

```bash
kubectl -n defi-risk-engine get pods -l app.kubernetes.io/name=risk-ui
kubectl -n defi-risk-engine logs deploy/risk-ui --tail=100
kubectl -n defi-risk-engine get ingress risk-ui
```
