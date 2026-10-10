# Flash Chat — Database Migration & Rollback Guide (v1.1.0)

This guide documents the database schema upgrades, idempotency verification, execution steps, and rollback procedures for Flash Chat v1.1.0.

---

## 1. Schema Changes & Additions

### User Collection
- `role`: Enum (`"user"`, `"support"`, `"admin"`), defaults lazily to `"user"`.
- `discoverableByPhone`: Boolean, defaults to `true`.
- `discoverableByEmail`: Boolean, defaults to `true`.
- `aiEnabled`: Boolean, defaults to `true`.

### New Collections & Background Indexes
- **`contacts`**:
  - `{ owner: 1, phone: 1 }` (Sparse)
  - `{ owner: 1, email: 1 }` (Sparse)
  - `{ owner: 1, name: 1 }`
- **`support_tickets`**:
  - `{ user: 1, createdAt: -1 }`
  - `{ status: 1, createdAt: -1 }`
- **`conversations`**:
  - `{ type: 1, updatedAt: -1 }`

---

## 2. Running the Migration

Run the migration script against your MongoDB cluster:
```bash
node server/migrations/partA_rename_and_roles.js
```

### Idempotency & Safety
- **Idempotent**: Re-running the script results in **0 documents modified**.
- **Non-destructive**: User message bodies and encryption keys remain untouched (verified with SHA-256 integrity checksums).
- **Background Indexing**: Compound indexes are built in the background without blocking database read/write throughput.

---

## 3. Rollback Procedure

If a critical post-deployment regression occurs requiring rollback to v1.0.0:

1. **Client Rollback**: Deploy the previous client build container. (The new API maintains backward compatibility with legacy client schemas).
2. **Reverse Migration (Optional)**: If you need to revert system AI tags:
   ```bash
   node server/migrations/partA_rollback.js
   ```
3. **Database Retention**: The `contacts` and `support_tickets` collections can remain safely in MongoDB without impacting legacy v1.0.0 queries.
