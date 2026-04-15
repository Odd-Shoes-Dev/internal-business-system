'use client';

import { useState, useEffect } from 'react';
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions, ComboboxButton } from '@headlessui/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CurrencySelect } from '@/components/ui';
import { formatCurrency as currencyFormatter } from '@/lib/currency';
import { useForm, useFieldArray } from 'react-hook-form';
import { useCompany } from '@/contexts/company-context';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  ChevronUpDownIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import type { Customer, Product, DocumentType } from '@/types/database';

interface InvoiceLineInput {
  product_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
}

interface InvoiceFormData {
  customer_id: string;
  document_type: DocumentType;
  currency: 'USD' | 'EUR' | 'GBP' | 'UGX';
  invoice_date: string;
  due_date: string;
  payment_terms: number;
  po_number: string;
  notes: string;
  lines: InvoiceLineInput[];
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { company } = useCompany();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [taxRate] = useState(0.0625); // MA sales tax

  // Get query parameters from URL (for booking-generated invoices)
  const bookingId = searchParams.get('booking_id');
  const prefilledCustomerId = searchParams.get('customer_id');
  const prefilledCurrency = searchParams.get('currency') as 'USD' | 'EUR' | 'GBP' | 'UGX' | null;
  const prefilledDescription = searchParams.get('description');
  const prefilledAmount = searchParams.get('amount');
  const prefilledInvoiceType = searchParams.get('invoice_type');
  const prefilledDeposit = searchParams.get('deposit_amount');
  const prefilledBalance = searchParams.get('balance_amount');
  const prefilledDocType = searchParams.get('type') as DocumentType | null;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    defaultValues: {
      document_type: prefilledDocType || 'invoice',
      currency: prefilledCurrency || 'USD',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      payment_terms: 30,
      lines: [
        {
          product_id: '',
          description: prefilledDescription || '',
          quantity: 1,
          unit_price: prefilledAmount ? parseFloat(prefilledAmount) : 0,
          discount_percent: 0,
          tax_rate: taxRate,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  const watchLines = watch('lines');
  const watchPaymentTerms = watch('payment_terms');
  const watchCurrency = watch('currency');

  useEffect(() => {
    loadData();
  }, [company?.id]);

  // Pre-fill form when coming from booking page
  useEffect(() => {
    if (prefilledCustomerId && customers.length > 0) {
      const found = customers.find(c => c.id === prefilledCustomerId) || null;
      setSelectedCustomer(found);
      setValue('customer_id', prefilledCustomerId);
    }
  }, [prefilledCustomerId, customers]);

  useEffect(() => {
    // Update due date when payment terms change
    const invoiceDate = watch('invoice_date');
    if (invoiceDate && watchPaymentTerms) {
      const due = new Date(invoiceDate);
      due.setDate(due.getDate() + watchPaymentTerms);
      setValue('due_date', due.toISOString().split('T')[0]);
    }
  }, [watchPaymentTerms, watch('invoice_date')]);


  const loadData = async () => {
    try {
      if (!company?.id) {
        return;
      }

      const query = `?company_id=${company.id}&active=true&limit=500`;
      const [customersRes, productsRes] = await Promise.all([
        fetch(`/api/customers${query}`, { credentials: 'include' }),
        fetch(`/api/products${query}`, { credentials: 'include' }),
      ]);

      if (!customersRes.ok || !productsRes.ok) {
        throw new Error('Failed to load customers/products');
      }

      const customersResult = await customersRes.json();
      const productsResult = await productsRes.json();

      setCustomers(customersResult.data || []);
      setProducts(productsResult.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleProductChange = async (index: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`lines.${index}.description`, product.name);
      
      // Check if currency conversion is needed
      const invoiceCurrency = watchCurrency || 'USD';
      const productCurrency = product.currency || 'USD';
      
      let convertedPrice = product.unit_price;
      
      if (productCurrency !== invoiceCurrency) {
        const conversionResponse = await fetch('/api/currency/convert', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: product.unit_price,
            from_currency: productCurrency,
            to_currency: invoiceCurrency,
          }),
        });

        const conversionResult = conversionResponse.ok ? await conversionResponse.json() : null;
        const converted = conversionResult?.data?.converted_amount ?? null;
        
        if (converted !== null) {
          convertedPrice = converted;
        } else {
          // If conversion fails, show a warning
          toast.error(`Unable to convert from ${productCurrency} to ${invoiceCurrency}. Using original price.`);
        }
      }
      
      setValue(`lines.${index}.unit_price`, convertedPrice);
      setValue(`lines.${index}.tax_rate`, product.is_taxable ? taxRate : 0);
    }
  };

  const calculateLineTotal = (line: InvoiceLineInput) => {
    const subtotal = line.quantity * line.unit_price;
    const discount = subtotal * (line.discount_percent / 100);
    return subtotal - discount;
  };

  const calculateLineTax = (line: InvoiceLineInput) => {
    return calculateLineTotal(line) * line.tax_rate;
  };

  const calculateSubtotal = () => {
    return watchLines.reduce((sum, line) => sum + calculateLineTotal(line), 0);
  };

  const calculateTax = () => {
    return watchLines.reduce((sum, line) => sum + calculateLineTax(line), 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const formatCurrency = (amount: number) => {
    const currency = watchCurrency || 'USD';
    return currencyFormatter(amount, currency as any);
  };

  const onSubmit = async (data: InvoiceFormData) => {
    if (data.lines.length === 0) {
      toast.error('Please add at least one line item');
      return;
    }

    if (!company) {
      toast.error('No company selected');
      return;
    }

    setLoading(true);
    try {
      // Use the API route to create invoice with proper document type handling
      const payload = {
        ...data,
        company_id: company.id,
        ...(bookingId && { booking_id: bookingId }), // Include booking_id if present
      };

      const response = await fetch('/api/invoices', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create invoice');
      }

      const result = await response.json();
      toast.success(`${data.document_type === 'quotation' ? 'Quotation' : data.document_type === 'proforma' ? 'Proforma Invoice' : 'Invoice'} created successfully!`);
      router.push(`/dashboard/invoices/${result.data.id}`);
    } catch (error: any) {
      console.error('Failed to create invoice:', error);
      toast.error(error.message || 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/invoices" className="btn-ghost p-2">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Invoice</h1>
          <p className="text-gray-500 mt-1">Create a new customer invoice</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Booking Info Banner */}
        {bookingId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Creating invoice for Booking #{bookingId.substring(0, 8)}
                </p>
                <p className="text-xs text-blue-700 mt-0.5">
                  {prefilledInvoiceType === 'deposit' && `Deposit invoice (${prefilledDeposit})`}
                  {prefilledInvoiceType === 'balance' && `Balance invoice (${prefilledBalance})`}
                  {prefilledInvoiceType === 'full' && 'Full amount invoice'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Customer and dates */}
        <div className="card">
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="form-group md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="label mb-0">Customer *</label>
                  <Link
                    href={`/dashboard/customers/new?returnTo=${encodeURIComponent('/dashboard/invoices/new')}`}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    <PlusIcon className="w-3 h-3" />
                    New Customer
                  </Link>
                </div>
                <input type="hidden" {...register('customer_id', { required: 'Customer is required' })} />
                <Combobox
                  value={selectedCustomer}
                  onChange={(customer: Customer | null) => {
                    setSelectedCustomer(customer);
                    setValue('customer_id', customer?.id || '', { shouldValidate: true });
                    if (customer?.currency) {
                      setValue('currency', customer.currency as any);
                    }
                  }}
                >
                  <div className="relative">
                    <ComboboxInput
                      className={`input pr-10 ${errors.customer_id ? 'input-error' : ''}`}
                      displayValue={(customer: Customer | null) => customer?.name || ''}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      placeholder="Search customers..."
                    />
                    <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-2">
                      <ChevronUpDownIcon className="w-5 h-5 text-gray-400" />
                    </ComboboxButton>
                    <ComboboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white shadow-lg border border-gray-200 py-1 text-sm">
                      {customers
                        .filter((c) =>
                          customerQuery === '' ||
                          c.name.toLowerCase().includes(customerQuery.toLowerCase()) ||
                          (c.email || '').toLowerCase().includes(customerQuery.toLowerCase())
                        )
                        .map((customer) => (
                          <ComboboxOption
                            key={customer.id}
                            value={customer}
                            className="group flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-blue-50 data-[focus]:bg-blue-50"
                          >
                            <div>
                              <span className="font-medium text-gray-900">{customer.name}</span>
                              {customer.email && (
                                <span className="ml-2 text-xs text-gray-400">{customer.email}</span>
                              )}
                            </div>
                            <CheckIcon className="w-4 h-4 text-blue-600 hidden group-data-[selected]:block" />
                          </ComboboxOption>
                        ))}
                      {customerQuery !== '' && customers.filter((c) =>
                        c.name.toLowerCase().includes(customerQuery.toLowerCase()) ||
                        (c.email || '').toLowerCase().includes(customerQuery.toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-gray-500 text-sm">No customers found</div>
                      )}
                      <div className="border-t border-gray-100 mt-1 pt-1">
                        <Link
                          href={`/dashboard/customers/new?returnTo=${encodeURIComponent('/dashboard/invoices/new')}`}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50"
                        >
                          <PlusIcon className="w-4 h-4" />
                          Create New Customer
                        </Link>
                      </div>
                    </ComboboxOptions>
                  </div>
                </Combobox>
                {errors.customer_id && (
                  <p className="form-error">{errors.customer_id.message}</p>
                )}
              </div>

              <div className="form-group md:col-span-2">
                <label className="label">Document Type *</label>
                <select
                  {...register('document_type', { required: 'Document type is required' })}
                  className={`input ${errors.document_type ? 'input-error' : ''}`}
                >
                  <option value="invoice">Invoice</option>
                  <option value="quotation">Quotation</option>
                  <option value="proforma">Proforma Invoice</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Select the type of document to generate
                </p>
              </div>

              <div className="form-group">
                <label className="label">Currency *</label>
                <CurrencySelect
                  value={watch('currency') || 'USD'}
                  onChange={(e) => setValue('currency', e.target.value as any)}
                  name="currency"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Auto-selected from customer preference
                </p>
              </div>

              <div className="form-group">
                <label className="label">Invoice Date *</label>
                <input
                  type="date"
                  {...register('invoice_date', { required: 'Invoice date is required' })}
                  className={`input ${errors.invoice_date ? 'input-error' : ''}`}
                />
              </div>

              <div className="form-group">
                <label className="label">Payment Terms</label>
                <select {...register('payment_terms', { valueAsNumber: true })} className="input">
                  <option value={15}>Net 15</option>
                  <option value={30}>Net 30</option>
                  <option value={45}>Net 45</option>
                  <option value={60}>Net 60</option>
                  <option value={0}>Due on Receipt</option>
                </select>
              </div>

              <div className="form-group">
                <label className="label">Due Date *</label>
                <input
                  type="date"
                  {...register('due_date', { required: 'Due date is required' })}
                  className={`input ${errors.due_date ? 'input-error' : ''}`}
                />
              </div>

              <div className="form-group">
                <label className="label">PO Number</label>
                <input
                  type="text"
                  {...register('po_number')}
                  className="input"
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Line Items</h2>
          </div>
          <div className="card-body space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-12 gap-3 items-end p-4 bg-gray-50 rounded-lg"
              >
                <div className="col-span-12 md:col-span-2">
                  <label className="label text-xs">Product</label>
                  <select
                    {...register(`lines.${index}.product_id`)}
                    onChange={(e) => handleProductChange(index, e.target.value)}
                    className="input text-sm"
                  >
                    <option value="">Custom item</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-12 md:col-span-3">
                  <label className="label text-xs">Description *</label>
                  <input
                    type="text"
                    {...register(`lines.${index}.description`, { required: true })}
                    className="input text-sm"
                    placeholder="Description"
                  />
                </div>

                <div className="col-span-4 md:col-span-1">
                  <label className="label text-xs">Qty</label>
                  <input
                    type="number"
                    step="1"
                    {...register(`lines.${index}.quantity`, { valueAsNumber: true, min: 1 })}
                    className="input text-sm"
                  />
                </div>

                <div className="col-span-4 md:col-span-2">
                  <label className="label text-xs">Unit Price</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register(`lines.${index}.unit_price`, { valueAsNumber: true, min: 0 })}
                    className="input text-sm"
                  />
                </div>

                <div className="col-span-4 md:col-span-1">
                  <label className="label text-xs">Disc %</label>
                  <input
                    type="number"
                    step="0.01"
                    {...register(`lines.${index}.discount_percent`, { valueAsNumber: true, min: 0, max: 100 })}
                    className="input text-sm"
                  />
                </div>

                <div className="col-span-6 md:col-span-2">
                  <label className="label text-xs">Line Total</label>
                  <div className="input bg-gray-100 text-sm">
                    {formatCurrency(calculateLineTotal(watchLines[index] || {
                      quantity: 0,
                      unit_price: 0,
                      discount_percent: 0,
                    }))}
                  </div>
                </div>

                <div className="col-span-6 md:col-span-1 flex justify-end">
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="btn-ghost text-red-600 hover:bg-red-50 p-2"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                append({
                  product_id: '',
                  description: '',
                  quantity: 1,
                  unit_price: 0,
                  discount_percent: 0,
                  tax_rate: taxRate,
                })
              }
              className="btn-secondary"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Line
            </button>
          </div>
        </div>

        {/* Notes and totals */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-body">
              <label className="label">Notes</label>
              <textarea
                {...register('notes')}
                className="input min-h-[120px]"
                placeholder="Notes to appear on the invoice..."
              />
            </div>
          </div>

          <div className="card">
            <div className="card-body space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax (6.25%)</span>
                <span className="font-medium">{formatCurrency(calculateTax())}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">
                  {formatCurrency(calculateTotal())}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/dashboard/invoices" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}

