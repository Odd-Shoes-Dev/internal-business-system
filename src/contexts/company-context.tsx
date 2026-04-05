'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// Types
interface Company {
  id: string;
  name: string;
  subdomain: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  currency: string;
  subscription_status: string;
  subscription_plan: string;
  tax_id: string | null;
  registration_number: string | null;
  region?: 'AFRICA' | 'ASIA' | 'EU' | 'GB' | 'US' | 'DEFAULT';
}

interface CompanyContextType {
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
      const response = await fetch('/api/companies/me', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.status === 401) {
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

      // Get stored company ID from localStorage or use primary
      const storedCompanyId = localStorage.getItem('currentCompanyId');
      let currentCompany: Company | null = null;

      if (storedCompanyId) {
        currentCompany = companiesList.find(c => c.id === storedCompanyId) || null;
      }

      // Fallback to currently selected/primary company
      if (!currentCompany) {
        currentCompany =
          companiesList.find((c: any) => c.id === payload?.currentCompanyId) ||
          companiesList.find((c: any) => (c as any).is_primary) ||
          companiesList[0];
      }

      setCompany(currentCompany);
      
      // Load modules for current company
      if (currentCompany) {
        setCompanyModules(payload?.modules || []);
      }

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
