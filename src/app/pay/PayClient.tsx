"use client";

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { formatCurrency } from '@/lib/utils';
import {
  CheckCircleIcon,
  DocumentTextIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  total: number;
  amount_paid: number;
  status: string;
  due_date: string;
}

function PaymentForm({ invoice, clientSecret }: { invoice: Invoice; clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const amountDue = invoice.total - invoice.amount_paid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pay/success?invoice=${invoice.id}`,
      },
    });

    if (submitError) {
      setError(submitError.message || 'An error occurred');
      setIsProcessing(false);
    }
  };

  if (isComplete) {
    return (
      <div className="bg-gradient-to-r from-green-50/80 to-emerald-50/80 backdrop-blur-sm rounded-3xl p-8 text-center border border-green-200">
        <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircleIcon className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-green-800 mb-3">Payment Successful!</h2>
        <p className="text-green-700 font-medium">Thank you for your payment. Your transaction has been processed securely.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 backdrop-blur-sm rounded-2xl p-6 border border-blueox-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blueox-primary/20 to-blueox-accent/20 rounded-xl flex items-center justify-center">
              <CreditCardIcon className="w-5 h-5 text-blueox-primary" />
            </div>
            <span className="text-lg font-semibold text-gray-700">Amount Due</span>
          </div>
          <span className="text-2xl lg:text-3xl font-bold text-blueox-primary-dark">
            {formatCurrency(amountDue)}
          </span>
        </div>
      </div>

      <PaymentElement />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 px-4 bg-[#1e3a5f] text-white rounded-lg font-medium hover:bg-[#1e3a5f]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing...
          </span>
        ) : (
          `Pay ${formatCurrency(amountDue)}`
        )}
      </button>

      <p className="text-xs text-center text-gray-500">
        Secured by Stripe. Your payment information is encrypted.
      </p>
    </form>
  );
}

export default function PayClient({ invoiceId }: { invoiceId?: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) {
      setError('No invoice specified');
      setIsLoading(false);
      return;
    }

    fetchInvoiceAndCreatePayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const fetchInvoiceAndCreatePayment = async () => {
    try {
      const invoiceRes = await fetch(`/api/invoices/${invoiceId}`);
      if (!invoiceRes.ok) {
        throw new Error('Invoice not found');
      }
      const invoiceData = await invoiceRes.json();
      setInvoice(invoiceData);

      if (invoiceData.status === 'paid') {
        setError('This invoice has already been paid');
        setIsLoading(false);
        return;
      }

      const paymentRes = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });

      if (!paymentRes.ok) {
        throw new Error('Failed to initialize payment');
      }

      const { clientSecret } = await paymentRes.json();
      setClientSecret(clientSecret);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-blueox-primary/5 rounded-full blur-xl"></div>
          <div className="absolute bottom-20 right-16 w-24 h-24 bg-blueox-accent/10 rounded-full blur-lg"></div>
        </div>
        
        <div className="relative bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-8 shadow-xl text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blueox-primary border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-blueox-primary-dark mb-2">Loading Invoice</h2>
          <p className="text-gray-600">Please wait while we prepare your payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-red-500/5 rounded-full blur-xl"></div>
          <div className="absolute bottom-20 right-16 w-24 h-24 bg-red-500/10 rounded-full blur-lg"></div>
        </div>
        
        <div className="relative bg-white/80 backdrop-blur-xl border border-red-200 rounded-3xl p-8 shadow-xl max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <DocumentTextIcon className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-red-800 mb-3">Payment Error</h1>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!invoice || !clientSecret) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/assets/logo.png"
            alt="Company Logo"
            className="h-10 mx-auto"
          />
        </div>

        {/* Invoice Details Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-[#1e3a5f] to-[#0d9488] px-6 py-4">
            <div className="flex items-center gap-3 text-white">
              <div>
                <p className="text-sm opacity-80">Invoice Payment</p>
                <p className="font-semibold">{invoice.invoice_number}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm invoice={invoice} clientSecret={clientSecret} />
            </Elements>
          </div>
        </div>
      </div>
    </div>
  );
}


