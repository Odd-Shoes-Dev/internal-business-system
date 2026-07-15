'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCompany } from '@/contexts/company-context';
import toast from 'react-hot-toast';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  PrinterIcon,
  ArrowLeftOnRectangleIcon,
  ShoppingCartIcon,
  CreditCardIcon,
  BanknotesIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline';
import { formatCurrency } from '@/lib/currency';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit_price: number;
  currency: string;
  is_taxable: boolean;
  tax_rate: number;
  product_type: string;
}

interface CartItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  tax_rate: number;
  line_total: number;
  tax_total: number;
}

interface Session {
  id: string;
  terminal_name: string;
  opened_by_name: string;
  currency: string;
  status: string;
  opening_float: number;
  total_sales: number;
  transaction_count: number;
  company_id: string;
}

type PaymentMethod = 'cash' | 'card' | 'mobile_money';

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { id: 'cash', label: 'Cash', icon: BanknotesIcon },
  { id: 'card', label: 'Card', icon: CreditCardIcon },
  { id: 'mobile_money', label: 'Mobile', icon: DevicePhoneMobileIcon },
];

export default function TillPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { company } = useCompany();

  const [session, setSession] = useState<Session | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [tendered, setTendered] = useState('');
  const [mobileRef, setMobileRef] = useState('');
  const [processing, setProcessing] = useState(false);

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [cashCounted, setCashCounted] = useState('');
  const [closingShift, setClosingShift] = useState(false);

  const [lastReceipt, setLastReceipt] = useState<{
    invoiceNumber: string;
    items: CartItem[];
    subtotal: number;
    taxAmount: number;
    total: number;
    tendered: number;
    change: number;
    method: PaymentMethod;
    currency: string;
  } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (company && sessionId) {
      loadSession();
      loadProducts();
    }
  }, [company, sessionId]);

  useEffect(() => {
    const q = search.toLowerCase();
    if (!q) {
      setFilteredProducts(products.slice(0, 30));
    } else {
      setFilteredProducts(
        products.filter(p =>
          p.name.toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q)
        ).slice(0, 30)
      );
    }
  }, [search, products]);

  useEffect(() => {
    const handle = () => {
      if (!showCloseModal && !lastReceipt) barcodeInputRef.current?.focus();
    };
    document.addEventListener('click', handle);
    return () => document.removeEventListener('click', handle);
  }, [showCloseModal, lastReceipt]);

  const loadSession = async () => {
    try {
      const res = await fetch(`/api/pos/sessions/${sessionId}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.data.status === 'closed') {
        toast.error('This session is already closed');
        router.push('/dashboard/pos');
        return;
      }
      setSession(data.data);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const loadProducts = async () => {
    if (!company) return;
    try {
      const res = await fetch(
        `/api/products?company_id=${company.id}&active=true&limit=200`,
        { credentials: 'include' }
      );
      const data = await res.json();
      setProducts(data.data || []);
      setFilteredProducts((data.data || []).slice(0, 30));
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === product.id);
      if (existing) {
        return prev.map(i =>
          i.product_id === product.id
            ? { ...i, quantity: i.quantity + 1, line_total: i.unit_price * (i.quantity + 1), tax_total: i.unit_price * (i.quantity + 1) * i.tax_rate }
            : i
        );
      }
      const taxRate = product.is_taxable ? Number(product.tax_rate) : 0;
      return [...prev, {
        product_id: product.id,
        name: product.name,
        unit_price: Number(product.unit_price),
        quantity: 1,
        tax_rate: taxRate,
        line_total: Number(product.unit_price),
        tax_total: Number(product.unit_price) * taxRate,
      }];
    });
    setSearch('');
    barcodeInputRef.current?.focus();
  }, []);

  const handleBarcodeEnter = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const value = search.trim();
    if (!value || !company) return;
    const res = await fetch(`/api/products?company_id=${company.id}&barcode=${encodeURIComponent(value)}`, { credentials: 'include' });
    const data = await res.json();
    if (data.data) {
      addToCart(data.data);
    } else {
      const match = filteredProducts.find(p => p.sku?.toLowerCase() === value.toLowerCase() || p.barcode?.toLowerCase() === value.toLowerCase());
      if (match) { addToCart(match); }
      else { toast.error(`No product found for: ${value}`); }
    }
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev =>
      prev.map(i => {
        if (i.product_id !== productId) return i;
        const newQty = i.quantity + delta;
        if (newQty <= 0) return null;
        return { ...i, quantity: newQty, line_total: i.unit_price * newQty, tax_total: i.unit_price * newQty * i.tax_rate };
      }).filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(i => i.product_id !== productId));

  const subtotal = cart.reduce((s, i) => s + i.line_total, 0);
  const taxAmount = cart.reduce((s, i) => s + i.tax_total, 0);
  const total = subtotal + taxAmount;
  const tenderedAmount = parseFloat(tendered) || 0;
  const change = paymentMethod === 'cash' ? Math.max(0, tenderedAmount - total) : 0;

  const handleCharge = async () => {
    if (cart.length === 0) { toast.error('Cart is empty'); return; }
    if (!session || !company) return;
    if (paymentMethod === 'cash' && tenderedAmount < total - 0.01) { toast.error('Tendered amount is less than total'); return; }
    setProcessing(true);
    try {
      const payments = paymentMethod === 'cash'
        ? [{ method: 'cash' as PaymentMethod, amount: total }]
        : paymentMethod === 'mobile_money'
        ? [{ method: 'mobile_money' as PaymentMethod, amount: total, reference: mobileRef || undefined }]
        : [{ method: 'card' as PaymentMethod, amount: total }];

      const res = await fetch('/api/pos/transactions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: company.id,
          session_id: session.id,
          items: cart.map(i => ({ product_id: i.product_id, name: i.name, quantity: i.quantity, unit_price: i.unit_price, tax_rate: i.tax_rate })),
          payments,
          currency: session.currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setLastReceipt({ invoiceNumber: data.data.invoice_number, items: [...cart], subtotal, taxAmount, total, tendered: tenderedAmount, change, method: paymentMethod, currency: session.currency });
      setSession(s => s ? { ...s, total_sales: s.total_sales + total, transaction_count: s.transaction_count + 1 } : s);
      setCart([]);
      setTendered('');
      setMobileRef('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handlePrintAndNext = () => {
    if (lastReceipt) window.print();
    setLastReceipt(null);
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  const handleCloseShift = async () => {
    if (!session) return;
    setClosingShift(true);
    try {
      const res = await fetch(`/api/pos/sessions/${session.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closing_cash_count: parseFloat(cashCounted) || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Shift closed');
      router.push('/dashboard/pos');
    } catch (e: any) {
      toast.error(e.message);
      setClosingShift(false);
    }
  };

  const currency = session?.currency || company?.currency || 'UGX';

  if (loading || !session) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--pos-bg)' }}>
        <div className="flex items-center gap-3" style={{ color: 'var(--pos-text-muted)' }}>
          <ShoppingCartIcon className="w-6 h-6 animate-pulse" style={{ color: 'var(--blueox-primary)' }} />
          <span>Loading till...</span>
        </div>
      </div>
    );
  }

  // Receipt view
  if (lastReceipt) {
    return (
      <div className="h-screen flex items-center justify-center p-4" style={{ background: 'var(--pos-bg)' }}>
        <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4 receipt-print">
          <div className="text-center border-b pb-4">
            <h2 className="font-bold text-lg">{company?.name}</h2>
            {company?.address && <p className="text-xs text-gray-500">{company.address}</p>}
            {company?.phone && <p className="text-xs text-gray-500">Tel: {company.phone}</p>}
            <p className="text-xs text-gray-500 mt-2">{new Date().toLocaleString()}</p>
            <p className="text-xs text-gray-500">Till: {session.terminal_name}</p>
            <p className="text-xs text-gray-500">Cashier: {session.opened_by_name}</p>
            <p className="text-xs font-mono text-gray-400">{lastReceipt.invoiceNumber}</p>
          </div>
          <div className="space-y-1.5 text-sm">
            {lastReceipt.items.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="flex-1 truncate">{item.name} x{item.quantity}</span>
                <span className="ml-4 font-medium">{formatCurrency(item.line_total, lastReceipt.currency)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>{formatCurrency(lastReceipt.subtotal, lastReceipt.currency)}</span>
            </div>
            {lastReceipt.taxAmount > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Tax</span><span>{formatCurrency(lastReceipt.taxAmount, lastReceipt.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1">
              <span>TOTAL</span><span>{formatCurrency(lastReceipt.total, lastReceipt.currency)}</span>
            </div>
            {lastReceipt.method === 'cash' && (
              <>
                <div className="flex justify-between text-gray-500">
                  <span>Cash Tendered</span><span>{formatCurrency(lastReceipt.tendered, lastReceipt.currency)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Change</span><span>{formatCurrency(lastReceipt.change, lastReceipt.currency)}</span>
                </div>
              </>
            )}
          </div>
          <p className="text-center text-xs text-gray-400 border-t pt-3">Thank you for your purchase!</p>
          <div className="flex gap-2 pt-2 no-print">
            <button onClick={handlePrintAndNext} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <PrinterIcon className="w-4 h-4" /> Print & Next
            </button>
            <button onClick={() => { setLastReceipt(null); setTimeout(() => barcodeInputRef.current?.focus(), 100); }} className="btn-secondary flex-1">
              Skip Print
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        :root {
          --pos-bg: #0f172a;
          --pos-surface: #1e293b;
          --pos-surface-raised: #273549;
          --pos-border: rgba(44, 75, 160, 0.25);
          --pos-border-active: var(--blueox-primary);
          --pos-text: #f1f5f9;
          --pos-text-muted: #94a3b8;
          --pos-text-subtle: #64748b;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .receipt-print { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="h-screen flex flex-col select-none" style={{ background: 'var(--pos-bg)', color: 'var(--pos-text)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b no-print" style={{ background: 'var(--pos-surface)', borderColor: 'var(--pos-border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ShoppingCartIcon className="w-5 h-5" style={{ color: 'var(--blueox-primary)' }} />
              <span className="font-bold text-sm" style={{ color: 'var(--blueox-accent-light)' }}>POS</span>
            </div>
            <span style={{ color: 'var(--pos-border)' }}>|</span>
            <span className="text-sm font-medium" style={{ color: 'var(--pos-text)' }}>{session.terminal_name}</span>
            <span style={{ color: 'var(--pos-border)' }}>|</span>
            <span className="text-sm" style={{ color: 'var(--pos-text-muted)' }}>{session.opened_by_name}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-xs" style={{ color: 'var(--pos-text-muted)' }}>Today</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--pos-text)' }}>
                {formatCurrency(session.total_sales, currency)} · {session.transaction_count} txns
              </p>
            </div>
            <button
              onClick={() => setShowCloseModal(true)}
              className="btn-danger btn-sm flex items-center gap-1.5"
            >
              <ArrowLeftOnRectangleIcon className="w-4 h-4" />
              Close Shift
            </button>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left — product search + grid */}
          <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
            {/* Search / barcode input */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--pos-text-muted)' }} />
              <input
                ref={barcodeInputRef}
                className="w-full rounded-xl pl-10 pr-4 py-3 text-base focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--pos-surface)',
                  border: '1px solid var(--pos-border)',
                  color: 'var(--pos-text)',
                  '--tw-ring-color': 'var(--blueox-primary)',
                } as React.CSSProperties}
                placeholder="Scan barcode or search product..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleBarcodeEnter}
                autoComplete="off"
                autoFocus
              />
            </div>

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 content-start">
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="rounded-xl p-3 text-left transition-all hover:scale-[1.02] active:scale-95"
                  style={{
                    background: 'var(--pos-surface)',
                    border: '1px solid var(--pos-border)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--blueox-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--pos-border)')}
                >
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--pos-text)' }}>{p.name}</p>
                  <p className="text-xs font-bold mt-1" style={{ color: 'var(--blueox-accent-light)' }}>
                    {formatCurrency(Number(p.unit_price), currency)}
                  </p>
                  {p.sku && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--pos-text-subtle)' }}>{p.sku}</p>}
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="col-span-full text-center py-16" style={{ color: 'var(--pos-text-muted)' }}>
                  {search ? 'No products match your search' : 'No active products found'}
                </div>
              )}
            </div>
          </div>

          {/* Right — cart + payment */}
          <div className="w-80 lg:w-96 flex flex-col border-l" style={{ background: 'var(--pos-surface)', borderColor: 'var(--pos-border)' }}>

            {/* Cart header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--pos-border)' }}>
              <div className="flex items-center gap-2">
                <ShoppingCartIcon className="w-4 h-4" style={{ color: 'var(--blueox-primary)' }} />
                <span className="text-sm font-semibold" style={{ color: 'var(--pos-text)' }}>Cart</span>
                {cart.length > 0 && (
                  <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--blueox-primary)', color: 'white' }}>
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </div>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs transition-colors" style={{ color: 'var(--pos-text-muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--pos-text-muted)')}>
                  Clear all
                </button>
              )}
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <ShoppingCartIcon className="w-10 h-10 mx-auto" style={{ color: 'var(--pos-text-subtle)' }} />
                  <p className="text-sm" style={{ color: 'var(--pos-text-muted)' }}>Cart is empty</p>
                  <p className="text-xs" style={{ color: 'var(--pos-text-subtle)' }}>Scan a barcode or tap a product</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.product_id} className="rounded-xl p-3 space-y-2" style={{ background: 'var(--pos-surface-raised)', border: '1px solid var(--pos-border)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight flex-1" style={{ color: 'var(--pos-text)' }}>{item.name}</p>
                      <button onClick={() => removeFromCart(item.product_id)} className="p-0.5 rounded transition-colors" style={{ color: 'var(--pos-text-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--pos-text-subtle)')}>
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.product_id, -1)} className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors" style={{ background: 'var(--pos-surface)', border: '1px solid var(--pos-border)', color: 'var(--pos-text)' }}>
                          <MinusIcon className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold w-5 text-center" style={{ color: 'var(--pos-text)' }}>{item.quantity}</span>
                        <button onClick={() => updateQty(item.product_id, 1)} className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors" style={{ background: 'var(--pos-surface)', border: '1px solid var(--pos-border)', color: 'var(--pos-text)' }}>
                          <PlusIcon className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-bold" style={{ color: 'var(--blueox-accent-light)' }}>
                        {formatCurrency(item.line_total, currency)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Totals + payment */}
            <div className="border-t p-4 space-y-4" style={{ borderColor: 'var(--pos-border)' }}>
              {/* Totals */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between" style={{ color: 'var(--pos-text-muted)' }}>
                  <span>Subtotal</span><span>{formatCurrency(subtotal, currency)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between" style={{ color: 'var(--pos-text-muted)' }}>
                    <span>Tax</span><span>{formatCurrency(taxAmount, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-1" style={{ color: 'var(--pos-text)' }}>
                  <span>TOTAL</span><span>{formatCurrency(total, currency)}</span>
                </div>
              </div>

              {/* Payment method tabs */}
              <div className="grid grid-cols-3 gap-1.5 rounded-xl p-1" style={{ background: 'var(--pos-bg)' }}>
                {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setPaymentMethod(id)}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={paymentMethod === id
                      ? { background: 'var(--blueox-primary)', color: 'white' }
                      : { background: 'transparent', color: 'var(--pos-text-muted)' }
                    }
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Payment inputs */}
              {paymentMethod === 'cash' && (
                <div className="space-y-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                    style={{
                      background: 'var(--pos-bg)',
                      border: '1px solid var(--pos-border)',
                      color: 'var(--pos-text)',
                      '--tw-ring-color': 'var(--blueox-primary)',
                    } as React.CSSProperties}
                    placeholder={`Cash tendered (${currency})`}
                    value={tendered}
                    onChange={e => setTendered(e.target.value)}
                  />
                  {tenderedAmount >= total && total > 0 && (
                    <div className="flex justify-between text-xs px-1 font-semibold" style={{ color: '#34d399' }}>
                      <span>Change</span>
                      <span>{formatCurrency(change, currency)}</span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'mobile_money' && (
                <input
                  className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                  style={{
                    background: 'var(--pos-bg)',
                    border: '1px solid var(--pos-border)',
                    color: 'var(--pos-text)',
                    '--tw-ring-color': 'var(--blueox-primary)',
                  } as React.CSSProperties}
                  placeholder="Transaction reference (optional)"
                  value={mobileRef}
                  onChange={e => setMobileRef(e.target.value)}
                />
              )}

              {/* Charge button */}
              <button
                onClick={handleCharge}
                disabled={cart.length === 0 || processing}
                className="w-full py-4 rounded-xl font-bold text-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: cart.length === 0 ? 'var(--pos-surface-raised)' : 'var(--blueox-primary)' }}
                onMouseEnter={e => { if (cart.length > 0) e.currentTarget.style.background = 'var(--blueox-primary-hover)'; }}
                onMouseLeave={e => { if (cart.length > 0) e.currentTarget.style.background = 'var(--blueox-primary)'; }}
              >
                {processing ? 'Processing...' : `Charge ${formatCurrency(total, currency)}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Close shift modal — uses shared .card + .btn classes */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900">Close Shift</h2>
              <button onClick={() => setShowCloseModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <XMarkIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl p-4 text-sm space-y-2 bg-gray-50 border border-gray-100">
                <div className="flex justify-between">
                  <span className="text-gray-500">Opening Float</span>
                  <span className="font-semibold">{formatCurrency(session.opening_float, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Sales</span>
                  <span className="font-semibold">{formatCurrency(session.total_sales, currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Transactions</span>
                  <span className="font-semibold">{session.transaction_count}</span>
                </div>
              </div>
              <div>
                <label className="label">Cash Counted in Drawer ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  placeholder="Count the cash in the till"
                  value={cashCounted}
                  onChange={e => setCashCounted(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowCloseModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleCloseShift} disabled={closingShift} className="btn-danger">
                {closingShift ? 'Closing...' : 'Close Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
