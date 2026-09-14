'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { useCompany } from '@/contexts/company-context';
import {
  PlusIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import type { BankTransaction, BankAccount } from '@/types/database';

type TransactionWithAccount = BankTransaction & {
  bank_accounts?: BankAccount;
};

export default function BankTransactionsPage() {
  const router = useRouter();
  const { company } = useCompany();
  const [transactions, setTransactions] = useState<TransactionWithAccount[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [reconcileFilter, setReconcileFilter] = useState<string>('all');
  const [stats, setStats] = useState({
    totalDeposits: 0,
    totalWithdrawals: 0,
    unreconciledCount: 0,
  });

  useEffect(() => {
    loadAccounts();
  }, [company?.id]);

  useEffect(() => {
    loadTransactions();
    loadStats();
  }, [selectedAccount, selectedType, reconcileFilter, company?.id]);

  const loadAccounts = async () => {
    try {
      if (!company?.id) {
        return;
      }

      const response = await fetch(`/api/bank-accounts?company_id=${company.id}&active=true`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load accounts');
      }

      const result = await response.json();
      setAccounts(result.data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      if (!company?.id) {
        return;
      }

      setLoading(true);
      const params = new URLSearchParams();
      params.append('company_id', company.id);
      if (selectedAccount !== 'all') params.append('account_id', selectedAccount);
      if (selectedType !== 'all') params.append('type', selectedType);
      if (reconcileFilter !== 'all') params.append('reconciled', reconcileFilter);

      const response = await fetch(`/api/bank-transactions?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load transactions');
      }

      const result = await response.json();
      setTransactions(result.data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      if (!company?.id) {
        return;
      }

      const params = new URLSearchParams();
      params.append('company_id', company.id);
      if (selectedAccount !== 'all') params.append('account_id', selectedAccount);
      if (selectedType !== 'all') params.append('type', selectedType);
      if (reconcileFilter !== 'all') params.append('reconciled', reconcileFilter);

      const response = await fetch(`/api/bank-transactions/stats?${params.toString()}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, (company?.currency || 'USD') as any);
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
      </div>

      <div className="relative max-w-6xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 bg-white/80 backdrop-blur-xl border border-blueox-primary/20 hover:border-blueox-primary/40 rounded-xl transition-all duration-300"
            title="Go back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-blueox-primary" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-blueox-primary-dark">Bank Transactions</h1>
            <p className="text-sm text-gray-600 mt-1">
              View and manage all bank transactions
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Link
            href="/dashboard/bank/transactions/new?type=deposit"
            className="inline-flex items-center justify-center gap-2 flex-1 sm:flex-none bg-white/80 backdrop-blur-xl border border-blueox-primary/20 hover:border-blueox-primary/40 px-4 py-2.5 rounded-2xl font-semibold text-blueox-primary transition-all duration-300 hover:shadow-lg"
          >
            <ArrowUpIcon className="w-5 h-5" />
            Deposit
          </Link>
          <Link
            href="/dashboard/bank/transactions/new?type=withdrawal"
            className="inline-flex items-center justify-center gap-2 flex-1 sm:flex-none bg-white/80 backdrop-blur-xl border border-blueox-primary/20 hover:border-blueox-primary/40 px-4 py-2.5 rounded-2xl font-semibold text-blueox-primary transition-all duration-300 hover:shadow-lg"
          >
            <ArrowDownIcon className="w-5 h-5" />
            Withdrawal
          </Link>
          <Link
            href="/dashboard/bank/transactions/new"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-5 py-2.5 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
          >
            <PlusIcon className="w-5 h-5" />
            Add Transaction
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <FunnelIcon className="w-5 h-5 text-blueox-primary" />
            <h3 className="font-semibold text-blueox-primary-dark">Filters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bank Account
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full rounded-xl border border-blueox-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary/30 bg-white/80"
              >
                <option value="all">All Accounts</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transaction Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full rounded-xl border border-blueox-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary/30 bg-white/80"
              >
                <option value="all">All Types</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
                <option value="transfer">Transfers</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reconciliation Status
              </label>
              <select
                value={reconcileFilter}
                onChange={(e) => setReconcileFilter(e.target.value)}
                className="w-full rounded-xl border border-blueox-primary/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blueox-primary/30 bg-white/80"
              >
                <option value="all">All</option>
                <option value="reconciled">Reconciled</option>
                <option value="unreconciled">Unreconciled</option>
              </select>
            </div>
          </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-blueox-primary/5 border-b border-blueox-primary/10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/dashboard/bank/transactions/${transaction.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.transaction_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {transaction.bank_accounts?.name || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {transaction.bank_accounts?.bank_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {transaction.description || '-'}
                      </div>
                      {transaction.reference_number && (
                        <div className="text-xs text-gray-500">
                          Ref: {transaction.reference_number}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded-full ${
                          transaction.transaction_type === 'deposit' 
                            ? 'bg-green-100 text-green-600' 
                            : transaction.transaction_type === 'withdrawal'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}>
                          {transaction.transaction_type === 'deposit' ? (
                            <ArrowUpIcon className="w-3 h-3" />
                          ) : (
                            <ArrowDownIcon className="w-3 h-3" />
                          )}
                        </div>
                        <span className="text-sm text-gray-700 capitalize">
                          {transaction.transaction_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`text-sm font-medium ${
                        transaction.transaction_type === 'deposit' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {transaction.transaction_type === 'deposit' ? '+' : '-'}
                        {formatCurrency(Math.abs(transaction.amount))}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        transaction.is_reconciled
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {transaction.is_reconciled ? 'Reconciled' : 'Unreconciled'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden">
          {transactions.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500">
              No transactions found
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => router.push(`/dashboard/bank/transactions/${transaction.id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`p-1.5 rounded-full ${
                          transaction.transaction_type === 'deposit' 
                            ? 'bg-green-100 text-green-600' 
                            : transaction.transaction_type === 'withdrawal'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}>
                          {transaction.transaction_type === 'deposit' ? (
                            <ArrowUpIcon className="w-3 h-3" />
                          ) : (
                            <ArrowDownIcon className="w-3 h-3" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {transaction.transaction_type}
                        </span>
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded ${
                          transaction.is_reconciled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {transaction.is_reconciled ? 'R' : 'U'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 font-medium mb-1">
                        {transaction.description || 'Transaction'}
                      </p>
                      <div className="text-xs text-gray-500">
                        {transaction.bank_accounts?.name || 'N/A'}
                      </div>
                      {transaction.reference_number && (
                        <div className="text-xs text-gray-400 mt-1">
                          Ref: {transaction.reference_number}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className={`text-lg font-semibold ${
                        transaction.transaction_type === 'deposit' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {transaction.transaction_type === 'deposit' ? '+' : '-'}
                        {formatCurrency(Math.abs(transaction.amount))}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(transaction.transaction_date)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg">
            <p className="text-sm font-medium text-gray-600 mb-2">Total Deposits (USD)</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(stats.totalDeposits)}
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg">
            <p className="text-sm font-medium text-gray-600 mb-2">Total Withdrawals (USD)</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(stats.totalWithdrawals)}
            </p>
          </div>
          <div className="bg-white/80 backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6 shadow-lg">
            <p className="text-sm font-medium text-gray-600 mb-2">Unreconciled</p>
            <p className="text-2xl font-bold text-amber-600">
              {stats.unreconciledCount}
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

