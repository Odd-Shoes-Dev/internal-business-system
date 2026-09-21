'use client';

import { useEffect } from 'react';

// A focused <input type="number"> changes its value when the mouse wheel turns over it,
// so scrolling a form can silently alter a price or quantity. Dropping focus on wheel
// makes the wheel scroll the page instead. Mounted once in the root layout so it covers
// every number field in the app.
export function DisableNumberWheel() {
  useEffect(() => {
    const handler = (event: WheelEvent) => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement && el.type === 'number' && event.target === el) {
        el.blur();
      }
    };
    document.addEventListener('wheel', handler, { passive: true, capture: true });
    return () => document.removeEventListener('wheel', handler, { capture: true });
  }, []);

  return null;
}
