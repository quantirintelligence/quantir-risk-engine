# API on Kubernetes

## 1) Build and Push Image

From repository root:

```bash
docker build -f Dockerfile.api -t ghcr.io/your-org/defi-risk-engine-api:<tag> .
docker push ghcr.io/your-org/defi-risk-engine-api:<tag>
```

Update `deployment.yaml` image tag.

## 2) Create Secret

Option A (recommended):

```bash
kubectl -n defi-risk-engine create secret generic api-secrets \
  --from-literal=MONGODB_URI='mongodb+srv://...' \
  --from-literal=AUTH_SECRET='' \
  --from-literal=WS_TOKEN_SECRET='' \
  --from-literal=GOOGLE_CLIENT_ID='' \
  --from-literal=GOOGLE_CLIENT_SECRET='' \
  --from-literal=TELEGRAM_LINK_API_SECRET='' \
  --from-literal=TELEGRAM_BOT_USERNAME=''
```

Option B: copy `secret.example.yaml` to a private file and apply it.

## 3) Configure Domain and CORS

Edit:

- `configmap.yaml`:
  - `CORS_ALLOWED_ORIGINS`
  - `AUTH_ALLOWED_REDIRECT_ORIGINS`
  - `NEXTAUTH_URL`
- `ingress.yaml`:
  - `api.example.com`
  - `api-tls`

`/ws/alerts` in ingress is routed to `onchain-engine` so frontend can use one API host for REST + WS.

## 4) Deploy

```bash
kubectl apply -k deploy/k8s/api
```

## 5) Verify

```bash
kubectl -n defi-risk-engine get pods -l app.kubernetes.io/name=api
kubectl -n defi-risk-engine logs deploy/api --tail=100
kubectl -n defi-risk-engine get ingress api
```
