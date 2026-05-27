import { removeBackground } from '@imgly/background-removal-node';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processImages() {
  const categories = ['combos.png'];
  for (const file of categories) {
    const inputPath = path.join(__dirname, 'public', 'categories', file);
    if (!fs.existsSync(inputPath)) {
        console.log(`File not found: ${inputPath}`);
        continue;
    }
    console.log(`Processing ${file}...`);
    try {
        const fileUrl = pathToFileURL(inputPath).href;
        const blob = await removeBackground(fileUrl);
        const buffer = Buffer.from(await blob.arrayBuffer());
        fs.writeFileSync(inputPath, buffer);
        console.log(`Done ${file}`);
    } catch (e) {
        console.error(`Error processing ${file}:`, e);
    }
  }
}

processImages();
