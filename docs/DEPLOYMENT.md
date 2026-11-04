# Flash Chat - Production Deployment & Operations Guide

This guide outlines the production deployment, infrastructure architecture, high-availability configuration, security hardening, and operational runbooks for **Flash Chat**.

> [!TIP]
> For release preparation, versioning policies, and step-by-step deployment runbooks, refer to [RELEASING.md](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/RELEASING.md) and [docs/RELEASING.md](file:///c:/Users/kg872/Documents/GitHub/Flash-chat/docs/RELEASING.md).

---

## 1. System Architecture & Sizing

Flash Chat is architected as a distributed real-time MERN super-app with Redis pub/sub, MongoDB persistence, Coturn WebRTC relay, and Nginx reverse proxy.

```
                     +---------------------------------------+
                     |         Internet Clients / PWA        |
                     +-------------------+-------------------+
                                         | HTTPS (443) / WSS
                                         v
                     +---------------------------------------+
                     |           Nginx Reverse Proxy         |
                     |       (SSL Termination, Rate Limit)   |
                     +---+------------------+-------------+--+
                         |                  |             |
           /api & /socket.io (HTTP/1.1)     | SSE Stream  | Static Assets (PWA)
                         |                  | (No Buffer) |
                         v                  v             v
             +-----------------------+  +-------+    +---------------+
             | Node.js API Instances |  | AI SSE|    | React Client  |
             | (Express + Socket.IO) |  | Stream|    | (Vite SPA)    |
             +-----------+-----------+  +-------+    +---------------+
                         |
           +-------------+-------------+
           |                           |
           v                           v
+--------------------+      +--------------------+
| MongoDB (Replica)  |      | Redis Cluster/PubSub|
| (Chats, Feeds, DB) |      | (Socket.IO Adapter) |
+--------------------+      +--------------------+
                                       ^
                                       | ICE / TURN Relay
                            +----------+---------+
                            |    Coturn Server   |
                            | (Audio/Video Calls)|
                            +--------------------+
```

### Recommended Infrastructure Sizing

| Environment | Specs | Target Concurrency | Target DAU |
| :--- | :--- | :--- | :--- |
| **Minimum / Staging** | 2 vCPU, 4 GB RAM, 40 GB SSD | Up to 500 concurrent sockets | ~5,000 DAU |
| **Production (Standard)** | 4 vCPU, 8 GB RAM, 80 GB NVMe | 2,000+ concurrent sockets | ~50,000 DAU |
| **Production (Clustered)** | 2x (4 vCPU, 8 GB RAM), Managed Mongo + Redis | 10,000+ concurrent sockets | 250,000+ DAU |

---

## 2. Environment Configuration Checklist

Create a secure `.env` file in the root directory based on `.env.example`.

### Required Production Environment Variables

```ini
# --- Core Environment ---
NODE_ENV=production
PORT=5000
CLIENT_URL=https://yourdomain.com
API_URL=https://yourdomain.com/api

# --- Persistence ---
MONGO_URI=mongodb://flash_user:SECURE_MONGO_PASSWORD@mongo:27017/flashchat?authSource=admin
REDIS_URL=redis://:SECURE_REDIS_PASSWORD@redis:6379

# --- Authentication & JWT Security ---
JWT_ACCESS_SECRET=GENERATE_64_CHAR_HEX_SECRET_FOR_ACCESS
JWT_REFRESH_SECRET=GENERATE_64_CHAR_HEX_SECRET_FOR_REFRESH
COOKIE_SECRET=GENERATE_64_CHAR_HEX_SECRET_FOR_COOKIES

# --- Web Push (VAPID) ---
# Generate with: cd server && node -e "const wp=require('web-push');console.log(wp.generateVAPIDKeys())"
VAPID_PUBLIC_KEY=YOUR_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=YOUR_VAPID_PRIVATE_KEY
VAPID_SUBJECT=mailto:admin@yourdomain.com

# --- Third-Party Integrations (Optional / Mock fallback) ---
# SMS OTP (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Email OTP (Nodemailer / SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=585
SMTP_USER=apikey
SMTP_PASS=YOUR_SENDGRID_OR_MAILGUN_KEY
SMTP_FROM="Flash Chat <noreply@yourdomain.com>"

# Media Storage (Cloudinary)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Multimodal AI (Google Gemini)
GEMINI_API_KEY=YOUR_GOOGLE_GEMINI_API_KEY

# WebRTC Coturn Signaling
COTURN_SECRET=SECURE_TURN_SHARED_SECRET
COTURN_SERVER=turn:yourdomain.com:3478
```

---

## 3. Production Docker Deployment

We provide a complete production Compose specification in `docker-compose.prod.yml`.

### Quick Start Production Boot

```bash
# 1. Clone repository
git clone https://github.com/your-org/flash-chat.git
cd flash-chat

# 2. Configure environment
cp .env.example .env
# Edit .env with your real credentials and secrets

# 3. Build and launch all services in detached mode
docker compose -f docker-compose.prod.yml up -d --build

# 4. Verify service health and logs
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f server
```

### Health Check Verification

Ensure all endpoints respond with status code 200:

```bash
# Liveness probe
curl -f http://localhost/api/health
# Output: {"status":"ok","timestamp":"2026-10-03T...","uptime":...}

# Readiness probe (verifies MongoDB & Redis connections)
curl -f http://localhost/api/ready
# Output: {"status":"ready","database":"connected","redis":"connected"}
```

---

## 4. Domain, DNS & Nginx SSL Setup

### DNS Records

Point your domain DNS records to your server IP:
- `A` record: `@` -> `YOUR_SERVER_PUBLIC_IP`
- `A` record: `www` -> `YOUR_SERVER_PUBLIC_IP`
- `A` record: `turn` -> `YOUR_SERVER_PUBLIC_IP` (for WebRTC Coturn)

### Let's Encrypt SSL Configuration with Certbot

```bash
# Install certbot
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain SSL Certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com -d turn.yourdomain.com
```

### Nginx Production Configuration (`/etc/nginx/sites-available/flashchat`)

```nginx
# Upstream clusters
upstream api_cluster {
    server 127.0.0.1:5000;
    keepalive 32;
}

# HTTP -> HTTPS Redirect
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

# HTTPS Main Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # 1. API Endpoints
    location /api/ {
        proxy_pass http://api_cluster;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 2. Gemini AI Streaming (SSE - disable proxy buffering)
    location /api/ai/stream {
        proxy_pass http://api_cluster;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
        proxy_read_timeout 600s;
    }

    # 3. WebSockets (Socket.IO)
    location /socket.io/ {
        proxy_pass http://api_cluster;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # 4. Static PWA Frontend Client
    location / {
        root /var/www/flashchat/client/dist;
        index index.html;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, max-age=31536000, immutable";
        }

        # Service worker - never cache
        location = /sw.js {
            expires -1;
            add_header Cache-Control "no-store, no-cache, must-revalidate";
        }
    }
}
```

---

## 5. WebRTC Coturn Setup

For reliable 1-on-1 audio/video calls behind symmetric NATs or corporate firewalls:

1. Configure `turnserver.conf`:
```ini
listening-port=3478
tls-listening-port=5349
realm=yourdomain.com
use-auth-secret
static-auth-secret=YOUR_COTURN_SHARED_SECRET
cert=/etc/letsencrypt/live/yourdomain.com/cert.pem
pkey=/etc/letsencrypt/live/yourdomain.com/privkey.pem
no-stdout-log
syslog
```

2. Open UDP & TCP ports on your firewall:
- `3478` (TURN UDP/TCP)
- `5349` (TURNS TLS UDP/TCP)
- `49152:65535` (Media Relay UDP)

---

## 6. Multi-Instance Scaling

To scale Flash Chat horizontally across multiple containers or servers:

1. **Redis Pub/Sub Adapter**: Enabled automatically in `server/config/socket.js`. All Socket.IO events (chat messages, call signaling, typing indicators) automatically fan out across server instances.
2. **Scale with Docker Compose**:
```bash
docker compose -f docker-compose.prod.yml up -d --scale server=3
```
3. **Nginx Load Balancing**:
```nginx
upstream api_cluster {
    least_conn;
    server 127.0.0.1:5001;
    server 127.0.0.1:5002;
    server 127.0.0.1:5003;
    keepalive 64;
}
```

---

## 7. Database Backup and Disaster Recovery

### Automated Nightly MongoDB Backup Script (`/opt/scripts/mongo-backup.sh`)

```bash
#!/usr/bin/env bash
set -eo pipefail

BACKUP_DIR="/var/backups/mongodb"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DEST="${BACKUP_DIR}/flashchat_${TIMESTAMP}"

mkdir -p "$BACKUP_DIR"

echo "Starting MongoDB backup to ${DEST}..."
docker exec flash-mongo-prod mongodump \
  --uri="mongodb://flash_user:${MONGO_PASSWORD}@localhost:27017/flashchat?authSource=admin" \
  --gzip \
  --out="/tmp/dump_${TIMESTAMP}"

docker cp flash-mongo-prod:/tmp/dump_${TIMESTAMP} "${DEST}"
docker exec flash-mongo-prod rm -rf "/tmp/dump_${TIMESTAMP}"

# Retain backups for 14 days
find "$BACKUP_DIR" -type d -mtime +14 -exec rm -rf {} +
echo "Backup complete: ${DEST}"
```

### Restore Procedure

```bash
# To restore from a specific dump directory
docker cp /var/backups/mongodb/flashchat_20261003_120000 flash-mongo-prod:/tmp/restore_dump

docker exec -it flash-mongo-prod mongorestore \
  --uri="mongodb://flash_user:${MONGO_PASSWORD}@localhost:27017/flashchat?authSource=admin" \
  --gzip \
  --dir="/tmp/restore_dump/flashchat"
```

---

## 8. Release Verification Checklist

Before opening public traffic:
- [x] Run full backend test suite: `npm --prefix server test` (100% green).
- [x] Run full client test suite: `npm --prefix client test` (100% green).
- [x] Verify PWA service worker registration and offline caching.
- [x] Confirm Web Push subscription and notification dispatch.
- [x] Test WebRTC 1-on-1 audio/video call audio & camera feeds.
- [x] Verify Pocket Vault AES-256-GCM zero-knowledge client encryption.
- [x] Validate Gemini AI smart actions and SSE streaming.
- [x] Check `/api/health` and `/api/ready` response codes.
- [x] Verify Nginx SSL A+ rating on Qualys SSL Labs.
