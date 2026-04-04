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
        bgColor: 'bg-red-50',
        borderColor: 'border-red-500',
        textColor: 'text-red-800',
        iconColor: 'text-red-500',
        icon: ExclamationTriangleIcon,
        message: `Your trial expired ${daysExpired} day${daysExpired !== 1 ? 's' : ''} ago!`,
        action: 'Upgrade Now',
      };
    } else if (daysRemaining === 0) {
      return {
        bgColor: 'bg-red-50',
        borderColor: 'border-red-400',
        textColor: 'text-red-700',
        iconColor: 'text-red-400',
        icon: ExclamationTriangleIcon,
        message: 'Your trial ends today!',
        action: 'Upgrade Now',
      };
    } else if (daysRemaining === 1) {
      return {
        bgColor: 'bg-red-50',
        borderColor: 'border-red-400',
        textColor: 'text-red-700',
        iconColor: 'text-red-400',
        icon: ExclamationTriangleIcon,
        message: 'Your trial ends tomorrow!',
        action: 'Upgrade Now',
      };
    } else if (daysRemaining <= 3) {
      return {
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-400',
        textColor: 'text-orange-700',
        iconColor: 'text-orange-400',
        icon: ExclamationTriangleIcon,
        message: `Your trial ends in ${daysRemaining} days.`,
        action: 'Upgrade to Continue',
      };
    } else {
      return {
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-400',
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
    <div className={`${config.bgColor} border-l-4 ${config.borderColor} p-4 mb-6 shadow-sm`}>
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
            <div className="mt-3">
              <Link
                href="/dashboard/billing"
                className={`inline-flex items-center px-4 py-2 text-sm font-semibold rounded-md ${
                  isExpired || daysRemaining <= 1
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : daysRemaining <= 3
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-yellow-600 text-white hover:bg-yellow-700'
                } transition-colors`}
              >
                {config.action} →
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
