import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import OpenAI from 'openai';
import { google } from 'googleapis';
import YahooFinance from 'yahoo-finance2';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const FOLDER_ID = '1ODcnaY0yQgeFUWYUGOkxVxGKTXsB3t56';

async function testOpenAI() {
  console.log('🧪 Testing OpenAI API...');
  try {
    if (!OPENAI_API_KEY) {
      console.log('❌ OPENAI_API_KEY not found');
      return false;
    }
    
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "OpenAI API is working"' }],
      max_tokens: 20,
    });
    
    console.log('✅ OpenAI API Response:', response.choices[0]?.message?.content);
    return true;
  } catch (error) {
    console.error('❌ OpenAI API Error:', error instanceof Error ? error.message : error);
    return false;
  }
}

function parseServiceAccountKey(key: string): object {
  try {
    return JSON.parse(key);
  } catch {
    try {
      return JSON.parse(key.replace(/\n/g, '\\n'));
    } catch {
      throw new Error('Invalid JSON format');
    }
  }
}

async function testGoogleDrive() {
  console.log('\n🧪 Testing Google Drive API...');
  try {
    if (!GOOGLE_SERVICE_ACCOUNT_KEY) {
      console.log('❌ GOOGLE_SERVICE_ACCOUNT_KEY not found');
      return false;
    }
    
    const credentials = parseServiceAccountKey(GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    
    const drive = google.drive({ version: 'v3', auth });
    const response = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 10,
    });
    
    console.log('✅ Google Drive API - Files found:', response.data.files?.length || 0);
    response.data.files?.slice(0, 3).forEach(f => {
      console.log(`   - ${f.name} (${f.mimeType})`);
    });
    return true;
  } catch (error) {
    console.error('❌ Google Drive API Error:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function testYahooFinance() {
  console.log('\n🧪 Testing Yahoo Finance API...');
  try {
    const yahooFinance = new YahooFinance();
    const quote = await yahooFinance.quote('005930.KS');
    
    console.log('✅ Yahoo Finance API - Samsung Electronics:');
    console.log(`   Price: ${quote.regularMarketPrice} ${quote.currency}`);
    console.log(`   Market Cap: ${quote.marketCap}`);
    return true;
  } catch (error) {
    console.error('❌ Yahoo Finance API Error:', error instanceof Error ? error.message : error);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('   API Key Test Script');
  console.log('========================================\n');
  
  const results = await Promise.all([
    testOpenAI(),
    testGoogleDrive(),
    testYahooFinance(),
  ]);
  
  console.log('\n========================================');
  console.log('   Test Results');
  console.log('========================================');
  console.log(`OpenAI API:        ${results[0] ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Google Drive API:  ${results[1] ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Yahoo Finance API: ${results[2] ? '✅ PASS' : '❌ FAIL'}`);
  console.log('========================================');
  
  if (results.every(r => r)) {
    console.log('\n🎉 All API keys are working correctly!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some APIs are not working. Check the errors above.');
    process.exit(1);
  }
}

main();
