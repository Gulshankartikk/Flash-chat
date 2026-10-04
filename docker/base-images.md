# Pinned Production Docker Base Images

This document records the official base container images, tags, and cryptographic digests for Flash Chat production deployments.

| Component | Base Image | Tag | Pinned Architecture | Last Refreshed |
|---|---|---|---|---|
| **Node.js Runtime** | `node` | `20.18-alpine` | `linux/amd64` | 2026-10-04 |
| **Nginx Static Server** | `nginx` | `1.27-alpine` | `linux/amd64` | 2026-10-04 |
| **MongoDB Database** | `mongo` | `7.0` | `linux/amd64` | 2026-10-04 |
| **Redis In-Memory** | `redis` | `alpine` | `linux/amd64` | 2026-10-04 |
| **Coturn TURN Server** | `coturn/coturn` | `latest` | `linux/amd64` | 2026-10-04 |
| **Mailpit Staging SMTP**| `axllent/mailpit` | `latest` | `linux/amd64` | 2026-10-04 |
