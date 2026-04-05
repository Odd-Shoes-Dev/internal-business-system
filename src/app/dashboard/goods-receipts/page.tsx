'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/contexts/company-context';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentCheckIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface GoodsReceipt {
  id: string;
  receipt_number: string;
  received_date: string;
  status: string;
  notes: string | null;
  purchase_order?: {
    po_number: string;
    vendor?: {
      name: string;
      company_name: string | null;
    };
  };
}

export default function GoodsReceiptsPage() {
  const { company } = useCompany();
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    if (!company?.id) {
      return;
    }
    loadReceipts();
  }, [searchQuery, statusFilter, currentPage, company?.id]);

  const loadReceipts = async () => {
    try {
      if (!company?.id) {
        return;
      }

      setLoading(true);
      const params = new URLSearchParams({
        company_id: company.id,
        page: String(currentPage),
        limit: String(pageSize),
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/goods-receipts?${params.toString()}`, {
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load goods receipts');
      }

      setReceipts(result.data || []);
      setTotalCount(result.pagination?.total || 0);
    } catch (error) {
      console.error('Failed to load goods receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; class: string; icon: any }> = {
      received: { label: 'Received', class: 'badge-info', icon: ClockIcon },
      inspected: { label: 'Inspected', class: 'badge-warning', icon: DocumentCheckIcon },
      accepted: { label: 'Accepted', class: 'badge-success', icon: CheckCircleIcon },
      rejected: { label: 'Rejected', class: 'badge-error', icon: CheckCircleIcon },
      returned: { label: 'Returned', class: 'badge-gray', icon: CheckCircleIcon },
    };
    const badge = badges[status] || badges.received;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.class}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goods Receipts</h1>
          <p className="text-gray-500 mt-1">Receive goods from purchase orders</p>
        </div>
        <Link href="/dashboard/goods-receipts/new" className="btn-primary">
          <PlusIcon className="w-5 h-5 mr-2" />
          New Goods Receipt
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by GR number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 input"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-full md:w-48"
          >
            <option value="all">All Statuses</option>
            <option value="received">Received</option>
            <option value="inspected">Inspected</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="returned">Returned</option>
          </select>
        </div>
      </div>

      {/* Goods Receipts List */}
      <div className="card">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blueox-primary mx-auto"></div>
          </div>
        ) : receipts.length === 0 ? (
          <div className="p-12 text-center">
            <DocumentCheckIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No goods receipts found</h3>
            <p className="text-gray-500 mb-4">Create your first goods receipt to get started</p>
            <Link href="/dashboard/goods-receipts/new" className="btn-primary inline-flex items-center">
              <PlusIcon className="w-5 h-5 mr-2" />
              New Goods Receipt
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>GR Number</th>
                    <th>PO Number</th>
                    <th>Vendor</th>
                    <th>Received Date</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((receipt) => (
                    <tr key={receipt.id}>
                      <td>
                        <Link 
                          href={`/dashboard/goods-receipts/${receipt.id}`}
                          className="font-medium text-blueox-primary hover:text-breco-ocean"
                        >
                          {receipt.receipt_number}
                        </Link>
                      </td>
                      <td>
                        {receipt.purchase_order?.po_number || 'N/A'}
                      </td>
                      <td>
                        <div className="text-sm">
                          {receipt.purchase_order?.vendor?.company_name || receipt.purchase_order?.vendor?.name || 'N/A'}
                        </div>
                      </td>
                      <td>{formatDate(receipt.received_date)}</td>
                      <td>{getStatusBadge(receipt.status)}</td>
                      <td className="text-right">
                        <Link
                          href={`/dashboard/goods-receipts/${receipt.id}`}
                          className="btn-ghost text-sm"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="card-footer flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} receipts
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="btn-secondary"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-secondary"
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
