'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCardIcon, CalendarIcon, CheckCircleIcon, XCircleIcon, ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { formatPrice } from '@/lib/regional-pricing';
import type { Currency } from '@/lib/regional-pricing';

interface Subscription {
  id: string;
  plan_tier: 'starter' | 'professional' | 'enterprise';
  billing_period: 'monthly' | 'annual';
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
  base_price_amount: number;
  currency: string;
  current_period_start: string;
  current_period_end: string;
  trial_end_date?: string;
  stripe_subscription_id?: string;
}

interface Module {
  id: string;
  module_id: string;
  monthly_price: number;
  is_active: boolean;
  is_trial_module: boolean;
  is_included: boolean;
  added_at: string;
}

interface ModuleQuota {
  total: number;
  included: number;
  paid: number;
  remaining: number;
}

interface BillingHistory {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string;
  invoice_pdf?: string;
}

const MODULE_NAMES: Record<string, string> = {
  tours: 'Tours & Safari',
  fleet: 'Fleet Management',
  hotels: 'Hotel Management',
  cafe: 'Retail & Restaurant',
  security: 'Security Services',
  inventory: 'Inventory & Assets',
};

const PLAN_NAMES: Record<string, string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

export default function BillingPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [moduleQuota, setModuleQuota] = useState<ModuleQuota | null>(null);
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [removingModuleId, setRemovingModuleId] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingData();
  }, []);

  async function fetchBillingData() {
    try {
      setLoading(true);
      
      // Fetch subscription details
      const subResponse = await fetch('/api/billing/subscription');
      if (subResponse.ok) {
        const subData = await subResponse.json();
        setSubscription(subData.subscription);
        setModules(subData.modules || []);
        setModuleQuota(subData.moduleQuota || null);
      }

      // Fetch billing history
      const historyResponse = await fetch('/api/billing/history');
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setBillingHistory(historyData.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade() {
    setProcessingAction('upgrade');
    router.push('/dashboard/billing/upgrade');
  }

  async function handleAddModule() {
    setProcessingAction('add-module');
    router.push('/dashboard/billing/add-modules');
  }

  async function handleManagePayment() {
    if (!subscription?.stripe_subscription_id) return;
    
    setProcessingAction('manage-payment');
    try {
      const response = await fetch('/api/billing/customer-portal', {
        method: 'POST',
      });
      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to open customer portal:', error);
      setProcessingAction(null);
    }
  }

  async function handleCancelSubscription() {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access at the end of your current billing period.')) {
      return;
    }

    setProcessingAction('cancel');
    try {
      const response = await fetch('/api/billing/cancel', {
        method: 'POST',
      });
      
      if (response.ok) {
        await fetchBillingData();
        alert('Subscription cancelled. You will retain access until the end of your billing period.');
      } else {
        alert('Failed to cancel subscription. Please try again.');
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
      alert('Failed to cancel subscription. Please try again.');
    } finally {
      setProcessingAction(null);
    }
  }

  async function handleRemoveModule(moduleId: string, moduleName: string) {
    if (!confirm(`Remove ${moduleName}? This will take effect immediately.`)) {
      return;
    }

    setRemovingModuleId(moduleId);
    try {
      const response = await fetch('/api/billing/remove-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module_id: moduleId }),
      });

      if (response.ok) {
        await fetchBillingData();
        alert(`${moduleName} removed successfully.`);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to remove module. Please try again.');
      }
    } catch (error) {
      console.error('Failed to remove module:', error);
      alert('Failed to remove module. Please try again.');
    } finally {
      setRemovingModuleId(null);
    }
  }

  function getStatusBadge(status: string) {
    const badges = {
      trial: { color: 'bg-blue-100 text-blue-800', icon: ClockIcon, text: 'Trial' },
      active: { color: 'bg-green-100 text-green-800', icon: CheckCircleIcon, text: 'Active' },
      past_due: { color: 'bg-red-100 text-red-800', icon: XCircleIcon, text: 'Past Due' },
      cancelled: { color: 'bg-gray-100 text-gray-800', icon: XCircleIcon, text: 'Cancelled' },
      expired: { color: 'bg-gray-100 text-gray-800', icon: XCircleIcon, text: 'Expired' },
    };

    const badge = badges[status as keyof typeof badges] || badges.active;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>
        <Icon className="h-4 w-4" />
        {badge.text}
      </span>
    );
  }

  function getDaysRemaining(endDate: string): number {
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-blueox-primary/5 rounded-full blur-xl"></div>
          <div className="absolute top-60 right-16 w-24 h-24 bg-blueox-accent/10 rounded-full blur-lg"></div>
          <div className="absolute bottom-40 left-1/3 w-20 h-20 bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 rounded-full blur-xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto py-8 px-6">
          {/* Header Skeleton */}
          <div className="mb-8 animate-pulse">
            <div className="h-10 bg-white/60 rounded-2xl w-1/3 mb-3"></div>
            <div className="h-6 bg-white/40 rounded-xl w-1/2"></div>
          </div>

          {/* Current Plan Skeleton */}
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-8 shadow-xl mb-6 animate-pulse">
            <div className="h-8 bg-blueox-primary/10 rounded-xl w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="h-4 bg-blueox-primary/10 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-blueox-primary/20 rounded-xl w-3/4"></div>
              </div>
              <div>
                <div className="h-4 bg-blueox-primary/10 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-blueox-primary/20 rounded-xl w-3/4"></div>
              </div>
              <div>
                <div className="h-4 bg-blueox-primary/10 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-blueox-primary/20 rounded-xl w-3/4"></div>
              </div>
            </div>
          </div>

          {/* Modules Skeleton */}
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-8 shadow-xl animate-pulse">
            <div className="h-8 bg-blueox-primary/10 rounded-xl w-1/4 mb-4"></div>
            <div className="h-24 bg-blueox-primary/5 rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <CreditCardIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Active Subscription</h2>
            <p className="text-gray-600 mb-6">Start your free trial to access all features.</p>
            <button
              onClick={() => router.push('/signup/select-modules')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isTrial = subscription.status === 'trial';
  const isExpired = subscription.status === 'expired';
  const isTrialOrExpired = isTrial || isExpired;
  const isPastDue = subscription.status === 'past_due';
  const isCancelled = subscription.status === 'cancelled';
  const daysRemaining = subscription.trial_end_date ? getDaysRemaining(subscription.trial_end_date) : 0;
  const totalModuleCost = modules.filter(m => m.is_active && !m.is_trial_module).reduce((sum, m) => sum + m.monthly_price, 0);
  const monthlyTotal = subscription.base_price_amount + totalModuleCost;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blueox-primary/5 rounded-full blur-xl"></div>
        <div className="absolute top-60 right-16 w-24 h-24 bg-blueox-accent/10 rounded-full blur-lg"></div>
        <div className="absolute bottom-40 left-1/3 w-20 h-20 bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 rounded-full blur-xl"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto py-8 px-6 space-y-8">
        {/* Hero Header */}
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-3 bg-white/70 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl px-6 py-3 shadow-lg mb-6">
            <CreditCardIcon className="w-6 h-6 text-blueox-primary" />
            <span className="text-blueox-primary font-semibold">Billing & Subscription</span>
          </div>
          
          <h1 className="text-3xl lg:text-4xl font-bold text-blueox-primary-dark mb-4 leading-tight">
            Manage Your Subscription
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            Control your subscription, modules, and payment methods
          </p>
        </div>

        {/* Trial Warning */}
        {isTrialOrExpired && (
          <div className={`bg-gradient-to-r ${daysRemaining < 0 ? 'from-red-50 to-rose-50 border-red-400/50' : 'from-yellow-50 to-orange-50 border-yellow-400/50'} border rounded-3xl p-6 shadow-lg`}>
            <div className="flex items-start gap-4">
              <div className={`p-3 ${daysRemaining < 0 ? 'bg-red-100' : 'bg-yellow-100'} rounded-xl`}>
                <ClockIcon className={`h-6 w-6 ${daysRemaining < 0 ? 'text-red-600' : 'text-yellow-600'}`} />
              </div>
              <div className="flex-1">
                <p className={`text-lg font-bold ${daysRemaining < 0 ? 'text-red-900' : 'text-yellow-900'} mb-2`}>
                  {daysRemaining < 0
                    ? `Your trial expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''} ago!`
                    : daysRemaining === 0
                    ? 'Your trial expires today!'
                    : daysRemaining === 1
                    ? 'Your trial ends tomorrow!'
                    : `Trial ending in ${daysRemaining} days!`}
                </p>
                <p className={`${daysRemaining < 0 ? 'text-red-700' : 'text-yellow-700'} mb-4`}>
                  {daysRemaining < 0
                    ? 'Your trial has ended. Upgrade now to restore access to your selected modules.'
                    : 'Upgrade now to continue using your selected modules without interruption.'}
                </p>
                <button
                  onClick={handleUpgrade}
                  className="bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg"
                >
                  Upgrade to Paid Plan →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Past Due Warning */}
        {isPastDue && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-400/50 rounded-3xl p-6 shadow-lg">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <XCircleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-red-900 mb-2">
                  Payment Failed!
                </p>
                <p className="text-red-700 mb-4">
                  Please update your payment method to continue using your subscription.
                </p>
                <button
                  onClick={handleManagePayment}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-300"
                >
                  Update Payment Method →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Current Plan */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-8 border-b border-blueox-primary/10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-blueox-primary-dark">Current Plan</h2>
                <p className="text-gray-600 mt-2 font-medium">
                  {PLAN_NAMES[subscription.plan_tier]} - {isTrialOrExpired ? 'Free Trial' : subscription.billing_period === 'monthly' ? 'Monthly' : 'Annual'} {isTrialOrExpired ? '' : 'Billing'}
                </p>
              </div>
              {getStatusBadge(subscription.status)}
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-gradient-to-br from-blueox-primary/5 to-blueox-accent/5 p-6 rounded-2xl">
                <p className="text-sm font-semibold text-blueox-primary-dark mb-2">{isTrialOrExpired ? 'Trial Access' : 'Base Plan'}</p>
                <p className="text-3xl font-bold text-blueox-primary">
                  {isTrialOrExpired ? 'Free' : formatPrice(subscription.base_price_amount, subscription.currency.toUpperCase() as Currency)}
                  {!isTrialOrExpired && <span className="text-base font-normal text-gray-600 ml-1">/{subscription.billing_period === 'monthly' ? 'mo' : 'yr'}</span>}
                </p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  {isTrialOrExpired ? (daysRemaining < 0 ? 'Trial Ended' : 'Trial Ends') : subscription.billing_period === 'monthly' ? 'Next Billing Date' : 'Renewal Date'}
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {new Date(isTrialOrExpired && subscription.trial_end_date ? subscription.trial_end_date : subscription.current_period_end).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
                {!isTrialOrExpired && (
                  <p className="text-sm text-gray-600 mt-2 font-medium">
                    {getDaysRemaining(subscription.current_period_end)} days remaining
                  </p>
                )}
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-2xl">
                <p className="text-sm font-semibold text-gray-700 mb-2">{isTrialOrExpired ? 'Subscription Cost' : 'Total Monthly Cost'}</p>
                <p className="text-3xl font-bold text-blueox-primary">
                  {isTrial ? 'Free During Trial' : isExpired ? 'Upgrade Required' : formatPrice(monthlyTotal, subscription.currency.toUpperCase() as Currency)}
                  {!isTrialOrExpired && <span className="text-base font-normal text-gray-600 ml-1">/mo</span>}
                </p>
                {!isTrialOrExpired && totalModuleCost > 0 && (
                  <p className="text-sm text-gray-600 mt-2 font-medium">
                    Includes {modules.filter(m => m.is_active && !m.is_trial_module).length} module(s)
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-4 mt-8 pt-8 border-t border-blueox-primary/10">
              {isTrialOrExpired ? (
                <button
                  onClick={handleUpgrade}
                  disabled={processingAction === 'upgrade'}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-8 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {processingAction === 'upgrade' ? 'Loading...' : 'Upgrade Now'}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleUpgrade}
                    disabled={!!processingAction}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg disabled:opacity-50"
                  >
                    Change Plan
                  </button>
                  <button
                    onClick={handleManagePayment}
                    disabled={!!processingAction}
                    className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border-2 border-blueox-primary/30 text-blueox-primary-dark px-6 py-3 rounded-2xl font-semibold hover:bg-blueox-primary/10 hover:border-blueox-primary transition-all duration-300 disabled:opacity-50"
                  >
                    <CreditCardIcon className="h-5 w-5" />
                    Manage Payment
                  </button>
                  {!isCancelled && (
                    <button
                      onClick={handleCancelSubscription}
                      disabled={!!processingAction}
                      className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm border-2 border-red-300 text-red-600 px-6 py-3 rounded-2xl font-semibold hover:bg-red-50 transition-all duration-300 disabled:opacity-50"
                    >
                      Cancel Subscription
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Active Modules */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-8 border-b border-blueox-primary/10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-blueox-primary-dark">Active Modules</h2>
                <p className="text-gray-600 mt-2 font-medium">Industry-specific features for your business</p>
                {moduleQuota && (
                  <div className="mt-3 flex items-center gap-2">
                    <div className="bg-blueox-primary/10 text-blueox-primary px-4 py-2 rounded-xl font-bold text-sm">
                      {moduleQuota.included} of {moduleQuota.total} included modules used
                    </div>
                    {moduleQuota.paid > 0 && (
                      <div className="bg-purple-100 text-purple-700 px-4 py-2 rounded-xl font-bold text-sm">
                        +{moduleQuota.paid} paid module{moduleQuota.paid !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {(moduleQuota?.remaining || 0) > 0 && (
                <button
                  onClick={handleAddModule}
                  disabled={!!processingAction}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg disabled:opacity-50"
                >
                  Add Module ({moduleQuota?.remaining} free remaining)
                  <ArrowPathIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          <div className="p-8">
            {modules.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-blueox-primary/10 rounded-2xl mb-4">
                  <CreditCardIcon className="w-10 h-10 text-blueox-primary" />
                </div>
                <p className="text-gray-600 font-medium mb-6">No modules active</p>
                <button
                  onClick={handleAddModule}
                  className="inline-flex items-center gap-2 text-blueox-primary hover:text-blueox-primary-dark font-semibold transition-colors"
                >
                  Browse Available Modules →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {modules.map((module) => (
                  <div
                    key={module.id}
                    className="bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5 border border-blueox-primary/20 rounded-2xl p-6 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-blueox-primary-dark">
                            {MODULE_NAMES[module.module_id]}
                          </h3>
                          {module.is_included && (
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">
                              Included in Plan
                            </span>
                          )}
                          {module.is_trial_module && (
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                              Trial
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          Added {new Date(module.added_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blueox-primary">
                            {module.is_included || module.is_trial_module ? 'Free' : formatPrice(module.monthly_price, subscription.currency.toUpperCase() as Currency)}
                          </p>
                          {!module.is_included && !module.is_trial_module && (
                            <p className="text-sm text-gray-600 font-medium">/month</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveModule(module.module_id, MODULE_NAMES[module.module_id])}
                          disabled={removingModuleId === module.module_id}
                          className="p-2 hover:bg-red-50 rounded-xl transition-colors group"
                          title="Remove module"
                        >
                          <XCircleIcon className="h-6 w-6 text-gray-400 group-hover:text-red-600 transition-colors" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Billing History */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-8 border-b border-blueox-primary/10">
            <h2 className="text-2xl font-bold text-blueox-primary-dark">Billing History</h2>
            <p className="text-gray-600 mt-2 font-medium">View and download past invoices</p>
          </div>

          <div className="p-8">
            {billingHistory.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-blueox-primary/10 rounded-2xl mb-4">
                  <CalendarIcon className="w-10 h-10 text-blueox-primary" />
                </div>
                <p className="text-gray-600 font-medium">No billing history yet</p>
                <p className="text-sm text-gray-500 mt-2">Your invoices will appear here after your first payment</p>
              </div>
            ) : (
              <div className="space-y-3">
                {billingHistory.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="bg-white border border-blueox-primary/20 rounded-2xl p-6 hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-blueox-primary-dark">{invoice.invoice_number}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(invoice.paid_at).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xl font-bold text-blueox-primary">
                            {formatPrice(invoice.amount, invoice.currency.toUpperCase() as Currency)}
                          </p>
                          <p className={`text-sm font-medium ${
                            invoice.status === 'succeeded' ? 'text-green-600' : 
                            invoice.status === 'pending' ? 'text-yellow-600' : 
                            'text-red-600'
                          }`}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </p>
                        </div>
                        {invoice.invoice_pdf && (
                          <a
                            href={invoice.invoice_pdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-blueox-primary/10 rounded-xl transition-colors"
                          >
                            <ArrowPathIcon className="h-5 w-5 text-blueox-primary" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
