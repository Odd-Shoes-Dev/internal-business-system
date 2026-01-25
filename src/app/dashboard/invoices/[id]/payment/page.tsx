'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { formatCurrency as currencyFormatter, SupportedCurrency } from '@/lib/currency';
import { Button, Card, CardHeader, CardTitle, CardBody, Input, Select, Textarea, LoadingSpinner } from '@/components/ui';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  amount_paid: number;
  customer_id: string;
  currency?: SupportedCurrency;
  customer: {
    name: string | null;
  } | null;
}

export default function RecordPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    payment_method: 'bank_transfer',
    reference_number: '',
    notes: '',
  });

  useEffect(() => {
    fetchInvoice();
  }, [params.id]);

  const fetchInvoice = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          total,
          amount_paid,
          customer_id,
          customer:customers(name)
        `)
        .eq('id', params.id)
        .single();

      if (error) throw error;
      const customerData = (data as any).customer;
      setInvoice({
        id: data.id,
        invoice_number: data.invoice_number,
        total: data.total,
        amount_paid: data.amount_paid,
        customer_id: data.customer_id,
        customer: Array.isArray(customerData)
          ? customerData[0] ?? null
          : customerData ?? null,
      });
      
      // Pre-fill with balance due
      const balanceDue = Number(data.total) - Number(data.amount_paid);
      setFormData(prev => ({
        ...prev,
        amount: balanceDue.toFixed(2),
      }));
    } catch (error) {
      console.error('Error fetching invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Please enter a valid amount');
      }

      const balanceDue = Number(invoice!.total) - Number(invoice!.amount_paid);
      if (amount > balanceDue) {
        throw new Error(`Amount cannot exceed balance due (${formatCurrency(balanceDue)})`);
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Generate payment number
      const { data: lastPayment } = await supabase
        .from('payments_received')
        .select('payment_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let paymentNumber = 'PMT-2025-00001';
      if (lastPayment?.payment_number) {
        const match = lastPayment.payment_number.match(/PMT-(\d{4})-(\d{5})/);
        if (match) {
          const year = new Date().getFullYear();
          const num = parseInt(match[2]) + 1;
          paymentNumber = `PMT-${year}-${num.toString().padStart(5, '0')}`;
        }
      }

      // Create payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments_received')
        .insert({
          payment_number: paymentNumber,
          customer_id: invoice!.customer_id,
          payment_date: formData.payment_date,
          amount: amount,
          payment_method: formData.payment_method,
          reference_number: formData.reference_number || null,
          notes: formData.notes || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Create payment application (link payment to invoice)
      const { error: applicationError } = await supabase
        .from('payment_applications')
        .insert({
          payment_id: paymentData.id,
          invoice_id: params.id,
          amount_applied: amount,
        });

      if (applicationError) throw applicationError;

      // Update invoice amount_paid and status
      const newAmountPaid = Number(invoice!.amount_paid) + amount;
      const newStatus = newAmountPaid >= Number(invoice!.total) ? 'paid' : 'partial';

      await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          status: newStatus,
        })
        .eq('id', params.id);

      // Create journal entry for payment
      // Debit: Cash/Bank, Credit: Accounts Receivable
      const { data: cashAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('account_number', '1010')
        .single();

      const { data: arAccount } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('account_number', '1200')
        .single();

      if (cashAccount && arAccount) {
        // Create journal entry
        const { data: journalEntry } = await supabase
          .from('journal_entries')
          .insert({
            entry_date: formData.payment_date,
            description: `Payment received for Invoice ${invoice!.invoice_number}`,
            reference_type: 'invoice_payment',
            reference_id: params.id,
            status: 'posted',
          })
          .select()
          .single();

        if (journalEntry) {
          // Create journal lines
          await supabase.from('journal_entry_lines').insert([
            {
              journal_entry_id: journalEntry.id,
              account_id: cashAccount.id,
              debit_amount: amount,
              credit_amount: 0,
              description: `Payment from ${invoice!.customer?.name ?? 'Customer'}`,
            },
            {
              journal_entry_id: journalEntry.id,
              account_id: arAccount.id,
              debit_amount: 0,
              credit_amount: amount,
              description: `Payment from ${invoice!.customer?.name ?? 'Customer'}`,
            },
          ]);
        }
      }

      router.push(`/dashboard/invoices/${params.id}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter(amount, invoice?.currency || 'USD');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Invoice not found</p>
        <Link href="/dashboard/invoices">
          <Button variant="outline" className="mt-4">
            Back to Invoices
          </Button>
        </Link>
      </div>
    );
  }

  const balanceDue = Number(invoice.total) - Number(invoice.amount_paid);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/invoices/${params.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Record Payment</h1>
          <p className="text-gray-500">Invoice {invoice.invoice_number}</p>
        </div>
      </div>

      {/* Invoice Summary */}
      <Card className="mb-6">
        <CardBody className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Customer</p>
              <p className="font-medium">{invoice.customer?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Invoice Total</p>
              <p className="font-medium">{formatCurrency(Number(invoice.total))}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Amount Paid</p>
              <p className="font-medium text-green-600">{formatCurrency(Number(invoice.amount_paid))}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Balance Due</p>
              <p className="font-semibold text-red-600">{formatCurrency(balanceDue)}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Payment Date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                required
              />

              <Input
                label="Amount"
                type="number"
                step="0.01"
                min="0.01"
                max={balanceDue}
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
              />
            </div>

            <Select
              label="Payment Method"
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
              options={[
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'check', label: 'Check' },
                { value: 'cash', label: 'Cash' },
                { value: 'credit_card', label: 'Credit Card' },
                { value: 'stripe', label: 'Stripe' },
                { value: 'other', label: 'Other' },
              ]}
              required
            />

            <Input
              label="Reference Number"
              placeholder="Check number, transaction ID, etc."
              value={formData.reference_number}
              onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
            />

            <Textarea
              label="Notes"
              rows={3}
              placeholder="Optional payment notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? 'Recording...' : 'Record Payment'}
              </Button>
              <Link href={`/dashboard/invoices/${params.id}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
