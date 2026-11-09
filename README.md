# Application Deployer acceptance fixture

This disposable repository exercises the D1/D2 deployer path against a real
rootless host. It is a template prepared by the deployer developer; it is not
part of the monorepo and must not contain credentials.

## What it deploys

- `front-accept`: a Node frontend, `/health` for the deployer gate and `/api`
  for a server-side call to the backend.
- `ms-accept`: a Node backend with a managed PostgreSQL add-on, `/health`,
  `/db` and `/secret`.
- `migration: node migrate.mjs` creates and seeds `acceptance_migration` in the
  managed database.
- `compose.yaml` is the deployment contract; the CI builds and pushes both
  images to GHCR by digest.

## Prerequisites

1. A **public** GitHub repository created from this directory, default branch
   `main`. The deployer's read-only Git source does not support private
   repository credentials yet.
2. Public GHCR packages: after the first push, set the
   `front-accept` and `ms-accept` package visibility to public. The deployer
   pulls anonymously and has no registry credential.
3. A host-local GitHub Actions self-hosted runner with the label
   `app-deployer-acceptance`, installed directly on the host (not in a bridge
   container), with `curl`, `jq` and `node` available. It must not have sudo,
   must not be in the `docker` group, and must not have access to the
   `app-deployer` account or its rootless socket. The workflow calls the
   loopback deployer API; a GitHub-hosted runner cannot reach it.
4. Rootless Docker and the Application Deployer are provisioned. Use
   `deploy/provision.sh` for all configuration; do not edit `deployer.env` by
   hand.

## Deployer provisioning

Example for dev (replace the PostgreSQL digest):

```bash
sudo env \
  PROVISION_DEV_DEPLOYER_EXECUTION_ENABLED=true \
  PROVISION_DEV_DEPLOYER_ALLOWED_REGISTRIES=ghcr.io,docker.io \
  PROVISION_DEV_POSTGRES_IMAGE='docker.io/library/postgres@sha256:...' \
  deploy/provision.sh --app deployer --env dev
```

Use the same with `PROVISION_PROD_*` and `--env prod` after dev is accepted.
`provision.sh --help` lists every configuration input. It refuses to start with
execution enabled unless the rootless Docker socket and
`/srv/app-deployer/run/nginx.sock` exist.

To obtain a pinned PostgreSQL image digest:

```bash
docker buildx imagetools inspect postgres:16 --format '{{json .Manifest.Digest}}'
```

## Run

- Push to `main` (or run the workflow with `target=dev`) to build, push and
  submit the release to the dev deployer. Dev executes automatically.
- Run the workflow manually with `target=both` to submit the same digest to dev
  and production. Production stays `AWAITING_APPROVAL`.
- Approve production with the operator token on the host:

  ```bash
  curl -fsS -X POST \
    -H "Authorization: Bearer $DEPLOYER_OPERATOR_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $(uuidgen)" \
    http://127.0.0.1:8791/v1/deployments/<deployment-id>/approve \
    -d '{"releaseId":"<release-id>","commitSha":"<commit>","digest":"sha256:<primary-image-digest>"}'
  ```

  The operator token lives in `/etc/app-deployer/prod/deployer.env` and must
  never be committed to this repository or sent to Product Intake.

## Evidence to collect

- `GET /v1/deployments/<id>`: status transitions and the release image digest.
- `GET /v1/deployments/<id>/access`: dev loopback edge port, then the SSH
  tunnel command `ssh -N -L <local>:127.0.0.1:<edge-port> <host>`.
- `GET /v1/deployments/<id>/logs?service=ms-accept&tail=100`: bounded, redacted
  logs.
- `https://builder-front-accept.vlanp.com/api` and
  `https://builder-ms-accept.vlanp.com/db`: front-to-backend and migration
  evidence.
- `POST /v1/deployments/<id>/database/backup` with the operator token: backup
  filename and checksum.
- Git commit that makes `ms-accept` `/health` return 500: the next release must
  become `ROLLED_BACK` while the previous release stays `ACTIVE`.

## Rollback drill

1. Change `apps/ms-accept/server.mjs` so `/health` returns HTTP 500; commit and
   push to `main` (or run `target=both`).
2. Dev observes `ROLLED_BACK`; the previous release remains `ACTIVE`.
3. For production, approve the new digest, observe `ROLLED_BACK`, and verify the
   previous builder vhost is restored.
4. Revert the health change and push a clean release.

Do not run this drill against a customer repository or a production application
that matters.
