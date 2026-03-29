import * as fs from 'fs';
import * as path from 'path';

const filePath = 'c:/Users/user/Desktop/개발/orlando-shin/src/lib/stock-analysis/ai-learning.ts';
let content = fs.readFileSync(filePath, 'utf-8');

// Use a more robust regex to find the strategy prompt JSON fields
content = content.replace(
  /"source": \{ "fileName": "파일명", "location": "위치" \}/g,
  '"source": { "fileName": "파일명", "location": "위치(페이지/시간)", "content_snippet": "본문에서 발췌한 실제 문구" }'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully updated strategy prompt schema.');
