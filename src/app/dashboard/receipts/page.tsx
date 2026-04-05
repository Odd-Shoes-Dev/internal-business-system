'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import { PlusIcon, MagnifyingGlassIcon, ReceiptPercentIcon, SparklesIcon, FunnelIcon } from '@heroicons/react/24/outline';
import type { Invoice, Customer } from '@/types/database';

export default function ReceiptsPage() {
  const { company } = useCompany();
  const [receipts, setReceipts] = useState<(Invoice & { customers: Customer; related_invoice_id?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalCount: 0,
    thisMonthCount: 0,
  });

  useEffect(() => {
    if (!company?.id) {
      return;
    }
    loadReceipts();
    loadStats();
  }, [company?.id]);

  const loadReceipts = async () => {
    try {
      if (!company?.id) {
        return;
      }

      setLoading(true);

      const params = new URLSearchParams({
        company_id: company.id,
        document_type: 'receipt',
        limit: '200',
      });

      const response = await fetch(`/api/invoices?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load receipts');
      }

      const payload = await response.json();
      const data = payload.data || [];
      setReceipts(data);
    } catch (error) {
      console.error('Failed to load receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      if (!company?.id) {
        return;
      }

      const response = await fetch(`/api/receipts/stats?company_id=${encodeURIComponent(company.id)}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return currencyFormatter(amount, currency as any);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredReceipts = receipts.filter((receipt) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      receipt.receipt_number?.toLowerCase().includes(query) ||
      receipt.customers?.name?.toLowerCase().includes(query) ||
      (receipt as any).reference_invoice_number?.toLowerCase().includes(query)
    );
  });

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
            <ReceiptPercentIcon className="w-6 h-6 text-blueox-primary" />
            <span className="text-blueox-primary font-semibold">Receipt Management</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-blueox-primary-dark mb-4 leading-tight">
                Payment Receipts
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl">
                Track payment receipts and confirmations for customer transactions
              </p>
            </div>
            
            <Link 
              href="/dashboard/receipts/new" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              New Receipt
              <SparklesIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>

      {/* Summary Stats */}
      {!loading && filteredReceipts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <p className="text-sm font-medium text-gray-600 mb-2">Total Receipts</p>
            <p className="text-2xl lg:text-3xl font-bold text-blueox-primary-dark">
              {stats.totalCount}
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl border border-green-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <p className="text-sm font-medium text-gray-600 mb-2">Total Amount Received</p>
            <p className="text-2xl lg:text-3xl font-bold text-green-600">
              {formatCurrency(stats.totalAmount, 'USD')}
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
            <p className="text-sm font-medium text-gray-600 mb-2">This Month</p>
            <p className="text-2xl lg:text-3xl font-bold text-blueox-primary">
              {stats.thisMonthCount}
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <FunnelIcon className="w-5 h-5 text-blueox-primary" />
          <h3 className="text-lg font-bold text-blueox-primary-dark">Search</h3>
        </div>
        
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by receipt number, customer, or related invoice..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
          />
        </div>
      </div>

      {/* Receipts table */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <ShimmerSkeleton className="h-6 w-32" />
              <ShimmerSkeleton className="h-10 w-24 rounded-xl" />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-100">
                <ShimmerSkeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <ShimmerSkeleton className="h-5 w-48" />
                  <ShimmerSkeleton className="h-4 w-32" />
                </div>
                <ShimmerSkeleton className="h-6 w-24" />
                <ShimmerSkeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-blueox-primary-dark mb-3">No receipts found</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Start recording payment receipts to track customer transactions.
            </p>
            <Link 
              href="/dashboard/receipts/new" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              Create Your First Receipt
            </Link>
          </div>
        ) : (
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-blueox-primary/10">
                  <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Receipt #</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Customer</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Related Invoice</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Receipt Date</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Amount Paid</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Payment Method</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((receipt) => (
                  <tr 
                    key={receipt.id}
                    className="border-b border-blueox-primary/5 hover:bg-blueox-primary/5 transition-colors duration-200"
                  >
                    <td className="py-4 px-6">
                      <Link
                        href={`/dashboard/receipts/${receipt.id}`}
                        className="text-blueox-primary hover:text-blueox-primary-hover font-semibold hover:underline transition-all duration-200"
                      >
                        {receipt.receipt_number}
                      </Link>
                    </td>
                    <td className="py-4 px-6 text-gray-900 font-medium">{receipt.customers?.name || 'Unknown'}</td>
                    <td className="py-4 px-6">
                      {(receipt as any).reference_invoice_number ? (
                        receipt.related_invoice_id ? (
                          <Link
                            href={`/dashboard/invoices/${receipt.related_invoice_id}`}
                            className="text-blue-600 hover:underline font-medium transition-all duration-200"
                          >
                            {(receipt as any).reference_invoice_number}
                          </Link>
                        ) : (
                          <span className="text-blue-600 font-medium">
                            {(receipt as any).reference_invoice_number}
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-medium text-gray-900">{formatDate(receipt.invoice_date)}</div>
                        <div className="text-sm text-gray-500 mt-1">{formatTime(receipt.created_at)}</div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right font-semibold text-green-600">
                      {formatCurrency(receipt.amount_paid || receipt.total, receipt.currency || 'USD')}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold bg-green-100 text-green-700">
                        {receipt.payment_terms === 0 ? 'Cash' : 'Bank Transfer'}
                      </span>
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
  );
}

