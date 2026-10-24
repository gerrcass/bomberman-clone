import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const readmePath = path.join(root, 'README.md');
const readme = await readFile(readmePath, 'utf8');
const imagePattern = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

const missing = [];
let checked = 0;

for (const match of readme.matchAll(imagePattern)) {
  const target = match[1];
  if (target === undefined) {
    continue;
  }
  if (/^(?:[a-z]+:)?\/\//i.test(target) || target.startsWith('#')) {
    continue;
  }

  checked += 1;
  const file = path.resolve(root, decodeURIComponent(target));
  if (!existsSync(file) || !statSync(file).isFile()) {
    missing.push(target);
  }
}

if (missing.length > 0) {
  console.error('README references missing documentation assets:');
  for (const target of missing) {
    console.error(`- ${target}`);
  }
  process.exit(1);
}

console.log(`Documentation assets: ${checked} image reference(s) resolved.`);
