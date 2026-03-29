import * as fs from 'fs';

const filePath = 'c:/Users/user/Desktop/개발/orlando-shin/src/app/admin/expert-analysis/page.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// Replace the buggy stats calculation
content = content.replace(
  /finalCount: data\.universeCounts\.russellCount - \(data\.excludedStockCount \|\| 0\)/g,
  'finalCount: data.universeCounts.finalCount'
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Successfully updated universeStats mapping in ExpertAnalysisPage');
