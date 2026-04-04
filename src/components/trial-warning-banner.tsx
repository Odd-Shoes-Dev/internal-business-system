'use client';

import { useEffect, useState } from 'react';
import { XMarkIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface TrialWarningProps {
  trialEndDate?: string;
  subscriptionStatus?: string;
}

export default function TrialWarningBanner({ trialEndDate, subscriptionStatus }: TrialWarningProps) {
  const [dismissed, setDismissed] = useState(false);
  // Keep a drifting `now` value so we can compute daysRemaining synchronously
  // on render (avoids an initial incorrect 0 value flash).
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    if (!trialEndDate) return;

    // update `now` hourly so the banner updates without frequent re-renders
    const interval = setInterval(() => setNow(Date.now()), 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, [trialEndDate]);

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysRemaining = trialEndDate
    ? Math.ceil((new Date(trialEndDate).getTime() - now) / msPerDay)
    : Infinity;

  const isExpired = daysRemaining < 0;
  const daysExpired = isExpired ? Math.abs(daysRemaining) : 0;

  // Don't show if dismissed or not in trial
  if (dismissed || subscriptionStatus !== 'trial') {
    return null;
  }

  // Show when trial is expired OR within 7 days of expiring
  if (!isExpired && daysRemaining > 7) {
    return null;
  }

  // Different urgency levels
  const getUrgencyConfig = () => {
    if (isExpired) {
      return {
        textColor: 'text-red-800',
        iconColor: 'text-red-500',
        icon: ExclamationTriangleIcon,
        message: `Your trial expired ${daysExpired} day${daysExpired !== 1 ? 's' : ''} ago!`,
        action: 'Upgrade Now',
      };
    } else if (daysRemaining === 0) {
      return {
        textColor: 'text-red-700',
        iconColor: 'text-red-400',
        icon: ExclamationTriangleIcon,
        message: 'Your trial ends today!',
        action: 'Upgrade Now',
      };
    } else if (daysRemaining === 1) {
      return {
        textColor: 'text-red-700',
        iconColor: 'text-red-400',
        icon: ExclamationTriangleIcon,
        message: 'Your trial ends tomorrow!',
        action: 'Upgrade Now',
      };
    } else if (daysRemaining <= 3) {
      return {
        textColor: 'text-orange-700',
        iconColor: 'text-orange-400',
        icon: ExclamationTriangleIcon,
        message: `Your trial ends in ${daysRemaining} days.`,
        action: 'Upgrade to Continue',
      };
    } else {
      return {
        textColor: 'text-yellow-700',
        iconColor: 'text-yellow-400',
        icon: ClockIcon,
        message: `Your trial ends in ${daysRemaining} days.`,
        action: 'View Plans',
      };
    }
  };

  const config = getUrgencyConfig();
  const Icon = config.icon;

  return (
    <div className={`bg-gradient-to-br from-white via-slate-50 to-blue-50 p-4 mb-6 shadow-[0_4px_12px_rgba(0,0,0,0.08)]`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start flex-1">
          <Icon className={`h-5 w-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
          <div className="ml-3 flex-1">
            <p className={`text-sm font-semibold ${config.textColor}`}>
              {config.message}
            </p>
            <p className={`text-sm ${config.textColor} mt-1`}>
              Upgrade to a paid plan to continue accessing your modules and data.
            </p>
            <div className="mt-4">
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02]"
              >
                {config.action}
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className={`ml-4 flex-shrink-0 ${config.textColor} hover:opacity-70 transition-opacity`}
          aria-label="Dismiss"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
