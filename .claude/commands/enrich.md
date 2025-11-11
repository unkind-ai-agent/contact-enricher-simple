---
description: Unified enrichment pipeline - Load records from Cloudflare KV, enrich in parallel batches, and save results
---

# Enrich Contact Records

## Overview

This command loads records from Cloudflare KV, enriches them using parallel enricher agents, and saves results both to KV and local JSON files. The process is idempotent - already-enriched records are skipped.

## Workflow

### Step 1: Fetch Records from Cloudflare KV

List all keys:
```bash
curl "https://contact-enricher-kv-worker-noauth.late-breeze-a95f.workers.dev/keys"
```

### Step 2: Create Enrichment Campaign Folder

Create folder: `enrichment/[YYYYMMDD-HHMMSS]/`
Save fetched keys to: `enrichment/[YYYYMMDD-HHMMSS]/keys.json`

### Step 3: Load and Filter Records

For each key:
1. Fetch value from KV:
   ```bash
   curl "https://contact-enricher-kv-worker-noauth.late-breeze-a95f.workers.dev/kv/{key}"
   ```
2. Filter out already-enriched records (those with `enrichment_timestamp`)

If no records need processing:
```
All records already enriched in Cloudflare KV. Nothing to do.
```

### Step 4: Extract Contact Information

From each record, extract:

```javascript
const contactInfo = {
  attio_record_id: record.id.record_id,
  business_name: record.values.business_name?.[0]?.value,
  phone: record.values.phone_numbers?.[0]?.phone_number,
  country_code: record.values.phone_numbers?.[0]?.country_code,
  address: record.values.primary_location?.[0]?.line_1,
  locality: record.values.primary_location?.[0]?.locality,
  region: record.values.primary_location?.[0]?.region,
  postcode: record.values.primary_location?.[0]?.postcode,
  latitude: record.values.primary_location?.[0]?.latitude,
  longitude: record.values.primary_location?.[0]?.longitude,
  suburb: record.values.suburb?.[0]?.value,
  category: record.values.google_map_business_category?.[0]?.option?.title,
  website: record.values.website?.[0]?.value
};
```

### Step 5: Process Records in Parallel Batches

**IMPORTANT: Launch 20 enricher agents simultaneously in a SINGLE message with 20 Task tool calls.**

For each batch of up to 20 records:

1. **Launch enrichers in parallel:**
   ```
   Launching batch of [N] enricher agents in parallel...
   ```

2. **Send a single message with multiple Task tool calls:**
   - `subagent_type="enricher"`
   - Prompt template:
     ```
     Enrich this business with comprehensive information:

     Business Name: [business_name or "Unknown"]
     Phone: [phone or "Not available"]
     Address: [address or "Not available"]
     City: [locality or "Not available"]
     Suburb: [suburb or "Not available"]
     Category: [category or "Not available"]
     Website: [website or "Not available"]
     Coordinates: [latitude], [longitude]
     Attio Record ID: [attio_record_id]

     PRIORITIES:
     - Verify business name (CRITICAL if unknown)
     - Find complete contact information (phone, email, website) (CRITICAL)
     - Find menu items with pricing
     - Find owner/decision-maker name (if available)
     - Find staff names and additional insights
     ```

3. **Track batch timing:**
   ```
   Batch [N] started: [timestamp]
   Processing [count] records in parallel...
   ```

4. **Wait for all enrichers to complete**

5. **Save results to Cloudflare KV:**
   - Save raw enrichment output with key: `enrich:record:[attio_record_id]`
   - Track: `[Record N] Saved to Cloudflare KV: enrich:record:[attio_record_id]`
   - If KV save fails: log error, continue processing, mark as partial failure

6. **Save to local JSON:**
   - Progressively update: `enrichment/[YYYYMMDD-HHMMSS]/results.json`

