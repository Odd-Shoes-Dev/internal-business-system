/**
 * Replaces stat-number display patterns across all dashboard .tsx files
 * with the <FitNumber> component.
 *
 * Targets single-line <p> and <div> elements whose className contains a
 * size class (text-xl / text-2xl / text-3xl) + font-bold but are NOT
 * headings (<h1>–<h6>). Adds the import to every file that was changed.
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';
import path from 'path';

const ROOT = path.resolve('src/app/dashboard');
const IMPORT_LINE = "import { FitNumber } from '@/components/ui/fit-number';";

// Matches a single-line <p> or <div> with a size+bold className.
// Captures: [1] tag, [2] classes before size, [3] size class, [4] classes after size,
//           [5] JSX expression content, [6] closing tag
const STAT_RE =
  /<(p|div)((?:\s+\w[\w-]*="[^"]*")*)\s+className="([^"]*\b(?:text-xl|text-2xl|text-3xl)\b[^"]*\bfont-bold\b[^"]*)">(.*?)<\/\1>/g;

// className parts we want to KEEP (everything except the size token)
const SIZE_TOKENS = new Set(['text-xl', 'text-2xl', 'text-3xl', 'lg:text-3xl', 'sm:text-xl', 'sm:text-2xl', 'lg:text-2xl', 'base']);

function stripSizeClasses(classes) {
  return classes
    .split(/\s+/)
    .filter(c => {
      // Remove any token that IS or ENDS WITH one of our size patterns
      if (SIZE_TOKENS.has(c)) return false;
      if (/^(?:xs:|sm:|md:|lg:|xl:)?text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)$/.test(c)) return false;
      return true;
    })
    .join(' ')
    .trim();
}

function processFile(filePath) {
  const original = readFileSync(filePath, 'utf8');
  let changed = false;

  const result = original.replace(STAT_RE, (match, tag, otherAttrs, classes, content) => {
    // Skip if content looks like a heading label or is plain text (no braces)
    // We only want to wrap JSX expressions or clear numeric/currency values
    const isCurrencyOrNumber = /\{[^}]+\}/.test(content);
    if (!isCurrencyOrNumber) return match;

    // Skip if it also has other meaningful attributes that would break as FitNumber
    // (e.g., onClick handlers — keep those as-is)
    if (otherAttrs && /onClick|onChange|href/.test(otherAttrs)) return match;

    const remaining = stripSizeClasses(classes);
    changed = true;
    // Extract the JSX expression value (strip outer braces for value prop)
    const valueExpr = content.trim();
    return `<FitNumber value={${valueExpr.startsWith('{') ? valueExpr.slice(1, -1) : valueExpr}} className="${remaining}" />`;
  });

  if (!changed) return false;

  // Add import after the last existing import block, if not already present
  let output = result;
  if (!output.includes("from '@/components/ui/fit-number'")) {
    // Find the last line that ends an import statement (contains "from '...'")
    const lines = output.split('\n');
    let lastImportEnd = 0;
    lines.forEach((line, i) => {
      if (/from\s+['"]/.test(line)) lastImportEnd = i;
    });
    lines.splice(lastImportEnd + 1, 0, IMPORT_LINE);
    output = lines.join('\n');
  }

  writeFileSync(filePath, output, 'utf8');
  return true;
}

const files = globSync(`${ROOT}/**/*.tsx`);
let updated = 0;
let skipped = 0;

for (const file of files) {
  try {
    if (processFile(file)) {
      console.log('✓', path.relative(ROOT, file));
      updated++;
    } else {
      skipped++;
    }
  } catch (err) {
    console.error('✗ ERROR', file, err.message);
  }
}

console.log(`\nDone: ${updated} files updated, ${skipped} files unchanged.`);
