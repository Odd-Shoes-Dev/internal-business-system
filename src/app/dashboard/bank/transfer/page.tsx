'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { useCompany } from '@/contexts/company-context';

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  currency: string;
}

export default function BankTransferPage() {
  const router = useRouter();
  const { company } = useCompany();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  const [formData, setFormData] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: 0,
    transfer_date: new Date().toISOString().split('T')[0],
    reference_number: '',
  });

  useEffect(() => {
    if (company?.id) fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch(`/api/bank-accounts?company_id=${company!.id}&active=true`);
      const result = await response.json();
      setAccounts(result.data || []);
    } catch {
      setAccounts([]);
    }
  };

  const fromAccount = accounts.find(a => a.id === formData.from_account_id);
  const toAccount = accounts.find(a => a.id === formData.to_account_id);
  const isCrossCurrency = fromAccount && toAccount && fromAccount.currency !== toAccount.currency;

  // Fetch converted amount preview whenever relevant fields change
  useEffect(() => {
    if (!isCrossCurrency || !formData.amount || formData.amount <= 0) {
      setConvertedAmount(null);
      return;
    }
    setLoadingRate(true);
    fetch(`/api/currency/convert?from=${fromAccount!.currency}&to=${toAccount!.currency}&amount=${formData.amount}`)
      .then(r => r.json())
      .then(d => setConvertedAmount(d.converted ?? null))
      .catch(() => setConvertedAmount(null))
      .finally(() => setLoadingRate(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.from_account_id, formData.to_account_id, formData.amount]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (!formData.from_account_id || !formData.to_account_id) {
        throw new Error('Please select both accounts');
      }
      if (formData.from_account_id === formData.to_account_id) {
        throw new Error('Cannot transfer to the same account');
      }
      if (formData.amount <= 0) {
        throw new Error('Amount must be greater than zero');
      }

      const response = await fetch('/api/bank-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, company_id: company!.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create transfer');
      }

      router.push('/dashboard/bank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/bank" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Transfer</h1>
          <p className="text-gray-600">Transfer funds between bank accounts</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <ArrowsRightLeftIcon className="w-5 h-5 text-[#52b53b]" />
            <h2 className="font-semibold text-gray-900">Transfer Details</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Account <span className="text-red-500">*</span>
              </label>
              <select
                name="from_account_id"
                value={formData.from_account_id}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">Select account...</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} - {account.bank_name} ({account.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Account <span className="text-red-500">*</span>
              </label>
              <select
                name="to_account_id"
                value={formData.to_account_id}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="">Select account...</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} - {account.bank_name} ({account.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="amount"
                  value={formData.amount || ''}
                  onChange={handleChange}
                  required
                  min="0.01"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                  placeholder="0.00"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">
                  {fromAccount?.currency || company?.currency || 'USD'}
                </div>
              </div>
              {/* Cross-currency preview */}
              {isCrossCurrency && formData.amount > 0 && (
                <p className="mt-1 text-xs text-blue-600">
                  {loadingRate
                    ? 'Calculating...'
                    : convertedAmount !== null
                    ? `≈ ${convertedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${toAccount!.currency} will be credited`
                    : 'Exchange rate unavailable — add rates in Settings'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transfer Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="transfer_date"
                value={formData.transfer_date}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Number
              </label>
              <input
                type="text"
                name="reference_number"
                value={formData.reference_number}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                placeholder="Optional reference number"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href="/dashboard/bank"
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-[#52b53b] text-white rounded-lg text-sm font-medium hover:bg-[#449932] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Processing...' : 'Transfer Funds'}
          </button>
        </div>
      </form>
    </div>
  );
}
