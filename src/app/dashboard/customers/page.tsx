'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  EnvelopeIcon,
  PhoneIcon,
  UserGroupIcon,
  SparklesIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { ShimmerSkeleton, CardSkeleton } from '@/components/ui/skeleton';
import type { Customer } from '@/types/database';

export default function CustomersPage() {
  const { company } = useCompany();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    if (company) {
      loadCustomers();
    }
  }, [company, searchQuery, statusFilter, currentPage]);

  const loadCustomers = async () => {
    if (!company) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams({
        company_id: company.id,
        page: String(currentPage),
        limit: String(pageSize),
      });

      if (searchQuery) {
        params.set('search', searchQuery);
      }

      if (statusFilter !== 'all') {
        params.set('active', statusFilter === 'active' ? 'true' : 'false');
      }

      const response = await fetch(`/api/customers?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to load customers');
      }

      const payload = await response.json();
      setCustomers(payload?.data || []);
      setTotalCount(payload?.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null, currency: string = 'USD') => {
    if (!amount) return currencyFormatter(0, currency as any);
    return currencyFormatter(amount, currency as any);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

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
            <UserGroupIcon className="w-6 h-6 text-blueox-primary" />
            <span className="text-blueox-primary font-semibold">Customer Management</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-blueox-primary-dark mb-4 leading-tight">
                Customer Directory
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl">
                Manage your customer relationships and track credit terms
              </p>
            </div>
            
            <Link 
              href="/dashboard/customers/new" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              Add New Customer
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <MagnifyingGlassIcon className="w-5 h-5 text-blueox-primary" />
            <h3 className="text-lg font-bold text-blueox-primary-dark">Search & Filter</h3>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers by name, email, or company..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
              />
            </div>
            
            <div className="lg:w-48 relative">
              <UserGroupIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'active' | 'inactive' | 'all');
                  setCurrentPage(1);
                }}
                className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40 appearance-none"
              >
                <option value="active">Active Customers</option>
                <option value="inactive">Inactive Customers</option>
                <option value="all">All Customers</option>
              </select>
            </div>
          </div>
        </div>

      {/* Customers Grid/Table */}
      {loading ? (
        <div className="space-y-6">
          {/* Desktop Table Skeleton */}
          <div className="hidden md:block overflow-hidden bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl">
            <div className="p-6">
              {/* Loading Skeletons */}
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="border border-blueox-primary/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <ShimmerSkeleton className="h-6 w-32" />
                      <ShimmerSkeleton className="h-6 w-20" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <ShimmerSkeleton className="h-5 w-full" />
                      <ShimmerSkeleton className="h-5 w-full" />
                      <ShimmerSkeleton className="h-5 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Cards Skeleton */}
          <div className="md:hidden space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl">
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blueox-primary/10 to-blueox-accent/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <UserGroupIcon className="w-8 h-8 text-blueox-primary" />
            </div>
            <h3 className="text-xl font-bold text-blueox-primary-dark mb-2">No customers found</h3>
            <p className="text-gray-600 mb-6">Get started by adding your first customer</p>
            <Link 
              href="/dashboard/customers/new" 
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              Add Your First Customer
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-blueox-primary/10 bg-gradient-to-r from-blueox-primary/5 to-blueox-accent/5">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-blueox-primary-dark">Customer</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-blueox-primary-dark">Contact</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-blueox-primary-dark">Credit Limit</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-blueox-primary-dark">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-blueox-primary-dark">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blueox-primary/10">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-blueox-primary/5 transition-colors duration-200">
                      <td className="px-6 py-4">
                        <div>
                          <Link
                            href={`/dashboard/customers/${customer.id}`}
                            className="font-semibold text-blueox-primary-dark hover:text-blueox-primary transition-colors duration-200"
                          >
                            {customer.name}
                          </Link>
                          {customer.company_name && (
                            <p className="text-sm text-gray-600 mt-1">{customer.company_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {customer.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <EnvelopeIcon className="w-4 h-4 text-blueox-primary/60" />
                              <a href={`mailto:${customer.email}`} className="text-gray-700 hover:text-blueox-primary transition-colors duration-200">
                                {customer.email}
                              </a>
                              {(customer.email_2 || customer.email_3 || customer.email_4) && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blueox-primary/10 text-blueox-primary">
                                  +{[customer.email_2, customer.email_3, customer.email_4].filter(Boolean).length}
                                </span>
                              )}
                            </div>
                          )}
                          {customer.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <PhoneIcon className="w-4 h-4 text-blueox-primary/60" />
                              <span className="text-gray-700">{customer.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {formatCurrency(customer.credit_limit, customer.currency || 'USD')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          customer.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {customer.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <Link
                            href={`/dashboard/customers/${customer.id}/edit`}
                            className="p-2 rounded-xl hover:bg-blueox-primary/10 text-blueox-primary transition-all duration-200"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {customers.map((customer) => (
              <div key={customer.id} className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <Link
                        href={`/dashboard/customers/${customer.id}`}
                        className="text-lg font-bold text-blueox-primary-dark hover:text-blueox-primary transition-colors duration-200"
                      >
                        {customer.name}
                      </Link>
                      {customer.company_name && (
                        <p className="text-sm text-gray-600 mt-1">{customer.company_name}</p>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      customer.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {customer.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    {customer.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <EnvelopeIcon className="w-4 h-4 text-blueox-primary/60" />
                        <span className="text-gray-700">{customer.email}</span>
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <PhoneIcon className="w-4 h-4 text-blueox-primary/60" />
                        <span className="text-gray-700">{customer.phone}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-4 border-t border-blueox-primary/10 flex justify-between items-center">
                    <div>
                      <span className="text-sm text-gray-600">Credit Limit:</span>
                      <span className="ml-2 font-semibold text-blueox-primary-dark">
                        {formatCurrency(customer.credit_limit)}
                      </span>
                    </div>
                    <Link
                      href={`/dashboard/customers/${customer.id}/edit`}
                      className="inline-flex items-center gap-2 text-blueox-primary hover:text-blueox-primary-dark font-medium text-sm transition-colors duration-200"
                    >
                      Edit
                      <PencilIcon className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing <span className="font-semibold text-blueox-primary-dark">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-semibold text-blueox-primary-dark">{Math.min(currentPage * pageSize, totalCount)}</span> of <span className="font-semibold text-blueox-primary-dark">{totalCount}</span> customers
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-white border border-blueox-primary/20 text-blueox-primary-dark rounded-xl font-medium hover:bg-blueox-primary/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark text-black rounded-xl font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
