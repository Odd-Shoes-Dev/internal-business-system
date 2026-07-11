/**
 * Fixes misplaced FitNumber import lines.
 * The previous script sometimes inserted the import inside a multi-line
 * import block. This script removes it from the wrong place and re-inserts
 * it after the last completed import statement (line containing "from '...'").
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';
import path from 'path';

const ROOT = path.resolve('src/app/dashboard');
const IMPORT_LINE = "import { FitNumber } from '@/components/ui/fit-number';";

function fixFile(filePath) {
  const original = readFileSync(filePath, 'utf8');

  // Only process files that have the FitNumber import
  if (!original.includes(IMPORT_LINE)) return false;

  const lines = original.split('\n');

  // Remove ALL occurrences of the FitNumber import line
  const withoutImport = lines.filter(l => l.trim() !== IMPORT_LINE);

  // Find the last line that ends an import statement (has `from '...'`)
  let lastImportEnd = 0;
  withoutImport.forEach((line, i) => {
    if (/from\s+['"]/.test(line)) lastImportEnd = i;
  });

  // Re-insert in the correct position
  withoutImport.splice(lastImportEnd + 1, 0, IMPORT_LINE);

  const fixed = withoutImport.join('\n');
  if (fixed === original) return false;

  writeFileSync(filePath, fixed, 'utf8');
  return true;
}

const files = globSync(`${ROOT}/**/*.tsx`);
let updated = 0;

for (const file of files) {
  try {
    if (fixFile(file)) {
      console.log('✓', path.relative(ROOT, file));
      updated++;
    }
  } catch (err) {
    console.error('✗ ERROR', file, err.message);
  }
}

console.log(`\nDone: ${updated} files fixed.`);
