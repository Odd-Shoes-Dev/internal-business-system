'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Region } from '@/lib/regional-pricing';
import { getSubscriptionPurchaseUrl, getEnterpriseContactInfo, planExceedsWhopLimit } from '@/lib/whop-utils';
import { CheckIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface PlanSelectionProps {
  onPlanSelected?: (planUrl: string) => void;
  showModules?: boolean;
}

const REGIONS: { id: Region; name: string; flag: string }[] = [
  { id: 'US', name: 'United States', flag: '🇺🇸' },
  { id: 'EU', name: 'Europe', flag: '🇪🇺' },
  { id: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { id: 'ASIA', name: 'Asia', flag: '🌏' },
  { id: 'AFRICA', name: 'Africa', flag: '🌍' },
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
      const purchaseUrl = getSubscriptionPurchaseUrl(selectedTier, billingPeriod, selectedRegion);
      
      if (!purchaseUrl) {
        toast.error('Plan not available for this region');
        return;
      }

      // Store plan selection details in localStorage to use after payment
      const planDetails = {
        tier: selectedTier,
        region: selectedRegion,
        billingPeriod: billingPeriod,
        timestamp: Date.now(),
      };
      localStorage.setItem('selectedPlan', JSON.stringify(planDetails));

      if (onPlanSelected) {
        onPlanSelected(purchaseUrl);
      } else {
        // Redirect to Whop checkout
        window.location.href = purchaseUrl;
      }
    } catch (error) {
      console.error('Error selecting plan:', error);
      toast.error('Failed to process plan selection');
    } finally {
      setLoading(false);
    }
  };

  const showContactForm = billingPeriod === 'annual' && selectedTier === 'enterprise' && planExceedsWhopLimit(5388); // Example enterprise annual price

  return (
    <div className="min-h-screen bg-gradient-to-br from-blueox-primary/5 via-white to-blueox-accent/5 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h1>
          <p className="text-xl text-gray-600">Select the perfect plan for your business</p>
        </div>

        {/* Region Selection */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Your Region</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {REGIONS.map((region) => (
              <button
                key={region.id}
                onClick={() => setSelectedRegion(region.id)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedRegion === region.id
                    ? 'border-blueox-primary bg-blueox-primary/5'
                    : 'border-gray-200 bg-white hover:border-blueox-primary/50'
                }`}
              >
                <div className="text-3xl mb-2">{region.flag}</div>
                <div className="font-semibold text-gray-900">{region.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Billing Period Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-gray-200 rounded-xl p-1">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-blueox-primary text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('annual')}
              className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                billingPeriod === 'annual'
                  ? 'bg-blueox-primary text-white'
                  : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              Annual
              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                Save 15%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              onClick={() => setSelectedTier(tier.id as any)}
              className={`rounded-2xl border-2 transition-all cursor-pointer ${
                selectedTier === tier.id
                  ? 'border-blueox-primary bg-gradient-to-br from-blueox-primary/5 to-blueox-accent/5'
                  : 'border-gray-200 bg-white hover:border-blueox-primary/50'
              }`}
            >
              <div className="p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    selectedTier === tier.id
                      ? 'bg-blueox-primary'
                      : 'bg-gray-200'
                  }`}>
                    {selectedTier === tier.id && (
                      <CheckIcon className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">{tier.name}</h3>
                </div>

                <p className="text-gray-600 mb-6">{tier.description}</p>

                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-gray-700">
                      <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
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
          <div className="max-w-2xl mx-auto bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-8 text-center">
            <h3 className="text-2xl font-bold text-amber-900 mb-4">
              ⚠️ High-Value Plan
            </h3>
            <p className="text-amber-800 mb-6">
              This plan exceeds our standard payment processing limits. Please contact our team for custom pricing and setup.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <a
                href={`mailto:${CONTACT_INFO.email}`}
                className="inline-flex items-center justify-center gap-2 bg-blueox-primary hover:bg-blueox-primary-hover text-white px-6 py-3 rounded-xl font-semibold transition-all"
              >
                📧 Email Us
              </a>
              <a
                href={CONTACT_INFO.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-semibold transition-all"
              >
                💬 WhatsApp
              </a>
            </div>

            <p className="text-sm text-amber-700">
              📞 {CONTACT_INFO.displayPhone}
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={handleSelectPlan}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Proceed to Checkout'}
              {!loading && <ArrowRightIcon className="w-5 h-5" />}
            </button>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-12 text-center text-gray-600">
          <p className="mb-2">Need help choosing?</p>
          <Link
            href="/contact"
            className="text-blueox-primary hover:text-blueox-primary-hover font-semibold underline"
          >
            Contact our sales team
          </Link>
        </div>
      </div>
    </div>
  );
}
