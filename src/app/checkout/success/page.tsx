'use client';

import { Suspense } from 'react';
import { CheckoutSuccessClient } from './checkout-success-client';

function CheckoutSuccessLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="mb-4">
          <div className="w-16 h-16 mx-auto bg-gray-200 rounded-full animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Processing Your Payment</h1>
        <p className="text-gray-600">Please wait while we confirm your subscription...</p>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<CheckoutSuccessLoading />}>
      <CheckoutSuccessClient />
    </Suspense>
  );
}
