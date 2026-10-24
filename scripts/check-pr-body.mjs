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

function section(source, heading) {
  const match = new RegExp(`^##\\s+${heading}\\s*$`, 'm').exec(source);
  if (match === null) {
    return '';
  }
  const rest = source.slice(match.index + match[0].length);
  const next = /^##\s+/m.exec(rest);
  return next === null ? rest : rest.slice(0, next.index);
}

function isGitHubHost(rawUrl) {
  let host;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return true;
  }
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === 'github.com' ||
    host.endsWith('.github.com') ||
    host.endsWith('.githubusercontent.com') ||
    host.endsWith('.github.io')
  );
}

const evidence = section(body, 'Evidence');
// Fenced blocks are quoted output, not evidence links. Keep the host check
// focused on the actual Evidence prose and attachments.
const evidenceProse = evidence.replace(/```[\s\S]*?```/g, '');
const evidenceUrls = [...evidenceProse.matchAll(/https?:\/\/[^\s)>"'`]+/g)].map((match) =>
  match[0].replace(/[.,;:!?]+$/, ''),
);
const externalEvidence = [...new Set(evidenceUrls.filter((url) => !isGitHubHost(url)))];

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

if (externalEvidence.length > 0) {
  console.error('Evidence links must be hosted on GitHub. External hosts are not allowed:');
  for (const url of externalEvidence) {
    console.error(`- ${url}`);
  }
  console.error(
    'Upload screenshots and videos with gh --attach, or commit them under docs/evidence/. Do not use an external image or video host.',
  );
  process.exit(1);
}

console.log('PR body contains the required pr-skill sections and GitHub-hosted evidence.');
