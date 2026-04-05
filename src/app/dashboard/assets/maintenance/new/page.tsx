'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/company-context';
import toast from 'react-hot-toast';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface Asset {
  id: string;
  name: string;
  asset_number: string;
  category_id: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  department: string;
}

export default function NewAssetMaintenancePage() {
  const router = useRouter();
  const { company } = useCompany();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    asset_id: '',
    maintenance_type: 'preventive',
    scheduled_date: '',
    performed_date: '',
    performed_by_employee_id: '',
    performed_by_vendor: '',
    description: '',
    cost: '',
    status: 'scheduled',
    notes: '',
    next_maintenance_date: '',
  });

  useEffect(() => {
    if (!company?.id) {
      return;
    }
    loadData();
  }, [company?.id]);

  const loadData = async () => {
    try {
      if (!company?.id) {
        return;
      }

      setLoading(true);

      const assetsParams = new URLSearchParams({
        company_id: company.id,
        status: 'active',
      });
      const assetsResponse = await fetch(`/api/assets?${assetsParams.toString()}`, {
        credentials: 'include',
      });
      if (!assetsResponse.ok) {
        const data = await assetsResponse.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load assets');
      }

      const assetsData = await assetsResponse.json();
      setAssets(assetsData || []);

      const employeeParams = new URLSearchParams({
        company_id: company.id,
        status: 'active',
      });
      const employeesResponse = await fetch(`/api/employees?${employeeParams.toString()}`, {
        credentials: 'include',
      });
      if (!employeesResponse.ok) {
        const data = await employeesResponse.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load employees');
      }

      const employeesPayload = await employeesResponse.json();
      setEmployees(employeesPayload.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.asset_id) {
      toast.error('Please select an asset');
      return;
    }

    if (!formData.scheduled_date) {
      toast.error('Please select a scheduled date');
      return;
    }

    if (!company?.id) {
      toast.error('No company selected');
      return;
    }

    try {
      setSaving(true);

      const dataToSave = {
        company_id: company.id,
        asset_id: formData.asset_id,
        maintenance_type: formData.maintenance_type,
        scheduled_date: formData.scheduled_date,
        performed_date: formData.performed_date || null,
        performed_by_employee_id: formData.performed_by_employee_id || null,
        performed_by_vendor: formData.performed_by_vendor || null,
        description: formData.description,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        status: formData.status,
        notes: formData.notes || null,
        next_maintenance_date: formData.next_maintenance_date || null,
      };

      const response = await fetch('/api/asset-maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(dataToSave),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to schedule maintenance');
      }

      toast.success('Maintenance scheduled successfully');
      router.push('/dashboard/assets/maintenance');
    } catch (error: any) {
      console.error('Error scheduling maintenance:', error);
      toast.error(error.message || 'Failed to schedule maintenance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-ghost p-2"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Schedule Maintenance</h1>
              <p className="text-gray-500 mt-1">Schedule asset maintenance or log completed work</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary"
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving || loading}>
              {saving ? 'Saving...' : 'Schedule Maintenance'}
            </button>
          </div>
        </div>

        {/* Maintenance Details */}
        <div className="card">
          <div className="card-body space-y-4">
            <h2 className="text-lg font-semibold">Maintenance Details</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="label">
                  Asset <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.asset_id}
                  onChange={(e) => setFormData({ ...formData, asset_id: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Select Asset</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} - {asset.asset_number || 'No number'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">
                  Maintenance Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.maintenance_type}
                  onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })}
                  className="input"
                  required
                >
                  <option value="preventive">Preventive</option>
                  <option value="corrective">Corrective</option>
                  <option value="inspection">Inspection</option>
                  <option value="calibration">Calibration</option>
                </select>
              </div>

              <div>
                <label className="label">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="input"
                  required
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="label">
                  Scheduled Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Performed Date</label>
                <input
                  type="date"
                  value={formData.performed_date}
                  onChange={(e) => setFormData({ ...formData, performed_date: e.target.value })}
                  className="input"
                />
              </div>

              <div>
                <label className="label">Next Maintenance Date</label>
                <input
                  type="date"
                  value={formData.next_maintenance_date}
                  onChange={(e) =>
                    setFormData({ ...formData, next_maintenance_date: e.target.value })
                  }
                  className="input"
                />
              </div>

              <div>
                <label className="label">Cost</label>
                <input
                  type="number"
                  value={formData.cost}
                  onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                  className="input"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>

              <div className="md:col-span-2">
                <label className="label">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={3}
                  required
                  placeholder="Describe the maintenance work to be performed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Performed By */}
        <div className="card">
          <div className="card-body space-y-4">
            <h2 className="text-lg font-semibold">Performed By</h2>
            <p className="text-sm text-gray-600">
              Select either an employee or enter vendor information
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Employee</label>
                <select
                  value={formData.performed_by_employee_id}
                  onChange={(e) =>
                    setFormData({ ...formData, performed_by_employee_id: e.target.value })
                  }
                  className="input"
                >
                  <option value="">Select Employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name} ({employee.employee_number})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Or Vendor Name</label>
                <input
                  type="text"
                  value={formData.performed_by_vendor}
                  onChange={(e) =>
                    setFormData({ ...formData, performed_by_vendor: e.target.value })
                  }
                  className="input"
                  placeholder="External service provider"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Additional Notes */}
        <div className="card">
          <div className="card-body space-y-4">
            <h2 className="text-lg font-semibold">Additional Notes</h2>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="input"
              rows={4}
              placeholder="Any additional information, parts used, or observations..."
            />
          </div>
        </div>
      </form>
    </div>
  );
}
