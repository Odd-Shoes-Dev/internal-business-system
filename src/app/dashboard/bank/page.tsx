'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { useCompany } from '@/contexts/company-context';
import {
  PlusIcon,
  BanknotesIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsRightLeftIcon,
  SparklesIcon,
  BuildingLibraryIcon,
} from '@heroicons/react/24/outline';
import type { BankAccount, BankTransaction } from '@/types/database';

type BankAccountWithBalance = BankAccount & {
  current_balance?: number;
};

export default function BankPage() {
  const { company } = useCompany();
  const [accounts, setAccounts] = useState<BankAccountWithBalance[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<(BankTransaction & { bank_accounts?: { name: string; currency: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBalance: 0,
    unreconciledCount: 0,
  });

  useEffect(() => {
    loadData();
  }, [company?.id]);

  const loadData = async () => {
    try {
      if (!company?.id) {
        return;
      }

      setLoading(true);
      const companyQuery = `company_id=${company.id}`;

      const [accountsResponse, transactionsResponse, statsResponse] = await Promise.all([
        fetch(`/api/bank-accounts?${companyQuery}&active=true`, { credentials: 'include' }),
        fetch(`/api/bank-transactions?${companyQuery}&limit=10`, { credentials: 'include' }),
        fetch(`/api/bank-transactions/stats?${companyQuery}`, { credentials: 'include' }),
      ]);

      if (!accountsResponse.ok || !transactionsResponse.ok || !statsResponse.ok) {
        throw new Error('Failed to load bank dashboard data');
      }

      const accountsResult = await accountsResponse.json();
      const transactionsResult = await transactionsResponse.json();
      const statsResult = await statsResponse.json();

      const accountsData: BankAccountWithBalance[] = accountsResult.data || [];
      setAccounts(accountsData);

      // Calculate total balance from all bank accounts (convert to USD for now)
      const totalBalance = accountsData.reduce((sum: number, account: BankAccountWithBalance) => {
        return sum + (account.current_balance || 0);
      }, 0) || 0;

      setRecentTransactions(transactionsResult.data || []);

      setStats({
        totalBalance,
        unreconciledCount: statsResult.unreconciledCount || 0,
      });
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return currencyFormatter(amount, currency as any);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

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
            <BuildingLibraryIcon className="w-6 h-6 text-blueox-primary" />
            <span className="text-blueox-primary font-semibold">Cash & Bank Management</span>
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-blueox-primary-dark mb-4 leading-tight">
                Cash & Bank Accounts
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl">
                Manage bank accounts, track transactions, and reconcile statements
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3 justify-center lg:justify-end">
              <Link 
                href="/dashboard/bank/reconcile" 
                className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-xl border border-blueox-primary/20 hover:border-blueox-primary/40 px-5 py-3 rounded-2xl font-semibold text-blueox-primary transition-all duration-300 hover:shadow-lg"
              >
                <ArrowsRightLeftIcon className="w-5 h-5" />
                Reconcile
              </Link>
              <Link 
                href="/dashboard/bank/accounts/new" 
                className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
              >
                <PlusIcon className="w-5 h-5" />
                Add Account
                <SparklesIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-sm font-medium text-gray-600 mb-2">Total Cash Balance</p>
          <p className="text-2xl lg:text-3xl font-bold text-blueox-primary-dark">{formatCurrency(stats.totalBalance)}</p>
          <p className="text-sm text-gray-500 mt-2">Across {accounts.length} accounts</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-sm font-medium text-gray-600 mb-2">Unreconciled</p>
          <p className="text-2xl lg:text-3xl font-bold text-amber-600">{stats.unreconciledCount}</p>
          <p className="text-sm text-gray-500 mt-2">transactions pending</p>
        </div>
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300">
          <p className="text-sm font-medium text-gray-600 mb-2">This Month</p>
          <div className="flex gap-4 mt-1">
            <div>
              <div className="flex items-center gap-1 text-green-600">
                <ArrowUpIcon className="w-4 h-4" />
                <span className="text-lg font-bold">$0</span>
              </div>
              <p className="text-xs text-gray-500">In</p>
            </div>
            <div>
              <div className="flex items-center gap-1 text-red-600">
                <ArrowDownIcon className="w-4 h-4" />
                <span className="text-lg font-bold">$0</span>
              </div>
              <p className="text-xs text-gray-500">Out</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bank Accounts */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-blueox-primary/10">
          <h2 className="text-xl font-bold text-blueox-primary-dark">Bank Accounts</h2>
          <Link 
            href="/dashboard/bank/accounts" 
            className="text-sm text-blueox-primary hover:text-blueox-primary-hover font-semibold hover:underline transition-all duration-200"
          >
            View All →
          </Link>
        </div>
        <div className="p-6">
          {accounts.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
                <BanknotesIcon className="w-10 h-10 text-blueox-primary" />
              </div>
              <h3 className="text-2xl font-bold text-blueox-primary-dark mb-3">No bank accounts set up</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Add your first bank account to start tracking transactions.
              </p>
              <Link 
                href="/dashboard/bank/accounts/new" 
                className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
              >
                <PlusIcon className="w-5 h-5" />
                Add Bank Account
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((account) => (
                <Link
                  key={account.id}
                  href={`/dashboard/bank/accounts/${account.id}`}
                  className="block p-5 bg-white/80 backdrop-blur-sm border border-blueox-primary/20 rounded-2xl hover:border-blueox-primary/40 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{account.name}</h3>
                      <p className="text-sm text-gray-600">{account.bank_name}</p>
                      <p className="text-xs text-gray-500 mt-1 capitalize">{account.account_type}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold ${
                        account.is_primary 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {account.is_primary ? 'Primary' : account.currency}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-blueox-primary/10">
          <h2 className="text-xl font-bold text-blueox-primary-dark">Recent Transactions</h2>
          <Link 
            href="/dashboard/bank/transactions" 
            className="text-sm text-blueox-primary hover:text-blueox-primary-hover font-semibold hover:underline transition-all duration-200"
          >
            View All →
          </Link>
        </div>
        <div className="p-6">
          {recentTransactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No transactions yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((transaction) => {
                const isIncoming = transaction.amount > 0 || transaction.transaction_type === 'deposit' || transaction.transaction_type === 'transfer_in';
                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm border border-blueox-primary/10 rounded-2xl hover:border-blueox-primary/20 hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${
                        isIncoming
                          ? 'bg-green-100 text-green-600' 
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {isIncoming ? (
                          <ArrowUpIcon className="w-5 h-5" />
                        ) : (
                          <ArrowDownIcon className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {transaction.description || 'Transaction'}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {formatDate(transaction.transaction_date)} • {transaction.bank_accounts?.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-lg ${
                        isIncoming ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {isIncoming ? '+' : '-'}
                        {formatCurrency(Math.abs(transaction.amount), transaction.bank_accounts?.currency || 'USD')}
                      </p>
                      {!transaction.is_reconciled && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 mt-1">
                          Unreconciled
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4 lg:gap-6">
        <Link
          href="/dashboard/bank/transactions/new?type=deposit"
          className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <ArrowUpIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Record Deposit</h3>
              <p className="text-sm text-gray-600">Add incoming funds</p>
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/bank/transactions/new?type=withdrawal"
          className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-xl">
              <ArrowDownIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Record Withdrawal</h3>
              <p className="text-sm text-gray-600">Record outgoing funds</p>
            </div>
          </div>
        </Link>
        <Link
          href="/dashboard/bank/transfer"
          className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <ArrowsRightLeftIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 mb-1">Transfer Funds</h3>
              <p className="text-sm text-gray-600">Move between accounts</p>
            </div>
          </div>
        </Link>
      </div>
      </div>
    </div>
  );
}

