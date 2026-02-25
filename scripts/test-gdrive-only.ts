import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env
config({ path: resolve(process.cwd(), '.env') });

import { google } from 'googleapis';

const FOLDER_ID = '1ODcnaY0yQgeFUWYUGOkxVxGKTXsB3t56';

async function testGoogleDriveWithApiKey() {
  console.log('🧪 Testing Google Drive with API Key method...');

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('❌ GEMINI_API_KEY not set');
    return false;
  }

  try {
    const drive = google.drive({ version: 'v3', auth: apiKey });
    const response = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 10,
    });

    console.log('✅ Google Drive API Key - Files found:', response.data.files?.length || 0);
    return true;
  } catch (error) {
    console.error('❌ API Key method failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function testGoogleDriveWithServiceAccount() {
  console.log('\n🧪 Testing Google Drive with Service Account...');

  const keyPath = './google-service-account.json';

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 10,
    });

    console.log('✅ Google Drive Service Account - Files found:', response.data.files?.length || 0);
    response.data.files?.slice(0, 3).forEach(f => {
      console.log(`   - ${f.name}`);
    });
    return true;
  } catch (error) {
    console.error('❌ Service Account method failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('   Google Drive API Test');
  console.log('========================================\n');

  const apiKeyResult = await testGoogleDriveWithApiKey();
  const serviceAccountResult = await testGoogleDriveWithServiceAccount();

  console.log('\n========================================');
  console.log('   Results');
  console.log('========================================');
  console.log(`API Key Method:        ${apiKeyResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Service Account Method: ${serviceAccountResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log('========================================');

  if (!serviceAccountResult) {
    console.log('\n💡 Service Account 파일을 생성하는 중...');
    console.log('   .env의 GOOGLE_SERVICE_ACCOUNT_KEY를 google-service-account.json 파일로 저장합니다.');
  }
}

main();
