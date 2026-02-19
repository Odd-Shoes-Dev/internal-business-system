'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/company-context';
import { regionalPricing } from '@/lib/regional-pricing';
import { Check, X, Loader2, Mail, MessageCircle, X as CloseIcon } from 'lucide-react';

type BillingPeriod = 'monthly' | 'annual';
type PlanTier = 'starter' | 'professional' | 'enterprise';

// Contact information for large purchases
const CONTACT_INFO = {
  email: 'support@blueox.com',
  whatsapp: '+256700123456', // Replace with actual WhatsApp number
  whatsappUrl: 'https://wa.me/256700123456?text=I%20am%20interested%20in%20upgrading%20my%20plan%20for%20enterprise%20pricing',
  emailUrl: 'mailto:support@blueox.com?subject=Enterprise%20Plan%20Inquiry&body=I%20am%20interested%20in%20upgrading%20to%20an%20enterprise%20plan%20with%20annual%20billing.',
};

export default function UpgradePage() {
  const router = useRouter();
  const { company } = useCompany();
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('professional');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [loading, setLoading] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [priceExceeded, setPriceExceeded] = useState<number | null>(null);

  // Fetch current subscription
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch('/api/billing/subscription');
        if (response.ok) {
          const data = await response.json();
          setCurrentSubscription(data);
        }
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
      }
    };
    fetchSubscription();
  }, []);

  // Get pricing for current region
  const pricing = regionalPricing[company?.region || 'DEFAULT'];
  const currencySymbol = pricing.starter.currencySymbol;

  // Calculate total price in USD
  const calculateTotalPrice = () => {
    const pricing = regionalPricing[company?.region || 'DEFAULT'];
    const tierData = pricing[selectedPlan];
    
    let usdPrice = 0;
    
    // Get the base price in local currency
    let localPrice: number;
    if (billingPeriod === 'monthly') {
      localPrice = tierData.monthly.max;
    } else {
      localPrice = tierData.annual;
    }
    
    // Convert to USD based on currency
    const exchangeRates: { [key: string]: number } = {
      '$': 1.0,   // USD
      '€': 1.10,  // EUR
      '£': 1.27,  // GBP
      'UGX': 0.00027, // UGX
    };
    
    const rate = exchangeRates[tierData.currencySymbol] || 1.0;
    usdPrice = Math.round(localPrice * rate * 100) / 100;
    
    return usdPrice;
  };

  const handleUpgrade = async () => {
    const totalPrice = calculateTotalPrice();
    
    // Check if price exceeds $2500 USD limit
    if (totalPrice > 2500) {
      setPriceExceeded(totalPrice);
      setShowContactModal(true);
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTier: selectedPlan,
          billingPeriod: billingPeriod,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Failed to process upgrade. Please try again.');
      setLoading(false);
    }
  };

  const handleChangePlan = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/billing/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPlanTier: selectedPlan,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to change plan');
      }

      alert('Plan changed successfully!');
      router.push('/dashboard/billing');
    } catch (error) {
      console.error('Plan change error:', error);
      alert('Failed to change plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isCurrentPlan = (tier: PlanTier) => {
    return currentSubscription?.plan_tier === tier;
  };

  const getPrice = (tier: PlanTier) => {
    const tierData = pricing[tier];
    if (billingPeriod === 'monthly') {
      return `${currencySymbol} ${tierData.monthly.min.toLocaleString()}-${tierData.monthly.max.toLocaleString()}`;
    } else {
      const monthlyEquivalent = tierData.annual / 12;
      return `${currencySymbol} ${Math.round(monthlyEquivalent).toLocaleString()}`;
    }
  };

  const plans = [
    {
      tier: 'starter' as PlanTier,
      name: 'Starter',
      description: 'Perfect for small businesses just getting started',
      users: '3 users',
      modules: '+ 1 optional module',
      features: [
        'Complete platform (accounting, invoicing, CRM, reports)',
        'Basic reporting',
        'Email support',
        'Mobile app access',
      ],
      notIncluded: [
        'Multi-currency',
        'Advanced reporting',
        'API access',
        'Priority support',
      ],
    },
    {
      tier: 'professional' as PlanTier,
      name: 'Professional',
      description: 'For growing businesses that need more power',
      users: '10 users',
      modules: '+ Up to 3 modules included',
      features: [
        'Everything in Starter',
        'Up to 3 industry modules included',
        'Multi-currency support',
        'Advanced reporting & analytics',
        'API access',
        'Priority email support',
        'Custom fields',
        'Bulk operations',
      ],
      notIncluded: [
        'Dedicated account manager',
        'Phone support',
        'Custom integrations',
      ],
      recommended: true,
    },
    {
      tier: 'enterprise' as PlanTier,
      name: 'Enterprise',
      description: 'For large organizations with complex needs',
      users: 'Unlimited users',
      modules: '+ All modules unlocked',
      features: [
        'Everything in Professional',
        'Unlimited users',
        'All industry modules unlocked',
        'Dedicated account manager',
        '24/7 phone support',
        'Custom integrations',
        'SLA guarantee',
        'Advanced security features',
        'Training & onboarding',
        'Custom contracts',
      ],
      notIncluded: [],
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Choose Your Plan</h1>
        <p className="text-gray-600 mt-2">
          Select the plan that best fits your business needs
        </p>
      </div>

      {/* Billing Period Toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'annual'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Annual
            <span className="ml-2 text-xs text-green-600 font-semibold">Save 15%</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {plans.map((plan) => {
          const isCurrent = isCurrentPlan(plan.tier);
          const isSelected = selectedPlan === plan.tier;

          return (
            <div
              key={plan.tier}
              className={`relative rounded-lg border-2 p-6 cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 shadow-lg'
                  : 'border-gray-200 hover:border-gray-300'
              } ${plan.recommended ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
              onClick={() => setSelectedPlan(plan.tier)}
            >
              {plan.recommended && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Recommended
                  </span>
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-4 right-4">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-gray-900">
                    {getPrice(plan.tier)}
                  </span>
                  <span className="text-gray-600 ml-2">/month</span>
                </div>
                {billingPeriod === 'annual' && (
                  <p className="text-xs text-gray-500 mt-1">Billed annually</p>
                )}
              </div>

              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Users:</span>
                  <span className="font-medium text-gray-900">{plan.users}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-600">Modules:</span>
                  <span className="font-medium text-gray-900">{plan.modules}</span>
                </div>
              </div>

              <div className="space-y-3">
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </div>
                ))}
                {plan.notIncluded.map((feature, idx) => (
                  <div key={idx} className="flex items-start">
                    <X className="w-5 h-5 text-gray-300 mr-2 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-400">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => router.back()}
          className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          onClick={currentSubscription ? handleChangePlan : handleUpgrade}
          disabled={loading || isCurrentPlan(selectedPlan)}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isCurrentPlan(selectedPlan)
            ? 'Current Plan'
            : currentSubscription
            ? 'Change Plan'
            : 'Upgrade Now'}
        </button>
      </div>

      {/* Trial Notice */}
      {!currentSubscription?.stripe_subscription_id && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Start your 14-day free trial • No credit card required
          </p>
        </div>
      )}

      {/* Contact Modal for Large Purchases */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Enterprise Plan Inquiry</h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-gray-700">
                Your selected plan <span className="font-bold">${priceExceeded?.toFixed(2)} USD {billingPeriod === 'annual' ? 'annually' : 'per month'}</span> exceeds our standard checkout limit of <span className="font-bold">$2,500 USD</span>.
              </p>
            </div>

            <p className="text-gray-700 mb-6">
              For custom pricing and enterprise solutions, please contact our sales team directly:
            </p>

            <div className="space-y-4 mb-6">
              {/* WhatsApp Contact */}
              <a
                href={CONTACT_INFO.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-lg border border-green-200 hover:bg-green-50 transition-colors"
              >
                <div className="bg-green-100 p-3 rounded-lg">
                  <MessageCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">WhatsApp</div>
                  <div className="text-sm text-gray-600">{CONTACT_INFO.whatsapp}</div>
                </div>
                <div className="text-green-600 font-semibold">→</div>
              </a>

              {/* Email Contact */}
              <a
                href={CONTACT_INFO.emailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Mail className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">Email</div>
                  <div className="text-sm text-gray-600">{CONTACT_INFO.email}</div>
                </div>
                <div className="text-blue-600 font-semibold">→</div>
              </a>
            </div>

            <p className="text-xs text-gray-500 mb-6">
              Our sales team will work with you to customize a plan that fits your needs and budget.
            </p>

            <button
              onClick={() => setShowContactModal(false)}
              className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Back to Plans
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
