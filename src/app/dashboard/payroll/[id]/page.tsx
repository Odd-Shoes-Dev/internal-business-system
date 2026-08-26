'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency as currencyFormatter, type SupportedCurrency } from '@/lib/currency';
import { useCompany } from '@/contexts/company-context';
import { ArrowLeftIcon, PrinterIcon, CheckCircleIcon, EnvelopeIcon, EyeIcon, EllipsisVerticalIcon, PencilIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface PayrollPeriod {
  id: string;
  period_name: string;
  period_type: string;
  start_date: string;
  end_date: string;
  payment_date: string;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  working_days: number | null;
}

interface Payslip {
  id: string;
  employee_id: string;
  gross_salary: number;
  paye: number;
  nssf_employee: number;
  total_deductions: number;
  net_salary: number;
  employee: {
    first_name: string;
    last_name: string;
    employee_number: string;
    job_title: string;
  };
}

export default function PayrollPeriodDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { company } = useCompany();
  const [period, setPeriod] = useState<PayrollPeriod | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodId, setPeriodId] = useState<string>('');
  const [emailingSlugs, setEmailingSlugs] = useState<Set<string>>(new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addableEmployees, setAddableEmployees] = useState<any[]>([]);
  const [addForm, setAddForm] = useState({ employee_id: '', days_worked: '' as number | '', paye: true, nssf: true });
  const [addingPayslip, setAddingPayslip] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    params.then(({ id }) => {
      setPeriodId(id);
      fetchPeriodDetails(id);
    });
  }, []);

  const fetchPeriodDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/payroll/periods/${id}`, {
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load payroll details');
      }

      const periodData = {
        id: result.id,
        period_name:
          result.period_name ||
          `${new Date(result.period_start).toLocaleDateString()} - ${new Date(result.period_end).toLocaleDateString()}`,
        period_type: result.period_type || 'monthly',
        start_date: result.start_date || result.period_start,
        end_date: result.end_date || result.period_end,
        payment_date: result.payment_date,
        status: result.status,
        total_gross: Number(result.total_gross || 0),
        total_deductions: Number(result.total_deductions || 0),
        total_net: Number(result.total_net || 0),
        working_days: result.working_days ?? null,
      };

      const payslipsData = ((result.payslips || []) as any[]).map((payslip) => ({
        id: payslip.id,
        employee_id: payslip.employee_id,
        gross_salary: Number(payslip.gross_salary || 0),
        paye: Number(payslip.paye ?? payslip.tax_deduction ?? 0),
        nssf_employee: Number(payslip.nssf_employee ?? payslip.nssf_deduction ?? 0),
        total_deductions: Number(payslip.total_deductions ?? payslip.deductions ?? 0),
        net_salary: Number(payslip.net_salary || 0),
        employee: {
          first_name: payslip.employee?.first_name || '-',
          last_name: payslip.employee?.last_name || '',
          employee_number: payslip.employee?.employee_number || payslip.employee?.employee_id || '-',
          job_title: payslip.employee?.job_title || payslip.employee?.position || '-',
        },
      }));

      setPeriod(periodData);
      setPayslips(payslipsData);
    } catch (error) {
      console.error('Error fetching payroll details:', error);
      toast.error('Failed to load payroll details');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, (company?.currency || 'USD') as SupportedCurrency);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      draft: 'bg-gray-100 text-gray-700',
      processing: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      paid: 'bg-emerald-100 text-emerald-700',
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusStyles[status as keyof typeof statusStyles]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handlePrint = () => {
    if (!period) return;

    const printHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payroll Summary - ${period.period_name}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 40px; color: #111827; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; }
            .header h1 { font-size: 24px; color: #1e3a8a; margin-bottom: 8px; }
            .header p { font-size: 14px; color: #6b7280; }
            .summary { display: flex; justify-content: space-between; margin: 30px 0; padding: 20px; background: #f9fafb; border-radius: 8px; }
            .summary-item { text-align: center; flex: 1; }
            .summary-item h3 { font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
            .summary-item p { font-size: 20px; font-weight: bold; }
            .summary-item.gross p { color: #111827; }
            .summary-item.deductions p { color: #dc2626; }
            .summary-item.net p { color: #16a34a; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f3f4f6; padding: 12px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #e5e7eb; }
            td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
            .text-right { text-align: right; }
            .employee-name { font-weight: 600; color: #111827; }
            .employee-number { color: #6b7280; font-size: 11px; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #6b7280; }
            @media print {
              body { padding: 20px; }
              @page { margin: 0.5in; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${company?.logo_url ? `<img src="${company.logo_url}" alt="${company?.name || ''}" style="width: 120px; margin-bottom: 15px;" onerror="this.style.display='none'">` : ''}
            <h1>${company?.name || ''}</h1>
            <h2>Payroll Summary</h2>
            <p>${period.period_name}</p>
            <p>${formatDate(period.start_date)} - ${formatDate(period.end_date)}</p>
            <p>Payment Date: ${formatDate(period.payment_date)}</p>
          </div>

          <div class="summary">
            <div class="summary-item gross">
              <h3>Total Gross Salary</h3>
              <p>${formatCurrency(period.total_gross || 0)}</p>
            </div>
            <div class="summary-item deductions">
              <h3>Total Deductions</h3>
              <p>${formatCurrency(period.total_deductions || 0)}</p>
            </div>
            <div class="summary-item net">
              <h3>Total Net Salary</h3>
              <p>${formatCurrency(period.total_net || 0)}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Job Title</th>
                <th class="text-right">Gross Salary</th>
                <th class="text-right">PAYE</th>
                <th class="text-right">NSSF</th>
                <th class="text-right">Total Deductions</th>
                <th class="text-right">Net Salary</th>
              </tr>
            </thead>
            <tbody>
              ${payslips.map(payslip => `
                <tr>
                  <td>
                    <div class="employee-name">${payslip.employee.first_name} ${payslip.employee.last_name}</div>
                    <div class="employee-number">${payslip.employee.employee_number}</div>
                  </td>
                  <td>${payslip.employee.job_title}</td>
                  <td class="text-right">${formatCurrency(payslip.gross_salary)}</td>
                  <td class="text-right">${formatCurrency(payslip.paye)}</td>
                  <td class="text-right">${formatCurrency(payslip.nssf_employee)}</td>
                  <td class="text-right">${formatCurrency(payslip.total_deductions)}</td>
                  <td class="text-right" style="font-weight: bold;">${formatCurrency(payslip.net_salary)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>This is a computer-generated document. No signature required.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.focus();

      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const openAddPayslipModal = async () => {
    if (!company?.id) return;
    try {
      const response = await fetch(`/api/employees?company_id=${company.id}`, { credentials: 'include' });
      const result = await response.json().catch(() => ({}));
      const allEmployees = (result.data || result || []) as any[];
      const existingIds = new Set(payslips.map((p) => p.employee_id));
      const eligible = allEmployees.filter((e: any) => !existingIds.has(e.id) && (e.is_active ?? true));
      setAddableEmployees(eligible);
      const defaultDays = period?.working_days ?? 30;
      setAddForm({ employee_id: '', days_worked: defaultDays, paye: true, nssf: true });
      setShowAddModal(true);
    } catch {
      toast.error('Failed to load employees');
    }
  };

  const handleAddPayslip = async () => {
    if (!addForm.employee_id) {
      toast.error('Please select an employee');
      return;
    }
    if (!company?.id) return;
    setAddingPayslip(true);
    try {
      const response = await fetch(`/api/payroll/periods/${periodId}/payslips?company_id=${company.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: addForm.employee_id,
          days_worked: addForm.days_worked === '' ? undefined : Number(addForm.days_worked),
          paye: addForm.paye,
          nssf: addForm.nssf,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(result.error || 'Failed to add payslip');
        return;
      }
      toast.success('Payslip added');
      setShowAddModal(false);
      fetchPeriodDetails(periodId);
    } catch {
      toast.error('Failed to add payslip');
    } finally {
      setAddingPayslip(false);
    }
  };

  const handleDeletePayslip = async (payslipId: string) => {
    const warning = period && period.status !== 'draft'
      ? 'This payslip belongs to a period that has already been processed. Deleting it will not reverse any related journal entry automatically. This cannot be undone. Continue?'
      : 'Delete this payslip? This cannot be undone.';
    if (!confirm(warning)) return;
    try {
      const response = await fetch(`/api/payroll/payslips/${payslipId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        toast.error(result.error || 'Failed to delete payslip');
        return;
      }
      toast.success('Payslip deleted');
      setPayslips(prev => prev.filter(p => p.id !== payslipId));
    } catch {
      toast.error('Failed to delete payslip');
    }
  };

  const handleEmailPayslip = async (payslipId: string, employeeName: string) => {
    setEmailingSlugs(prev => new Set(prev).add(payslipId));
    
    try {
      const response = await fetch(`/api/payslips/${payslipId}/email`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send email');
      }

      toast.success(`Payslip emailed to ${employeeName}!`);
    } catch (error: any) {
      console.error('Error emailing payslip:', error);
      toast.error(error.message || 'Failed to send payslip email');
    } finally {
      setEmailingSlugs(prev => {
        const newSet = new Set(prev);
        newSet.delete(payslipId);
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blueox-primary"></div>
      </div>
    );
  }

  if (!period) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payroll Period Not Found</h2>
        <Link href="/dashboard/payroll" className="text-blueox-primary hover:underline">
          Back to Payroll
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/payroll"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{period.period_name}</h1>
            <p className="text-gray-500">
              {formatDate(period.start_date)} - {formatDate(period.end_date)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {getStatusBadge(period.status)}
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <PrinterIcon className="w-5 h-5" />
            Print All
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <p className="text-sm text-gray-500 mb-1">Total Gross Salary</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(period.total_gross || 0)}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500 mb-1">Total Deductions</p>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(period.total_deductions || 0)}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500 mb-1">Total Net Salary</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(period.total_net || 0)}
          </p>
        </div>
      </div>

      {/* Payslips Table */}
      <div className="card">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Payslips ({payslips.length})
          </h2>
          {period.status === 'draft' && (
            <button
              onClick={openAddPayslipModal}
              className="btn-primary btn-sm flex items-center gap-1"
            >
              <PlusIcon className="w-4 h-4" />
              Add Employee
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job Title
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gross Salary
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PAYE
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  NSSF
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Deductions
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net Salary
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payslips.map((payslip) => (
                <tr
                  key={payslip.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/dashboard/payroll/${periodId}/payslips/${payslip.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="font-medium text-gray-900">
                        {payslip.employee.first_name} {payslip.employee.last_name}
                      </p>
                      <p className="text-sm text-gray-500">{payslip.employee.employee_number}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {payslip.employee.job_title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                    {formatCurrency(payslip.gross_salary)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-red-600">
                    {formatCurrency(payslip.paye)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-red-600">
                    {formatCurrency(payslip.nssf_employee)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-red-600 font-medium">
                    {formatCurrency(payslip.total_deductions)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-green-600 font-bold">
                    {formatCurrency(payslip.net_salary)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-gray-400">-</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="relative flex justify-end">
                      <button
                        onClick={(e) => {
                          if (openMenuId === payslip.id) {
                            setOpenMenuId(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          const estimatedMenuHeight = 170;
                          const opensUpward = rect.bottom + estimatedMenuHeight > window.innerHeight;
                          setMenuPos({
                            top: opensUpward ? rect.top - estimatedMenuHeight - 4 : rect.bottom + 4,
                            left: rect.right - 140,
                          });
                          setOpenMenuId(payslip.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                      >
                        <EllipsisVerticalIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {payslips.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No payslips found for this period</p>
          </div>
        )}
      </div>

      {openMenuId && menuPos && (() => {
        const payslip = payslips.find((p) => p.id === openMenuId);
        if (!payslip) return null;
        return (
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
            className="z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]"
          >
            <Link
              href={`/dashboard/payroll/${periodId}/payslips/${payslip.id}`}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <EyeIcon className="w-4 h-4" />
              View
            </Link>
            {period?.status === 'draft' && (
              <Link
                href={`/dashboard/payroll/${periodId}/payslips/${payslip.id}/edit`}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <PencilIcon className="w-4 h-4" />
                Edit
              </Link>
            )}
            <button
              onClick={() => {
                setOpenMenuId(null);
                handleEmailPayslip(payslip.id, `${payslip.employee.first_name} ${payslip.employee.last_name}`);
              }}
              disabled={emailingSlugs.has(payslip.id)}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
            >
              <EnvelopeIcon className="w-4 h-4" />
              Email
            </button>
            <button
              onClick={() => { setOpenMenuId(null); handleDeletePayslip(payslip.id); }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <TrashIcon className="w-4 h-4" />
              Delete
            </button>
          </div>
        );
      })()}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h2 className="text-lg font-semibold">Add Employee to Payroll</h2>
            </div>
            <div className="card-body space-y-4">
              {addableEmployees.length === 0 ? (
                <p className="text-sm text-gray-500">
                  All active employees already have a payslip for this period.
                </p>
              ) : (
                <>
                  <div className="form-group">
                    <label className="label">Employee *</label>
                    <select
                      value={addForm.employee_id}
                      onChange={(e) => setAddForm({ ...addForm, employee_id: e.target.value })}
                      className="input"
                    >
                      <option value="">Select an employee...</option>
                      {addableEmployees.map((emp: any) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name} — {emp.job_title || 'No title'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Days Worked</label>
                    <input
                      type="number"
                      min={0}
                      value={addForm.days_worked}
                      onChange={(e) => setAddForm({ ...addForm, days_worked: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={addForm.paye}
                        onChange={(e) => setAddForm({ ...addForm, paye: e.target.checked })}
                        className="w-4 h-4"
                      />
                      Subject to PAYE
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={addForm.nssf}
                        onChange={(e) => setAddForm({ ...addForm, nssf: e.target.checked })}
                        className="w-4 h-4"
                      />
                      Subject to NSSF
                    </label>
                  </div>
                </>
              )}

              <div className="flex items-center gap-4 pt-4 border-t">
                <button
                  onClick={handleAddPayslip}
                  disabled={addingPayslip || addableEmployees.length === 0}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  {addingPayslip ? 'Adding...' : 'Add Payslip'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
