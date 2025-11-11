# Cloudflare KV Endpoint Usage Guide

**Base URL:** `https://contact-enricher-kv-worker-noauth.late-breeze-a95f.workers.dev`

**Authentication:** None required

---

## Endpoints

### List Keys
```bash
GET /keys?prefix={prefix}&limit={limit}&cursor={cursor}
```

**Example:**
```bash
curl "https://contact-enricher-kv-worker-noauth.late-breeze-a95f.workers.dev/keys"
curl "https://contact-enricher-kv-worker-noauth.late-breeze-a95f.workers.dev/keys?prefix=user_&limit=10"
```

---

### Get Value
```bash
GET /kv/{key}
```

**Example:**
```bash
curl "https://contact-enricher-kv-worker-noauth.late-breeze-a95f.workers.dev/kv/user_123"
```

---

### Create/Update Value
```bash
POST /kv/{key}
PUT /kv/{key}
```

**Example:**
```bash
curl -X POST "https://contact-enricher-kv-worker-noauth.late-breeze-a95f.workers.dev/kv/user_123" \
  -H "Content-Type: application/json" \
  -d '{"value": {"name": "John Doe", "email": "john@example.com"}}'
```

---

### Delete Value
```bash
DELETE /kv/{key}
```

**Example:**
```bash
curl -X DELETE "https://contact-enricher-kv-worker-noauth.late-breeze-a95f.workers.dev/kv/user_123"
```
