'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { useCompany } from '@/contexts/company-context';
import {
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  BanknotesIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import { FitNumber } from '@/components/ui/fit-number';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_type: string;
  routing_number: string;
  wire_routing_number: string;
  currency: string;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
}

interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  reference_number: string;
  amount: number;
  transaction_type: string;
  is_reconciled: boolean;
}

export default function BankAccountDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { company } = useCompany();
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadAccount();
    loadTransactions();
  }, [id, company?.id]);

  const loadAccount = async () => {
    try {
      const response = await fetch(`/api/bank-accounts/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load bank account');
      }

      const result = await response.json();
      setAccount(result.data || null);
    } catch (error) {
      console.error('Failed to load bank account:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      if (!company?.id) {
        return;
      }

      const response = await fetch(
        `/api/bank-transactions?company_id=${company.id}&account_id=${id}&limit=50`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        throw new Error('Failed to load transactions');
      }

      const result = await response.json();
      setTransactions(result.data || []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  };

  const accountCurrency = account?.currency || company?.currency || 'USD';

  const formatCurrency = (amount: number) => {
    return currencyFormatter(Math.abs(amount), accountCurrency as any);
  };

  const calculateBalance = () => {
    return transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${account?.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`/api/bank-accounts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete bank account');
      }

      alert('Bank account deleted successfully');
      window.location.href = '/dashboard/bank/accounts';
    } catch (error) {
      console.error('Failed to delete bank account:', error);
      alert('Failed to delete bank account. It may have associated transactions.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blueox-primary/20 border-t-blueox-primary" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Bank account not found</p>
          <Link
            href="/dashboard/bank/accounts"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
          >
            Back to Accounts
          </Link>
        </div>
      </div>
    );
  }

  const balance = calculateBalance();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blueox-primary/5 rounded-full blur-xl"></div>
        <div className="absolute top-60 right-16 w-24 h-24 bg-blueox-accent/10 rounded-full blur-lg"></div>
      </div>

      <div className="relative max-w-5xl mx-auto py-8 px-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 bg-white/80 backdrop-blur-xl border border-blueox-primary/20 hover:border-blueox-primary/40 rounded-xl transition-all duration-300"
              title="Go back"
            >
              <ArrowLeftIcon className="w-5 h-5 text-blueox-primary" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-blueox-primary-dark">{account.name}</h1>
              <p className="text-gray-600 mt-1">{account.bank_name}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/dashboard/bank/accounts/${id}/edit`}
              className="p-2 bg-white/80 backdrop-blur-xl border border-blueox-primary/20 hover:border-blueox-primary/40 rounded-xl transition-all duration-300"
            >
              <PencilIcon className="w-5 h-5 text-blueox-primary" />
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 bg-white/80 backdrop-blur-xl border border-red-200 hover:border-red-400 rounded-xl transition-all duration-300 text-red-600 disabled:opacity-50"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Balance + Account Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
          <div className="md:col-span-1 bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg flex flex-col justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Current Balance</p>
              <FitNumber
                value={`${balance < 0 ? '-' : ''}${formatCurrency(balance)}`}
                className={`font-bold ${balance < 0 ? 'text-red-600' : 'text-blueox-primary-dark'}`}
              />
            </div>
            <BanknotesIcon className="w-10 h-10 text-blueox-primary/30 mt-4" />
          </div>

          <div className="md:col-span-2 bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl p-6 shadow-lg">
            <h2 className="text-sm font-semibold text-blueox-primary-dark mb-4 uppercase tracking-wide">Account Information</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Account Type</p>
                <p className="text-sm text-gray-900 font-medium capitalize">{account.account_type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Currency</p>
                <p className="text-sm text-gray-900 font-medium">{account.currency}</p>
              </div>
              {account.routing_number && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Routing Number</p>
                  <p className="text-sm text-gray-900 font-medium">{account.routing_number}</p>
                </div>
              )}
              {account.wire_routing_number && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Wire Routing Number</p>
                  <p className="text-sm text-gray-900 font-medium">{account.wire_routing_number}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 mb-1">Status</p>
                <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-xl ${
                  account.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {account.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Primary Account</p>
                <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-xl ${
                  account.is_primary ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {account.is_primary ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl overflow-hidden">
          <div className="flex justify-between items-center p-6 border-b border-blueox-primary/10">
            <h3 className="text-xl font-bold text-blueox-primary-dark">Recent Transactions</h3>
            <Link
              href="/dashboard/bank/transactions"
              className="text-sm text-blueox-primary hover:text-blueox-primary-hover font-semibold hover:underline transition-all duration-200"
            >
              View All →
            </Link>
          </div>

          {transactions.length === 0 ? (
            <div className="text-center py-16">
              <BanknotesIcon className="w-12 h-12 text-blueox-primary/30 mx-auto mb-3" />
              <p className="text-gray-500">No transactions found</p>
            </div>
          ) : (
            <div className="p-6 space-y-3">
              {transactions.map((transaction) => {
                const isIncoming = transaction.transaction_type === 'deposit' || transaction.transaction_type === 'transfer_in' || transaction.transaction_type === 'credit';
                return (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm border border-blueox-primary/10 rounded-2xl hover:border-blueox-primary/20 hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${isIncoming ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {isIncoming ? <ArrowUpIcon className="w-5 h-5" /> : <ArrowDownIcon className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{transaction.description || 'Transaction'}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {new Date(transaction.transaction_date).toLocaleDateString()}
                          {transaction.reference_number ? ` • ${transaction.reference_number}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-lg ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>
                        {isIncoming ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold mt-1 ${
                        transaction.is_reconciled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {transaction.is_reconciled ? 'Reconciled' : 'Pending'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
