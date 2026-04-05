'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency as currencyFormatter, type SupportedCurrency } from '@/lib/currency';
import type { PayrollPeriod, Payslip, Employee } from '@/types/breco';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  PaperAirplaneIcon,
  CurrencyDollarIcon,
  CalculatorIcon,
  ArrowPathIcon,
  EyeIcon,
  PrinterIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  UserGroupIcon,
  MinusCircleIcon,
} from '@heroicons/react/24/outline';
import { ShimmerSkeleton, CardSkeleton } from '@/components/ui/skeleton';
import toast from 'react-hot-toast';

type PayrollStatus = 'draft' | 'processing' | 'approved' | 'paid';

interface PayrollPeriodWithPayslips extends PayrollPeriod {
  payslips?: (Payslip & { employee?: Employee })[];
}

// Default currency for payroll - can be overridden from company settings
const defaultCurrency: SupportedCurrency = 'UGX';

export default function PayrollPage() {
  const { company } = useCompany();
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriodWithPayslips[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<PayrollPeriodWithPayslips | null>(null);
  const [processing, setProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    period_name: '',
    period_type: 'monthly' as 'weekly' | 'bi_weekly' | 'monthly',
    start_date: '',
    end_date: '',
    payment_date: '',
  });

  useEffect(() => {
    if (!company?.id) {
      return;
    }
    fetchPayrollPeriods();
    fetchEmployees();
  }, [company?.id]);

  const fetchPayrollPeriods = async () => {
    try {
      if (!company?.id) {
        return;
      }

      const response = await fetch(`/api/payroll/periods?company_id=${company.id}`, {
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load payroll periods');
      }

      const mappedPeriods = ((result || []) as any[]).map((row) => ({
        ...row,
        start_date: row.start_date || row.period_start,
        end_date: row.end_date || row.period_end,
        period_name:
          row.period_name ||
          `${new Date(row.period_start).toLocaleDateString()} - ${new Date(row.period_end).toLocaleDateString()}`,
      }));

      setPayrollPeriods(mappedPeriods);
    } catch (error) {
      console.error('Error fetching payroll periods:', error);
      toast.error('Failed to load payroll periods');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      if (!company?.id) {
        return;
      }

      const response = await fetch(`/api/employees?company_id=${company.id}&is_active=true`, {
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load employees');
      }

      setEmployees(result.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!company?.id) {
        toast.error('No company selected');
        return;
      }

      const response = await fetch(`/api/payroll/periods?company_id=${company.id}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_start: formData.start_date,
          period_end: formData.end_date,
          payment_date: formData.payment_date,
          period_name: formData.period_name,
          period_type: formData.period_type,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create payroll period');
      }
      
      toast.success('Payroll period created');
      setShowCreateModal(false);
      setFormData({
        period_name: '',
        period_type: 'monthly',
        start_date: '',
        end_date: '',
        payment_date: '',
      });
      fetchPayrollPeriods();
    } catch (error) {
      console.error('Error creating payroll period:', error);
      toast.error('Failed to create payroll period');
    }
  };

  const processPayroll = async (period: PayrollPeriodWithPayslips) => {
    setProcessing(true);
    
    try {
      if (!company?.id) {
        toast.error('No company selected');
        return;
      }

      const response = await fetch(
        `/api/payroll/periods/${period.id}/generate?company_id=${company.id}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to process payroll');
      }

      toast.success('Payroll processed successfully with allowances and deductions');
      setShowProcessModal(false);
      fetchPayrollPeriods();
    } catch (error) {
      console.error('Error processing payroll:', error);
      toast.error('Failed to process payroll');
    } finally {
      setProcessing(false);
    }
  };

  const updatePeriodStatus = async (period: PayrollPeriod, newStatus: PayrollStatus) => {
    try {
      const updateData: any = { status: newStatus };

      // Use API route for paid status to trigger journal entry creation
      if (newStatus === 'paid') {
        const response = await fetch(`/api/payroll/${period.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update payroll status');
        }

        toast.success(`Payroll marked as paid and posted to general ledger`);
      } else {
        const response = await fetch(`/api/payroll/${period.id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.error || 'Failed to update payroll status');
        }
        
        toast.success(`Status updated to ${newStatus}`);
      }
      
      fetchPayrollPeriods();
    } catch (error: any) {
      console.error('Failed to update status:', error);
      toast.error(error.message || 'Failed to update status');
    }
  };

  const handlePrint = (period: PayrollPeriod) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-UG', {
        style: 'currency',
        currency: defaultCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    };

    const formatDate = (date: string | null) => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payroll Period - ${period.period_name}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #000;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #000;
            }
            .logo {
              max-height: 80px;
            }
            .company-info {
              text-align: right;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            h1 {
              text-align: center;
              margin: 20px 0;
              font-size: 22px;
            }
            .period-info {
              background: #f5f5f5;
              padding: 15px;
              margin-bottom: 20px;
              border-radius: 5px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .info-label {
              font-weight: bold;
              width: 150px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin: 20px 0;
            }
            .summary-box {
              border: 1px solid #ddd;
              padding: 15px;
              border-radius: 5px;
              text-align: center;
            }
            .summary-label {
              font-size: 12px;
              color: #666;
              margin-bottom: 5px;
            }
            .summary-value {
              font-size: 20px;
              font-weight: bold;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
            @media print {
              body { margin: 0; }
              .header { page-break-after: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="/assets/logo_bg.png" alt="Company Logo" class="logo" />
            <div class="company-info">
              <div class="company-name">Breco Safaris</div>
              <div>Operations Department</div>
            </div>
          </div>

          <h1>Payroll Period Summary</h1>

          <div class="period-info">
            <div class="info-row">
              <span class="info-label">Period Name:</span>
              <span>${period.period_name}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Period Type:</span>
              <span>${period.period_type || '-'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Start Date:</span>
              <span>${formatDate(period.start_date)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">End Date:</span>
              <span>${formatDate(period.end_date)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Payment Date:</span>
              <span>${formatDate(period.payment_date)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span style="text-transform: capitalize;">${period.status}</span>
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-box">
              <div class="summary-label">Gross Pay</div>
              <div class="summary-value">${formatCurrency(period.total_gross || 0)}</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">Total Deductions</div>
              <div class="summary-value">${formatCurrency(period.total_deductions || 0)}</div>
            </div>
            <div class="summary-box">
              <div class="summary-label">Net Pay</div>
              <div class="summary-value">${formatCurrency(period.total_net || 0)}</div>
            </div>
          </div>

          <div class="footer">
            <p>Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-GB')}</p>
            <p>Breco Safaris - Operations Department</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const deletePeriod = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payroll period? This will also delete all associated payslips.')) return;

    try {
      const response = await fetch(`/api/payroll/periods/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete payroll period');
      }
      
      setPayrollPeriods(prev => prev.filter(p => p.id !== id));
      toast.success('Payroll period deleted');
    } catch (error) {
      toast.error('Failed to delete payroll period');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <span className="badge flex items-center gap-1"><DocumentTextIcon className="w-3 h-3" /> Draft</span>;
      case 'processing':
        return <span className="badge-warning flex items-center gap-1"><ArrowPathIcon className="w-3 h-3 animate-spin" /> Processing</span>;
      case 'approved':
        return <span className="badge-info flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" /> Approved</span>;
      case 'paid':
        return <span className="badge-success flex items-center gap-1"><BanknotesIcon className="w-3 h-3" /> Paid</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const formatCurrency = (amount: number | null, currency: SupportedCurrency = 'UGX') => {
    if (!amount) return currencyFormatter(0, currency);
    return currencyFormatter(amount, currency);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Calculate summary stats
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentPeriod = payrollPeriods.find(p => p.start_date?.startsWith(currentMonth));
  const totalPaidThisYear = payrollPeriods
    .filter(p => p.status === 'paid' && p.start_date?.startsWith(new Date().getFullYear().toString()))
    .reduce((sum, p) => sum + (p.total_net || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blueox-primary"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <ShimmerSkeleton className="h-12 w-64 mb-6 rounded-full" />
          <ShimmerSkeleton className="h-10 w-80 mb-2" />
          <ShimmerSkeleton className="h-6 w-96" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl">
              <ShimmerSkeleton className="h-4 w-24 mb-3" />
              <ShimmerSkeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-4 sm:p-6 lg:p-8">
      {/* Hero Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-full px-6 py-3 mb-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <BanknotesIcon className="w-6 h-6 text-blueox-primary" />
          <span className="font-bold text-blueox-primary-dark text-lg">Payroll Management</span>
          <SparklesIcon className="w-5 h-5 text-cyan-500" />
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blueox-primary via-blue-600 to-cyan-500 mb-2">
              Employee Payroll
            </h1>
            <p className="text-gray-600 text-lg">Process payroll with PAYE & NSSF compliance</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
          >
            <PlusIcon className="w-5 h-5" />
            New Pay Period
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <div className="bg-white/80 backdrop-blur-xl border-l-4 border-blue-500 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Active Employees</p>
              <p className="text-3xl font-extrabold text-blueox-primary-dark group-hover:text-blueox-primary transition-colors">
                {employees.length}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-2xl group-hover:bg-blue-200 transition-colors">
              <UserGroupIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl border-l-4 border-green-500 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">This Month Payroll</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-blueox-primary-dark group-hover:text-green-600 transition-colors">
                {formatCurrency(currentPeriod?.total_net || employees.reduce((sum, e) => sum + (e.basic_salary || 0), 0))}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-2xl group-hover:bg-green-200 transition-colors">
              <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl border-l-4 border-red-500 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Total Deductions</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-red-600 group-hover:text-red-700 transition-colors">
                {formatCurrency(currentPeriod?.total_deductions || 0)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-2xl group-hover:bg-red-200 transition-colors">
              <MinusCircleIcon className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Tax Compliance Alert */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 backdrop-blur-xl border-l-4 border-amber-500 rounded-3xl p-6 mb-8 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 rounded-2xl flex-shrink-0">
            <ExclamationTriangleIcon className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-amber-900 text-lg mb-2">Statutory Remittances</h3>
            <p className="text-amber-700">
              PAYE must be remitted to URA by the 15th of each month. NSSF contributions must be paid by the 15th following the pay period.
            </p>
          </div>
        </div>
      </div>

      {/* Payroll Periods */}
      {payrollPeriods.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-16 shadow-xl text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
            <BanknotesIcon className="w-10 h-10 text-blueox-primary" />
          </div>
          <h3 className="text-2xl font-bold text-blueox-primary-dark mb-3">No payroll periods</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">Create your first payroll period to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-white px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
          >
            <PlusIcon className="w-5 h-5" />
            New Pay Period
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {payrollPeriods.map((period) => (
            <div key={period.id} className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-6 py-5 border-b border-blueox-primary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-blueox-primary-dark">{period.period_name}</h3>
                  <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                    <CalendarDaysIcon className="w-4 h-4" />
                    {formatDate(period.start_date)} - {formatDate(period.end_date)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(period.status)}
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100">
                    <p className="text-xs font-medium text-gray-600 mb-1">Employees</p>
                    <p className="text-2xl font-bold text-blueox-primary-dark">{period.employee_count || '-'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100">
                    <p className="text-xs font-medium text-gray-600 mb-1">Gross Pay</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(period.total_gross)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-4 border border-red-100">
                    <p className="text-xs font-medium text-gray-600 mb-1">Deductions</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(period.total_deductions)}</p>
                  </div>
                  <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-4 border border-cyan-100">
                    <p className="text-xs font-medium text-gray-600 mb-1">Net Pay</p>
                    <p className="text-xl font-bold text-cyan-600">{formatCurrency(period.total_net)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-6 border-t border-blueox-primary/10">
                  {period.status === 'draft' && !period.employee_count && (
                    <button
                      onClick={() => {
                        setSelectedPeriod(period);
                        setShowProcessModal(true);
                      }}
                      className="btn-primary btn-sm flex items-center gap-1"
                    >
                      <CalculatorIcon className="w-4 h-4" />
                      Process Payroll
                    </button>
                  )}
                  
                  {period.status === 'draft' && period.employee_count && (
                    <button
                      onClick={() => updatePeriodStatus(period, 'approved')}
                      className="btn-primary btn-sm flex items-center gap-1"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                      Approve
                    </button>
                  )}
                  
                  {period.status === 'approved' && (
                    <button
                      onClick={() => updatePeriodStatus(period, 'paid')}
                      className="btn-success btn-sm flex items-center gap-1"
                    >
                      <BanknotesIcon className="w-4 h-4" />
                      Mark as Paid
                    </button>
                  )}

                  <Link
                    href={`/dashboard/payroll/${period.id}`}
                    className="btn-secondary btn-sm flex items-center gap-1"
                  >
                    <EyeIcon className="w-4 h-4" />
                    View Payslips
                  </Link>

                  <button
                    onClick={() => handlePrint(period)}
                    className="btn-secondary btn-sm flex items-center gap-1"
                  >
                    <PrinterIcon className="w-4 h-4" />
                    Print
                  </button>

                  {period.status === 'draft' && (
                    <button
                      onClick={() => deletePeriod(period.id)}
                      className="btn-sm btn-danger ml-auto"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Period Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h2 className="text-lg font-semibold">Create Pay Period</h2>
            </div>
            <form onSubmit={handleCreatePeriod} className="card-body space-y-4">
              <div className="form-group">
                <label className="label">Period Name *</label>
                <input
                  type="text"
                  value={formData.period_name}
                  onChange={(e) => setFormData({ ...formData, period_name: e.target.value })}
                  className="input"
                  placeholder="e.g., January 2024"
                  required
                />
              </div>
              <div className="form-group">
                <label className="label">Period Type *</label>
                <select
                  value={formData.period_type}
                  onChange={(e) => setFormData({ ...formData, period_type: e.target.value as any })}
                  className="input"
                  required
                >
                  <option value="weekly">Weekly</option>
                  <option value="bi_weekly">Bi-Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label">Start Date *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="label">End Date *</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="label">Pay Date *</label>
                <input
                  type="date"
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                <button type="submit" className="btn-primary">
                  Create Period
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Payroll Modal */}
      {showProcessModal && selectedPeriod && (
        <div className="modal-overlay" onClick={() => setShowProcessModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h2 className="text-lg font-semibold">Process Payroll</h2>
            </div>
            <div className="card-body space-y-4">
              <p className="text-gray-600">
                This will generate payslips for <strong>{employees.length}</strong> active employees 
                for the period <strong>{selectedPeriod.period_name}</strong>.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium">Calculations will include:</h4>
                <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                  <li>PAYE (Pay As You Earn) - Uganda progressive tax rates</li>
                  <li>NSSF Employee Contribution (5%)</li>
                  <li>NSSF Employer Contribution (10%)</li>
                  <li>Any configured allowances and deductions</li>
                </ul>
              </div>

              <div className="bg-yellow-50 rounded-lg p-4">
                <p className="text-sm text-yellow-700">
                  <strong>Note:</strong> You can review and adjust individual payslips after processing.
                </p>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                <button
                  onClick={() => processPayroll(selectedPeriod)}
                  disabled={processing}
                  className="btn-primary flex items-center gap-2"
                >
                  {processing ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CalculatorIcon className="w-4 h-4" />
                      Process Payroll
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowProcessModal(false)}
                  className="btn-secondary"
                  disabled={processing}
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

