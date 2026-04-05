'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  DocumentTextIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { ShimmerSkeleton, CardSkeleton } from '@/components/ui/skeleton';
import type { Invoice, Customer } from '@/types/database';

export default function InvoicesPage() {
  const { company } = useCompany();
  const [invoices, setInvoices] = useState<(Invoice & { customers: Customer })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (company) {
      loadInvoices();
    }
  }, [company, statusFilter, typeFilter]);

  const loadInvoices = async () => {
    if (!company) return;
    
    try {
      const params = new URLSearchParams({
        company_id: company.id,
        page: '1',
        limit: '200',
      });

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/invoices?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to load invoices');
      }

      const payload = await response.json();
      const allInvoices = payload?.data || [];
      const filteredByType = allInvoices.filter((invoice: any) => {
        const docType = invoice.document_type || 'invoice';
        if (docType === 'receipt') return false;
        if (typeFilter === 'all') return true;
        return docType === typeFilter;
      });

      setInvoices(filteredByType);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
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

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      draft: 'status-draft',
      sent: 'status-sent',
      partial: 'status-partial',
      paid: 'status-paid',
      overdue: 'status-overdue',
      void: 'status-void',
      cancelled: 'status-cancelled',
    };
    return classes[status] || 'badge-gray';
  };

  const getDocumentTypeBadge = (type: string) => {
    const config: Record<string, { label: string; class: string }> = {
      invoice: { label: 'Invoice', class: 'bg-blue-100 text-blue-800' },
      quotation: { label: 'Quote', class: 'bg-purple-100 text-purple-800' },
      proforma: { label: 'Proforma', class: 'bg-orange-100 text-orange-800' },
    };
    return config[type] || config.invoice;
  };

  const filteredInvoices = invoices.filter((invoice) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      invoice.invoice_number.toLowerCase().includes(query) ||
      invoice.customers?.name?.toLowerCase().includes(query)
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
            <DocumentTextIcon className="w-6 h-6 text-blueox-primary" />
            <span className="text-blueox-primary font-semibold">Invoice Management</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-blueox-primary-dark mb-4 leading-tight">
                Invoices & Quotations
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl">
                Manage customer invoices, track payments, and generate professional documents
              </p>
            </div>
            
            <Link 
              href="/dashboard/invoices/new" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              Create New Invoice
              <SparklesIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <FunnelIcon className="w-5 h-5 text-blueox-primary" />
            <h3 className="text-lg font-bold text-blueox-primary-dark">Search & Filter</h3>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by invoice number or customer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
              />
            </div>

            {/* Status filter */}
            <div className="lg:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40 appearance-none"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="void">Void</option>
              </select>
            </div>

            {/* Document Type filter */}
            <div className="lg:w-48">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40 appearance-none"
              >
                <option value="all">All Types</option>
                <option value="invoice">Invoices</option>
                <option value="quotation">Quotations</option>
                <option value="proforma">Proforma</option>
              </select>
            </div>
          </div>
        </div>

       {/* Invoices table */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
        {loading ? (
          <div className="p-8">
            {/* Loading Skeletons */}
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="border border-blueox-primary/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <ShimmerSkeleton className="h-6 w-32" />
                    <ShimmerSkeleton className="h-6 w-20" />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <ShimmerSkeleton className="h-5 w-full" />
                    <ShimmerSkeleton className="h-5 w-full" />
                    <ShimmerSkeleton className="h-5 w-full" />
                    <ShimmerSkeleton className="h-5 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blueox-primary/10 rounded-full mb-6">
              <DocumentTextIcon className="w-10 h-10 text-blueox-primary" />
            </div>
            <h3 className="text-2xl font-bold text-blueox-primary-dark mb-3">No invoices found</h3>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              Get started by creating your first invoice to track sales and payments.
            </p>
            <Link 
              href="/dashboard/invoices/new" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              Create Your First Invoice
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-blueox-primary/10">
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Invoice #</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Type</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Customer</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Date</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Due Date</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Total</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Balance</th>
                    <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => {
                    const docType = getDocumentTypeBadge(invoice.document_type || 'invoice');
                    return (
                    <tr 
                      key={invoice.id}
                      className="border-b border-blueox-primary/5 hover:bg-blueox-primary/5 transition-colors duration-200"
                    >
                      <td className="py-4 px-6">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="text-blueox-primary hover:text-blueox-primary-hover font-semibold hover:underline transition-all duration-200"
                        >
                          {invoice.invoice_number}
                        </Link>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold ${docType.class}`}>
                          {docType.label}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-900 font-medium">{invoice.customers?.name || 'Unknown'}</td>
                      <td className="py-4 px-6 text-gray-600">{formatDate(invoice.invoice_date)}</td>
                      <td className="py-4 px-6 text-gray-600">{formatDate(invoice.due_date)}</td>
                      <td className="py-4 px-6 text-gray-900 font-semibold">{formatCurrency(invoice.total, invoice.currency || 'USD')}</td>
                      <td className={`py-4 px-6 font-semibold ${invoice.balance_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(invoice.balance_due, invoice.currency || 'USD')}
                      </td>
                      <td className="py-4 px-6">
                        <span className={getStatusBadge(invoice.status)}>
                          {invoice.status}
                        </span>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden p-4 space-y-4">
              {filteredInvoices.map((invoice) => {
                const docType = getDocumentTypeBadge(invoice.document_type || 'invoice');
                return (
                  <div 
                    key={invoice.id} 
                    className="bg-white/90 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl p-5 hover:shadow-lg hover:border-blueox-primary/40 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="text-lg font-bold text-blueox-primary hover:text-blueox-primary-hover hover:underline transition-all duration-200"
                        >
                          {invoice.invoice_number}
                        </Link>
                        <p className="text-sm text-gray-600 mt-1">{invoice.customers?.name || 'Unknown'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold ${docType.class}`}>
                          {docType.label}
                        </span>
                        <span className={getStatusBadge(invoice.status)}>
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blueox-primary/10">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Invoice Date</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(invoice.invoice_date)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Due Date</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(invoice.due_date)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Amount</p>
                        <p className="text-sm font-bold text-blueox-primary">{formatCurrency(invoice.total, invoice.currency || 'USD')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Balance Due</p>
                        <p className={`text-sm font-bold ${invoice.balance_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(invoice.balance_due, invoice.currency || 'USD')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

