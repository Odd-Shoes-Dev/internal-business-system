'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/company-context';
import { FilterSearchBar } from '@/components/ui';
import {
  PlusIcon,
  BanknotesIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import type { BankAccount } from '@/types/database';

export default function BankAccountsPage() {
  const router = useRouter();
  const { company } = useCompany();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAccounts();
  }, [filter, company?.id]);

  const loadAccounts = async () => {
    try {
      if (!company?.id) {
        return;
      }

      setLoading(true);
      const params = new URLSearchParams();
      params.append('company_id', company.id);
      if (filter !== 'all') {
        params.append('active', filter === 'active' ? 'true' : 'false');
      }

      const response = await fetch(`/api/bank-accounts?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load bank accounts');
      }

      const result = await response.json();
      setAccounts(result.data || []);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter((account) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      account.name.toLowerCase().includes(q) ||
      account.bank_name?.toLowerCase().includes(q) ||
      account.currency?.toLowerCase().includes(q) ||
      account.account_type?.toLowerCase().includes(q)
    );
  });

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
      </div>

      <div className="relative max-w-6xl mx-auto py-8 px-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 bg-white/80 backdrop-blur-xl border border-blueox-primary/20 hover:border-blueox-primary/40 rounded-xl transition-all duration-300"
              title="Go back"
            >
              <ArrowLeftIcon className="w-5 h-5 text-blueox-primary" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-blueox-primary-dark">Bank Accounts</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage your company&apos;s bank accounts
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/bank/accounts/new"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-5 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
          >
            <PlusIcon className="w-5 h-5" />
            Add Account
          </Link>
        </div>

        {/* Search + Filters */}
        <FilterSearchBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by account name, bank, currency..."
          filters={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'all', label: 'All' },
          ]}
          activeFilter={filter}
          onFilterChange={(v) => setFilter(v as 'all' | 'active' | 'inactive')}
        />

        {/* Accounts Grid */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
          {filteredAccounts.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
                <BanknotesIcon className="w-10 h-10 text-blueox-primary" />
              </div>
              <h3 className="text-xl font-bold text-blueox-primary-dark mb-2">No bank accounts found</h3>
              <p className="text-gray-600 mb-8">
                {search.trim()
                  ? `No accounts match "${search.trim()}".`
                  : (
                    <>
                      {filter === 'active' && 'No active bank accounts. Add one to get started.'}
                      {filter === 'inactive' && 'No inactive bank accounts.'}
                      {filter === 'all' && 'No bank accounts set up yet.'}
                    </>
                  )}
              </p>
              {!search.trim() && filter !== 'inactive' && (
                <Link
                  href="/dashboard/bank/accounts/new"
                  className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
                >
                  <PlusIcon className="w-5 h-5" />
                  Add Bank Account
                </Link>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {filteredAccounts.map((account) => (
                <Link
                  key={account.id}
                  href={`/dashboard/bank/accounts/${account.id}`}
                  className="block p-5 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl hover:border-blueox-primary/40 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{account.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{account.bank_name}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Type:</span>
                      <span className="text-gray-900 font-medium capitalize">
                        {account.account_type.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Currency:</span>
                      <span className="text-gray-900 font-medium">{account.currency}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    {account.is_primary && (
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-xl">
                        Primary
                      </span>
                    )}
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-xl ${
                      account.is_active
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
