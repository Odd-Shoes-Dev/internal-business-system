'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  PrinterIcon,
  CalendarIcon,
  FunnelIcon,
  ReceiptPercentIcon,
} from '@heroicons/react/24/outline';
import { ShimmerSkeleton } from '@/components/ui/skeleton';

interface ExpenseLine {
  id: string;
  expense_number: string;
  expense_date: string;
  description: string;
  category: string;
  department: string;
  amount: number;
  tax_amount: number;
  total: number;
  currency: string;
  payment_method: string;
  status: string;
  vendor_name: string | null;
  account_name: string | null;
  account_code: string | null;
}

interface ExpenseCategory {
  name: string;
  items: ExpenseLine[];
  total: number;
}

interface ExpensesReportData {
  company: {
    name: string;
    currency: string;
    address: string;
    phone: string;
    email: string;
    logo_url: string;
  };
  period: { startDate: string | null; endDate: string | null };
  currency: string;
  categories: ExpenseCategory[];
  grandTotal: number;
  totalExpenses: number;
  availableCategories: string[];
}

export default function ExpensesReportPage() {
  const { company } = useCompany();
  const [data, setData] = useState<ExpensesReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('paid');

  const loadReport = useCallback(async () => {
    if (!company?.id) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        company_id: company.id,
        start_date: startDate,
        end_date: endDate,
        status,
        ...(category !== 'all' ? { category } : {}),
      });
      const res = await fetch(`/api/reports/expenses?${params}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setData(json.data);
      } else {
        console.error('Expenses report error:', json.error);
        setData(null);
      }
    } catch (error) {
      console.error('Failed to load report:', error);
    } finally {
      setLoading(false);
    }
  }, [company?.id, startDate, endDate, category, status]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const formatCurrency = (amount: number) =>
    currencyFormatter(amount, data?.currency || company?.currency || 'USD');

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const setPresetPeriod = (preset: string) => {
    const now = new Date();
    let start: Date;
    let end: Date = now;
    switch (preset) {
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisQuarter': {
        const q = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), q * 3, 1);
        break;
      }
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'lastYear':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        return;
    }
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const generatePrintHTML = () => {
    if (!data) return '';
    const currency = data.currency;

    const fc = (amt: number) => currencyFormatter(amt, currency);
    const fd = (d: string | null) => formatDate(d);
    const fds = (d: string) => formatDateShort(d);

    const categoryRows = data.categories
      .map(
        (cat) => `
        <div class="category-block">
          <div class="category-title">${cat.name}</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Number</th>
                <th>Description</th>
                <th>Vendor</th>
                <th>Payment Method</th>
                <th class="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${cat.items
                .map(
                  (exp) => `
                <tr>
                  <td>${fds(exp.expense_date)}</td>
                  <td>${exp.expense_number}</td>
                  <td>${exp.description || '—'}</td>
                  <td>${exp.vendor_name || '—'}</td>
                  <td>${exp.payment_method || '—'}</td>
                  <td class="amount">${fc(exp.total)}</td>
                </tr>`
                )
                .join('')}
            </tbody>
            <tfoot>
              <tr class="subtotal">
                <td colspan="5">Subtotal — ${cat.name}</td>
                <td class="amount">${fc(cat.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>`
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <title>Expenses Report — ${fd(startDate)} to ${fd(endDate)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 40px;
      color: #000;
      background: white;
      line-height: 1.4;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #1e3a5f;
    }
    .company-name { font-size: 22px; font-weight: bold; color: #1e3a5f; margin-bottom: 4px; }
    .company-sub { font-size: 12px; color: #666; }
    .report-title { font-size: 26px; font-weight: bold; color: #1e3a5f; text-align: right; margin-bottom: 4px; }
    .report-sub { font-size: 12px; color: #666; text-align: right; }
    .summary {
      display: flex;
      gap: 20px;
      margin-bottom: 30px;
      padding: 14px 20px;
      background: #f4f6f9;
      border-radius: 8px;
    }
    .summary-item { flex: 1; }
    .summary-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-value { font-size: 18px; font-weight: bold; color: #1e3a5f; }
    .category-block { margin-bottom: 28px; }
    .category-title {
      font-size: 14px;
      font-weight: bold;
      color: #1e3a5f;
      margin-bottom: 6px;
      padding: 6px 10px;
      background: #eef1f7;
      border-left: 3px solid #2C4BA0;
    }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead tr { background: #f8f9fa; }
    th { padding: 7px 10px; text-align: left; font-weight: 600; color: #555; border-bottom: 1px solid #ddd; }
    td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; color: #333; }
    .amount { text-align: right; font-variant-numeric: tabular-nums; }
    tr.subtotal td { font-weight: 700; background: #f4f6f9; border-top: 1px solid #ccc; }
    .grand-total {
      margin-top: 20px;
      padding: 14px 20px;
      background: #1e3a5f;
      color: white;
      display: flex;
      justify-content: space-between;
      font-size: 16px;
      font-weight: bold;
      border-radius: 4px;
    }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${data.company.name || ''}</div>
      ${data.company.address ? `<div class="company-sub">${data.company.address}</div>` : ''}
      ${data.company.phone ? `<div class="company-sub">${data.company.phone}</div>` : ''}
    </div>
    <div>
      <div class="report-title">Expenses Report</div>
      <div class="report-sub">${fd(startDate)} — ${fd(endDate)}</div>
      <div class="report-sub">Status: ${status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}</div>
    </div>
  </div>

  <div class="summary">
    <div class="summary-item">
      <div class="summary-label">Total Expenses</div>
      <div class="summary-value">${data.totalExpenses}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Categories</div>
      <div class="summary-value">${data.categories.length}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Total Amount</div>
      <div class="summary-value">${fc(data.grandTotal)}</div>
    </div>
  </div>

  ${categoryRows}

  <div class="grand-total">
    <span>Grand Total</span>
    <span>${fc(data.grandTotal)}</span>
  </div>
</body>
</html>`;
  };

  const handlePrint = () => {
    if (!data) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(generatePrintHTML());
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  };

  const handleExport = () => {
    if (!data) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(generatePrintHTML());
    win.document.close();
  };

  const handleExportCSV = () => {
    if (!data) return;
    const rows: string[] = [
      ['Date', 'Number', 'Description', 'Category', 'Vendor', 'Account', 'Payment Method', 'Amount', 'Currency', 'Status'].join(','),
    ];
    for (const cat of data.categories) {
      for (const exp of cat.items) {
        rows.push([
          exp.expense_date,
          exp.expense_number,
          `"${(exp.description || '').replace(/"/g, '""')}"`,
          `"${(cat.name || '').replace(/"/g, '""')}"`,
          `"${(exp.vendor_name || '').replace(/"/g, '""')}"`,
          `"${(exp.account_name || '').replace(/"/g, '""')}"`,
          exp.payment_method || '',
          exp.total,
          exp.currency || data.currency,
          exp.status,
        ].join(','));
      }
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/reports" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expenses Report</h1>
            <p className="text-gray-500 text-sm">Paid expenses grouped by category</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={!data || loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={handleExport}
            disabled={!data || loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={handlePrint}
            disabled={!data || loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#16304f] disabled:opacity-50"
          >
            <PrinterIcon className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Period presets */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <CalendarIcon className="w-3 h-3 inline mr-1" />Period
            </label>
            <div className="flex gap-1 flex-wrap">
              {[
                { label: 'This Month', value: 'thisMonth' },
                { label: 'Last Month', value: 'lastMonth' },
                { label: 'This Quarter', value: 'thisQuarter' },
                { label: 'This Year', value: 'thisYear' },
                { label: 'Last Year', value: 'lastYear' },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPresetPeriod(p.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:border-[#1e3a5f] hover:bg-blue-50 hover:text-[#1e3a5f] transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date inputs */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            />
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              <FunnelIcon className="w-3 h-3 inline mr-1" />Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            >
              <option value="paid">Paid only</option>
              <option value="approved">Approved only</option>
              <option value="all">All statuses</option>
            </select>
          </div>

          {/* Category filter */}
          {data?.availableCategories && data.availableCategories.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="all">All Categories</option>
                {data.availableCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {data && !loading && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-sm text-gray-500">Total Expenses</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{data.totalExpenses}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-sm text-gray-500">Categories</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{data.categories.length}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="text-sm text-gray-500">Grand Total</div>
            <div className="text-2xl font-bold text-[#1e3a5f] mt-1">{formatCurrency(data.grandTotal)}</div>
          </div>
        </div>
      )}

      {/* Report body */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <ShimmerSkeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : !data || data.categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <ReceiptPercentIcon className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-base font-medium">No expenses found</p>
            <p className="text-sm mt-1">Try adjusting the date range or status filter</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.categories.map((cat) => (
              <div key={cat.name}>
                {/* Category header */}
                <div className="flex items-center justify-between px-6 py-3 bg-gray-50">
                  <span className="text-sm font-semibold text-[#1e3a5f] uppercase tracking-wide">
                    {cat.name}
                  </span>
                  <span className="text-sm font-semibold text-gray-700">
                    {cat.items.length} item{cat.items.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Expense rows */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase tracking-wide">
                      <th className="pl-6 pr-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Number</th>
                      <th className="px-3 py-2 text-left font-medium">Description</th>
                      <th className="px-3 py-2 text-left font-medium">Vendor</th>
                      <th className="px-3 py-2 text-left font-medium">Payment</th>
                      <th className="pr-6 pl-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {cat.items.map((exp) => (
                      <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="pl-6 pr-3 py-3 text-gray-600 whitespace-nowrap">
                          {formatDateShort(exp.expense_date)}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-gray-500">{exp.expense_number}</td>
                        <td className="px-3 py-3 text-gray-700">{exp.description || '—'}</td>
                        <td className="px-3 py-3 text-gray-600">{exp.vendor_name || '—'}</td>
                        <td className="px-3 py-3 text-gray-500 capitalize">{exp.payment_method || '—'}</td>
                        <td className="pr-6 pl-3 py-3 text-right font-medium tabular-nums text-gray-900">
                          {formatCurrency(exp.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="pl-6 pr-3 py-3 text-sm font-semibold text-gray-700">
                        Subtotal — {cat.name}
                      </td>
                      <td className="pr-6 pl-3 py-3 text-right font-bold tabular-nums text-gray-900">
                        {formatCurrency(cat.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}

            {/* Grand total */}
            <div className="flex items-center justify-between px-6 py-4 bg-[#1e3a5f]">
              <span className="text-base font-bold text-white">Grand Total</span>
              <span className="text-xl font-bold text-white tabular-nums">
                {formatCurrency(data.grandTotal)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
