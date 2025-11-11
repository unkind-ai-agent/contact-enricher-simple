const fs = require('fs');
const https = require('https');

const BATCH_TIMESTAMP = process.argv[2];
const BASE_URL = 'https://contact-enricher-kv-worker-noauth.late-breeze-a95f.workers.dev';

if (!BATCH_TIMESTAMP) {
  console.error('Usage: node load-and-filter.js <batch-timestamp>');
  process.exit(1);
}

const ENRICHMENT_DIR = `enrichment/${BATCH_TIMESTAMP}`;

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  // Read keys from keys.json
  const keysData = JSON.parse(fs.readFileSync(`${ENRICHMENT_DIR}/keys.json`, 'utf8'));
  const keys = keysData.keys.map(k => k.name);

  console.log(`Total keys found: ${keys.length}`);

  const recordsToEnrich = [];
  const alreadyEnriched = [];

  // Fetch each record and filter
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    console.log(`[${i + 1}/${keys.length}] Checking ${key}...`);

    try {
      const record = await httpsGet(`${BASE_URL}/kv/${key}`);

      // Check if already enriched
      if (record.enrichment_timestamp) {
        console.log(`  ✓ Already enriched (${record.enrichment_timestamp})`);
        alreadyEnriched.push(key);
        continue;
      }

      // Extract contact information
      const contactInfo = {
        attio_record_id: record.id?.record_id || key,
        business_name: record.values?.business_name?.[0]?.value,
        phone: record.values?.phone_numbers?.[0]?.phone_number,
        country_code: record.values?.phone_numbers?.[0]?.country_code,
        address: record.values?.primary_location?.[0]?.line_1,
        locality: record.values?.primary_location?.[0]?.locality,
        region: record.values?.primary_location?.[0]?.region,
        postcode: record.values?.primary_location?.[0]?.postcode,
        latitude: record.values?.primary_location?.[0]?.latitude,
        longitude: record.values?.primary_location?.[0]?.longitude,
        suburb: record.values?.suburb?.[0]?.value,
        category: record.values?.google_map_business_category?.[0]?.option?.title,
        website: record.values?.website?.[0]?.value,
        _raw: record
      };

      recordsToEnrich.push(contactInfo);
      console.log(`  → Needs enrichment: ${contactInfo.business_name || 'Unknown'}`);

    } catch (error) {
      console.error(`  ✗ Error fetching ${key}:`, error.message);
    }
  }

  // Save results
  const filterResult = {
    total_keys: keys.length,
    already_enriched: alreadyEnriched.length,
    needs_enrichment: recordsToEnrich.length,
    enriched_keys: alreadyEnriched,
    records_to_enrich: recordsToEnrich
  };

  fs.writeFileSync(
    `${ENRICHMENT_DIR}/filtered-records.json`,
    JSON.stringify(filterResult, null, 2)
  );

  console.log('\n========================================');
  console.log('FILTERING COMPLETE');
  console.log('========================================');
  console.log(`Total records: ${keys.length}`);
  console.log(`Already enriched: ${alreadyEnriched.length}`);
  console.log(`Need enrichment: ${recordsToEnrich.length}`);
  console.log(`\nSaved to: ${ENRICHMENT_DIR}/filtered-records.json`);
}

main().catch(console.error);
