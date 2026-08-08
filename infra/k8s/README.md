# Kubernetes deployment (optional)

Kubernetes is **not required**. Use `infra/docker/docker-compose.yml` for simpler deployments.

Use this directory when you need:

- Horizontal Pod Autoscaling (HPA)
- Rolling updates across nodes
- PodDisruptionBudgets for maintenance

## Prerequisites

- Same container images built from `infra/docker/Dockerfile.*`
- Managed PostgreSQL and Redis **recommended** (or in-cluster with persistent volumes)
- S3-compatible storage for OTA artifacts (prefer external bucket + CDN, not PVC for multi-GB zips)

## Apply order

```bash
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml          # or ExternalSecrets
kubectl apply -f postgres.yaml        # optional if using managed DB
kubectl apply -f redis.yaml             # optional if using managed Redis
kubectl apply -f dashboard-deployment.yaml
kubectl apply -f worker-deployment.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml               # optional autoscaling
```

## OTA traffic on K8s

**Recommended:** Point `OTA_PUBLIC_BASE_URL` to CDN/object storage directly.  
Do not route gigabyte `.zip` downloads through the dashboard Ingress.

nginx Ingress (if used) must disable compression for OTA paths — see `infra/nginx/nginx.conf`.

## Environment variables

Identical keys to Docker Compose `.env.example`. Inject via `Secret` + `ConfigMap`.

## Scaling guide

| Signal | Action |
|--------|--------|
| High metadata QPS | CDN cache + nginx rate limits |
| Slow downloads | Scale object storage egress / CDN |
| Validation backlog | Increase `worker` replicas + `WORKER_CONCURRENCY` |
| Admin latency | Increase `dashboard` replicas (HPA) |

## Files

Manifests are added incrementally during Stage 6/7. Placeholder structure only until application images exist.
