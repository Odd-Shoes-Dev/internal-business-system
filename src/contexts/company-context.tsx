'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// Types
interface Company {
  id: string;
  name: string;
  subdomain: string | null;
  role?: string;
  is_primary?: boolean;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  currency: string;
  subscription_status: string;
  subscription_plan: string;
  tax_id: string | null;
  registration_number: string | null;
  duns_number: string | null;
  region?: 'AFRICA' | 'ASIA' | 'EU' | 'GB' | 'US' | 'DEFAULT';
  sales_tax_rate: number | null;
  income_tax_rate: number;
  nssf_employee_rate: number;
  nssf_employer_rate: number;
  default_payment_terms: number | null;
  fiscal_year_start: string | null;
  fiscal_year_start_month: number | null;
  city: string | null;
  country: string | null;
  website: string | null;
  trial_ends_at?: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
}

interface CompanyContextType {
  user: SessionUser | null;
  company: Company | null;
  companies: Company[];
  switchCompany: (companyId: string) => Promise<void>;
  companyModules: string[];
  loading: boolean;
  refreshCompany: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyModules, setCompanyModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserCompanies();
  }, []);

  async function loadUserCompanies() {
    try {
      setLoading(true);

      // Ask for the last-used company up front so the modules returned belong to it.
      // The API ignores an id the user is not a member of.
      const storedCompanyId = localStorage.getItem('currentCompanyId');
      const url = storedCompanyId
        ? `/api/companies/me?company_id=${encodeURIComponent(storedCompanyId)}`
        : '/api/companies/me';
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (response.status === 401) {
        setUser(null);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        console.error('Error loading companies:', payload?.error || 'Request failed');
        setLoading(false);
        return;
      }

      const payload = await response.json();
      setUser(payload?.user || null);
      const userCompanies = payload?.companies || [];

      if (!userCompanies || userCompanies.length === 0) {
        // User has no companies - redirect to plan selection
        router.push('/signup/select-plan');
        setLoading(false);
        return;
      }

      // Extract companies
      const companiesList = userCompanies as Company[];
      setCompanies(companiesList);

      // currentCompanyId is the stored company when the user still belongs to it, else the primary
      const currentCompany =
        companiesList.find((c) => c.id === payload?.currentCompanyId) ||
        companiesList.find((c) => c.is_primary) ||
        companiesList[0];

      setCompany(currentCompany);
      setCompanyModules(payload?.modules || []);

      setLoading(false);
    } catch (error) {
      console.error('Error in loadUserCompanies:', error);
      setLoading(false);
    }
  }

  async function loadModules(companyId: string) {
    try {
      const response = await fetch(`/api/companies/me?company_id=${encodeURIComponent(companyId)}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        console.error('Error loading modules:', payload?.error || 'Request failed');
        return;
      }

      const data = await response.json();

      setCompanyModules(data?.modules || []);
    } catch (error) {
      console.error('Error in loadModules:', error);
    }
  }

  async function switchCompany(companyId: string) {
    try {
      const newCompany = companies.find(c => c.id === companyId);
      
      if (!newCompany) {
        console.error('Company not found:', companyId);
        return;
      }

      setCompany(newCompany);
      await loadModules(companyId);

      // Store in localStorage for persistence
      localStorage.setItem('currentCompanyId', companyId);

      // Refresh the page to reload data for new company
      router.refresh();
    } catch (error) {
      console.error('Error switching company:', error);
    }
  }

  async function refreshCompany() {
    await loadUserCompanies();
  }

  return (
    <CompanyContext.Provider
      value={{ 
        user,
        company, 
        companies, 
        switchCompany, 
        companyModules, 
        loading,
        refreshCompany
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within CompanyProvider');
  }
  return context;
}

// Helper hook to check if a module is enabled
export function useModule(moduleId: string): boolean {
  const { companyModules } = useCompany();
  return companyModules.includes(moduleId);
}
