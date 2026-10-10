# Flash Chat — Production Monitoring & Observability Runbook

This guide specifies essential metrics, alert thresholds, Pino log query patterns, and diagnostic workflows for monitoring Flash Chat v1.1.0 in production.

---

## 1. Core Service Level Indicators (SLIs) & Alert Thresholds

| Metric | Target / Normal | Warning Alert | Critical Alert | Response Action |
|---|---|---|---|---|
| **HTTP Response Time (p95)** | < 150 ms | > 350 ms for 5 min | > 800 ms for 2 min | Inspect MongoDB slow queries and Node.js event loop lag. |
| **HTTP 5xx Error Rate** | < 0.05% | > 1.0% of requests | > 5.0% of requests | Check Pino error logs for unhandled exceptions or DB disconnects. |
| **HTTP 429 Rate (Rate Limits)** | < 0.5% | > 3.0% of requests | > 10.0% of requests | Check for distributed credential stuffing, invite spam, or AI generation abuse. |
| **Socket Connection Count** | Baseline ± 20% | Reconnect storm > 500/sec | Drop > 70% in 1 min | Check Redis pub/sub connectivity and WebSocket reverse-proxy gateway health. |
| **Node.js Event Loop Lag** | < 20 ms | > 60 ms | > 150 ms | Investigate synchronous CPU bottlenecks (e.g. unoptimized crypto or JSON parsing). |
| **Support Ticket Queue Age** | < 2 hours | Open > 6 hours | Open > 24 hours | Escalate to on-duty support agents or trigger AI auto-remediation. |
| **Web Push Dispatch Failure** | < 2% | > 8% (410 / expired) | > 20% | Run dead subscription cleanup job; verify VAPID key expiry. |

---

## 2. Pino Structured Log Query Patterns

Flash Chat outputs JSON logs using `pino`. Query using tools like `jq`, Datadog, or Grafana Loki:

### Find All 5xx Server Errors
```bash
jq 'select(.level >= 50)' /var/log/flashchat/server.log
```

### Inspect Rate Limit (429) Trigger Events
```bash
jq 'select(.status == 429) | { time: .time, ip: .req.remoteAddress, url: .req.url, msg: .msg }' /var/log/flashchat/server.log
```

### Track Support Ticket Lifecycle Events
```bash
jq 'select(.event == "SUPPORT_TICKET_CREATED" or .event == "SUPPORT_HANDOFF")' /var/log/flashchat/server.log
```

### Monitor Flash AI Invocation Latency
```bash
jq 'select(.service == "FlashAiService") | { durationMs: .duration, action: .action, status: .status }' /var/log/flashchat/server.log
```

---

## 3. Incident Escalation & Response Matrix

1. **P1 (Critical Outage / Data Leak Risk)**:
   - Page DevOps & Engineering Leads immediately.
   - Execute Rollback Runbook if post-deployment regression detected.
2. **P2 (Degraded Performance / 3rd-Party Service Outage)**:
   - Activate Mock Fallback Modes for Gemini / Cloudinary if external APIs return 5xx.
   - Scale container replicas via Docker Compose / ECS.
3. **P3 (Support SLA / Feature Degradation)**:
   - Assign tickets directly in Support Console (`/admin/support`).
