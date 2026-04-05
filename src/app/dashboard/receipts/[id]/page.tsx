'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { ShimmerSkeleton } from '@/components/ui/skeleton';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PrinterIcon,
  TrashIcon,
  CheckCircleIcon,
  EnvelopeIcon,
} from '@heroicons/react/24/outline';
import type { Invoice, InvoiceLine, Customer } from '@/types/database';

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { company } = useCompany();
  const [receipt, setReceipt] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [relatedInvoiceId, setRelatedInvoiceId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!company?.id) {
      return;
    }
    fetchReceipt();
  }, [params.id, company?.id]);

  const fetchReceipt = async () => {
    try {
      if (!company?.id) {
        return;
      }

      const response = await fetch(`/api/invoices/${params.id}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load receipt');
      }

      const payload = await response.json();
      const receiptData = payload?.data;

      if (!receiptData || receiptData.document_type !== 'receipt') {
        throw new Error('Receipt not found');
      }
      
      // Ensure numeric fields are properly parsed
      const parsedReceipt = {
        ...receiptData,
        subtotal: Number(receiptData.subtotal) || 0,
        tax_amount: Number(receiptData.tax_amount) || 0,
        discount_amount: Number(receiptData.discount_amount) || 0,
        total: Number(receiptData.total) || 0,
        amount_paid: Number(receiptData.amount_paid) || 0,
        balance_due: Number(receiptData.balance_due) || 0,
      };
      
      setReceipt(parsedReceipt);
      setCustomer(receiptData.customers || null);
      setLineItems(receiptData.invoice_lines || []);

      // Fetch related invoice ID if reference exists
      const refNumber = (receiptData as any).reference_invoice_number;
      if (refNumber) {
        const query = new URLSearchParams({
          company_id: company.id,
          document_type: 'invoice',
          search: refNumber,
          limit: '1',
        });
        const invoiceResponse = await fetch(`/api/invoices?${query.toString()}`, {
          credentials: 'include',
        });
        if (invoiceResponse.ok) {
          const invoicePayload = await invoiceResponse.json();
          const invoice = invoicePayload?.data?.[0];
          if (invoice?.invoice_number === refNumber) {
            setRelatedInvoiceId(invoice.id);
          }
        }
      }

    } catch (error) {
      console.error('Error fetching receipt:', error);
      toast.error('Failed to load receipt');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    const currency = receipt?.currency || 'USD';
    return currencyFormatter(amount, currency as any);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePrint = () => {
    if (!receipt) return;

    const printHTML = `
      <html>
        <head>
          <title>Receipt #${receipt.receipt_number} - ${company?.name || 'Company'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #111827;
              background: white;
              padding: 40px;
            }
            .header { 
              display: flex; 
              align-items: center; 
              justify-content: space-between;
              margin-bottom: 30px;
              border-bottom: 3px solid #1e3a5f;
              padding-bottom: 20px;
            }
            .company-section {
              display: flex;
              align-items: center;
            }
            .logo { 
              width: 200px; 
              height: 200px; 
              margin-right: 20px;
              border-radius: 8px;
              object-fit: contain;
            }
            .company-info h1 { 
              font-size: 24px; 
              font-weight: bold; 
              color: #1e3a5f;
              margin-bottom: 4px;
            }
            .company-info .address { 
              font-size: 12px; 
              color: #6b7280;
              margin-bottom: 2px;
            }
            .receipt-header { 
              text-align: right;
            }
            .receipt-header h2 { 
              font-size: 32px; 
              font-weight: bold; 
              color: #1e3a5f;
              margin-bottom: 4px;
            }
            .receipt-header .number { 
              font-size: 14px; 
              color: #6b7280;
            }
            .paid-badge {
              display: inline-block;
              padding: 6px 16px;
              border-radius: 12px;
              font-size: 13px;
              font-weight: 700;
              text-transform: uppercase;
              margin-top: 8px;
              background: #e8f5e9;
              color: #2e7d32;
            }
            .receipt-details {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin: 25px 0;
            }
            .section {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 15px;
              background: #f9fafb;
            }
            .section h3 {
              font-size: 12px;
              font-weight: bold;
              color: #6b7280;
              margin-bottom: 10px;
              text-transform: uppercase;
            }
            .section p {
              font-size: 14px;
              color: #111827;
              margin-bottom: 4px;
            }
            .section .label {
              font-size: 12px;
              color: #6b7280;
            }
            .section .value {
              font-size: 14px;
              color: #111827;
              font-weight: 500;
            }
            .items-table {
              width: 100%;
              border-collapse: collapse;
              margin: 25px 0;
            }
            .items-table thead {
              background: #f1f8e9;
            }
            .items-table th {
              text-align: left;
              padding: 12px;
              font-size: 12px;
              font-weight: bold;
              color: #2e7d32;
              text-transform: uppercase;
              border-bottom: 2px solid #1e3a5f;
            }
            .items-table th.text-right {
              text-align: right;
            }
            .items-table td {
              padding: 12px;
              border-bottom: 1px solid #e5e7eb;
            }
            .items-table td.text-right {
              text-align: right;
            }
            .totals-section {
              margin: 30px 0;
              padding: 20px;
              border: 2px solid #1e3a5f;
              border-radius: 8px;
              background: #f1f8e9;
              display: flex;
              justify-content: flex-end;
            }
            .totals-box {
              min-width: 300px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
            }
            .total-row.subtotal {
              color: #6b7280;
            }
            .total-row.total {
              border-top: 2px solid #1e3a5f;
              margin-top: 10px;
              padding-top: 15px;
              font-size: 18px;
              font-weight: bold;
              color: #1e3a5f;
            }
            .total-row.paid {
              color: #1e3a5f;
              font-weight: 600;
            }
            .total-row.balance {
              font-size: 20px;
              font-weight: bold;
              color: #1e3a5f;
              border-top: 2px solid #1e3a5f;
              margin-top: 10px;
              padding-top: 15px;
            }
            .notes-section {
              margin: 25px 0;
              padding: 20px;
              background: #f1f8e9;
              border-radius: 8px;
              border-left: 4px solid #1e3a5f;
            }
            .notes-section h3 {
              font-size: 12px;
              font-weight: bold;
              color: #1e3a5f;
              margin-bottom: 10px;
              text-transform: uppercase;
            }
            .notes-section p {
              font-size: 14px;
              color: #111827;
              white-space: pre-wrap;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              font-size: 11px;
              color: #6b7280;
            }
            .thank-you {
              text-align: center;
              margin: 30px 0;
              padding: 20px;
              font-size: 18px;
              font-weight: 600;
              color: #1e3a5f;
            }
            @media print {
              body { padding: 20px; }
              @page { margin: 0.5in; }
            }
          </style>
        </head>
        <body>
          <!-- Header -->
          <div class="header">
            <div class="company-section">
              ${company?.logo_url ? `<img src="${company.logo_url}" alt="${company.name} Logo" class="logo" />` : ''}
              <div class="company-info">
                <h1>${company?.name || 'Company Name'}</h1>
                ${company?.address ? `<p class="address">${company.address}</p>` : ''}
                ${company?.phone ? `<p class="address">Tel: ${company.phone}</p>` : ''}
                ${company?.email ? `<p class="address">Email: ${company.email}</p>` : ''}
                ${company?.tax_id || company?.registration_number ? `<p class="address">${company?.tax_id ? `TIN: ${company.tax_id}` : ''}${company?.tax_id && company?.registration_number ? ' | ' : ''}${company?.registration_number ? `Reg. No: ${company.registration_number}` : ''}</p>` : ''}
              </div>
            </div>
            <div class="receipt-header">
              <h2>RECEIPT</h2>
              <p class="number">#${receipt.receipt_number}</p>
              <span class="paid-badge">✓ PAID</span>
            </div>
          </div>

          <!-- Customer and Receipt Info -->
          <div class="receipt-details">
            <!-- Customer -->
            <div class="section">
              <h3>Received From</h3>
              <p><strong>${customer?.name || 'N/A'}</strong></p>
              ${customer?.email ? `<p>${customer.email}</p>` : ''}
              ${customer?.phone ? `<p>${customer.phone}</p>` : ''}
              ${customer?.address_line1 ? `<p style="margin-top: 8px;">${customer.address_line1}</p>` : ''}
              ${customer?.address_line2 ? `<p>${customer.address_line2}</p>` : ''}
              ${customer?.city ? `<p>${[customer.city, customer.state, customer.zip_code].filter(Boolean).join(', ')}</p>` : ''}
            </div>

            <!-- Receipt Details -->
            <div class="section">
              <h3>Receipt Details</h3>
              <p><span class="label">Receipt Date:</span> <span class="value">${formatDate(receipt.invoice_date)}</span></p>
              ${receipt.po_number ? `<p><span class="label">Reference:</span> <span class="value">${receipt.po_number}</span></p>` : ''}
            </div>
          </div>

          <!-- Line Items -->
          <table class="items-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th class="text-right">Quantity</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItems.map(item => `
                <tr>
                  <td>${item.line_number}</td>
                  <td>${item.description}</td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">${formatCurrency(Number(item.unit_price))}</td>
                  <td class="text-right"><strong>${formatCurrency(Number(item.line_total))}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Totals -->
          <div class="totals-section">
            <div class="totals-box">
              <div class="total-row subtotal">
                <span>Subtotal</span>
                <span>${formatCurrency(Number(receipt.subtotal))}</span>
              </div>
              ${Number(receipt.discount_amount) > 0 ? `
              <div class="total-row subtotal" style="color: #16a34a;">
                <span>Discount</span>
                <span>-${formatCurrency(Number(receipt.discount_amount))}</span>
              </div>
              ` : ''}
              <div class="total-row subtotal">
                <span>Tax</span>
                <span>${formatCurrency(Number(receipt.tax_amount))}</span>
              </div>
              <div class="total-row total">
                <span>TOTAL</span>
                <span>${formatCurrency(Number(receipt.total))}</span>
              </div>
              <div class="total-row paid">
                <span>Amount Paid</span>
                <span>${formatCurrency(Number(receipt.amount_paid))}</span>
              </div>
              <div class="total-row balance">
                <span>BALANCE DUE</span>
                <span>${formatCurrency(Number(receipt.total) - Number(receipt.amount_paid))}</span>
              </div>
            </div>
          </div>

          <!-- Thank You -->
          <div class="thank-you">
            Thank you for your business!
          </div>

          <!-- Notes -->
          ${receipt.notes ? `
          <div class="notes-section">
            <h3>Notes</h3>
            <p>${receipt.notes}</p>
          </div>
          ` : ''}

          <!-- Footer -->
          <div class="footer">
            <p>This is a computer-generated receipt. No signature required.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `;

    // Open print dialog in new window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHTML);
      printWindow.document.close();
      printWindow.focus();

      // Wait a moment for content to load, then show print dialog
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this receipt?')) return;

    try {
      const response = await fetch(`/api/invoices/${params.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to delete receipt');
      }

      toast.success('Receipt deleted successfully');
      router.push('/dashboard/receipts');
    } catch (error) {
      console.error('Error deleting receipt:', error);
      toast.error('Failed to delete receipt');
    }
  };

  const handleSendEmail = async () => {
    if (!customer?.email) {
      toast.error('Customer does not have an email address');
      return;
    }

    try {
      const response = await fetch(`/api/invoices/${params.id}/send`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }

      toast.success(data.message || 'Receipt sent successfully!');
    } catch (error: any) {
      console.error('Error sending receipt:', error);
      toast.error(error.message || 'Failed to send receipt email');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    
    const balanceDue = Math.round((receipt!.total - (receipt!.amount_paid || 0)) * 100) / 100;
    if (amount > balanceDue + 0.01) { // Allow small rounding differences
      toast.error(`Payment amount cannot exceed balance due of ${formatCurrency(balanceDue)}`);
      return;
    }
    
    setSubmitting(true);
    try {
      const response = await fetch(`/api/receipts/${params.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          payment_method: paymentMethod,
          notes: paymentNotes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to record payment');
      }

      toast.success('Payment recorded successfully!');
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNotes('');
      fetchReceipt(); // Refresh receipt data
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <div className="flex items-center gap-4">
            <ShimmerSkeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <ShimmerSkeleton className="h-8 w-64" />
              <ShimmerSkeleton className="h-4 w-48" />
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-6">
            <ShimmerSkeleton className="h-24 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <ShimmerSkeleton className="h-4 w-24" />
                  <ShimmerSkeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
            <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <ShimmerSkeleton className="h-4 w-24" />
                  <ShimmerSkeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!receipt || !customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <div className="max-w-5xl mx-auto p-6">
          <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-12 text-center">
            <p className="text-gray-500 mb-4">Receipt not found</p>
            <Link href="/dashboard/receipts" className="btn-primary">
              Back to Receipts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/dashboard/receipts">
            <button className="p-2 hover:bg-white/50 backdrop-blur-xl border border-blueox-primary/20 rounded-xl shadow-lg transition-all duration-200">
              <ArrowLeftIcon className="w-5 h-5 text-gray-700" />
            </button>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                Receipt {receipt.receipt_number}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-green-100 text-green-800 w-fit">
                <CheckCircleIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                PAID
              </span>
            </div>
            <p className="text-sm sm:text-base text-gray-500 mt-1 truncate">{customer.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(() => {
            const balanceDue = receipt.total - (receipt.amount_paid || 0);
            const hasInvoiceReference = !!(receipt as any).reference_invoice_number;
            // Only show Record Payment for standalone receipts (no invoice reference) with balance due
            return balanceDue > 0 && !hasInvoiceReference && (
              <button 
                onClick={() => setShowPaymentModal(true)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500/90 hover:bg-blue-600/90 text-white backdrop-blur-xl border border-blue-400/30 rounded-xl shadow-lg transition-all duration-200 text-xs sm:text-sm font-medium"
              >
                <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Record Payment</span>
                <span className="sm:hidden">Pay</span>
              </button>
            );
          })()}
          {customer?.email && (
            <button onClick={handleSendEmail} className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-500/90 hover:bg-green-600/90 text-white backdrop-blur-xl border border-green-400/30 rounded-xl shadow-lg transition-all duration-200 text-xs sm:text-sm font-medium">
              <EnvelopeIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Send Email</span>
              <span className="sm:hidden">Send</span>
            </button>
          )}
          <button onClick={handlePrint} className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-white/80 hover:bg-white/90 text-gray-700 backdrop-blur-xl border border-blueox-primary/20 rounded-xl shadow-lg transition-all duration-200 text-xs sm:text-sm font-medium">
            <PrinterIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Print / PDF</span>
          </button>
          <button onClick={handleDelete} className="inline-flex items-center gap-2 px-3 py-2 bg-red-50/80 hover:bg-red-100/80 text-red-600 backdrop-blur-xl border border-red-200/50 rounded-xl shadow-lg transition-all duration-200">
            <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Payment Received Box */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              <h3 className="text-base sm:text-lg font-semibold text-green-900">Payment Received</h3>
            </div>
            <p className="text-sm sm:text-base text-green-700">
              Payment of <span className="font-bold text-lg sm:text-xl">{formatCurrency(receipt.amount_paid || receipt.total)}</span> received on {formatDate(receipt.invoice_date)}
            </p>
            <p className="text-xs sm:text-sm text-green-600 mt-1">
              Time: {formatTime(receipt.created_at)}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs sm:text-sm text-green-700">Payment Method</p>
            <p className="font-semibold text-sm sm:text-base text-green-900">
              {receipt.payment_terms === 0 ? 'Cash' : 'Bank Transfer'}
            </p>
          </div>
        </div>
      </div>

      {/* Receipt Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Information */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Customer Name</p>
              <p className="font-medium">{customer.name}</p>
            </div>
            {customer.email && (
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{customer.email}</p>
              </div>
            )}
            {customer.phone && (
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{customer.phone}</p>
              </div>
            )}
            {(customer.address_line1 || customer.city) && (
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">
                  {customer.address_line1}
                  {customer.address_line2 && <br />}
                  {customer.address_line2}
                  {(customer.city || customer.state || customer.zip_code) && <br />}
                  {[customer.city, customer.state, customer.zip_code].filter(Boolean).join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Receipt Information */}
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Receipt Details</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500">Receipt Number</p>
              <p className="font-medium">{receipt.receipt_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Receipt Date</p>
              <p className="font-medium">{formatDate(receipt.invoice_date)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Receipt Time</p>
              <p className="font-medium">{formatTime(receipt.created_at)}</p>
            </div>
            {(receipt as any).reference_invoice_number && (
              <div>
                <p className="text-sm text-gray-500">Related Invoice</p>
                {relatedInvoiceId ? (
                  <Link
                    href={`/dashboard/invoices/${relatedInvoiceId}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {(receipt as any).reference_invoice_number}
                  </Link>
                ) : (
                  <p className="font-medium text-blue-600">
                    {(receipt as any).reference_invoice_number}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Line Items</h3>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="table min-w-full">
            <thead>
              <tr>
                <th className="text-left text-xs sm:text-sm">#</th>
                <th className="text-left text-xs sm:text-sm">Description</th>
                <th className="text-right text-xs sm:text-sm">Qty</th>
                <th className="text-right text-xs sm:text-sm">Price</th>
                <th className="text-right text-xs sm:text-sm">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="text-xs sm:text-sm">{item.line_number}</td>
                  <td className="text-xs sm:text-sm">{item.description}</td>
                  <td className="text-right text-xs sm:text-sm">{item.quantity}</td>
                  <td className="text-right text-xs sm:text-sm">{formatCurrency(Number(item.unit_price))}</td>
                  <td className="text-right font-medium text-xs sm:text-sm">{formatCurrency(Number(item.line_total))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Summary */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Payment Summary</h3>
        <div>
          <div className="flex justify-end">
            <div className="w-full sm:w-80 space-y-2 sm:space-y-3">
              <div className="flex justify-between text-sm sm:text-base text-gray-600">
                <span>Subtotal</span>
                <span>{formatCurrency(receipt.subtotal)}</span>
              </div>
              {Number(receipt.discount_amount) > 0 && (
                <div className="flex justify-between text-sm sm:text-base text-gray-600">
                  <span>Discount</span>
                  <span className="text-red-600">-{formatCurrency(receipt.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm sm:text-base text-gray-600">
                <span>Tax</span>
                <span>{formatCurrency(receipt.tax_amount)}</span>
              </div>
              <div className="flex justify-between pt-2 sm:pt-3 border-t border-gray-200 text-sm sm:text-base">
                <span className="font-semibold">Total</span>
                <span className="font-semibold">{formatCurrency(receipt.total)}</span>
              </div>
              <div className="flex justify-between pt-2 sm:pt-3 border-t-2 border-green-500 bg-green-50 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 sm:py-3 rounded">
                <span className="font-bold text-green-900 text-sm sm:text-base">Amount Paid</span>
                <span className="font-bold text-green-900 text-base sm:text-lg">
                  {formatCurrency(receipt.amount_paid || receipt.total)}
                </span>
              </div>
              {(() => {
                const balanceDue = receipt.total - (receipt.amount_paid || 0);
                return balanceDue > 0 ? (
                  <div className="flex justify-between pt-2 text-sm sm:text-base">
                    <span className="font-semibold text-red-900">Balance Due</span>
                    <span className="font-semibold text-red-600">{formatCurrency(balanceDue)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between pt-2 text-sm sm:text-base">
                    <span className="font-semibold text-gray-900">Balance Due</span>
                    <span className="font-semibold text-green-600">{formatCurrency(0)}</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {receipt.notes && (
        <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{receipt.notes}</p>
        </div>
      )}

      {/* Company Info Footer */}
      <div className="bg-white/80 backdrop-blur-xl border border-blueox-primary/20 rounded-3xl shadow-xl p-6">
        <div className="text-center text-sm text-gray-600 space-y-1">
          <p className="font-semibold text-gray-900">{company?.name || 'Company Name'}</p>
          {company?.address && <p>{company.address}</p>}
          <p>
            {company?.phone && `Tel: ${company.phone}`}
            {company?.phone && company?.email && ' • '}
            {company?.email && `Email: ${company.email}`}
          </p>
          <p>
            {company?.tax_id && `TIN: ${company.tax_id}`}
            {company?.tax_id && company?.registration_number && ' • '}
            {company?.registration_number && `Reg. No: ${company.registration_number}`}
          </p>
          <p className="mt-2 text-xs">This is an official receipt for accounting purposes.</p>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Record Payment</h2>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">
                  Balance due: {formatCurrency(receipt.total - (receipt.amount_paid || 0))}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="stripe">Stripe</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Additional notes about this payment..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50"
                  disabled={submitting}
                >
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
