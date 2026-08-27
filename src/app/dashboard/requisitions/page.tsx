'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/contexts/company-context';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

interface Requisition {
  id: string;
  requisition_number: string;
  client_name: string;
  status: 'open' | 'partial' | 'completed' | 'closed';
  request_date: string;
  created_at: string;
  total_requested: number;
  total_delivered: number;
  line_count: number;
  delivery_count: number;
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-gray-100 text-gray-700',
  partial: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-700',
};

export default function RequisitionsPage() {
  const { company } = useCompany();
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (company) loadRequisitions();
  }, [company, statusFilter]);

  const loadRequisitions = async () => {
    if (!company) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ company_id: company.id });
      if (statusFilter) q.set('status', statusFilter);
      const res = await fetch(`/api/requisitions?${q}`, { credentials: 'include' });
      const data = await res.json();
      setRequisitions(data.data || []);
    } catch {
      toast.error('Failed to load requisitions');
    } finally {
      setLoading(false);
    }
  };

  const filtered = requisitions.filter(r =>
    !search ||
    r.requisition_number.toLowerCase().includes(search.toLowerCase()) ||
    r.client_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardDocumentListIcon className="w-7 h-7 text-blueox-primary" />
              Stock Requisitions
            </h1>
            <p className="text-gray-500 mt-1">Client requests fulfilled through one or more delivery forms</p>
          </div>
          <Link href="/dashboard/requisitions/new" className="btn-primary flex items-center gap-2">
            <PlusIcon className="w-5 h-5" />
            New Requisition
          </Link>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative max-w-sm flex-1 min-w-[220px]">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Search by number or client..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input w-auto"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="partial">Partial</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="bg-white/90 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardDocumentListIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No requisitions yet</p>
              <p className="text-sm text-gray-400 mt-1">Create one when a client sends in their request</p>
              <Link href="/dashboard/requisitions/new" className="btn-primary mt-4 inline-flex items-center gap-1">
                <PlusIcon className="w-4 h-4" /> New Requisition
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Number</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Items</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Progress</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Deliveries</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Request Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(r => (
                    <tr
                      key={r.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => window.location.assign(`/dashboard/requisitions/${r.id}`)}
                    >
                      <td className="px-4 py-3 font-semibold text-blueox-primary">{r.requisition_number}</td>
                      <td className="px-4 py-3 text-gray-800">{r.client_name}</td>
                      <td className="px-4 py-3 text-gray-600">{r.line_count}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {Number(r.total_delivered)} / {Number(r.total_requested)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.delivery_count}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{new Date(r.request_date).toLocaleDateString()}</td>
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
