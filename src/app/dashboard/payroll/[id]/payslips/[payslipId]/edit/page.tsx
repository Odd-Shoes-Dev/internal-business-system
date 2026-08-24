'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { ShimmerSkeleton } from '@/components/ui/skeleton';

export default function PayslipEditPage({
  params,
}: {
  params: Promise<{ id: string; payslipId: string }>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [periodId, setPeriodId] = useState('');
  const [payslipId, setPayslipId] = useState('');
  const [employeeName, setEmployeeName] = useState('');

  const [formData, setFormData] = useState({
    days_worked: 0,
    basic_salary: 0,
    housing_allowance: 0,
    transport_allowance: 0,
    other_allowances: 0,
    tax_deduction: 0,
    nssf_deduction: 0,
    loan_deduction: 0,
    advance_deduction: 0,
    notes: '',
  });

  useEffect(() => {
    params.then(({ id, payslipId }) => {
      setPeriodId(id);
      setPayslipId(payslipId);
      fetchPayslip(payslipId);
    });
  }, []);

  const fetchPayslip = async (id: string) => {
    try {
      const response = await fetch(`/api/payroll/payslips/${id}`, {
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Payslip not found');
      }

      setEmployeeName(
        result.employee ? `${result.employee.first_name} ${result.employee.last_name}` : ''
      );

      setFormData({
        days_worked: Number(result.days_worked || 0),
        basic_salary: Number(result.basic_salary || 0),
        housing_allowance: Number(result.housing_allowance || 0),
        transport_allowance: Number(result.transport_allowance || 0),
        other_allowances: Number(result.other_allowances || 0),
        tax_deduction: Number(result.tax_deduction || 0),
        nssf_deduction: Number(result.nssf_deduction || 0),
        loan_deduction: Number(result.loan_deduction || 0),
        advance_deduction: Number(result.advance_deduction || 0),
        notes: result.notes || '',
      });
    } catch (error: any) {
      console.error('Error fetching payslip:', error);
      toast.error(error.message || 'Failed to load payslip');
      router.push(`/dashboard/payroll/${periodId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const allowances =
        formData.housing_allowance + formData.transport_allowance + formData.other_allowances;
      const deductions =
        formData.tax_deduction +
        formData.nssf_deduction +
        formData.loan_deduction +
        formData.advance_deduction;

      const response = await fetch(`/api/payroll/payslips/${payslipId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days_worked: formData.days_worked,
          basic_salary: formData.basic_salary,
          housing_allowance: formData.housing_allowance,
          transport_allowance: formData.transport_allowance,
          other_allowances: formData.other_allowances,
          allowances,
          tax_deduction: formData.tax_deduction,
          nssf_deduction: formData.nssf_deduction,
          loan_deduction: formData.loan_deduction,
          advance_deduction: formData.advance_deduction,
          deductions,
          notes: formData.notes,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(result.error || 'Failed to update payslip');
        return;
      }

      toast.success('Payslip updated successfully');
      router.push(`/dashboard/payroll/${periodId}/payslips/${payslipId}`);
    } catch (error: any) {
      console.error('Error updating payslip:', error);
      toast.error(error.message || 'Failed to update payslip');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <div className="flex items-center gap-4">
            <ShimmerSkeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-2">
              <ShimmerSkeleton className="w-48 h-8" />
              <ShimmerSkeleton className="w-64 h-4" />
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white/80 backdrop-blur-xl border border-blue-200/20 rounded-3xl shadow-xl p-6"
            >
              <ShimmerSkeleton className="w-48 h-6 mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="space-y-2">
                    <ShimmerSkeleton className="w-24 h-4" />
                    <ShimmerSkeleton className="w-full h-10 rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/payroll/${periodId}/payslips/${payslipId}`}
            className="p-2 hover:bg-white/50 backdrop-blur-xl border border-blue-200/20 rounded-xl shadow-lg transition-all duration-200"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Payslip</h1>
            <p className="text-gray-500 mt-1">{employeeName}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Earnings */}
          <div className="bg-white/80 backdrop-blur-xl border border-blue-200/20 rounded-3xl shadow-xl p-6">
            <div className="card-header">
              <h2 className="font-semibold">Earnings</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="form-group">
                  <label className="label">Days Worked</label>
                  <input
                    type="number"
                    value={formData.days_worked}
                    onChange={(e) =>
                      setFormData({ ...formData, days_worked: parseFloat(e.target.value) || 0 })
                    }
                    className="input"
                    min="0"
                    step="0.5"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Basic Salary</label>
                  <input
                    type="number"
                    value={formData.basic_salary}
                    onChange={(e) =>
                      setFormData({ ...formData, basic_salary: parseFloat(e.target.value) || 0 })
                    }
                    className="input"
                    min="0"
                    step="1000"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Housing Allowance</label>
                  <input
                    type="number"
                    value={formData.housing_allowance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        housing_allowance: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="input"
                    min="0"
                    step="1000"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Transport Allowance</label>
                  <input
                    type="number"
                    value={formData.transport_allowance}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        transport_allowance: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="input"
                    min="0"
                    step="1000"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Other Allowances</label>
                  <input
                    type="number"
                    value={formData.other_allowances}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        other_allowances: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="input"
                    min="0"
                    step="1000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div className="bg-white/80 backdrop-blur-xl border border-blue-200/20 rounded-3xl shadow-xl p-6">
            <div className="card-header">
              <h2 className="font-semibold">Deductions</h2>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="form-group">
                  <label className="label">PAYE (Income Tax)</label>
                  <input
                    type="number"
                    value={formData.tax_deduction}
                    onChange={(e) =>
                      setFormData({ ...formData, tax_deduction: parseFloat(e.target.value) || 0 })
                    }
                    className="input"
                    min="0"
                    step="1000"
                  />
                </div>
                <div className="form-group">
                  <label className="label">NSSF (Employee)</label>
                  <input
                    type="number"
                    value={formData.nssf_deduction}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nssf_deduction: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="input"
                    min="0"
                    step="1000"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Loan Deduction</label>
                  <input
                    type="number"
                    value={formData.loan_deduction}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        loan_deduction: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="input"
                    min="0"
                    step="1000"
                  />
                </div>
                <div className="form-group">
                  <label className="label">Salary Advance</label>
                  <input
                    type="number"
                    value={formData.advance_deduction}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        advance_deduction: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="input"
                    min="0"
                    step="1000"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white/80 backdrop-blur-xl border border-blue-200/20 rounded-3xl shadow-xl p-6">
            <div className="card-header">
              <h2 className="font-semibold">Notes</h2>
            </div>
            <div className="card-body">
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input"
                rows={3}
                placeholder="Additional notes about this payslip..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-blue-500/90 hover:bg-blue-600/90 text-white backdrop-blur-xl border border-blue-400/30 rounded-xl shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href={`/dashboard/payroll/${periodId}/payslips/${payslipId}`}
              className="px-6 py-3 bg-white/80 hover:bg-white/90 text-gray-700 backdrop-blur-xl border border-blue-200/20 rounded-xl shadow-lg transition-all duration-200"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
