'use client';

import { cn } from '@/lib/utils';

const FONT_SIZE_STEPS = [
  'text-5xl',
  'text-4xl',
  'text-3xl',
  'text-2xl',
  'text-xl',
  'text-lg',
  'text-base',
  'text-sm',
  'text-xs',
] as const;

type SizeStep = (typeof FONT_SIZE_STEPS)[number];

interface FitNumberProps {
  value: string | number;
  className?: string;
  /** Maximum (starting) size — defaults to text-2xl, shrinks as needed */
  startSize?: SizeStep;
}

/**
 * How many extra size steps to drop based on character count.
 * Calibrated for tabular-nums font at each starting size.
 *   ≤ 8 chars  → stay at start  (e.g. "$945.00")
 *   9–10 chars → drop 1         (e.g. "$1,200.00")
 *  11–12 chars → drop 2         (e.g. "$404,055.00", "USh 400,000")
 *  13–15 chars → drop 3         (e.g. "$1,234,567.89")
 *  16+ chars   → drop 4         (very long currency strings)
 */
function stepsToDropForLength(len: number): number {
  if (len <= 8) return 0;
  if (len <= 10) return 1;
  if (len <= 12) return 2;
  if (len <= 15) return 3;
  return 4;
}

function getSizeClass(value: string | number, startSize: SizeStep): SizeStep {
  const str = String(value);
  const startIdx = FONT_SIZE_STEPS.indexOf(startSize);
  const base = startIdx === -1 ? 3 : startIdx; // default text-2xl = index 3
  const drop = stepsToDropForLength(str.length);
  const idx = Math.min(base + drop, FONT_SIZE_STEPS.length - 1);
  return FONT_SIZE_STEPS[idx];
}

/**
 * Renders a number or currency value, automatically stepping down the font
 * size based on string length so the value never overflows its container.
 * No DOM measurement needed — works on SSR and renders correctly on first paint.
 */
export function FitNumber({ value, className, startSize = 'text-2xl' }: FitNumberProps) {
  const sizeClass = getSizeClass(value, startSize);

  return (
    <span className={cn('block w-full overflow-hidden whitespace-nowrap tabular-nums', sizeClass, className)}>
      {value}
    </span>
  );
}
