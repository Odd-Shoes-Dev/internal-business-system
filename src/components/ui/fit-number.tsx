'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

const FONT_SIZE_STEPS = [
  'text-3xl',
  'text-2xl',
  'text-xl',
  'text-lg',
  'text-base',
  'text-sm',
  'text-xs',
] as const;

interface FitNumberProps {
  value: string | number;
  className?: string;
  /** Starting size — defaults to text-2xl */
  startSize?: (typeof FONT_SIZE_STEPS)[number];
}

/**
 * Renders a number/currency value and automatically shrinks the font size
 * via ResizeObserver until the text fits within its container without
 * overflowing. Works with any currency symbol length or number magnitude.
 */
export function FitNumber({ value, className, startSize = 'text-2xl' }: FitNumberProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const startIndex = FONT_SIZE_STEPS.indexOf(startSize);
  const [sizeIndex, setSizeIndex] = useState(startIndex === -1 ? 1 : startIndex);

  const fit = useCallback(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const containerWidth = container.offsetWidth;
    if (containerWidth === 0) return;

    // Walk down sizes until text fits, starting from the configured start size
    let idx = startIndex === -1 ? 1 : startIndex;
    while (idx < FONT_SIZE_STEPS.length - 1) {
      // Apply candidate size and measure
      text.className = cn('whitespace-nowrap', FONT_SIZE_STEPS[idx], className);
      if (text.scrollWidth <= containerWidth) break;
      idx++;
    }
    setSizeIndex(idx);
  }, [className, startIndex]);

  useEffect(() => {
    fit();
    const observer = new ResizeObserver(fit);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fit, value]);

  return (
    <span ref={containerRef} className="block w-full overflow-hidden">
      <span
        ref={textRef}
        className={cn('whitespace-nowrap tabular-nums', FONT_SIZE_STEPS[sizeIndex], className)}
      >
        {value}
      </span>
    </span>
  );
}
