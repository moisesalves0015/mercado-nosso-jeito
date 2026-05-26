const fs = require('fs');
const path = require('path');

const fileAdmin = path.join(__dirname, 'src', 'pages', 'Admin.tsx');
let codeAdmin = fs.readFileSync(fileAdmin, 'utf8');

// Remove unused imports in Admin.tsx
codeAdmin = codeAdmin.replace(/useRef, /g, '');
codeAdmin = codeAdmin.replace(/Upload, /g, '');
codeAdmin = codeAdmin.replace(/ChevronRight, /g, '');
codeAdmin = codeAdmin.replace(/ChevronLeft, /g, '');

// Remove unused types and constants in Admin.tsx
codeAdmin = codeAdmin.replace(/type ImageMode = 'url' \| 'upload' \| 'gallery';\s*/g, '');
codeAdmin = codeAdmin.replace(/const calcSuggestedPrice = [\s\S]*?;\s*/, '');
codeAdmin = codeAdmin.replace(/const GALLERY_IMAGES = [\s\S]*?\];\s*/, '');
codeAdmin = codeAdmin.replace(/const compressImage = [\s\S]*?;\s*\};\s*/, '');
codeAdmin = codeAdmin.replace(/type WizardStep = 1 \| 2 \| 3 \| 4 \| 5;\s*/, '');
codeAdmin = codeAdmin.replace(/const WIZARD_META = [\s\S]*?\];\s*/, '');

fs.writeFileSync(fileAdmin, codeAdmin);
console.log('Admin.tsx cleaned');

const fileDetail = path.join(__dirname, 'src', 'pages', 'AdminProductDetail.tsx');
let codeDetail = fs.readFileSync(fileDetail, 'utf8');

// Remove unused imports in AdminProductDetail.tsx
codeDetail = codeDetail.replace(/useRef, /g, '');
codeDetail = codeDetail.replace(/Link, /g, '');
codeDetail = codeDetail.replace(/Percent, /g, '');
codeDetail = codeDetail.replace(/Zap, /g, '');

fs.writeFileSync(fileDetail, codeDetail);
console.log('AdminProductDetail.tsx cleaned');
