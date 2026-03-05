'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Region } from '@/lib/regional-pricing';
import { getEnterpriseContactInfo, planExceedsWhopLimit } from '@/lib/whop-utils';
import { 
  CheckIcon, 
  ArrowRightIcon,
  GlobeAltIcon,
  SparklesIcon,
  EnvelopeIcon,
  ChatBubbleBottomCenterTextIcon,
  PhoneIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface PlanSelectionProps {
  onPlanSelected?: (planUrl: string) => void;
  showModules?: boolean;
}

const REGIONS: { id: Region; name: string; description: string }[] = [
  { id: 'US', name: 'United States', description: 'USD' },
  { id: 'EU', name: 'Europe', description: 'EUR' },
  { id: 'GB', name: 'United Kingdom', description: 'GBP' },
  { id: 'ASIA', name: 'Asia', description: 'Multi-currency' },
  { id: 'AFRICA', name: 'Africa', description: 'UGX' },
];

const TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small teams getting started',
    features: ['Up to 5 users', 'Core modules', 'Email support'],
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For growing teams',
    features: ['Up to 20 users', 'All modules', 'Priority support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Full-featured solution',
    features: ['Unlimited users', 'All modules + custom', 'Dedicated account manager'],
  },
];

const CONTACT_INFO = getEnterpriseContactInfo();

export default function PlanSelection({ onPlanSelected, showModules }: PlanSelectionProps) {
  const [selectedRegion, setSelectedRegion] = useState<Region>('US');
  const [selectedTier, setSelectedTier] = useState<'starter' | 'professional' | 'enterprise'>('starter');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);

  const handleSelectPlan = async () => {
    setLoading(true);
    try {
      // Store plan selection details in localStorage for after payment
      const planDetails = {
        tier: selectedTier,
        region: selectedRegion,
        billingPeriod: billingPeriod,
        timestamp: Date.now(),
      };
      localStorage.setItem('selectedPlan', JSON.stringify(planDetails));

      // Create a Whop checkout session (required – direct plan URLs show an error on Whop)
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          plan_tier: selectedTier,
          billing_period: billingPeriod,
          region: selectedRegion,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(data.error || 'Could not start checkout');
        return;
      }

      const checkoutUrl = data.url;
      if (!checkoutUrl) {
        toast.error('No checkout URL returned');
        return;
      }

      if (onPlanSelected) {
        onPlanSelected(checkoutUrl);
      } else {
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      console.error('Error selecting plan:', error);
      toast.error('Failed to process plan selection');
    } finally {
      setLoading(false);
    }
  };

  const handleStartFreeTrial = async () => {
    setLoading(true);
    try {
      // Company name from signup (stored in localStorage) – required when API creates a new company
      let companyName: string | undefined;
      try {
        const stored = localStorage.getItem('companyName');
        if (typeof stored === 'string' && stored.trim()) companyName = stored.trim();
      } catch {
        // ignore localStorage errors
      }

      const response = await fetch('/api/trial/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: selectedTier,
          region: selectedRegion,
          billingPeriod,
          ...(companyName ? { name: companyName } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start free trial');
      }

      // Clear stored data
      localStorage.removeItem('selectedPlan');
      localStorage.removeItem('companyName');

      toast.success('30-day free trial started! Redirecting to dashboard...');
      
      // Redirect to dashboard
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    } catch (error: any) {
      console.error('Trial error:', error);
      toast.error(error.message || 'Failed to start free trial');
      setLoading(false);
    }
  };

  const showContactForm = billingPeriod === 'annual' && selectedTier === 'enterprise' && planExceedsWhopLimit(5388); // Example enterprise annual price

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 py-12 px-4">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-400/5 rounded-full blur-xl"></div>
        <div className="absolute top-60 right-16 w-24 h-24 bg-cyan-400/10 rounded-full blur-lg"></div>
        <div className="absolute bottom-32 left-1/2 w-40 h-40 bg-blue-300/5 rounded-full blur-2xl"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <SparklesIcon className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-black mb-4">Choose Your Plan</h1>
          <p className="text-lg text-black/70">Select the perfect plan for your business needs</p>
        </div>

        {/* Region Selection */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <GlobeAltIcon className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-black">Select Your Region</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {REGIONS.map((region) => (
              <button
                key={region.id}
                onClick={() => setSelectedRegion(region.id)}
                className={`p-4 rounded-2xl border-2 transition-all duration-300 ${
                  selectedRegion === region.id
                    ? 'border-blue-500 bg-white shadow-lg'
                    : 'border-slate-200 bg-white/60 hover:border-blue-300 hover:shadow-md'
                }`}
              >
                <div className="font-semibold text-black text-sm">{region.name}</div>
                <div className="text-black/60 text-xs mt-1">{region.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Billing Period Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-white/80 backdrop-blur-sm rounded-2xl p-1 border border-slate-200">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-xl font-semibold transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-black hover:text-black/80'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-6 py-2 rounded-xl font-semibold transition-all flex items-center gap-2 ${
                billingPeriod === 'annual'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-black hover:text-black/80'
              }`}
            >
              Annual
              {billingPeriod === 'annual' && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-semibold">
                  Save 15%
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              onClick={() => setSelectedTier(tier.id as any)}
              className={`rounded-2xl border-2 transition-all duration-300 cursor-pointer backdrop-blur-sm ${
                selectedTier === tier.id
                  ? 'border-blue-500 bg-white shadow-xl'
                  : 'border-slate-200 bg-white/60 hover:border-blue-300 hover:shadow-lg'
              }`}
            >
              <div className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    selectedTier === tier.id
                      ? 'bg-blue-600'
                      : 'bg-slate-200'
                  }`}>
                    {selectedTier === tier.id && (
                      <CheckIcon className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-black">{tier.name}</h3>
                </div>

                <p className="text-black/70 mb-6 text-sm">{tier.description}</p>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-black/80 text-sm">
                      <CheckIcon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Action Section */}
        {showContactForm ? (
          <div className="max-w-2xl mx-auto bg-white/80 backdrop-blur-sm border-2 border-amber-200 rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold text-black mb-4">
              High-Value Plan
            </h3>
            <p className="text-black/70 mb-6">
              This plan exceeds our standard payment processing limits. Please contact our team for custom pricing and setup.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <a
                href={`mailto:${CONTACT_INFO.email}`}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg"
              >
                <EnvelopeIcon className="w-5 h-5" />
                Email Us
              </a>
              <a
                href={CONTACT_INFO.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg"
              >
                <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                WhatsApp
              </a>
            </div>

            <div className="flex items-center justify-center gap-2 text-black/70">
              <PhoneIcon className="w-5 h-5" />
              <p className="text-sm">
                {CONTACT_INFO.displayPhone}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleStartFreeTrial}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-white border-2 border-blue-600 hover:bg-blue-50 text-blue-600 px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Start Free Trial (30 Days)'}
            </button>
            <button
              onClick={handleSelectPlan}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:shadow-xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Proceed to Checkout'}
              {!loading && <ArrowRightIcon className="w-5 h-5" />}
            </button>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-12 text-center">
          <p className="text-black/70 mb-4">
            <span className="font-semibold">No credit card required</span> for the free trial. You can upgrade anytime.
          </p>
          <Link
            href="/contact"
            className="text-blue-600 hover:text-blue-700 font-semibold underline hover:underline-offset-2 transition-all"
          >
            Need help choosing?
          </Link>
        </div>
      </div>
    </div>
  );
}
