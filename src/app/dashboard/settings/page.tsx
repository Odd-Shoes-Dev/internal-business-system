'use client';

import { useState, useEffect } from 'react';
import { useCompany } from '@/contexts/company-context';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Image from 'next/image';
import {
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  BellIcon,
  UserGroupIcon,
  ShieldCheckIcon,
  PaintBrushIcon,
  BookOpenIcon,
  ArrowTopRightOnSquareIcon,
  LockClosedIcon,
  SparklesIcon,
  CogIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { ShimmerSkeleton, FormFieldSkeleton } from '@/components/ui/skeleton';
import type { CompanySettings } from '@/types/database';

type SettingsTab = 'company' | 'financial' | 'invoicing' | 'notifications' | 'users' | 'security' | 'branding';

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  company_role: string;
  is_primary: boolean;
  joined_at: string;
  last_login_at: string | null;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  invited_by_name: string | null;
  token: string;
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'operations', label: 'Operations' },
  { value: 'sales', label: 'Sales' },
  { value: 'guide', label: 'Guide' },
  { value: 'viewer', label: 'Viewer' },
];

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  accountant: 'bg-blue-100 text-blue-700',
  operations: 'bg-orange-100 text-orange-700',
  sales: 'bg-green-100 text-green-700',
  guide: 'bg-teal-100 text-teal-700',
  viewer: 'bg-gray-100 text-gray-600',
  manager: 'bg-indigo-100 text-indigo-700',
};

interface CompanyFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  tax_id: string;
  registration_number: string;
  website: string;
  logo_url: string;
}

interface FinancialFormData {
  fiscal_year_start_month: number;
  default_payment_terms: number;
  sales_tax_rate: number;
}

