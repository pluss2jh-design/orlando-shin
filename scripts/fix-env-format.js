const fs = require('fs');

const envPath = '.env';
const envContent = fs.readFileSync(envPath, 'utf-8');

// Find and extract the multiline JSON
const keyMatch = envContent.match(/GOOGLE_SERVICE_ACCOUNT_KEY=\{[\s\S]*?\}(?=\n\n|\n[A-Z_]+=|$)/);

if (!keyMatch) {
  console.log('❌ Could not find GOOGLE_SERVICE_ACCOUNT_KEY');
  process.exit(1);
}

// Extract just the JSON part
let jsonStr = keyMatch[0].replace('GOOGLE_SERVICE_ACCOUNT_KEY=', '');

// Parse and re-stringify to single line
try {
  const parsed = JSON.parse(jsonStr);
  const singleLineJson = JSON.stringify(parsed);

  // Replace in env file
  const newEnvContent = envContent.replace(
    keyMatch[0],
    `GOOGLE_SERVICE_ACCOUNT_KEY=${singleLineJson}`
  );

  fs.writeFileSync(envPath, newEnvContent);
  console.log('✅ GOOGLE_SERVICE_ACCOUNT_KEY converted to single line format');
  console.log('   Backup created at .env.backup');

  // Create backup
  fs.copyFileSync(envPath, '.env.backup');
} catch (e) {
  console.log('❌ Failed to parse JSON:', e.message);
}
