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

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

interface BankTransaction {
  id: string;
  bank_account_id: string;
  transaction_date: string;
  transaction_type: string;
  description: string;
  amount: number;
  reference_number: string;
  is_reconciled: boolean;
  created_at: string;
  bank_accounts?: {
    id: string;
    name: string;
    bank_name: string;
  };
}

export default function TransactionDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { company } = useCompany();
  const [transaction, setTransaction] = useState<BankTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadTransaction();
  }, [id]);

  const loadTransaction = async () => {
    try {
      const response = await fetch(`/api/bank-transactions/${id}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load transaction');
      }

      const result = await response.json();
      setTransaction(result.data || null);
    } catch (error) {
      console.error('Failed to load transaction:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`/api/bank-transactions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete transaction');
      }

      alert('Transaction deleted successfully');
      router.push('/dashboard/bank/transactions');
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      alert('Failed to delete transaction. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, company?.currency || 'USD');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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

  if (!transaction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Transaction not found</p>
          <Link
            href="/dashboard/bank/transactions"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-blueox-primary to-blueox-primary-dark hover:from-blueox-primary-hover hover:to-blueox-primary text-black px-6 py-3 rounded-2xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105"
          >
            Back to Transactions
          </Link>
        </div>
      </div>
    );
  }

  const isIncoming = transaction.amount > 0 || transaction.transaction_type === 'deposit' || transaction.transaction_type === 'transfer_in';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blueox-primary/5 rounded-full blur-xl"></div>
        <div className="absolute top-60 right-16 w-24 h-24 bg-blueox-accent/10 rounded-full blur-lg"></div>
      </div>

      <div className="relative max-w-4xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 bg-white/80 backdrop-blur-xl border border-blueox-primary/20 hover:border-blueox-primary/40 rounded-xl transition-all duration-300"
            title="Go back"
          >
            <ArrowLeftIcon className="w-5 h-5 text-blueox-primary" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-blueox-primary-dark">Transaction Details</h1>
            <p className="text-gray-600 mt-1">{formatDate(transaction.transaction_date)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2 bg-white/80 backdrop-blur-xl border border-red-200 hover:border-red-400 rounded-xl transition-all duration-300 text-red-600 disabled:opacity-50"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Transaction Amount Card */}
      <div className={`bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border-2 p-8 text-center ${
        isIncoming ? 'border-green-200' : 'border-red-200'
      }`}>
        <div className={`inline-flex p-4 rounded-full mb-4 ${
          isIncoming ? 'bg-green-100' : 'bg-red-100'
        }`}>
          {isIncoming ? (
            <ArrowUpIcon className={`w-8 h-8 ${isIncoming ? 'text-green-600' : 'text-red-600'}`} />
          ) : (
            <ArrowDownIcon className="w-8 h-8 text-red-600" />
          )}
        </div>
        <p className="text-sm text-gray-500 mb-2">Transaction Amount</p>
        <p className={`text-4xl font-bold ${isIncoming ? 'text-green-600' : 'text-red-600'}`}>
          {isIncoming ? '+' : '-'}
          {formatCurrency(Math.abs(transaction.amount))}
        </p>
        <p className="text-sm text-gray-500 mt-2 capitalize">
          {transaction.transaction_type.replace('_', ' ')}
        </p>
      </div>

      {/* Transaction Details */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-lg p-6">
        <h2 className="text-sm font-semibold text-blueox-primary-dark mb-4 uppercase tracking-wide">Transaction Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Bank Account</label>
            <p className="text-base text-gray-900">
              {transaction.bank_accounts?.name || 'N/A'}
            </p>
            {transaction.bank_accounts?.bank_name && (
              <p className="text-sm text-gray-500">{transaction.bank_accounts.bank_name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Transaction Date</label>
            <p className="text-base text-gray-900">{formatDate(transaction.transaction_date)}</p>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-500 mb-1">Description</label>
            <p className="text-base text-gray-900">{transaction.description || 'No description'}</p>
          </div>

          {transaction.reference_number && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Reference Number</label>
              <p className="text-base text-gray-900 font-mono">{transaction.reference_number}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Reconciliation Status</label>
            <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
              transaction.is_reconciled
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {transaction.is_reconciled ? 'Reconciled' : 'Unreconciled'}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Created</label>
            <p className="text-base text-gray-900">
              {new Date(transaction.created_at).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href={`/dashboard/bank/accounts/${transaction.bank_account_id}`}
          className="inline-flex items-center justify-center gap-2 flex-1 bg-white/80 backdrop-blur-xl border border-blueox-primary/20 hover:border-blueox-primary/40 px-5 py-3 rounded-2xl font-semibold text-blueox-primary transition-all duration-300 hover:shadow-lg"
        >
          <BanknotesIcon className="w-5 h-5" />
          View Account
        </Link>
      </div>
      </div>
    </div>
  );
}
