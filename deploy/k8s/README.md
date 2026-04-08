# Kubernetes Manifests

Microservice manifests live in separate folders:

- `alert-system`
- `risk-model`
- `onchain-engine`
- `offchain-news`
- `chronos`
- `forecast-service`
- `api`
- `risk-ui`

Deploy each service independently:

```bash
kubectl apply -k deploy/k8s/risk-model
kubectl apply -k deploy/k8s/chronos
kubectl apply -k deploy/k8s/forecast-service
kubectl apply -k deploy/k8s/onchain-engine
kubectl apply -k deploy/k8s/offchain-news
kubectl apply -k deploy/k8s/alert-system
kubectl apply -k deploy/k8s/api
kubectl apply -k deploy/k8s/risk-ui
```
