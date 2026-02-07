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
  added_at: string;
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
  const [billingHistory, setBillingHistory] = useState<BillingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

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
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
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
  const isPastDue = subscription.status === 'past_due';
  const isCancelled = subscription.status === 'cancelled';
  const daysRemaining = subscription.trial_end_date ? getDaysRemaining(subscription.trial_end_date) : 0;
  const totalModuleCost = modules.filter(m => m.is_active && !m.is_trial_module).reduce((sum, m) => sum + m.monthly_price, 0);
  const monthlyTotal = subscription.base_price_amount + totalModuleCost;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Billing & Subscription</h1>
          <p className="text-gray-600 mt-2">Manage your subscription, modules, and payment methods</p>
        </div>

        {/* Trial Warning */}
        {isTrial && daysRemaining <= 7 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <ClockIcon className="h-5 w-5 text-yellow-400" />
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Trial ending in {daysRemaining} days!</strong> Upgrade now to continue using your selected modules.
                </p>
                <button
                  onClick={handleUpgrade}
                  className="mt-2 text-sm font-medium text-yellow-700 underline hover:text-yellow-800"
                >
                  Upgrade to Paid Plan →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Past Due Warning */}
        {isPastDue && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <XCircleIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  <strong>Payment Failed!</strong> Please update your payment method to continue using your subscription.
                </p>
                <button
                  onClick={handleManagePayment}
                  className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-800"
                >
                  Update Payment Method →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Current Plan */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Current Plan</h2>
                <p className="text-gray-600 mt-1">
                  {PLAN_NAMES[subscription.plan_tier]} - {subscription.billing_period === 'monthly' ? 'Monthly' : 'Annual'} Billing
                </p>
              </div>
              {getStatusBadge(subscription.status)}
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Base Plan</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatPrice(subscription.base_price_amount, subscription.currency.toUpperCase() as Currency)}
                  <span className="text-sm font-normal text-gray-600">/{subscription.billing_period === 'monthly' ? 'mo' : 'yr'}</span>
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">
                  {isTrial ? 'Trial Ends' : subscription.billing_period === 'monthly' ? 'Next Billing Date' : 'Renewal Date'}
                </p>
                <p className="text-lg font-semibold text-gray-900">
                  {new Date(isTrial && subscription.trial_end_date ? subscription.trial_end_date : subscription.current_period_end).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
                {!isTrial && (
                  <p className="text-sm text-gray-600 mt-1">
                    {getDaysRemaining(subscription.current_period_end)} days remaining
                  </p>
                )}
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Total Monthly Cost</p>
                <p className="text-2xl font-bold text-gray-900">
                  {isTrial ? 'Free' : formatPrice(monthlyTotal, subscription.currency.toUpperCase() as Currency)}
                  {!isTrial && <span className="text-sm font-normal text-gray-600">/mo</span>}
                </p>
                {!isTrial && totalModuleCost > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    Includes {modules.filter(m => m.is_active && !m.is_trial_module).length} module(s)
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-200">
              {isTrial ? (
                <button
                  onClick={handleUpgrade}
                  disabled={processingAction === 'upgrade'}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingAction === 'upgrade' ? 'Loading...' : 'Upgrade Now'}
                </button>
              ) : (
                <>
                  <button
                    onClick={handleUpgrade}
                    disabled={!!processingAction}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    Change Plan
                  </button>
                  <button
                    onClick={handleManagePayment}
                    disabled={!!processingAction}
                    className="border border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50"
                  >
                    <CreditCardIcon className="h-5 w-5 inline mr-2" />
                    Manage Payment
                  </button>
                  {!isCancelled && (
                    <button
                      onClick={handleCancelSubscription}
                      disabled={!!processingAction}
                      className="border border-red-300 text-red-600 px-6 py-2 rounded-lg font-semibold hover:bg-red-50 disabled:opacity-50"
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
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Active Modules</h2>
                <p className="text-gray-600 mt-1">Industry-specific features for your business</p>
              </div>
              {!isTrial && (
                <button
                  onClick={handleAddModule}
                  disabled={!!processingAction}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  Add Module
                </button>
              )}
            </div>
          </div>

          <div className="p-6">
            {modules.filter(m => m.is_active).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No modules active</p>
                <button
                  onClick={handleAddModule}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Browse Available Modules →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modules.filter(m => m.is_active).map((module) => (
                  <div key={module.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{MODULE_NAMES[module.module_id] || module.module_id}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {module.is_trial_module ? (
                            <span className="text-blue-600 font-medium">Trial Module</span>
                          ) : (
                            <>
                              {formatPrice(module.monthly_price, subscription.currency.toUpperCase() as Currency)}/mo
                            </>
                          )}
                        </p>
                      </div>
                      <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Billing History */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Billing History</h2>
            <p className="text-gray-600 mt-1">View and download past invoices</p>
          </div>

          <div className="p-6">
            {billingHistory.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No billing history yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {billingHistory.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm font-medium text-gray-900">{invoice.invoice_number}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {new Date(invoice.paid_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                          {formatPrice(invoice.amount, invoice.currency.toUpperCase() as Currency)}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {invoice.status === 'succeeded' ? (
                            <span className="text-green-600 font-medium">Paid</span>
                          ) : (
                            <span className="text-red-600 font-medium">Failed</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-right">
                          {invoice.invoice_pdf && (
                            <a
                              href={invoice.invoice_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Download
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
