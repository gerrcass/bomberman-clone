import { readFileSync } from 'node:fs';

function readBody() {
  const fileIndex = process.argv.indexOf('--body-file');
  if (fileIndex !== -1) {
    const file = process.argv[fileIndex + 1];
    if (file === undefined) {
      console.error('--body-file needs a path');
      process.exit(2);
    }
    return readFileSync(file, 'utf8');
  }
  return process.env['PR_BODY'] ?? '';
}

const body = readBody();
const required = [
  ['Summary heading', /^##\s+Summary\s*$/m],
  ['Evidence heading', /^##\s+Evidence\s*$/m],
  ['Merge Danger heading', /^##\s+Merge Danger\s*$/m],
  ['Before marker', /^\s*(?:[-*]\s*)?\*\*Before:\*\*/m],
  ['After marker', /^\s*(?:[-*]\s*)?\*\*After:\*\*/m],
  ['Door marker', /^\s*(?:[-*]\s*)?\*\*Door:\*\*/m],
  ['Blast Radius marker', /^\s*(?:[-*]\s*)?\*\*Blast Radius:\*\*/m],
];

const missing = required.filter(([, pattern]) => !pattern.test(body)).map(([label]) => label);

if (missing.length > 0) {
  console.error('PR body is missing required pr-skill sections:');
  for (const label of missing) {
    console.error(`- ${label}`);
  }
  console.error(
    'Use the pr skill and the evidence gate in docs/agents/pr-evidence.md before opening or updating the PR.',
  );
  process.exit(1);
}

console.log('PR body contains the required pr-skill sections.');
