'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SUBSCRIPTION_EXPIRED_MESSAGE, TRIAL_EXPIRED_MESSAGE } from '@/lib/subscription-access';

const TOAST_ID = 'trial-expired';

// When the server blocks a change because the trial or paid period has ended (402 TRIAL_EXPIRED / SUBSCRIPTION_EXPIRED), show one
// clear message with an Upgrade button, whichever screen made the request. The screen's own
// "failed" toast for the same message is skipped so the user does not see two.
export function TrialExpiredHandler() {
  const router = useRouter();

  useEffect(() => {
    const originalFetch = window.fetch;
    const originalError = toast.error;

    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      if (res.status === 402) {
        try {
          const data = await res.clone().json();
          if (data?.code === 'TRIAL_EXPIRED' || data?.code === 'SUBSCRIPTION_EXPIRED') {
            toast.custom(
              (t) => (
                <div
                  className={`${t.visible ? 'animate-enter' : 'animate-leave'} flex max-w-sm items-start gap-3 rounded-lg bg-red-600 px-4 py-3 text-sm text-white shadow-lg`}
                >
                  <div className="flex-1">
                    <p>{data.error || (data.code === 'SUBSCRIPTION_EXPIRED' ? SUBSCRIPTION_EXPIRED_MESSAGE : TRIAL_EXPIRED_MESSAGE)}</p>
                    <button
                      type="button"
                      onClick={() => {
                        toast.dismiss(TOAST_ID);
                        router.push('/dashboard/billing/upgrade');
                      }}
                      className="mt-2 rounded bg-white px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Upgrade now
                    </button>
                  </div>
                </div>
              ),
              { id: TOAST_ID, duration: 8000 }
            );
          }
        } catch {
          // not JSON; nothing to show here
        }
      }
      return res;
    };

    toast.error = ((message: any, opts?: any) => {
      if (message === TRIAL_EXPIRED_MESSAGE || message === SUBSCRIPTION_EXPIRED_MESSAGE) return TOAST_ID;
      return originalError(message, opts);
    }) as typeof toast.error;

    return () => {
      window.fetch = originalFetch;
      toast.error = originalError;
    };
  }, [router]);

  return null;
}
