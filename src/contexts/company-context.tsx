'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';
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
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoading(false);
        return;
      }

      // Get user's companies
      const { data: userCompanies, error } = await supabase
        .from('user_companies')
        .select(`
          company_id,
          is_primary,
          role,
          companies (
            id,
            name,
            subdomain,
            email,
            phone,
            address,
            logo_url,
            currency,
            subscription_status,
            subscription_plan,
            tax_id,
            registration_number,
            region
          )
        `)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error loading companies:', error);
        setLoading(false);
        return;
      }

      if (!userCompanies || userCompanies.length === 0) {
        // User has no companies - redirect to plan selection
        router.push('/signup/select-plan');
        setLoading(false);
        return;
      }

      // Extract companies
      const companiesList = userCompanies.map((uc: any) => uc.companies).filter(Boolean) as Company[];
      setCompanies(companiesList);

      // Get stored company ID from localStorage or use primary
      const storedCompanyId = localStorage.getItem('currentCompanyId');
      let currentCompany: Company | null = null;

      if (storedCompanyId) {
        currentCompany = companiesList.find(c => c.id === storedCompanyId) || null;
      }

      // Fallback to primary company
      if (!currentCompany) {
        const primaryUserCompany = userCompanies.find((uc: any) => uc.is_primary);
        currentCompany = (primaryUserCompany?.companies as unknown as Company) || companiesList[0];
      }

      setCompany(currentCompany);
      
      // Load modules for current company
      if (currentCompany) {
        await loadModules(currentCompany.id);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error in loadUserCompanies:', error);
      setLoading(false);
    }
  }

  async function loadModules(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('subscription_modules')
        .select('module_id')
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (error) {
        console.error('Error loading modules:', error);
        return;
      }

      setCompanyModules(data?.map((m: any) => m.module_id) || []);
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
