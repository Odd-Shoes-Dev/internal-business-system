'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

export function CheckoutSuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate verification of payment
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <CheckCircleIcon className="w-16 h-16 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Processing Your Payment</h1>
          <p className="text-gray-600">Please wait while we confirm your subscription...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center border border-green-200">
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircleIcon className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-green-900 mb-3">
            Payment Successful!
          </h1>

          <p className="text-gray-600 mb-2">
            Your subscription has been activated successfully.
          </p>

          <p className="text-gray-600 mb-8">
            Check your email for confirmation details and next steps.
          </p>

          <div className="space-y-3">
            <Link
              href="/dashboard"
              className="block w-full bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-white px-6 py-3 rounded-xl font-semibold transition-all"
            >
              Go to Dashboard
            </Link>

            <Link
              href="/"
              className="block w-full bg-gray-200 hover:bg-gray-300 text-gray-900 px-6 py-3 rounded-xl font-semibold transition-all"
            >
              Return Home
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4">
              Questions? We're here to help!
            </p>
            <a
              href="mailto:support@blueoox.com"
              className="text-blueox-primary hover:text-blueox-primary-hover font-semibold"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
