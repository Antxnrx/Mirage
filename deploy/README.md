# Deploy

## Images

| Image | How |
|---|---|
| `mirage-server` | `docker buildx build --platform linux/arm64 -t mirage-server:arm64 --load .` (repo root) |
| `mirage-zkool` (x86-64 host) | `deploy/zkool/Dockerfile` downloads the zkool_graphql release binary (checksum-pinned) |
| `mirage-zkool` (ARM64 host) | The release binary is x86-64 only. Cross-compile on an ARM Mac, then package: |

```bash
# in a zkool2 checkout at tag zkool-v6.36.0 (rust/ directory)
rustup target add aarch64-unknown-linux-gnu
cargo install --locked cargo-zigbuild        # needs `brew install zig`
cargo zigbuild --release --features graphql --bin zkool_graphql --target aarch64-unknown-linux-gnu.2.35
cp ../target/aarch64-unknown-linux-gnu/release/zkool_graphql <dir>/ && cp deploy/zkool/Dockerfile.arm64-prebuilt <dir>/Dockerfile
docker buildx build --platform linux/arm64 -t mirage-zkool:arm64 --load <dir>
```

`deploy/zkool/Dockerfile.build` builds from source inside Docker instead (needs more than 4 GB of Docker memory).

## OCI (shared production host)

The host runs other production tenants. Rules:
- **Own space:** Mirage lives in its own compose project at `/srv/mirage`. Never touch another project's files or containers.
- **Private wallet engine:** zkool is on the project network only (never published, never routed).
- **Routing:** Mirage joins the shared `edge` network as `mirage-app`; routing is one file, `/srv/edge/sites/mirage.caddy`.
- **Reload safely:** validate before reloading the shared proxy, then reload gracefully (no restart):
  ```bash
  docker exec edge-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
  docker exec edge-caddy-1 caddy reload   --config /etc/caddy/Caddyfile --adapter caddyfile
  ```
- **Ship images over SSH:** `docker save mirage-server:arm64 | gzip -1 | ssh oci docker load`
- **Update:** `cd /srv/mirage && docker compose up -d mirage` (recreates only Mirage's own container).

## CI/CD (GitHub Actions)

- **`ci.yml`:** on every PR and push to `main`, runs the mirage-core tests and typechecks the server.
- **`deploy.yml`:** on push to `main` (code changes only) or manual run:
  1. Runs CI, then builds the ARM64 image on a GitHub ARM runner.
  2. Ships it over SSH as a gzipped `docker save`.
  3. On the host, the deploy key may only run `/srv/mirage/deploy.sh` (forced command), which loads the image, recreates **only** the `mirage` container, health-checks it, and rolls back to the previous image on failure.

One-time setup (done by a maintainer with shell access):

```bash
# 1. Deploy key (keep the private half only in GitHub secrets)
ssh-keygen -t ed25519 -N "" -C mirage-ci-deploy -f ./mirage-deploy
# 2. On the host: allow it to run the deploy script and nothing else
echo "command=\"/srv/mirage/deploy.sh\",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty $(cat mirage-deploy.pub)" \
  | ssh oci 'cat >> ~/.ssh/authorized_keys'
# 3. GitHub secrets (repo → Settings → Environments → production)
gh secret set OCI_HOST --env production --body 140.238.167.7
gh secret set OCI_USER --env production --body ubuntu
gh secret set OCI_DEPLOY_KEY --env production < mirage-deploy
ssh-keyscan -t ed25519 140.238.167.7 | gh secret set OCI_KNOWN_HOSTS --env production
rm mirage-deploy
```
