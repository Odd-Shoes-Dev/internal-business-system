'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  SparklesIcon,
  UserGroupIcon,
  EyeIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { 
  ShimmerSkeleton,
  CardSkeleton,
} from '@/components/ui/skeleton';
import type { Vendor } from '@/types/database';

export default function VendorsPage() {
  const { company } = useCompany();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    if (company) {
      loadVendors();
    }
  }, [company, searchQuery, statusFilter, currentPage]);

  const loadVendors = async () => {
    if (!company) return;
    
    try {
      setLoading(true);
      let query = supabase
        .from('vendors')
        .select('*', { count: 'exact' })
        .eq('company_id', company.id)
        .order('name');

      // Apply status filter
      if (statusFilter === 'active') {
        query = query.eq('is_active', true);
      } else if (statusFilter === 'inactive') {
        query = query.eq('is_active', false);
      }
      // 'all' shows both active and inactive

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error) throw error;

      setVendors(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Failed to load vendors:', error);
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
            <span className="text-blueox-primary font-semibold">Vendor Management</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-blueox-primary-dark mb-4 leading-tight">
                Vendor Directory
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl">
                Manage your supplier relationships and track payment terms
              </p>
            </div>
            
            <Link 
              href="/dashboard/vendors/new" 
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              Add New Vendor
              <SparklesIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <FunnelIcon className="w-5 h-5 text-blueox-primary" />
            <h3 className="text-lg font-bold text-blueox-primary-dark">Search & Filter</h3>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search vendors by name, email, or company..."
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
                <option value="active">Active Vendors</option>
                <option value="inactive">Inactive Vendors</option>
                <option value="all">All Vendors</option>
              </select>
            </div>
          </div>
        </div>

        {/* Vendors List */}
        {loading ? (
          <div className="space-y-6">
            {/* Desktop Table Skeleton */}
            <div className="hidden md:block overflow-hidden bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl">
              <div className="p-6">
                {/* Table Header Skeleton */}
                <div className="flex justify-between items-center pb-4 border-b border-blueox-primary/10">
                  <ShimmerSkeleton className="h-6 w-20" />
                  <ShimmerSkeleton className="h-6 w-24" />
                  <ShimmerSkeleton className="h-6 w-32" />
                  <ShimmerSkeleton className="h-6 w-24" />
                  <ShimmerSkeleton className="h-6 w-16" />
                  <ShimmerSkeleton className="h-6 w-20" />
                </div>
                
                {/* Table Rows Skeleton */}
                <div className="space-y-3 pt-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-white/50 rounded-2xl">
                      <ShimmerSkeleton className="h-5 w-32" />
                      <ShimmerSkeleton className="h-5 w-40" />
                      <ShimmerSkeleton className="h-5 w-24" />
                      <ShimmerSkeleton className="h-5 w-28" />
                      <ShimmerSkeleton className="h-5 w-20" />
                      <ShimmerSkeleton className="h-8 w-16" />
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

            {/* Pagination Skeleton */}
            <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-4 shadow-xl">
              <ShimmerSkeleton className="h-5 w-48" />
              <div className="flex gap-2">
                <ShimmerSkeleton className="h-10 w-20" />
                <ShimmerSkeleton className="h-10 w-16" />
              </div>
            </div>
          </div>
        ) : vendors.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-12 shadow-xl text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blueox-primary/20 to-blueox-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <BuildingOfficeIcon className="w-8 h-8 text-blueox-primary" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Vendors Found</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchQuery || statusFilter !== 'all' 
                ? 'No vendors match your current search criteria. Try adjusting your filters.' 
                : 'Start building your vendor network by adding your first supplier.'}
            </p>
            <Link 
              href="/dashboard/vendors/new" 
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-accent hover:from-blueox-primary-hover hover:to-blueox-accent text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <PlusIcon className="w-5 h-5" />
              Add Your First Vendor
              <SparklesIcon className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Contact</th>
                  <th>Payment Terms</th>
                  <th>1099 Vendor</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.id}>
                    <td>
                      <div>
                        <Link
                          href={`/dashboard/vendors/${vendor.id}`}
                          className="font-medium text-gray-900 hover:text-navy-600"
                        >
                          {vendor.name}
                        </Link>
                        {vendor.company_name && (
                          <p className="text-sm text-gray-500">{vendor.company_name}</p>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        {vendor.email && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                            <a href={`mailto:${vendor.email}`} className="text-gray-600 hover:text-navy-600">
                              {vendor.email}
                            </a>
                          </div>
                        )}
                        {vendor.phone && (
                          <div className="flex items-center gap-1.5 text-sm">
                            <PhoneIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600">{vendor.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {vendor.payment_terms ? `Net ${vendor.payment_terms}` : 'Not set'}
                    </td>
                    <td>
                      <span className={vendor.is_1099_vendor ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                        {vendor.is_1099_vendor ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${vendor.is_active ? 'badge-success' : 'badge-error'}`}>
                        {vendor.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/dashboard/vendors/${vendor.id}/edit`}
                        className="btn-ghost p-2"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden grid gap-4">
            {vendors.map((vendor) => (
              <div key={vendor.id} className="card">
                <div className="card-body">
                  <div className="flex justify-between items-start">
                    <div>
                      <Link
                        href={`/dashboard/vendors/${vendor.id}`}
                        className="font-semibold text-gray-900 hover:text-navy-600"
                      >
                        {vendor.name}
                      </Link>
                      {vendor.company_name && (
                        <p className="text-sm text-gray-500">{vendor.company_name}</p>
                      )}
                    </div>
                    <span className={`badge ${vendor.is_active ? 'badge-success' : 'badge-error'}`}>
                      {vendor.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {vendor.email && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <EnvelopeIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">{vendor.email}</span>
                      </div>
                    )}
                    {vendor.phone && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <PhoneIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">{vendor.phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                    <div>
                      <span className="text-gray-500">Payment Terms:</span>
                      <span className="ml-1.5 font-medium">
                        {vendor.payment_terms ? `Net ${vendor.payment_terms}` : 'Not set'}
                      </span>
                    </div>
                    <Link
                      href={`/dashboard/vendors/${vendor.id}/edit`}
                      className="text-navy-600 font-medium"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} vendors
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn-secondary disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn-secondary disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}

