'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency } from '@/lib/currency';
import { adjustmentReasonLabel } from '@/lib/inventory/adjustment-reasons';
import { PageHeader } from '@/components/page-header';

interface Adjustment {
  id: string;
  adjustment_number: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  unit_of_measure: string;
  quantity_change: number;
  reason: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  source: string;
  total_cost: number | null;
  requested_by_name: string | null;
  approved_by_name: string | null;
  rejection_reason: string | null;
  created_at: string;
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-gray-100 text-gray-600',
};

export default function StockAdjustmentsPage() {
  const { company, companies } = useCompany();
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | ''>('pending');
  const [rows, setRows] = useState<Adjustment[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isAdmin = ['owner', 'admin'].includes(companies.find((c) => c.id === company?.id)?.role || '');

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stock-adjustments?company_id=${company.id}${status ? `&status=${status}` : ''}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.data);
      setCanApprove(data.can_approve);
      setApprovalRequired(data.approval_required);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load adjustments');
    } finally {
      setLoading(false);
    }
  }, [company?.id, status]);

  useEffect(() => { load(); }, [load]);

  const act = async (row: Adjustment, action: 'approve' | 'reject') => {
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/stock-adjustments/${row.id}/${action}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${row.adjustment_number} ${action === 'approve' ? 'approved' : 'rejected'}`);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const toggleApproval = async () => {
    if (!company) return;
    const res = await fetch('/api/companies/inventory-settings', {
      method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: company.id, require_adjustment_approval: !approvalRequired }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error); return; }
    setApprovalRequired(data.data.require_adjustment_approval);
    toast.success(data.data.require_adjustment_approval ? 'Adjustments now need approval' : 'Adjustments now apply straight away');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock adjustments"
        actions={
          <>
            <Link href="/dashboard/inventory/adjust" className="btn-primary btn-sm inline-flex items-center gap-1.5">New adjustment</Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1 text-sm">
          {(['pending', 'approved', 'rejected', ''] as const).map((s) => (
            <button key={s || 'all'} onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg ${status === s ? 'bg-white shadow font-semibold' : 'text-gray-600'}`}>
              {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={approvalRequired} onChange={toggleApproval} />
            Require approval (owners, admins and accountants approve)
          </label>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3 text-right">Change</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Requested</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No {status || ''} adjustments</td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-mono">{row.adjustment_number}</td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/inventory/${row.product_id}`} className="text-blueox-primary hover:underline">{row.product_name}</Link>
                  {row.notes && <p className="text-xs text-gray-500">{row.notes}</p>}
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${row.quantity_change < 0 ? 'text-red-600' : 'text-green-700'}`}>
                  {row.quantity_change > 0 ? '+' : ''}{row.quantity_change} {row.unit_of_measure}
                </td>
                <td className="px-4 py-3">{adjustmentReasonLabel(row.reason)}{row.source === 'stock_take' ? ' (stock take)' : ''}</td>
                <td className="px-4 py-3 text-gray-600">
                  {row.requested_by_name || '—'}
                  <p className="text-xs">{new Date(row.created_at).toLocaleString()}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[row.status]}`}>{row.status}</span>
                  {row.approved_by_name && row.status !== 'pending' && <p className="text-xs text-gray-500 mt-1">by {row.approved_by_name}</p>}
                  {row.rejection_reason && <p className="text-xs text-gray-500">{row.rejection_reason}</p>}
                </td>
                <td className="px-4 py-3 text-right">{row.total_cost != null ? formatCurrency(row.total_cost, (company?.currency || 'UGX') as any) : '—'}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {row.status === 'pending' && canApprove && (
                    <span className="inline-flex gap-2">
                      <button disabled={busyId === row.id} onClick={() => act(row, 'approve')} className="btn-primary btn-sm inline-flex items-center gap-1">
                        <CheckIcon className="w-4 h-4" /> Approve
                      </button>
                      <button disabled={busyId === row.id} onClick={() => act(row, 'reject')} className="btn-secondary btn-sm inline-flex items-center gap-1">
                        <XMarkIcon className="w-4 h-4" /> Reject
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
