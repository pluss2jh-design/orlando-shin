const fs = require('fs');
require('dotenv').config({ path: '.env' });

const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

if (!key) {
  console.log('❌ GOOGLE_SERVICE_ACCOUNT_KEY not found in .env');
  process.exit(1);
}

fs.writeFileSync('google-service-account.json', key);
console.log('✅ Service account key saved to google-service-account.json');

try {
  const parsed = JSON.parse(key);
  console.log('   Client Email:', parsed.client_email);
  console.log('   Project ID:', parsed.project_id);
} catch (e) {
  console.log('⚠️  Warning: Key may not be valid JSON:', e.message);
}
