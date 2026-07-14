'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import type { Customer as CustomerType } from '@/types/database';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CreditCardIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { FitNumber } from '@/components/ui/fit-number';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total: number;
  currency: string;
  status: string;
}

export default function CustomerDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  interface Credit {
    id: string;
    payment_number: string;
    payment_date: string;
    amount: number;
    currency: string;
    available_credit: number;
    payment_method: string;
  }

  const [customer, setCustomer] = useState<CustomerType | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [totalCredit, setTotalCredit] = useState(0);
  const [creditCurrency, setCreditCurrency] = useState('USD');
  const [outstandingBalance, setOutstandingBalance] = useState<number | null>(null);
  const [balanceCurrency, setBalanceCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadCustomerAndInvoices();
  }, [id]);

  const loadCustomerAndInvoices = async () => {
    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to load customer');
      }

      const payload = await response.json();
      const customerData = payload?.data || null;
      setCustomer(customerData);
      setInvoices(customerData?.recent_invoices || []);

      // Load outstanding balance and unapplied credits in parallel
      const [balanceRes, creditsRes] = await Promise.all([
        fetch(`/api/customers/${id}/balance`, { credentials: 'include' }),
        fetch(`/api/customers/${id}/credits`, { credentials: 'include' }),
      ]);
      if (balanceRes.ok) {
        const balancePayload = await balanceRes.json();
        setOutstandingBalance(balancePayload.outstandingBalance ?? 0);
        setBalanceCurrency(balancePayload.currency || 'USD');
      }
      if (creditsRes.ok) {
        const creditsPayload = await creditsRes.json();
        setCredits(creditsPayload.data || []);
        setTotalCredit(creditsPayload.total_credit || 0);
        setCreditCurrency(creditsPayload.currency || 'USD');
      }
    } catch (error) {
      console.error('Failed to load customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${customer?.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete customer');
      }

      alert(payload?.message || 'Customer deleted successfully');
      router.push('/dashboard/customers');
    } catch (error) {
      console.error('Failed to delete customer:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return currencyFormatter(amount, currency as any);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not set';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Not set';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center gap-4">
            <ShimmerSkeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <ShimmerSkeleton className="h-8 w-64" />
              <ShimmerSkeleton className="h-4 w-48" />
            </div>
            <div className="flex gap-2">
              <ShimmerSkeleton className="h-10 w-10 rounded-lg" />
              <ShimmerSkeleton className="h-10 w-10 rounded-lg" />
            </div>
          </div>

          {/* Status Badge Skeleton */}
          <ShimmerSkeleton className="h-8 w-24 rounded-full" />

          {/* Content Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-6">
                <ShimmerSkeleton className="h-6 w-48 mb-4" />
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="space-y-2">
                      <ShimmerSkeleton className="h-4 w-24" />
                      <ShimmerSkeleton className="h-5 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Invoices Table Skeleton */}
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-6">
            <ShimmerSkeleton className="h-6 w-40 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <ShimmerSkeleton className="h-4 w-32" />
                  <ShimmerSkeleton className="h-4 w-24" />
                  <ShimmerSkeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Customer not found</p>
        <Link href="/dashboard/customers" className="btn-primary mt-4">
          Back to Customers
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="p-4 sm:p-6 md:p-8 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link href="/dashboard/customers" className="btn-ghost p-2 flex-shrink-0">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">{customer.name}</h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1 truncate">{customer.company_name || 'Individual Customer'}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end sm:justify-start">
          <Link
            href={`/dashboard/customers/${id}/edit`}
            className="btn-ghost p-2"
          >
            <PencilIcon className="w-5 h-5" />
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-ghost p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Status Badge */}
      <div>
        <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
          customer.is_active
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}>
          {customer.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Customer Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Contact Information */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5" />
            Contact Information
          </h2>
          <div className="space-y-3 sm:space-y-4">
            {customer.email && (
              <div className="flex items-start gap-2 sm:gap-3">
                <EnvelopeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Primary Email</p>
                  <p className="text-sm sm:text-base text-gray-900 break-words">{customer.email}</p>
                </div>
              </div>
            )}
            {customer.email_2 && (
              <div className="flex items-start gap-2 sm:gap-3">
                <EnvelopeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Secondary Email</p>
                  <p className="text-sm sm:text-base text-gray-900 break-words">{customer.email_2}</p>
                </div>
              </div>
            )}
            {customer.email_3 && (
              <div className="flex items-start gap-2 sm:gap-3">
                <EnvelopeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Additional Email</p>
                  <p className="text-sm sm:text-base text-gray-900 break-words">{customer.email_3}</p>
                </div>
              </div>
            )}
            {customer.email_4 && (
              <div className="flex items-start gap-2 sm:gap-3">
                <EnvelopeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Fourth Email</p>
                  <p className="text-sm sm:text-base text-gray-900 break-words">{customer.email_4}</p>
                </div>
              </div>
            )}
            {customer.phone && (
              <div className="flex items-start gap-2 sm:gap-3">
                <PhoneIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Phone</p>
                  <p className="text-sm sm:text-base text-gray-900">{customer.phone}</p>
                </div>
              </div>
            )}
            {(customer.address_line1 || customer.city) && (
              <div className="flex items-start gap-2 sm:gap-3">
                <MapPinIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Address</p>
                  <div className="text-sm sm:text-base text-gray-900">
                    {customer.address_line1 && <p>{customer.address_line1}</p>}
                    {customer.address_line2 && <p>{customer.address_line2}</p>}
                    {(customer.city || customer.state || customer.zip_code) && (
                      <p>
                        {customer.city}{customer.city && (customer.state || customer.zip_code) ? ', ' : ''}
                        {customer.state} {customer.zip_code}
                      </p>
                    )}
                    {customer.country && <p>{customer.country}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Account Summary */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Account Summary</h2>
          <div className="space-y-3 sm:space-y-4">
            {/* Outstanding invoices */}
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm text-gray-500">Outstanding Balance</p>
              <p className={`text-sm sm:text-base font-bold ${outstandingBalance && outstandingBalance > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {outstandingBalance !== null
                  ? formatCurrency(outstandingBalance, balanceCurrency)
                  : formatCurrency(customer.current_balance || 0)}
              </p>
            </div>

            {/* Unapplied credits */}
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm text-gray-500">Unapplied Credits</p>
              <p className={`text-sm sm:text-base font-bold ${totalCredit > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {totalCredit > 0 ? `− ${formatCurrency(totalCredit, creditCurrency)}` : formatCurrency(0, balanceCurrency)}
              </p>
            </div>

            {/* Net balance */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
              <p className="text-xs sm:text-sm font-semibold text-gray-700">Net Balance</p>
              {(() => {
                const net = (outstandingBalance ?? 0) - totalCredit;
                return (
                  <p className={`text-sm sm:text-base font-bold ${net > 0 ? 'text-red-600' : net < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {formatCurrency(Math.abs(net), balanceCurrency)}
                    {net < 0 && <span className="ml-1 text-xs font-normal text-green-600">(credit)</span>}
                  </p>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-gray-200">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Payment Terms</p>
                <p className="text-sm sm:text-base font-medium text-gray-900">Net {customer.payment_terms} days</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Credit Limit</p>
                <p className="text-sm sm:text-base font-medium text-gray-900">
                  {customer.credit_limit ? formatCurrency(customer.credit_limit, customer.currency || 'USD') : 'Unlimited'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unapplied Credits */}
      {totalCredit > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl shadow-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-amber-200 flex items-center gap-3">
            <CreditCardIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-amber-900">Unapplied Credits</h3>
              <p className="text-sm text-amber-700">
                {formatCurrency(totalCredit, creditCurrency)} available — not yet linked to any invoice
              </p>
            </div>
            <Link
              href={`/dashboard/invoices/new?customer_id=${id}`}
              className="btn-primary text-sm flex-shrink-0"
            >
              Create Invoice
            </Link>
          </div>
          <div className="divide-y divide-amber-100">
            {credits.map((credit) => (
              <div key={credit.id} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">{credit.payment_number}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(credit.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    {' · '}{credit.payment_method}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-amber-800">
                    {formatCurrency(Number(credit.available_credit), credit.currency)}
                  </p>
                  <p className="text-xs text-gray-400">
                    of {formatCurrency(Number(credit.amount), credit.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Invoices */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl">
        <div className="px-4 sm:px-6 py-4 border-b border-blueox-primary/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-900">Recent Invoices</h3>
          <Link
            href={`/dashboard/invoices/new?customer_id=${id}`}
            className="btn-primary text-sm w-full sm:w-auto text-center"
          >
            New Invoice
          </Link>
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-8 sm:py-12">
            <p className="text-sm sm:text-base text-gray-500">No invoices yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Date</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Due Date</th>
                  <th className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-3 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/dashboard/invoices/${invoice.id}`)}
                  >
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 font-medium">{invoice.invoice_number}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 hidden sm:table-cell">{formatDate(invoice.invoice_date)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 hidden md:table-cell">{formatDate(invoice.due_date)}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(invoice.total, invoice.currency || 'USD')}
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : invoice.status === 'overdue'
                          ? 'bg-red-100 text-red-800'
                          : invoice.status === 'partial'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-4 sm:p-6">
        <p className="text-xs text-gray-500">
          Customer since {formatDate(customer.created_at)}
        </p>
      </div>
      </div>
    </div>
  );
}
