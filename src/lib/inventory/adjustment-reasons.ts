// Stock adjustment reasons and labels (safe to import in the browser)
export const ADJUSTMENT_REASON_OPTIONS = [
  { value: 'count_correction', label: 'Count correction', direction: 'either' },
  { value: 'found', label: 'Found stock', direction: 'in' },
  { value: 'damage', label: 'Damaged', direction: 'out' },
  { value: 'expired', label: 'Expired', direction: 'out' },
  { value: 'spoilage', label: 'Spoilage', direction: 'out' },
  { value: 'theft', label: 'Theft / missing', direction: 'out' },
  { value: 'internal_use', label: 'Used internally', direction: 'out' },
  { value: 'other', label: 'Other', direction: 'either' },
] as const;

export const adjustmentReasonLabel = (value: string) =>
  ADJUSTMENT_REASON_OPTIONS.find((o) => o.value === value)?.label ?? value;
