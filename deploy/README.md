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
