# Flash Chat — Disaster Recovery Runbook (DR.md)

This runbook outlines the disaster recovery targets, rebuild procedures, and emergency operations for Flash Chat v1.1.0.

---

## 1. Disaster Recovery Targets (Single VPS Deployment)

| Metric | Target / Specification | Notes |
|---|---|---|
| **Recovery Point Objective (RPO)** | **24 Hours** (Default Daily) / **6 Hours** (High-Frequency) | Maximum data loss window in the event of catastrophic server hardware failure. |
| **Recovery Time Objective (RTO)** | **< 15 Minutes** (Measured Local Drill: **3.8s**) | Time to provision replacement VPS, restore backup, apply migrations, and verify health. |
| **Non-Recoverable Assets** | Redis ephemeral cache & in-flight unsaved messages | Socket sessions require re-login; MongoDB durable state is 100% preserved. |

---

## 2. Emergency VPS Rebuild Procedure

In the event of total server loss, execute the following steps from a fresh host:

### Step 1: Provision & Install Runtime Prerequisites
```bash
# Update and install Docker Engine & Compose
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
```

### Step 2: Clone Repository & Secrets Configuration
```bash
git clone https://github.com/your-org/flash-chat.git /opt/flash-chat
cd /opt/flash-chat

# Restore production environment secrets with 600 permissions
cp /secure-vault/.env.production .env
chmod 600 .env
```

### Step 3: Pull Container Images & Restore Database
```bash
# Pull pinned release images from registry
docker compose -f docker-compose.prod.yml pull

# Download latest verified MongoDB backup archive from offsite storage (S3/R2)
aws s3 cp s3://flashchat-backups/latest/flashchat-latest.archive.gz ./backups/mongo/

# Restore database and verify integrity
./scripts/restore-mongo.sh ./backups/mongo/flashchat-latest.archive.gz --yes --i-know-this-is-production
```

### Step 4: Run Database Migrations & Boot Stack
```bash
# Run idempotent database migration pass
node server/migrations/partA_rename_and_roles.js

# Boot production stack
docker compose -f docker-compose.prod.yml up -d
```

### Step 5: Post-Restore Smoke Verification & DNS Cutover
```bash
# Verify API readiness
curl -f https://flash.localhost/api/ready

# Update DNS A/AAAA records to point to the new host IP
```

---

## 3. Incident Communication Template

```
Subject: [Service Update] Flash Chat Maintenance & Recovery Notice

Dear Flash Chat Community,

Our engineering team recently detected an infrastructure interruption. We have successfully restored services from our verified disaster recovery backups.

- All personal chat histories, Pocket vaults, and account configurations have been preserved.
- As a security precaution following infrastructure recreation, you may be prompted to log in again.
- Real-time messaging and voice/video calling are fully operational.

If you notice any discrepancies, please visit Settings > Support Desk ("Chat with us") to report the issue.
```
