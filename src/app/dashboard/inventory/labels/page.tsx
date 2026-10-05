'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { ArrowLeftIcon, MagnifyingGlassIcon, PrinterIcon, QrCodeIcon } from '@heroicons/react/24/outline';
import { useCompany } from '@/contexts/company-context';
import { formatCurrency } from '@/lib/currency';

interface LabelProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit_price: string;
  currency: string;
  shelf_location: string | null;
}

// What the code holds: the barcode when there is one (scans straight into the till), else the SKU
const codeValue = (p: LabelProduct) => p.barcode || p.sku || p.id;

function LabelsPage() {
  const { company } = useCompany();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<LabelProduct[]>([]);
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [showPrice, setShowPrice] = useState(true);
  const [showShelf, setShowShelf] = useState(false);
  const [codes, setCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!company?.id) return;
    fetch(`/api/inventory?company_id=${company.id}&limit=1000`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        setProducts(d.data || []);
        const preselected = (searchParams.get('ids') || '').split(',').filter(Boolean);
        if (preselected.length) setCopies(Object.fromEntries(preselected.map((id) => [id, 1])));
      })
      .catch(() => {});
  }, [company?.id, searchParams]);

  const selected = useMemo(() => products.filter((p) => (copies[p.id] || 0) > 0), [products, copies]);

  // QR images for the chosen products
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      selected.filter((p) => !codes[p.id]).map(async (p) => [p.id, await QRCode.toDataURL(codeValue(p), { margin: 0, width: 160 })] as const)
    ).then((pairs) => {
      if (!cancelled && pairs.length) setCodes((c) => ({ ...c, ...Object.fromEntries(pairs) }));
    });
    return () => { cancelled = true; };
  }, [selected, codes]);

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search)
  );
  const labels = selected.flatMap((p) => Array.from({ length: copies[p.id] }, (_, i) => ({ product: p, key: `${p.id}-${i}` })));

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .label-sheet, .label-sheet * { visibility: visible; }
          .label-sheet { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/inventory" className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeftIcon className="w-5 h-5 text-gray-600" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><QrCodeIcon className="w-6 h-6 text-blueox-primary" /> Print labels</h1>
            <p className="text-gray-600">Shelf and product labels with a QR code that scans at the till</p>
          </div>
        </div>
        <button onClick={() => window.print()} disabled={!labels.length} className="btn-primary inline-flex items-center gap-2">
          <PrinterIcon className="w-4 h-4" /> Print {labels.length} label{labels.length === 1 ? '' : 's'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block">
        <div className="card p-4 space-y-3 print:hidden">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Price</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={showShelf} onChange={(e) => setShowShelf(e.target.checked)} /> Shelf</label>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y border rounded-xl">
            {filtered.slice(0, 300).map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="flex-1 truncate">{p.name}</span>
                <input type="number" min="0" className="input w-16 py-1 text-right" value={copies[p.id] || ''} placeholder="0"
                  onChange={(e) => setCopies((c) => ({ ...c, [p.id]: Math.max(0, Math.min(500, parseInt(e.target.value, 10) || 0)) }))} />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">Enter how many labels to print for each product.</p>
        </div>

        <div className="lg:col-span-2">
          {labels.length === 0 ? (
            <div className="card p-10 text-center text-gray-500 print:hidden">Choose products to see the labels here</div>
          ) : (
            <div className="label-sheet grid grid-cols-2 sm:grid-cols-3 gap-2">
              {labels.map(({ product, key }) => (
                <div key={key} className="border border-gray-300 rounded p-2 flex gap-2 items-center bg-white break-inside-avoid">
                  {codes[product.id]
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={codes[product.id]} alt="" className="w-16 h-16" />
                    : <div className="w-16 h-16 bg-gray-100" />}
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold text-sm leading-tight line-clamp-2">{product.name}</p>
                    {showPrice && <p className="font-bold">{formatCurrency(Number(product.unit_price), (product.currency || company?.currency || 'UGX') as any)}</p>}
                    <p className="font-mono text-[10px] text-gray-600 truncate">{codeValue(product)}</p>
                    {showShelf && product.shelf_location && <p className="text-[10px] text-gray-500">{product.shelf_location}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LabelsPageWrapper() {
  return (
    <Suspense fallback={null}>
      <LabelsPage />
    </Suspense>
  );
}
