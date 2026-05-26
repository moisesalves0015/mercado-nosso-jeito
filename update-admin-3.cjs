const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'Admin.tsx');
const lines = fs.readFileSync(file, 'utf8').split('\n');

const startIndex = lines.findIndex(l => l.includes('{/* Step indicator */}'));
const endIndex = lines.findIndex(l => l.includes('{/* ═══ MODAL: AWARD DIAMONDS ════'));

if (startIndex !== -1 && endIndex !== -1) {
  // Delete from startIndex to just before endIndex
  lines.splice(startIndex, endIndex - startIndex);
  fs.writeFileSync(file, lines.join('\n'));
  console.log('Deleted leftover wizard rendering from Admin.tsx');
} else {
  console.log('Could not find start or end bounds', startIndex, endIndex);
}