export default function SettingsPage() {
  const { company, refreshCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<SettingsTab>('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [refreshingRates, setRefreshingRates] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('accountant');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  const companyForm = useForm<CompanyFormData>();
  const financialForm = useForm<FinancialFormData>();

  useEffect(() => {
    loadSettings();
  }, [company?.id]);

  useEffect(() => {
    if (activeTab === 'users' && company?.id) {
      loadTeam();
    }
  }, [activeTab, company?.id]);

  const loadTeam = async () => {
    if (!company?.id) return;
    setLoadingTeam(true);
    try {
      const res = await fetch(`/api/invitations?company_id=${encodeURIComponent(company.id)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load team');
      const payload = await res.json();
      setTeamMembers(payload.members || []);
      setPendingInvitations(payload.invitations || []);
    } catch {
      toast.error('Failed to load team members');
    } finally {
      setLoadingTeam(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;
    setSendingInvite(true);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ company_id: company.id, email: inviteEmail, role: inviteRole }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to send invitation');
      toast.success(`Invitation sent to ${inviteEmail}`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('accountant');
      loadTeam();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevokeInvitation = async (token: string) => {
    setRevokingToken(token);
    try {
      const res = await fetch(`/api/invitations/${token}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to revoke invitation');
      toast.success('Invitation revoked');
      loadTeam();
    } catch {
      toast.error('Failed to revoke invitation');
    } finally {
      setRevokingToken(null);
    }
  };

  const loadSettings = async () => {
    if (!company?.id) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/companies/me?company_id=${encodeURIComponent(company.id)}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to load settings');
      }

      const payload = await response.json();
      const data = (payload.companies || []).find((c: any) => c.id === company.id);

      if (data) {
        setSettings(data as any);
        setLogoPreview(data.logo_url);
        companyForm.reset({
          name: data.name,
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          city: data.city || '',
          country: data.country || 'Uganda',
          tax_id: data.tax_id || '',
          registration_number: data.registration_number || '',
          website: data.website || '',
          logo_url: data.logo_url || '',
        });
        financialForm.reset({
          fiscal_year_start_month: data.fiscal_year_start_month || 1,
          default_payment_terms: data.default_payment_terms || 30,
          sales_tax_rate: Number(data.sales_tax_rate) || 6.25,
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSaveCompany = async (data: CompanyFormData) => {
    if (!company?.id) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/companies/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          company_id: company.id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          country: data.country,
          tax_id: data.tax_id,
          registration_number: data.registration_number,
          website: data.website,
          logo_url: data.logo_url || logoPreview || null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to save settings');
      }

      toast.success('Company settings saved!');
      loadSettings();
      await refreshCompany();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !company?.id) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const publicUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/companies/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          company_id: company.id,
          logo_url: publicUrl,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to upload logo');
      }

      setLogoPreview(publicUrl);
      companyForm.setValue('logo_url', publicUrl);
      toast.success('Logo uploaded successfully!');
      
      // Refresh company context to update the logo everywhere
      await refreshCompany();
      await loadSettings();
    } catch (error: any) {
      console.error('Logo upload error:', error);
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const onSaveFinancial = async (data: FinancialFormData) => {
    if (!company?.id) return;
    
    setSaving(true);
    try {
      const fiscalYearStart = `${data.fiscal_year_start_month.toString().padStart(2, '0')}-01`;
      const response = await fetch('/api/companies/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          company_id: company.id,
          fiscal_year_start: fiscalYearStart,
          default_payment_terms: data.default_payment_terms,
          sales_tax_rate: data.sales_tax_rate,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to save financial settings');
      }

      setSettings((prev) => (prev
        ? {
            ...prev,
            fiscal_year_start: fiscalYearStart,
            default_payment_terms: data.default_payment_terms,
            sales_tax_rate: data.sales_tax_rate,
          } as CompanySettings
        : prev));

      toast.success('Financial settings saved!');
      await loadSettings();
      await refreshCompany();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshExchangeRates = async () => {
    setRefreshingRates(true);
    try {
      const response = await fetch('/api/exchange-rates', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to refresh exchange rates');
      }

      toast.success(`Exchange rates updated! ${data.data?.length || 0} rates refreshed from exchangerate-api.com`);
    } catch (error: any) {
      console.error('Failed to refresh exchange rates:', error);
      toast.error(error.message || 'Failed to refresh exchange rates');
    } finally {
      setRefreshingRates(false);
    }
  };

  const tabs = [
    { id: 'company' as const, label: 'Company', icon: BuildingOfficeIcon },
    { id: 'financial' as const, label: 'Financial', icon: CurrencyDollarIcon },
    { id: 'invoicing' as const, label: 'Invoicing', icon: DocumentTextIcon },
    { id: 'branding' as const, label: 'Branding', icon: PaintBrushIcon },
    { id: 'notifications' as const, label: 'Notifications', icon: BellIcon },
    { id: 'users' as const, label: 'Users', icon: UserGroupIcon },
    { id: 'security' as const, label: 'Security', icon: ShieldCheckIcon },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-blue-500/5 rounded-full blur-xl"></div>
          <div className="absolute bottom-20 right-16 w-24 h-24 bg-blue-400/10 rounded-full blur-lg"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header Skeleton */}
          <div className="bg-white/80 backdrop-blur-xl border border-blue-200 rounded-3xl p-8 shadow-xl mb-8">
            <ShimmerSkeleton className="h-8 w-48 mb-2" />
            <ShimmerSkeleton className="h-5 w-96" />
          </div>
          
          {/* Tabs and Content Skeleton */}
          <div className="bg-white/80 backdrop-blur-xl border border-blue-200 rounded-3xl shadow-xl overflow-hidden">
            {/* Tab Navigation Skeleton */}
            <div className="border-b border-blue-100 px-8 pt-8">
              <div className="flex space-x-8">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <ShimmerSkeleton className="h-5 w-5 rounded" />
                    <ShimmerSkeleton className="h-5 w-20" />
                  </div>
                ))}
              </div>
            </div>
            
            {/* Form Content Skeleton */}
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <FormFieldSkeleton key={i} />
                ))}
              </div>
              
              {/* Action Buttons Skeleton */}
              <div className="flex space-x-4 pt-6">
                <ShimmerSkeleton className="h-12 w-32" />
                <ShimmerSkeleton className="h-12 w-24" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-500/5 rounded-full blur-xl"></div>
        <div className="absolute top-60 right-16 w-24 h-24 bg-blue-400/10 rounded-full blur-lg"></div>
        <div className="absolute bottom-40 left-1/3 w-20 h-20 bg-gradient-to-r from-blue-500/5 to-blue-400/5 rounded-full blur-xl"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto py-8 px-6 space-y-8">
        {/* Hero Header */}
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-3 bg-white/70 backdrop-blur-xl border border-blue-200 rounded-2xl px-6 py-3 shadow-lg mb-6">
            <CogIcon className="w-6 h-6 text-black" />
            <span className="text-black font-semibold">System Configuration</span>
          </div>
          
          <h1 className="text-3xl lg:text-4xl font-bold text-black mb-4 leading-tight">
            Company Settings
          </h1>
          
          <p className="text-lg text-black mb-8 max-w-2xl">
            Configure your business information, financial settings, and platform preferences
          </p>
        </div>

        <div className="flex flex-col xl:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="xl:w-80 shrink-0">
            <div className="bg-white/80 backdrop-blur-xl border border-blue-200 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <SparklesIcon className="w-5 h-5 text-black" />
                <h3 className="text-lg font-bold text-black">Settings Menu</h3>
              </div>
              
              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-left transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-gray-100 to-gray-200 text-black border border-gray-300 shadow-md'
                          : 'text-black hover:bg-gray-100 hover:text-black'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        isActive 
                          ? 'bg-gradient-to-r from-blue-600 to-blue-500'
                          : 'bg-gray-100'
                      }`}>
                        <tab.icon className={`w-4 h-4 ${
                          isActive ? 'text-white' : 'text-black'
                        }`} />
                      </div>
                      <span className="font-semibold">{tab.label}</span>
                    </button>
                  );
                })}
                
                {/* External Link to Fiscal Periods */}
                <Link
                  href="/dashboard/settings/fiscal-periods"
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-left transition-all duration-300 text-black hover:bg-gray-100 hover:text-black group"
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-gray-100">
                    <LockClosedIcon className="w-4 h-4 text-black" />
                  </div>
                  <span className="font-semibold flex-1">Fiscal Periods</span>
                  <ArrowTopRightOnSquareIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1">
            <div className="bg-white/80 backdrop-blur-xl border border-blue-200 rounded-3xl shadow-xl overflow-hidden">
              {/* Company Settings */}
              {activeTab === 'company' && (
            <form onSubmit={companyForm.handleSubmit(onSaveCompany)}>
              <div className="bg-gradient-to-r from-blue-500/5 to-blue-400/5 px-8 py-6 border-b border-blue-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500/20 to-blue-400/20 rounded-xl flex items-center justify-center">
                    <BuildingOfficeIcon className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-black">Company Information</h2>
                    <p className="text-gray-900 mt-1">
                      Basic information and branding for your business
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="p-8 space-y-8">
                {/* Logo Upload Section */}
                <div className="bg-gradient-to-r from-gray-50/50 to-blue-50/50 rounded-2xl p-6 border border-gray-200/50">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg flex items-center justify-center">
                      <PaintBrushIcon className="w-4 h-4 text-black" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Company Logo</h3>
                  </div>
                  
                  <div className="flex flex-col lg:flex-row items-start gap-8">
                    <div className="flex-shrink-0">
                      {logoPreview ? (
                        <div className="relative group">
                          <Image
                            src={logoPreview}
                            alt="Company logo"
                            width={140}
                            height={140}
                            className="rounded-2xl border-2 border-gray-200 object-contain bg-white shadow-lg group-hover:shadow-xl transition-all duration-300"
                          />
                          <div className="absolute inset-0 bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <span className="text-white text-sm font-medium">Click to change</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-[140px] h-[140px] rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 hover:from-blue-50 hover:to-cyan-50 transition-all duration-300">
                          <div className="text-center">
                            <PaintBrushIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <span className="text-gray-900 text-sm font-medium">No logo</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      <label className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-8 py-3 rounded-2xl font-semibold cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:scale-100">
                        <SparklesIcon className="w-4 h-4" />
                        {uploadingLogo ? 'Uploading Logo...' : 'Upload New Logo'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          disabled={uploadingLogo}
                          className="hidden"
                        />
                      </label>
                      
                      <div className="space-y-2 text-sm text-gray-900">
                        <p className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                          Recommended: Square image (1:1 aspect ratio)
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                          Formats: PNG, JPG, or SVG files
                        </p>
                        <p className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                          Maximum size: 2MB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Basic Information Section */}
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg flex items-center justify-center">
                      <DocumentTextIcon className="w-4 h-4 text-black" />
                    </div>
                    <h3 className="text-lg font-bold text-black">Basic Information</h3>
                  </div>
                  
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-black flex items-center gap-2">
                        Company Name *
                        <span className="text-red-500">•</span>
                      </label>
                      <input
                        type="text"
                        {...companyForm.register('name', { required: true })}
                        className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-blue-400"
                        placeholder="Your company name"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-black">Email Address</label>
                      <input
                        type="email"
                        {...companyForm.register('email')}
                        className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
                        placeholder="contact@company.com"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-black">Phone Number</label>
                      <input
                        type="tel"
                        {...companyForm.register('phone')}
                        className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-black">Website</label>
                      <input
                        type="url"
                        {...companyForm.register('website')}
                        className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
                        placeholder="https://company.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200"></div>

                {/* Registration Details Section */}
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg flex items-center justify-center">
                      <ShieldCheckIcon className="w-4 h-4 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Registration Details</h3>
                  </div>
                  
                  <div className="grid lg:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-black">Tax ID</label>
                      <input
                        type="text"
                        {...companyForm.register('tax_id')}
                        className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
                        placeholder="Tax identification number"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-black">Registration Number</label>
                      <input
                        type="text"
                        {...companyForm.register('registration_number')}
                        className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
                        placeholder="Company registration number"
                      />
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200"></div>

                {/* Address Section */}
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-lg flex items-center justify-center">
                      <BuildingOfficeIcon className="w-4 h-4 text-black" />
                    </div>
                    <h3 className="text-lg font-bold text-black">Business Address</h3>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-black">Street Address</label>
                      <input
                        type="text"
                        {...companyForm.register('address')}
                        className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
                        placeholder="123 Business Street"
                      />
                    </div>
                    
                    <div className="grid lg:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-black">City</label>
                        <input
                          type="text"
                          {...companyForm.register('city')}
                          className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
                          placeholder="City name"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-black">Country</label>
                        <input
                          type="text"
                          {...companyForm.register('country')}
                          className="w-full px-4 py-3 bg-white/80 backdrop-blur-sm border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blueox-primary focus:border-transparent transition-all duration-300 hover:border-blueox-primary/40"
                          placeholder="Country name"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Save Button */}
                <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-8 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:scale-100"
                  >
                    <SparklesIcon className="w-4 h-4" />
                    {saving ? 'Saving Changes...' : 'Save Company Settings'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Financial Settings */}
          {activeTab === 'financial' && (
            <form onSubmit={financialForm.handleSubmit(onSaveFinancial)} className="card">
              <div className="card-header">
                <h2 className="font-semibold text-black">Financial Settings</h2>
                <p className="text-sm text-black mt-1">
                  Configure fiscal year and default values
                </p>
              </div>
              <div className="card-body space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Fiscal Year Start Month</label>
                    <select {...financialForm.register('fiscal_year_start_month', { valueAsNumber: true })} className="input">
                      <option value={1}>January</option>
                      <option value={2}>February</option>
                      <option value={3}>March</option>
                      <option value={4}>April</option>
                      <option value={5}>May</option>
                      <option value={6}>June</option>
                      <option value={7}>July</option>
                      <option value={8}>August</option>
                      <option value={9}>September</option>
                      <option value={10}>October</option>
                      <option value={11}>November</option>
                      <option value={12}>December</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Default Payment Terms (days)</label>
                    <input
                      type="number"
                      {...financialForm.register('default_payment_terms', { valueAsNumber: true })}
                      className="input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Default Tax Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    {...financialForm.register('sales_tax_rate', { valueAsNumber: true })}
                    className="input max-w-xs"
                  />
                  <p className="text-sm text-black mt-1">
                    Massachusetts sales tax is 6.25%
                  </p>
                </div>

                <div className="p-4 bg-gray-100 border border-gray-300 rounded-lg">
                  <h4 className="font-medium text-black">Base Currency</h4>
                  <p className="text-sm text-black mt-1">
                    USD (US Dollar) - Contact support to change base currency
                  </p>
                </div>

                <div className="p-4 bg-gray-100 border border-gray-300 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <BookOpenIcon className="w-5 h-5 text-black" />
                        <h4 className="font-medium text-black">Chart of Accounts</h4>
                      </div>
                      <p className="text-sm text-black">
                        View all account numbers and categories for bills, expenses, and transactions
                      </p>
                    </div>
                    <Link 
                      href="/dashboard/chart-of-accounts"
                      className="btn-secondary whitespace-nowrap ml-4"
                    >
                      <BookOpenIcon className="w-4 h-4 mr-2" />
                      View Chart
                      <ArrowTopRightOnSquareIcon className="w-4 h-4 ml-2" />
                    </Link>
                  </div>
                </div>

                <hr />

                <div>
                  <h3 className="font-medium text-black mb-2">Exchange Rates</h3>
                  <p className="text-sm text-black mb-4">
                    Multi-currency support with automatic exchange rate updates from exchangerate-api.com
                  </p>
                  <button
                    type="button"
                    onClick={handleRefreshExchangeRates}
                    disabled={refreshingRates}
                    className="btn-secondary"
                  >
                    {refreshingRates ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Refreshing...
                      </>
                    ) : (
                      'Refresh Exchange Rates'
                    )}
                  </button>
                  <p className="text-xs text-black mt-2">
                    Last updated rates are cached in database. Click to fetch latest rates for USD, EUR, GBP, and UGX.
                  </p>
                </div>
              </div>
              <div className="card-footer flex justify-end">
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {/* Invoicing Settings */}
          {activeTab === 'invoicing' && (
            <div className="card">
              <div className="card-header">
                <h2 className="font-semibold text-black">Invoice Settings</h2>
                <p className="text-sm text-black mt-1">
                  Customize invoice appearance and numbering
                </p>
              </div>
              <div className="card-body space-y-6">
                <div className="form-group">
                  <label className="label">Invoice Number Prefix</label>
                  <input type="text" className="input max-w-xs" defaultValue="INV-" />
                </div>
                <div className="form-group">
                  <label className="label">Next Invoice Number</label>
                  <input type="number" className="input max-w-xs" defaultValue="1001" />
                </div>
                <div className="form-group">
                  <label className="label">Default Invoice Notes</label>
                  <textarea
                    className="input min-h-[100px]"
                    placeholder="Thank you for your business!"
                    defaultValue="Thank you for your business! Payment is due within the terms specified above."
                  />
                </div>
                <div className="form-group">
                  <label className="label">Default Invoice Terms</label>
                  <textarea
                    className="input min-h-[100px]"
                    placeholder="Payment terms and conditions..."
                  />
                </div>
              </div>
              <div className="card-footer flex justify-end">
                <button className="btn-primary">Save Changes</button>
              </div>
            </div>
          )}

          {/* Branding */}
          {activeTab === 'branding' && (
            <div className="card">
              <div className="card-header">
                <h2 className="font-semibold text-black">Branding</h2>
                <p className="text-sm text-black mt-1">
                  Upload your logo and customize appearance
                </p>
              </div>
              <div className="card-body space-y-6">
                <div className="form-group">
                  <label className="label">Company Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                      {settings?.logo_url ? (
                        <Image
                          src={settings.logo_url}
                          alt="Logo"
                          width={96}
                          height={96}
                          className="object-contain"
                        />
                      ) : (
                        <PaintBrushIcon className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <button type="button" className="btn-secondary">
                        Upload Logo
                      </button>
                      <p className="text-sm text-black mt-2">
                        PNG, JPG up to 2MB. Recommended size: 200x200px
                      </p>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Brand Colors</label>
                  <div className="flex gap-4">
                    <div>
                      <label className="text-sm text-black">Primary (Navy)</label>
                      <div className="w-12 h-12 rounded-lg bg-navy-600 border border-gray-200 mt-1" />
                    </div>
                    <div>
                      <label className="text-sm text-black">Accent (Magenta)</label>
                      <div className="w-12 h-12 rounded-lg bg-magenta-600 border border-gray-200 mt-1" />
                    </div>
                    <div>
                      <label className="text-sm text-black">Secondary (Purple)</label>
                      <div className="w-12 h-12 rounded-lg bg-purple-600 border border-gray-200 mt-1" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="card-footer flex justify-end">
                <button className="btn-primary">Save Changes</button>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div className="card">
              <div className="card-header">
                <h2 className="font-semibold text-black">Notification Preferences</h2>
                <p className="text-sm text-black mt-1">
                  Control when and how you receive notifications
                </p>
              </div>
              <div className="card-body space-y-4">
                {[
                  { label: 'Invoice paid', description: 'When a customer pays an invoice' },
                  { label: 'Invoice overdue', description: 'When an invoice becomes overdue' },
                  { label: 'Bill due soon', description: 'Reminder before a bill is due' },
                  { label: 'Low stock alert', description: 'When inventory falls below reorder point' },
                  { label: 'Bank reconciliation', description: 'Weekly reconciliation reminders' },
                ].map((item) => (
                  <label key={item.label} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg cursor-pointer">
                    <input type="checkbox" defaultChecked className="mt-1" />
                    <div>
                      <p className="font-medium text-black">{item.label}</p>
                      <p className="text-sm text-black">{item.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="card-footer flex justify-end">
                <button className="btn-primary">Save Changes</button>
              </div>
            </div>
          )}

          {/* Users */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              {/* Invite Modal */}
              {showInviteModal && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                    <div className="flex items-center justify-between p-6 border-b border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900">Invite Team Member</h3>
                      <button onClick={() => setShowInviteModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
                        <XMarkIcon className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                    <form onSubmit={handleSendInvite} className="p-6 space-y-4">
                      <div className="form-group">
                        <label className="label">Email Address *</label>
                        <input
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="input"
                          placeholder="colleague@company.com"
                        />
                      </div>
                      <div className="form-group">
                        <label className="label">Role *</label>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="input"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-400 mt-1">This sets what the user can access in your company.</p>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowInviteModal(false)}
                          className="btn-secondary flex-1"
                        >
                          Cancel
                        </button>
                        <button type="submit" disabled={sendingInvite} className="btn-primary flex-1">
                          {sendingInvite ? 'Sending...' : 'Send Invitation'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Team Members */}
              <div className="card">
                <div className="card-header flex justify-between items-center">
                  <div>
                    <h2 className="font-semibold text-black">Team Members</h2>
                    <p className="text-sm text-gray-500 mt-1">People with access to your company</p>
                  </div>
                  <button onClick={() => setShowInviteModal(true)} className="btn-primary flex items-center gap-2">
                    <PlusIcon className="w-4 h-4" />
                    Invite User
                  </button>
                </div>
                <div className="card-body">
                  {loadingTeam ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="text-center py-8">
                      <UserGroupIcon className="w-12 h-12 mx-auto text-gray-300" />
                      <p className="mt-2 text-gray-500">No team members yet</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {teamMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blueox-primary to-blueox-accent flex items-center justify-center text-white text-sm font-semibold">
                              {(member.full_name || member.email)[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {member.full_name || member.email}
                                {member.is_primary && (
                                  <span className="ml-2 text-xs bg-blueox-primary/10 text-blueox-primary px-2 py-0.5 rounded-full">Owner</span>
                                )}
                              </p>
                              <p className="text-xs text-gray-400">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[member.company_role] || 'bg-gray-100 text-gray-600'}`}>
                              {ROLE_OPTIONS.find(r => r.value === member.company_role)?.label || member.company_role}
                            </span>
                            <span className="text-xs text-gray-400">
                              {member.last_login_at ? `Last seen ${new Date(member.last_login_at).toLocaleDateString()}` : 'Never logged in'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pending Invitations */}
              {(pendingInvitations.length > 0 || loadingTeam) && (
                <div className="card">
                  <div className="card-header">
                    <h2 className="font-semibold text-black">Pending Invitations</h2>
                    <p className="text-sm text-gray-500 mt-1">Awaiting acceptance</p>
                  </div>
                  <div className="card-body">
                    {loadingTeam ? (
                      <div className="space-y-3">
                        <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {pendingInvitations.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                                <ClockIcon className="w-5 h-5 text-amber-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{inv.email}</p>
                                <p className="text-xs text-gray-400">
                                  Invited by {inv.invited_by_name || 'Admin'} &middot; Expires {new Date(inv.expires_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[inv.role] || 'bg-gray-100 text-gray-600'}`}>
                                {ROLE_OPTIONS.find(r => r.value === inv.role)?.label || inv.role}
                              </span>
                              <button
                                onClick={() => handleRevokeInvitation(inv.token)}
                                disabled={revokingToken === inv.token}
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Revoke invitation"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Security */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="card">
                <div className="card-header">
                  <h2 className="font-semibold text-black">Password</h2>
                </div>
                <div className="card-body space-y-4">
                  <div className="form-group">
                    <label className="label">Current Password</label>
                    <input type="password" className="input max-w-md" />
                  </div>
                  <div className="form-group">
                    <label className="label">New Password</label>
                    <input type="password" className="input max-w-md" />
                  </div>
                  <div className="form-group">
                    <label className="label">Confirm New Password</label>
                    <input type="password" className="input max-w-md" />
                  </div>
                </div>
                <div className="card-footer flex justify-end">
                  <button className="btn-primary">Update Password</button>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2 className="font-semibold text-black">Two-Factor Authentication</h2>
                </div>
                <div className="card-body">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-black">2FA is not enabled</p>
                      <p className="text-sm text-black">
                        Add an extra layer of security to your account
                      </p>
                    </div>
                    <button className="btn-secondary">Enable 2FA</button>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h2 className="font-semibold text-black">Active Sessions</h2>
                </div>
                <div className="card-body">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Current Session</p>
                      <p className="text-sm text-black">Windows • Chrome • Active now</p>
                    </div>
                    <span className="badge badge-success">Current</span>
                  </div>
                </div>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

