'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCompany } from '@/contexts/company-context';
import type { Employee } from '@/types/breco';
import { CurrencySelect } from '@/components/ui';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  IdentificationIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  CheckBadgeIcon,
  XCircleIcon,
  SparklesIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

type EmploymentStatus = 'active' | 'on_leave' | 'terminated' | 'probation';

export default function EmployeesPage() {
  const { company } = useCompany();
  const searchParams = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>(searchParams.get('department') || 'all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    employee_number: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    national_id: '',
    nssf_number: '',
    tin: '',
    date_of_birth: '',
    hire_date: '',
    job_title: '',
    department: 'Operations',
    employment_type: 'full_time' as 'full_time' | 'part_time' | 'contract' | 'casual',
    pay_frequency: 'monthly' as 'weekly' | 'bi_weekly' | 'monthly',
    basic_salary: 0,
    salary_currency: 'UGX',
    bank_name: '',
    bank_account_number: '',
    bank_branch: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    address: '',
  });

  useEffect(() => {
    if (company) {
      fetchEmployees();
    }
  }, [company]);

  const fetchEmployees = async () => {
    if (!company) return;
    
    try {
      const response = await fetch(`/api/employees?company_id=${company.id}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch employees');
      
      const result = await response.json();
      setEmployees(result.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!company) return;
    
    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          company_id: company.id,
          date_of_birth: formData.date_of_birth || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add employee');
      }
      
      toast.success('Employee added successfully');
      setShowCreateModal(false);
      setFormData({
        employee_number: '',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        national_id: '',
        nssf_number: '',
        tin: '',
        date_of_birth: '',
        hire_date: '',
        job_title: '',
        department: 'Operations',
        employment_type: 'full_time',
        pay_frequency: 'monthly',
        basic_salary: 0,
        salary_currency: 'UGX',
        bank_name: '',
        bank_account_number: '',
        bank_branch: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        address: '',
      });
      fetchEmployees();
    } catch (error: any) {
      console.error('Error creating employee:', error);
      toast.error(error.message || 'Failed to add employee');
    }
  };

  const updateStatus = async (employee: Employee, newStatus: EmploymentStatus) => {
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ employment_status: newStatus }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update status');
      }

      setEmployees(prev => 
        prev.map(e => e.id === employee.id ? result.data : e)
      );
      
      toast.success('Status updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee record?')) return;

    try {
      const response = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete employee');
      }
      
      setEmployees(prev => prev.filter(e => e.id !== id));
      toast.success(result.message || 'Employee deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete employee');
    }
  };

  const departments = [...new Set(employees.map(e => e.department).filter((d): d is string => Boolean(d)))];
  
  const filteredEmployees = employees.filter(employee => {
    const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase();
    const matchesSearch = 
      fullName.includes(searchQuery.toLowerCase()) ||
      employee.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.employee_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.job_title?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || employee.employment_status === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || employee.department === departmentFilter;
    
    return matchesSearch && matchesStatus && matchesDepartment;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge-success flex items-center gap-1"><CheckBadgeIcon className="w-3 h-3" /> Active</span>;
      case 'on_leave':
        return <span className="badge-warning flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> On Leave</span>;
      case 'probation':
        return <span className="badge-info flex items-center gap-1"><UserIcon className="w-3 h-3" /> Probation</span>;
      case 'terminated':
        return <span className="badge-danger flex items-center gap-1"><XCircleIcon className="w-3 h-3" /> Terminated</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const formatCurrency = (amount: number | null, currency: string = 'UGX') => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const departmentOptions = ['Operations', 'Finance', 'Sales', 'Marketing', 'Administration', 'Guides', 'Drivers', 'IT'];
  const employmentTypes = [
    { value: 'full_time', label: 'Full Time' },
    { value: 'part_time', label: 'Part Time' },
    { value: 'contract', label: 'Contract' },
    { value: 'casual', label: 'Casual' },
  ];
  const statuses: EmploymentStatus[] = ['active', 'on_leave', 'probation', 'terminated'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blueox-primary/20 border-t-blueox-primary" />
      </div>
    );
  }

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
            <span className="text-blueox-primary font-semibold">Employee Management</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-blueox-primary-dark mb-4 leading-tight">
                Employee Directory
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl">
                Manage staff information and payroll details
              </p>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
            >
              <PlusIcon className="w-5 h-5" />
              Add Employee
              <SparklesIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-2xl lg:text-3xl font-bold text-blueox-primary-dark">{employees.length}</p>
          <p className="text-sm font-medium text-gray-600 mt-2">Total Employees</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-green-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-2xl lg:text-3xl font-bold text-green-600">
            {employees.filter(e => e.employment_status === 'active').length}
          </p>
          <p className="text-sm font-medium text-gray-600 mt-2">Active</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-2xl lg:text-3xl font-bold text-blue-600">
            {employees.filter(e => e.employment_status === 'probation').length}
          </p>
          <p className="text-sm font-medium text-gray-600 mt-2">On Probation</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-2xl lg:text-3xl font-bold text-blueox-primary">
            {formatCurrency(
              employees
                .filter(e => e.is_active)
                .reduce((sum, e) => sum + (e.basic_salary || 0), 0),
              'UGX'
            )}
          </p>
          <p className="text-sm font-medium text-gray-600 mt-2">Monthly Payroll</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <FunnelIcon className="w-5 h-5 text-blueox-primary" />
          <h3 className="text-lg font-bold text-blueox-primary-dark">Search & Filter</h3>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees by name, email, or employee number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-48 px-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
          >
            <option value="all">All Statuses</option>
            {statuses.map(status => (
              <option key={status} value={status}>
                {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="w-full sm:w-48 px-4 py-3 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl text-gray-900 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Table */}
      {filteredEmployees.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl p-16 shadow-xl text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
            <UserGroupIcon className="w-10 h-10 text-blueox-primary" />
          </div>
          <h3 className="text-2xl font-bold text-blueox-primary-dark mb-3">No employees found</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">Add your first employee to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
          >
            <PlusIcon className="w-5 h-5" />
            Add Employee
          </button>
        </div>
      ) : (
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-blueox-primary/10">
                  <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Employee</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Position</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Department</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Status</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Hire Date</th>
                  <th className="text-left py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Salary</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold text-blueox-primary-dark">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className={`border-b border-blueox-primary/5 hover:bg-blueox-primary/5 transition-colors duration-200 ${employee.employment_status === 'terminated' ? 'opacity-50' : ''}`}>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blueox-primary/10 rounded-full flex items-center justify-center">
                          <UserIcon className="w-5 h-5 text-blueox-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {employee.first_name} {employee.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{employee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="font-medium text-gray-900">{employee.job_title || '-'}</p>
                      <p className="text-xs text-gray-500">
                        {employee.employee_number}
                      </p>
                    </td>
                    <td className="py-4 px-6 text-gray-900">{employee.department || '-'}</td>
                    <td className="py-4 px-6">{getStatusBadge(employee.employment_status)}</td>
                    <td className="py-4 px-6 text-gray-900">{formatDate(employee.hire_date)}</td>
                    <td className="py-4 px-6">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(employee.basic_salary, employee.salary_currency)}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">{employee.pay_frequency}</p>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/dashboard/employees/${employee.id}`}
                          className="inline-flex items-center justify-center w-9 h-9 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl transition-all duration-200"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/dashboard/employees/${employee.id}/edit`}
                          className="inline-flex items-center justify-center w-9 h-9 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all duration-200"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => deleteEmployee(employee.id)}
                          className="inline-flex items-center justify-center w-9 h-9 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl transition-all duration-200"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <h2 className="text-lg font-semibold">Add Employee</h2>
            </div>
            <form onSubmit={handleCreateEmployee} className="card-body space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Personal Information */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="label">Employee Number *</label>
                    <input
                      type="text"
                      value={formData.employee_number}
                      onChange={(e) => setFormData({ ...formData, employee_number: e.target.value })}
                      className="input"
                      placeholder="EMP001"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">First Name *</label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Last Name *</label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Date of Birth</label>
                    <input
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              {/* Statutory IDs */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Statutory Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="label">National ID</label>
                    <input
                      type="text"
                      value={formData.national_id}
                      onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">NSSF Number</label>
                    <input
                      type="text"
                      value={formData.nssf_number}
                      onChange={(e) => setFormData({ ...formData, nssf_number: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">TIN Number</label>
                    <input
                      type="text"
                      value={formData.tin}
                      onChange={(e) => setFormData({ ...formData, tin: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Employment Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="label">Job Title</label>
                    <input
                      type="text"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Department</label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="input"
                    >
                      {departmentOptions.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Employment Type</label>
                    <select
                      value={formData.employment_type}
                      onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as any })}
                      className="input"
                    >
                      {employmentTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Hire Date *</label>
                    <input
                      type="date"
                      value={formData.hire_date}
                      onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Salary Information */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Salary Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="label">Basic Salary</label>
                    <input
                      type="number"
                      value={formData.basic_salary}
                      onChange={(e) => setFormData({ ...formData, basic_salary: parseFloat(e.target.value) })}
                      className="input"
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Currency</label>
                    <CurrencySelect
                      value={formData.salary_currency}
                      onChange={(e) => setFormData({ ...formData, salary_currency: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Pay Frequency</label>
                    <select
                      value={formData.pay_frequency}
                      onChange={(e) => setFormData({ ...formData, pay_frequency: e.target.value as any })}
                      className="input"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="bi_weekly">Bi-Weekly</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Bank Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="label">Bank Name</label>
                    <input
                      type="text"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Account Number</label>
                    <input
                      type="text"
                      value={formData.bank_account_number}
                      onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="label">Branch</label>
                    <input
                      type="text"
                      value={formData.bank_branch}
                      onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                <button type="submit" className="btn-primary">
                  Add Employee
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
      </div>
    </div>
  );
}

