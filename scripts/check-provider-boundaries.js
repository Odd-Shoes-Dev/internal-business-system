#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const targetRoots = [path.join(repoRoot, 'src', 'app', 'api')];

const bannedImportPatterns = [
  /from\s+['"]@\/lib\/db\/neon['"]/,
  /from\s+['"]@\/lib\/provider\/neon-provider['"]/,
  /from\s+['"]pg['"]/,
  /from\s+['"]@supabase\//,
  /import\(\s*['"]@supabase\//,
];

const allowedFileSuffixes = ['.ts', '.tsx'];

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(fullPath));
      continue;
    }
    if (allowedFileSuffixes.some((suffix) => entry.name.endsWith(suffix))) {
      out.push(fullPath);
    }
  }
  return out;
}

function toRepoRelative(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

const violations = [];

for (const root of targetRoots) {
  if (!fs.existsSync(root)) {
    continue;
  }

  const files = walk(root);
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      for (const pattern of bannedImportPatterns) {
        if (pattern.test(line)) {
          violations.push({
            file: toRepoRelative(filePath),
            line: i + 1,
            text: line.trim(),
          });
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Provider boundary violations found. Use provider abstractions instead of provider-specific imports in src/app/api.');
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} -> ${violation.text}`);
  }
  process.exit(1);
}

console.log('Provider boundary check passed.');
