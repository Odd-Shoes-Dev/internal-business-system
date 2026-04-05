'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface Vendor {
  id: string;
  name: string;
  company_name: string | null;
  email: string;
  email_2: string | null;
  email_3: string | null;
  email_4: string | null;
  phone: string | null;
  phone_2: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  tax_id: string | null;
  website: string | null;
  payment_terms: number | null;
  currency: string;
  account_number: string | null;
  balance: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Bill {
  id: string;
  bill_number: string;
  bill_date: string;
  due_date: string;
  total: number;
  amount_paid?: number;
  currency: string;
  status: string;
}

export default function VendorDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [outstandingBalance, setOutstandingBalance] = useState(0);

  useEffect(() => {
    loadVendorAndBills();
    loadBalance();
  }, [id]);

  const loadVendorAndBills = async () => {
    try {
      const response = await fetch(`/api/vendors/${id}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to load vendor');
      }

      const payload = await response.json();
      const vendorData = payload?.data || null;
      setVendor(vendorData);
      setBills(vendorData?.recent_bills || []);
    } catch (error) {
      console.error('Failed to load vendor:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBalance = async () => {
    try {
      const response = await fetch(`/api/vendors/${id}/balance`, {
        method: 'GET',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setOutstandingBalance(data.outstandingBalance || 0);
      }
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${vendor?.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`/api/vendors/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete vendor');
      }

      alert(payload?.message || 'Vendor deleted successfully');
      router.push('/dashboard/vendors');
    } catch (error) {
      console.error('Failed to delete vendor:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete vendor');
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return currencyFormatter(amount, currency as any);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'paid':
        return 'badge-success';
      case 'partial':
        return 'badge-warning';
      case 'overdue':
        return 'badge-error';
      case 'pending_approval':
      case 'approved':
        return 'badge-info';
      default:
        return 'badge-gray';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <ShimmerSkeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <ShimmerSkeleton className="h-8 w-64" />
              <ShimmerSkeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-6">
                <ShimmerSkeleton className="h-6 w-40 mb-4" />
                <div className="space-y-3">
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
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Vendor not found</p>
        <Link href="/dashboard/vendors" className="btn-secondary mt-4">
          Back to Vendors
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/vendors" className="btn-ghost p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
            {vendor.company_name && (
              <p className="text-gray-500 mt-1">{vendor.company_name}</p>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/dashboard/vendors/${id}/edit`}
            className="btn-secondary"
          >
            <PencilIcon className="w-5 h-5 mr-2" />
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn-ghost text-red-600 hover:bg-red-50"
          >
            <TrashIcon className="w-5 h-5 mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex items-center gap-2">
        <span className={`badge ${vendor.is_active ? 'badge-success' : 'badge-gray'}`}>
          {vendor.is_active ? 'Active' : 'Inactive'}
        </span>
        {outstandingBalance > 0 && (
          <span className="badge badge-warning">
            Outstanding Balance: {formatCurrency(outstandingBalance, 'USD')}
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Total Bills</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{bills.length}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Outstanding Balance (USD)</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {formatCurrency(outstandingBalance, 'USD')}
            </p>
          </div>
        </div>
        <div className="card">
          <div className="card-body">
            <p className="text-sm text-gray-500">Payment Terms</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {vendor.payment_terms ? `Net ${vendor.payment_terms}` : 'Not set'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Information */}
        <div className="card">
          <div className="card-body">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BuildingOfficeIcon className="w-5 h-5" />
              Contact Information
            </h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <EnvelopeIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Primary Email</p>
                  <a href={`mailto:${vendor.email}`} className="text-navy-600 hover:underline">
                    {vendor.email}
                  </a>
                  {vendor.email_2 && (
                    <a href={`mailto:${vendor.email_2}`} className="block text-navy-600 hover:underline mt-1">
                      {vendor.email_2}
                    </a>
                  )}
                  {vendor.email_3 && (
                    <a href={`mailto:${vendor.email_3}`} className="block text-navy-600 hover:underline mt-1">
                      {vendor.email_3}
                    </a>
                  )}
                  {vendor.email_4 && (
                    <a href={`mailto:${vendor.email_4}`} className="block text-navy-600 hover:underline mt-1">
                      {vendor.email_4}
                    </a>
                  )}
                </div>
              </div>
              {vendor.phone && (
                <div className="flex items-start gap-3">
                  <PhoneIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Phone</p>
                    <a href={`tel:${vendor.phone}`} className="text-gray-900">
                      {vendor.phone}
                    </a>
                    {vendor.phone_2 && (
                      <a href={`tel:${vendor.phone_2}`} className="block text-gray-900 mt-1">
                        {vendor.phone_2}
                      </a>
                    )}
                  </div>
                </div>
              )}
              {(vendor.address_line1 || vendor.city) && (
                <div className="flex items-start gap-3">
                  <MapPinIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Address</p>
                    {vendor.address_line1 && <p className="text-gray-900">{vendor.address_line1}</p>}
                    {vendor.address_line2 && <p className="text-gray-900">{vendor.address_line2}</p>}
                    {(vendor.city || vendor.state || vendor.zip_code) && (
                      <p className="text-gray-900">
                        {[vendor.city, vendor.state, vendor.zip_code].filter(Boolean).join(', ')}
                      </p>
                    )}
                    {vendor.country && <p className="text-gray-900">{vendor.country}</p>}
                  </div>
                </div>
              )}
              {vendor.website && (
                <div>
                  <p className="text-sm text-gray-500">Website</p>
                  <a
                    href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-navy-600 hover:underline"
                  >
                    {vendor.website}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Business Details */}
        <div className="card">
          <div className="card-body">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BanknotesIcon className="w-5 h-5" />
              Business Details
            </h2>
            <div className="space-y-3">
              {vendor.tax_id && (
                <div>
                  <p className="text-sm text-gray-500">Tax ID</p>
                  <p className="font-medium text-gray-900">{vendor.tax_id}</p>
                </div>
              )}
              {vendor.account_number && (
                <div>
                  <p className="text-sm text-gray-500">Account Number</p>
                  <p className="font-medium text-gray-900">{vendor.account_number}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Currency</p>
                <p className="font-medium text-gray-900">{vendor.currency}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Payment Terms</p>
                <p className="font-medium text-gray-900">
                  {vendor.payment_terms ? `Net ${vendor.payment_terms} days` : 'Not specified'}
                </p>
              </div>
              {vendor.notes && (
                <div>
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-gray-900">{vendor.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bills */}
      {bills.length > 0 && (
        <div className="card">
          <div className="card-body">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">Recent Bills</h2>
              <Link href={`/dashboard/bills?vendor=${id}`} className="text-sm text-navy-600 hover:underline">
                View all
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Bill #</th>
                    <th>Date</th>
                    <th>Due Date</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr key={bill.id}>
                      <td>
                        <Link
                          href={`/dashboard/bills/${bill.id}`}
                          className="text-navy-600 hover:underline font-medium"
                        >
                          {bill.bill_number}
                        </Link>
                      </td>
                      <td>{new Date(bill.bill_date).toLocaleDateString()}</td>
                      <td>{new Date(bill.due_date).toLocaleDateString()}</td>
                      <td className="text-right font-medium">
                        {formatCurrency(bill.total, bill.currency)}
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(bill.status)}`}>
                          {bill.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Additional Info */}
      <div className="card">
        <div className="card-body">
          <h2 className="font-semibold text-gray-900 mb-4">Additional Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="text-gray-900">{new Date(vendor.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Last Updated</p>
              <p className="text-gray-900">{new Date(vendor.updated_at).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
