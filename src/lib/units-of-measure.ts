export interface UnitOption {
  value: string;
  label: string;
}

// 'goods' units only make sense for physical stock, 'service' units only for services
// (time / per-head / per-trip), 'any' units fit both.
type UnitScope = 'goods' | 'service' | 'any';

interface UnitDefinition extends UnitOption {
  scope: UnitScope;
}

const UNIT_DEFINITIONS: UnitDefinition[] = [
  // Either
  { value: 'each', label: 'Each (ea)', scope: 'any' },
  { value: 'unit', label: 'Unit (u)', scope: 'any' },
  { value: 'set', label: 'Set', scope: 'any' },

  // Goods - counting and packaging
  { value: 'piece', label: 'Piece (pc)', scope: 'goods' },
  { value: 'pair', label: 'Pair (pr)', scope: 'goods' },
  { value: 'dozen', label: 'Dozen (doz)', scope: 'goods' },
  { value: 'pack', label: 'Pack (pk)', scope: 'goods' },
  { value: 'packet', label: 'Packet (pkt)', scope: 'goods' },
  { value: 'box', label: 'Box (bx)', scope: 'goods' },
  { value: 'case', label: 'Case (cs)', scope: 'goods' },
  { value: 'carton', label: 'Carton (ctn)', scope: 'goods' },
  { value: 'bundle', label: 'Bundle', scope: 'goods' },
  { value: 'bag', label: 'Bag', scope: 'goods' },
  { value: 'sack', label: 'Sack', scope: 'goods' },
  { value: 'bottle', label: 'Bottle', scope: 'goods' },
  { value: 'ream', label: 'Ream (rm)', scope: 'goods' },
  { value: 'roll', label: 'Roll', scope: 'goods' },
  { value: 'sheet', label: 'Sheet', scope: 'goods' },

  // Goods - weight
  { value: 'g', label: 'Gram (g)', scope: 'goods' },
  { value: 'kg', label: 'Kilogram (kg)', scope: 'goods' },
  { value: 'tonne', label: 'Tonne (t)', scope: 'goods' },
  { value: 'oz', label: 'Ounce (oz)', scope: 'goods' },
  { value: 'lb', label: 'Pound (lb)', scope: 'goods' },

  // Goods - volume
  { value: 'ml', label: 'Millilitre (ml)', scope: 'goods' },
  { value: 'liter', label: 'Litre (L)', scope: 'goods' },
  { value: 'gallon', label: 'Gallon (gal)', scope: 'goods' },

  // Goods - length and area
  { value: 'cm', label: 'Centimetre (cm)', scope: 'goods' },
  { value: 'm', label: 'Metre (m)', scope: 'goods' },
  { value: 'ft', label: 'Foot (ft)', scope: 'goods' },
  { value: 'sqm', label: 'Square Metre (sqm)', scope: 'goods' },
  { value: 'sqft', label: 'Square Foot (sq ft)', scope: 'goods' },

  // Services
  { value: 'hour', label: 'Hour', scope: 'service' },
  { value: 'day', label: 'Day', scope: 'service' },
  { value: 'night', label: 'Night', scope: 'service' },
  { value: 'month', label: 'Month', scope: 'service' },
  { value: 'person', label: 'Person (per head)', scope: 'service' },
  { value: 'trip', label: 'Trip', scope: 'service' },
];

export const UNITS_OF_MEASURE: UnitOption[] = UNIT_DEFINITIONS.map(({ value, label }) => ({ value, label }));

// Older forms saved different spellings for the same unit; map them to the canonical value.
const LEGACY_ALIASES: Record<string, string> = {
  l: 'liter',
  ltr: 'liter',
  litre: 'liter',
  gal: 'gallon',
  ea: 'each',
  pc: 'piece',
  pcs: 'piece',
};

export function normalizeUnit(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'each';
  const lower = trimmed.toLowerCase();
  if (UNIT_DEFINITIONS.some((u) => u.value === lower)) return lower;
  return LEGACY_ALIASES[lower] ?? trimmed;
}

function scopeMatches(scope: UnitScope, productType?: string | null): boolean {
  if (!productType) return true;
  if (scope === 'any') return true;
  return productType === 'service' ? scope === 'service' : scope === 'goods';
}

// Whether a unit is offered for the given product type (services get time / per-head
// units, stock items get physical units). No product type means no filtering.
export function isUnitAllowed(value: string, productType?: string | null): boolean {
  const unit = UNIT_DEFINITIONS.find((u) => u.value === normalizeUnit(value));
  return !unit || scopeMatches(unit.scope, productType);
}

// Options for a dropdown, filtered by product type. A stored unit that isn't in the
// filtered list (a unit from the other type, or a custom value) is appended so the
// form keeps showing and saving it instead of silently falling back to the first option.
export function getUnitOptions(currentValue?: string | null, productType?: string | null): UnitOption[] {
  const current = normalizeUnit(currentValue);
  const filtered = UNIT_DEFINITIONS
    .filter((u) => scopeMatches(u.scope, productType))
    .map(({ value, label }) => ({ value, label }));
  if (filtered.some((u) => u.value === current)) return filtered;

  const known = UNIT_DEFINITIONS.find((u) => u.value === current);
  return [...filtered, { value: current, label: known ? known.label : `${current} (custom)` }];
}
