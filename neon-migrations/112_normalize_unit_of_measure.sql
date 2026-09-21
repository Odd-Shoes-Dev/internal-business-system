-- Map legacy unit spellings to the canonical values in src/lib/units-of-measure.ts.
-- Idempotent: safe to re-run.
UPDATE products SET unit_of_measure = 'liter'  WHERE LOWER(TRIM(unit_of_measure)) IN ('l', 'ltr', 'litre');
UPDATE products SET unit_of_measure = 'gallon' WHERE LOWER(TRIM(unit_of_measure)) = 'gal';
UPDATE products SET unit_of_measure = 'each'   WHERE LOWER(TRIM(unit_of_measure)) = 'ea';
UPDATE products SET unit_of_measure = 'piece'  WHERE LOWER(TRIM(unit_of_measure)) IN ('pc', 'pcs');