7. **Display progress:**
   ```
   Batch [N] Complete: [count] records processed
     Average duration: [X]m [Y]s per record
     Overall: [processed]/[total] ([percentage]%) complete

   [Record N] ✅ Complete: [business_name]
     Duration: [X]m [Y]s | Score: [score]/10
     Saved to: KV + JSON
   ```

### Step 6: Finalize Output Files

Three output files in `enrichment/[YYYYMMDD-HHMMSS]/`:

#### 6a. Keys File
**File**: `keys.json`
Contains all fetched KV keys.

#### 6b. Results File
**File**: `results.json`

Structure:
```json
{
  "batch_date": "2025-01-11T14:30:00Z",
  "batch_timestamp": "20250111-143000",
  "total_records": 992,
  "enriched_count": 100,
  "skipped_count": 50,
  "records": [
    {
      "attio_record_id": "00b6f64c-32f3-4f72-bd97-2702ccc7e49d",
      "business_name": "L'Espresso Coffee House",
      "phone": "+61736325127",
      "email": "hello@lespresso.com.au",
      "website": "http://lespresso.com.au",
      "suburb": "Chermside",
      "locality": "Chermside",
      "region": "QLD",
      "category": "Cafe",
      "first_name": "John",
      "last_name": "Smith",
      "job_title": "Owner",
      "menu_items": "- Flat White: $4.50\n- Cappuccino: $5.00",
      "enrichment_output": "Business Name: L'Espresso Coffee House\nConfidence Score: 8/10...",
      "enrichment_score": 8,
      "enrichment_timestamp": "2025-01-11T14:35:00.000Z",
      "batch_id": "20250111-143000"
    }
  ]
}
```

#### 6c. Processing Log
**File**: `log.txt`

Format:
```
========================================
CONTACT ENRICHMENT PROCESSING LOG
========================================
Start Time: 2025-01-11T14:30:00Z
Batch Timestamp: 20250111-143000
Total Records in KV: 992
Already Enriched (Skipped): 50
Records Processed: 100

--- RECORD [N]/[TOTAL] ---
Attio Record ID: [record_id]
Business Name: [business_name or "Unknown"]
Phone: [phone]
Address: [address]
Suburb: [suburb]

Enrichment: Started [time]
Enrichment: Completed [time] (Duration: [X]m [Y]s)
  - Owner/Decision-Maker Found: [name or "NOT FOUND"]
  - Enrichment Score: [score]/10

Cloudflare KV: Saved to enrich:record:[record_id]
JSON Save: Completed [time]
Total Duration: [X]m [Y]s

========================================
BATCH SUMMARY
========================================
End Time: 2025-01-11T15:45:30Z
Total Duration: 1h 15m 30s

Processed: 100/100 (100%)
Average Processing Time: 5m per record
Owner names discovered: 85/100 (85%)

Cloudflare KV Storage:
- Keys created: 100
- Key prefix: enrich:record:

Output Files:
- enrichment/20250111-143000/keys.json
- enrichment/20250111-143000/results.json
- enrichment/20250111-143000/log.txt
========================================
```

### Step 7: Display Summary Report

```
========================================
ENRICHMENT COMPLETE
========================================

Total Records in KV: 992
Already Enriched (Skipped): 50
Processed: 100 records
Duration: 1 hour 15 minutes

RESULTS:
✅ Successfully enriched: 100 records
📊 Average enrichment score: 7.8/10

DETAILS:
- Average processing time: 5m per record
- Owner names discovered: 85/100 (85%)

CLOUDFLARE KV STORAGE:
🔑 Keys created: 100
🏷️  Key prefix: enrich:record:
💾 Each key contains raw enrichment output + metadata

OUTPUT FILES:
📁 enrichment/20250111-143000/
  📄 keys.json (fetched KV keys)
  📄 results.json (100 enriched records)
  📄 log.txt (full audit trail)

NEXT STEPS:
1. Review enriched records in results.json
2. Access KV data using key: enrich:record:{attio_record_id}
3. Re-run safely - already-enriched records will be skipped (idempotent)
========================================
```