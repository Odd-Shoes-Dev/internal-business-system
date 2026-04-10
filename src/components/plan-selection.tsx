'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Region, PRICING, formatPrice } from '@/lib/regional-pricing';
import { getEnterpriseContactInfo, planExceedsWhopLimit } from '@/lib/whop-utils';
import { 
  CheckIcon, 
  XMarkIcon,
  ArrowRightIcon,
  GlobeAltIcon,
  SparklesIcon,
  EnvelopeIcon,
  ChatBubbleBottomCenterTextIcon,
  PhoneIcon,
  LockClosedIcon,
  MapPinIcon,
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
    id: 'starter' as const,
    name: 'Starter',
    description: 'Perfect for small businesses just getting started',
    users: 'Up to 3 users',
    modules: '+ 1 optional module',
    recommended: false,
    features: [
      'Complete platform (accounting, invoicing, CRM, reports)',
      'Basic reporting & dashboards',
      'Email support',
      'Mobile app access',
      '1 industry module (add-on)',
    ],
    notIncluded: [
      'Multi-currency support',
      'Advanced reporting & analytics',
      'API access',
      'Priority support',
      'Dedicated account manager',
    ],
  },
  {
    id: 'professional' as const,
    name: 'Professional',
    description: 'For growing businesses that need more power',
    users: 'Up to 10 users',
    modules: '+ Up to 3 modules included',
    recommended: true,
    features: [
      'Everything in Starter',
      'Up to 3 industry modules included',
      'Multi-currency support',
      'Advanced reporting & analytics',
      'API access',
      'Priority email support',
      'Custom fields & bulk operations',
    ],
    notIncluded: [
      'Dedicated account manager',
      'Phone support',
      'Custom integrations',
    ],
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    description: 'For large organizations with complex needs',
    users: 'Unlimited users',
    modules: '+ All modules unlocked',
    recommended: false,
    features: [
      'Everything in Professional',
      'All industry modules unlocked',
      'Dedicated account manager',
      '24/7 phone support',
      'Custom integrations & SLA guarantee',
      'Advanced security features',
      'Training & onboarding',
      'Custom contracts',
    ],
    notIncluded: [],
  },
];

const CONTACT_INFO = getEnterpriseContactInfo();

export default function PlanSelection({ onPlanSelected, showModules }: PlanSelectionProps) {
  const [selectedRegion, setSelectedRegion] = useState<Region>('US');
  const [regionLocked, setRegionLocked] = useState(false);
  const [regionSource, setRegionSource] = useState<'company' | 'ip' | 'default' | 'loading'>('loading');
  const [selectedTier, setSelectedTier] = useState<'starter' | 'professional' | 'enterprise'>('professional');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);

  // Auto-detect region from server on mount
  useEffect(() => {
    fetch('/api/auth/detect-region', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.region) setSelectedRegion(data.region);
        setRegionLocked(!!data.locked);
        setRegionSource(data.source ?? 'default');
      })
      .catch(() => setRegionSource('default'));
  }, []);

  const getPriceDisplay = (tierId: 'starter' | 'professional' | 'enterprise') => {
    const pricing = PRICING[tierId][selectedRegion];
    const price = billingPeriod === 'monthly' ? pricing.monthly : pricing.annually;
    return formatPrice(price, pricing.currency);
  };

  const getAnnualSavings = (tierId: 'starter' | 'professional' | 'enterprise') => {
    const pricing = PRICING[tierId][selectedRegion];
    const monthlyCost = pricing.monthly * 12;
    const annualCost = pricing.annually * 12;
    const savings = Math.round(((monthlyCost - annualCost) / monthlyCost) * 100);
    return savings;
  };

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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <GlobeAltIcon className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-black">Your Region</h2>
            </div>
            {regionLocked ? (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                <LockClosedIcon className="w-3.5 h-3.5" />
                Locked to your account
              </div>
            ) : regionSource === 'ip' ? (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-600 text-xs font-medium px-3 py-1.5 rounded-full">
                <MapPinIcon className="w-3.5 h-3.5" />
                Auto-detected from your location
              </div>
            ) : regionSource === 'loading' ? (
              <div className="text-xs text-black/40 px-3 py-1.5">Detecting location…</div>
            ) : null}
          </div>

          {regionLocked && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <strong>Pricing region is locked</strong> to your account for billing consistency.
              Contact support if you believe this is incorrect.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {REGIONS.map((region) => {
              const isSelected = selectedRegion === region.id;
              return (
                <button
                  key={region.id}
                  onClick={() => !regionLocked && setSelectedRegion(region.id)}
                  disabled={regionLocked}
                  className={`p-4 rounded-2xl border-2 transition-all duration-300 text-left ${
                    isSelected
                      ? 'border-blue-500 bg-white shadow-lg'
                      : 'border-slate-200 bg-white/60'
                  } ${regionLocked ? 'cursor-not-allowed opacity-70' : 'hover:border-blue-300 hover:shadow-md cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-black text-sm">{region.name}</div>
                    {isSelected && regionLocked && <LockClosedIcon className="w-3 h-3 text-amber-500" />}
                  </div>
                  <div className="text-black/50 text-xs mt-0.5">{region.description}</div>
                </button>
              );
            })}
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
              <span className={`text-xs px-2 py-0.5 rounded-lg font-semibold ${
                billingPeriod === 'annual' ? 'bg-green-400/30 text-green-100' : 'bg-green-100 text-green-700'
              }`}>
                Save {getAnnualSavings(selectedTier)}%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              onClick={() => setSelectedTier(tier.id)}
              className={`relative rounded-2xl border-2 transition-all duration-300 cursor-pointer backdrop-blur-sm flex flex-col ${
                selectedTier === tier.id
                  ? 'border-blue-500 bg-white shadow-xl'
                  : 'border-slate-200 bg-white/60 hover:border-blue-300 hover:shadow-lg'
              } ${tier.recommended ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
            >
              {/* Recommended badge */}
              {tier.recommended && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-md">
                    Recommended
                  </span>
                </div>
              )}

              <div className="p-8 flex flex-col flex-1">
                {/* Plan header */}
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                    selectedTier === tier.id ? 'bg-blue-600' : 'bg-slate-200'
                  }`}>
                    {selectedTier === tier.id && <CheckIcon className="w-5 h-5 text-white" />}
                  </div>
                  <h3 className="text-2xl font-bold text-black">{tier.name}</h3>
                </div>

                <p className="text-black/60 text-sm mb-5 ml-11">{tier.description}</p>

                {/* Price */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-black">{getPriceDisplay(tier.id)}</span>
                    <span className="text-black/50 text-sm">/month</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-slate-100 text-black/50 px-2 py-0.5 rounded font-medium">
                      {PRICING[tier.id][selectedRegion].currency}
                    </span>
                    {billingPeriod === 'annual' && (
                      <span className="text-xs text-black/40">
                        Billed annually — save {getAnnualSavings(tier.id)}% vs monthly
                      </span>
                    )}
                    {billingPeriod === 'monthly' && (
                      <span className="text-xs text-green-600 font-medium">
                        Save {getAnnualSavings(tier.id)}% with annual billing
                      </span>
                    )}
                  </div>
                </div>

                {/* Users & Modules */}
                <div className="mb-5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-black/50">Users</span>
                    <span className="font-semibold text-black">{tier.users}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-black/50">Modules</span>
                    <span className="font-semibold text-black">{tier.modules}</span>
                  </div>
                </div>

                {/* Included features */}
                <ul className="space-y-2.5 mb-4 flex-1">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-black/80">
                      <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                  {tier.notIncluded.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-black/30">
                      <XMarkIcon className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
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
