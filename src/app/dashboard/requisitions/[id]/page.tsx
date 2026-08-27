'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCompany } from '@/contexts/company-context';
import toast from 'react-hot-toast';
import { printDeliveryForm } from '@/lib/pdf/delivery-form-pdf';
import { printRequisition } from '@/lib/pdf/requisition-pdf';
import {
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  PrinterIcon,
  TrashIcon,
  ClipboardDocumentListIcon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  ArrowPathIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

interface Line {
  id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  unit_of_measure: string;
  quantity_on_hand: number;
  quantity_requested: number;
  quantity_delivered: number;
  remarks: string | null;
}

interface DeliveryLine {
  id: string;
  product_name: string;
  unit_of_measure: string;
  quantity_requested: number;
  quantity_delivered_total: number;
  quantity_delivered: number;
  remarks: string | null;
}

interface Delivery {
  id: string;
  delivery_number: string;
  status: 'active' | 'voided';
  delivery_date: string;
  delivered_by: string | null;
  received_by: string | null;
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
  voided_by_name: string | null;
  voided_at: string | null;
  void_reason: string | null;
  lines: DeliveryLine[];
}

interface Requisition {
  id: string;
  requisition_number: string;
  client_name: string;
  delivery_location: string | null;
  notes: string | null;
  status: 'open' | 'partial' | 'completed' | 'closed';
  request_date: string;
  created_by_name: string | null;
  created_at: string;
  completed_at: string | null;
  closed_by_name: string | null;
  closed_at: string | null;
  close_reason: string | null;
  lines: Line[];
  deliveries: Delivery[];
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-gray-100 text-gray-700',
  partial: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-700',
};

export default function RequisitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { company } = useCompany();
  const router = useRouter();

  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);

  // Add item
  const [addingItem, setAddingItem] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [pendingProduct, setPendingProduct] = useState<any | null>(null);
  const [pendingQty, setPendingQty] = useState('1');
  const [pendingRemarks, setPendingRemarks] = useState('');
  const [savingNewItem, setSavingNewItem] = useState(false);

  // Edit line quantity
  const [qtyEditTarget, setQtyEditTarget] = useState<Line | null>(null);
  const [qtyEditValue, setQtyEditValue] = useState('');
  const [savingQty, setSavingQty] = useState(false);

  // Process modal
  const [showProcess, setShowProcess] = useState(false);
  const [processQtys, setProcessQtys] = useState<Record<string, string>>({});
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [stockWarnings, setStockWarnings] = useState<string[] | null>(null);

  // Close modal
  const [showClose, setShowClose] = useState(false);
  const [closeReason, setCloseReason] = useState('');
  const [closing, setClosing] = useState(false);

  // Void delivery modal
  const [voidTarget, setVoidTarget] = useState<Delivery | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  // Edit delivery modal
  const [editTarget, setEditTarget] = useState<Delivery | null>(null);
  const [editDeliveryDate, setEditDeliveryDate] = useState('');
  const [editDeliveredBy, setEditDeliveredBy] = useState('');
  const [editReceivedBy, setEditReceivedBy] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Edit requisition details modal
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [editClientName, setEditClientName] = useState('');
  const [editDeliveryLocation, setEditDeliveryLocation] = useState('');
  const [editReqNotes, setEditReqNotes] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/requisitions/${id}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load requisition');
      setRequisition(data.data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!company || !productQuery.trim()) { setProductResults([]); return; }
    const timer = setTimeout(async () => {
      const q = new URLSearchParams({ company_id: company.id, search: productQuery, active: 'true', limit: '10' });
      const res = await fetch(`/api/products?${q}`, { credentials: 'include' });
      const data = await res.json();
      setProductResults(data.data || []);
    }, 250);
    return () => clearTimeout(timer);
  }, [productQuery, company]);

  const isEditable = requisition && (requisition.status === 'open' || requisition.status === 'partial');

  const selectProductToAdd = (product: any) => {
    setPendingProduct(product);
    setPendingQty('1');
    setPendingRemarks('');
    setProductQuery('');
    setProductResults([]);
  };

  const confirmAddItem = async () => {
    if (!pendingProduct) return;
    const qty = Number(pendingQty);
    if (!(qty > 0)) {
      toast.error('Enter a quantity greater than 0');
      return;
    }
    setSavingNewItem(true);
    try {
      const res = await fetch(`/api/requisitions/${id}/lines`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: pendingProduct.id,
          quantity_requested: qty,
          remarks: pendingRemarks.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add item');
      toast.success('Item added');
      setPendingProduct(null);
      setAddingItem(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingNewItem(false);
    }
  };

  const removeItem = async (lineId: string) => {
    if (!confirm('Remove this item from the requisition?')) return;
    try {
      const res = await fetch(`/api/requisitions/${id}/lines/${lineId}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove item');
      toast.success('Item removed');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const updateRequestDate = async (value: string) => {
    if (!requisition || value === requisition.request_date) return;
    try {
      const res = await fetch(`/api/requisitions/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_date: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update request date');
      toast.success('Request date updated');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openEditDetails = () => {
    if (!requisition) return;
    setEditClientName(requisition.client_name);
    setEditDeliveryLocation(requisition.delivery_location || '');
    setEditReqNotes(requisition.notes || '');
    setShowEditDetails(true);
  };

  const submitEditDetails = async () => {
    if (!editClientName.trim()) {
      toast.error('Client name is required');
      return;
    }
    setSavingDetails(true);
    try {
      const res = await fetch(`/api/requisitions/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: editClientName.trim(),
          delivery_location: editDeliveryLocation.trim() || null,
          notes: editReqNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update requisition details');
      toast.success('Requisition details updated');
      setShowEditDetails(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingDetails(false);
    }
  };

  const openQtyEdit = (line: Line) => {
    setQtyEditTarget(line);
    setQtyEditValue(String(line.quantity_requested));
  };

  const submitQtyEdit = async () => {
    if (!qtyEditTarget) return;
    const qty = Number(qtyEditValue);
    if (!(qty > 0)) {
      toast.error('Enter a quantity greater than 0');
      return;
    }
    if (qty < Number(qtyEditTarget.quantity_delivered)) {
      toast.error(`Cannot be less than the ${qtyEditTarget.quantity_delivered} already delivered`);
      return;
    }
    setSavingQty(true);
    try {
      const res = await fetch(`/api/requisitions/${id}/lines/${qtyEditTarget.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity_requested: qty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update item');
      toast.success('Quantity updated');
      setQtyEditTarget(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingQty(false);
    }
  };

  const openProcess = () => {
    if (!requisition) return;
    const initial: Record<string, string> = {};
    requisition.lines.forEach(l => {
      const remaining = Number(l.quantity_requested) - Number(l.quantity_delivered);
      if (remaining > 0) initial[l.id] = '';
    });
    setProcessQtys(initial);
    setDeliveryDate(new Date().toISOString().slice(0, 10));
    setDeliveredBy('');
    setReceivedBy('');
    setDeliveryNotes('');
    setStockWarnings(null);
    setShowProcess(true);
  };

  const submitProcess = async (confirmed = false) => {
    if (!requisition) return;
    const lines = Object.entries(processQtys)
      .filter(([, v]) => Number(v) > 0)
      .map(([requisition_line_id, v]) => ({ requisition_line_id, quantity_delivered: Number(v) }));

    if (lines.length === 0) {
      toast.error('Enter a quantity for at least one item');
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/requisitions/${id}/deliveries`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_date: deliveryDate || null,
          delivered_by: deliveredBy.trim() || null,
          received_by: receivedBy.trim() || null,
          notes: deliveryNotes.trim() || null,
          lines,
          confirmed,
        }),
      });
      const data = await res.json();
      if (res.status === 409 && data.warnings) {
        setStockWarnings(data.warnings);
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Failed to process delivery');
      toast.success(`Delivery ${data.data.delivery_number} created`);
      setShowProcess(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const openVoidModal = (delivery: Delivery) => {
    setVoidTarget(delivery);
    setVoidReason('');
  };

  const submitVoidDelivery = async () => {
    if (!voidTarget) return;
    setVoiding(true);
    try {
      const res = await fetch(`/api/requisitions/${id}/deliveries/${voidTarget.id}/void`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ void_reason: voidReason.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to void delivery');
      toast.success('Delivery voided and stock reversed');
      setVoidTarget(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setVoiding(false);
    }
  };

  const openEditModal = (delivery: Delivery) => {
    setEditTarget(delivery);
    setEditDeliveryDate(delivery.delivery_date?.slice(0, 10) || '');
    setEditDeliveredBy(delivery.delivered_by || '');
    setEditReceivedBy(delivery.received_by || '');
    setEditNotes(delivery.notes || '');
  };

  const submitEditDelivery = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/requisitions/${id}/deliveries/${editTarget.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_date: editDeliveryDate || null,
          delivered_by: editDeliveredBy,
          received_by: editReceivedBy,
          notes: editNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update delivery form');
      toast.success('Delivery form updated');
      setEditTarget(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handlePrintRequisition = () => {
    if (!requisition) return;
    printRequisition({
      requisition_number: requisition.requisition_number,
      client_name: requisition.client_name,
      delivery_location: requisition.delivery_location,
      request_date: new Date(requisition.request_date).toLocaleDateString(),
      status: requisition.status,
      notes: requisition.notes,
      created_by_name: requisition.created_by_name,
      created_at: new Date(requisition.created_at).toLocaleString(),
      lines: requisition.lines.map(l => ({
        product_name: l.product_name,
        unit_of_measure: l.unit_of_measure,
        quantity_requested: Number(l.quantity_requested),
        quantity_delivered: Number(l.quantity_delivered),
        remarks: l.remarks,
      })),
      deliveries: requisition.deliveries.map(d => ({
        delivery_number: d.delivery_number,
        delivery_date: new Date(d.delivery_date).toLocaleDateString(),
        status: d.status,
      })),
      company: company ? {
        name: company.name || undefined,
        logo_url: company.logo_url,
        email: company.email,
        phone: company.phone,
        address: [company.address, company.city, company.country].filter(Boolean).join(', '),
        tax_id: company.tax_id,
        registration_number: company.registration_number,
        duns_number: company.duns_number,
      } : undefined,
    });
  };

  const handlePrintDelivery = (d: Delivery) => {
    if (!requisition) return;
    printDeliveryForm({
      delivery_number: d.delivery_number,
      delivery_date: new Date(d.delivery_date).toLocaleDateString(),
      delivered_by: d.delivered_by,
      received_by: d.received_by,
      notes: d.notes,
      requisition_number: requisition.requisition_number,
      client_name: requisition.client_name,
      delivery_location: requisition.delivery_location,
      status: d.status,
      lines: d.lines.map(dl => ({
        product_name: dl.product_name,
        unit_of_measure: dl.unit_of_measure,
        quantity_requested: Number(dl.quantity_requested),
        quantity_delivered_total: Number(dl.quantity_delivered_total),
        quantity_delivered: Number(dl.quantity_delivered),
        remarks: dl.remarks,
      })),
      company: company ? {
        name: company.name || undefined,
        logo_url: company.logo_url,
        email: company.email,
        phone: company.phone,
        address: [company.address, company.city, company.country].filter(Boolean).join(', '),
        tax_id: company.tax_id,
        registration_number: company.registration_number,
        duns_number: company.duns_number,
      } : undefined,
    });
  };

  const closeRequisition = async () => {
    setClosing(true);
    try {
      const res = await fetch(`/api/requisitions/${id}/close`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ close_reason: closeReason.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to close requisition');
      toast.success('Requisition closed');
      setShowClose(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setClosing(false);
    }
  };

  const reopenRequisition = async () => {
    if (!confirm('Reopen this requisition?')) return;
    try {
      const res = await fetch(`/api/requisitions/${id}/reopen`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reopen requisition');
      toast.success('Requisition reopened');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteRequisition = async () => {
    if (!confirm('Delete this requisition? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/requisitions/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete requisition');
      toast.success('Requisition deleted');
      router.push('/dashboard/requisitions');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading || !requisition) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
        <div className="max-w-5xl mx-auto text-center text-gray-500 py-20">Loading...</div>
      </div>
    );
  }

  const totalRequested = requisition.lines.reduce((s, l) => s + Number(l.quantity_requested), 0);
  const totalDelivered = requisition.lines.reduce((s, l) => s + Number(l.quantity_delivered), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <button onClick={() => router.push('/dashboard/requisitions')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeftIcon className="w-4 h-4" /> Back to requisitions
        </button>

        <div className="bg-white/90 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-lg p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{requisition.requisition_number}</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[requisition.status]}`}>
                  {requisition.status}
                </span>
              </div>
              <p className="text-gray-600 mt-1">
                <span className="font-medium">{requisition.client_name}</span>
                {requisition.delivery_location ? ` · ${requisition.delivery_location}` : ''}
              </p>
              {requisition.notes && <p className="text-sm text-gray-500 mt-1">{requisition.notes}</p>}

              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-medium text-gray-500">Request Date:</span>
                {isEditable ? (
                  <input
                    type="date"
                    className="input !py-0.5 !px-2 !text-xs w-36"
                    defaultValue={requisition.request_date?.slice(0, 10)}
                    onBlur={e => updateRequestDate(e.target.value)}
                  />
                ) : (
                  <span className="text-xs text-gray-700">{new Date(requisition.request_date).toLocaleDateString()}</span>
                )}
              </div>

              <p className="text-xs text-gray-400 mt-1">
                Created by {requisition.created_by_name || 'Unknown'} on {new Date(requisition.created_at).toLocaleString()}
              </p>
              {requisition.status === 'completed' && requisition.completed_at && (
                <p className="text-xs text-green-600">Completed {new Date(requisition.completed_at).toLocaleString()}</p>
              )}
              {requisition.status === 'closed' && (
                <p className="text-xs text-red-600">
                  Closed by {requisition.closed_by_name || 'Unknown'} on {requisition.closed_at ? new Date(requisition.closed_at).toLocaleString() : ''}
                  {requisition.close_reason ? ` — ${requisition.close_reason}` : ''}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handlePrintRequisition} className="btn-secondary flex items-center gap-2">
                <PrinterIcon className="w-5 h-5" /> Print
              </button>
              {isEditable && (
                <button onClick={openEditDetails} className="btn-secondary flex items-center gap-2">
                  <PencilIcon className="w-5 h-5" /> Edit Details
                </button>
              )}
              {isEditable && (
                <button onClick={openProcess} className="btn-primary flex items-center gap-2">
                  <ClipboardDocumentListIcon className="w-5 h-5" /> Process
                </button>
              )}
              {isEditable && (
                <button onClick={() => setShowClose(true)} className="btn-secondary">
                  Close
                </button>
              )}
              {requisition.status === 'closed' && (
                <button onClick={reopenRequisition} className="btn-secondary flex items-center gap-2">
                  <ArrowPathIcon className="w-4 h-4" /> Reopen
                </button>
              )}
              {requisition.status === 'open' && requisition.deliveries.length === 0 && (
                <button onClick={deleteRequisition} className="text-red-600 hover:text-red-800 p-2" title="Delete">
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white/90 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Items ({Number(totalDelivered)} / {Number(totalRequested)} delivered)</h2>
            {isEditable && (
              <button
                onClick={() => { setAddingItem(v => !v); setPendingProduct(null); setProductQuery(''); }}
                className="btn-secondary flex items-center gap-1 text-sm"
              >
                <PlusIcon className="w-4 h-4" /> Add Item
              </button>
            )}
          </div>

          {addingItem && !pendingProduct && (
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                autoFocus
                className="input pl-9"
                placeholder="Search products..."
                value={productQuery}
                onChange={e => setProductQuery(e.target.value)}
              />
              {productResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {productResults.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center justify-between"
                      onClick={() => selectProductToAdd(p)}
                    >
                      <span>{p.name}</span>
                      <span className="text-xs text-gray-400">{p.quantity_on_hand} {p.unit_of_measure} in stock</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {addingItem && pendingProduct && (
            <div className="border border-blueox-primary/20 rounded-xl p-4 space-y-3 bg-blueox-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{pendingProduct.name}</p>
                  <p className="text-xs text-gray-400">{pendingProduct.quantity_on_hand} {pendingProduct.unit_of_measure} in stock</p>
                </div>
                <button type="button" onClick={() => setPendingProduct(null)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    autoFocus
                    className="input"
                    value={pendingQty}
                    onChange={e => setPendingQty(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Remarks</label>
                  <input
                    type="text"
                    className="input"
                    value={pendingRemarks}
                    onChange={e => setPendingRemarks(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary text-sm" onClick={() => setPendingProduct(null)}>Cancel</button>
                <button type="button" className="btn-primary text-sm" disabled={savingNewItem} onClick={confirmAddItem}>
                  {savingNewItem ? 'Adding...' : 'Add Item'}
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Item</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Qty Due</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Delivered</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Pending</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requisition.lines.map(l => {
                  const remaining = Number(l.quantity_requested) - Number(l.quantity_delivered);
                  const locked = remaining <= 0;
                  return (
                    <tr key={l.id}>
                      <td className="px-3 py-2 text-gray-800">
                        {l.product_name}
                        <span className="text-xs text-gray-400 block">{l.unit_of_measure} · {l.quantity_on_hand} in stock</span>
                      </td>
                      <td className="px-3 py-2">
                        {isEditable && !locked ? (
                          <button
                            type="button"
                            onClick={() => openQtyEdit(l)}
                            className="inline-flex items-center gap-1.5 text-gray-800 hover:text-blueox-primary transition-colors"
                            title="Edit quantity"
                          >
                            {Number(l.quantity_requested)}
                            <PencilIcon className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                        ) : (
                          Number(l.quantity_requested)
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{Number(l.quantity_delivered)}</td>
                      <td className="px-3 py-2">
                        {locked ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-semibold">
                            <LockClosedIcon className="w-3.5 h-3.5" /> Complete
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium">{remaining}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {isEditable && Number(l.quantity_delivered) === 0 && (
                          <button
                            type="button"
                            onClick={() => removeItem(l.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Remove item"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Delivery forms */}
        <div className="bg-white/90 backdrop-blur-xl border border-blueox-primary/20 rounded-2xl shadow-lg p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Delivery Forms</h2>
          {requisition.deliveries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No deliveries processed yet</p>
          ) : (
            <div className="space-y-3">
              {requisition.deliveries.map(d => (
                <div key={d.id} className={`border rounded-xl p-4 ${d.status === 'voided' ? 'border-red-200 bg-red-50/50' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{d.delivery_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${d.status === 'voided' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {d.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(d.delivery_date).toLocaleDateString()} · Delivered by {d.delivered_by || '—'} · Received by {d.received_by || '—'}
                      </p>
                      <p className="text-xs text-gray-400">
                        Created by {d.created_by_name || 'Unknown'} on {new Date(d.created_at).toLocaleString()}
                      </p>
                      {d.status === 'voided' && (
                        <p className="text-xs text-red-600 mt-1">
                          Voided by {d.voided_by_name || 'Unknown'} on {d.voided_at ? new Date(d.voided_at).toLocaleString() : ''}
                          {d.void_reason ? ` — ${d.void_reason}` : ''}
                        </p>
                      )}
                      <ul className="text-xs text-gray-600 mt-2 space-y-0.5">
                        {d.lines.map(dl => (
                          <li key={dl.id}>{dl.product_name}: {Number(dl.quantity_delivered)}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePrintDelivery(d)}
                        className="btn-secondary flex items-center gap-1 text-xs px-3 py-1.5"
                      >
                        <PrinterIcon className="w-4 h-4" /> Print
                      </button>
                      {d.status === 'active' && (
                        <>
                          <button
                            onClick={() => openEditModal(d)}
                            className="btn-secondary flex items-center gap-1 text-xs px-3 py-1.5"
                          >
                            <PencilIcon className="w-4 h-4" /> Edit
                          </button>
                          <button
                            onClick={() => openVoidModal(d)}
                            className="text-red-600 hover:text-red-800 text-xs font-semibold px-3 py-1.5 border border-red-200 rounded-lg"
                          >
                            Void
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Process modal */}
      {showProcess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full !max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Process Delivery</h3>
              <button onClick={() => setShowProcess(false)}><XMarkIcon className="w-6 h-6 text-gray-400" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Date</label>
                <input type="date" className="input" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Delivered By</label>
                <input type="text" className="input" value={deliveredBy} onChange={e => setDeliveredBy(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Received By</label>
                <input type="text" className="input" value={receivedBy} onChange={e => setReceivedBy(e.target.value)} />
              </div>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Item</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Remaining</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 w-32">Deliver Now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requisition.lines.filter(l => Number(l.quantity_requested) - Number(l.quantity_delivered) > 0).map(l => {
                  const remaining = Number(l.quantity_requested) - Number(l.quantity_delivered);
                  return (
                    <tr key={l.id}>
                      <td className="px-3 py-2 text-gray-800">{l.product_name}</td>
                      <td className="px-3 py-2 text-gray-600">{remaining}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          step="any"
                          className="input"
                          value={processQtys[l.id] ?? ''}
                          onChange={e => setProcessQtys(prev => ({ ...prev, [l.id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="input" rows={2} value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} />
            </div>

            {stockWarnings && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-800">Stock warning</p>
                <ul className="text-sm text-amber-700 list-disc list-inside">
                  {stockWarnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
                <p className="text-xs text-amber-600">You can adjust the quantities above, or confirm to proceed anyway.</p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowProcess(false)}>Cancel</button>
              {stockWarnings ? (
                <button className="btn-primary" disabled={processing} onClick={() => submitProcess(true)}>
                  {processing ? 'Processing...' : 'Confirm Anyway'}
                </button>
              ) : (
                <button className="btn-primary" disabled={processing} onClick={() => submitProcess(false)}>
                  {processing ? 'Processing...' : 'Create Delivery Form'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Close modal */}
      {showClose && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Close Requisition</h3>
            <p className="text-sm text-gray-600">
              Any remaining undelivered quantity will no longer be processed. What has already been delivered stays as is.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
              <textarea className="input" rows={2} value={closeReason} onChange={e => setCloseReason(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowClose(false)}>Cancel</button>
              <button className="btn-primary" disabled={closing} onClick={closeRequisition}>
                {closing ? 'Closing...' : 'Close Requisition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void delivery modal */}
      {voidTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Void Delivery {voidTarget.delivery_number}</h3>
            <p className="text-sm text-gray-600">
              Stock and delivered quantities for this delivery will be reversed. The delivery form stays in the record, marked as voided.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
              <textarea
                className="input"
                rows={2}
                autoFocus
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setVoidTarget(null)}>Cancel</button>
              <button
                className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
                disabled={voiding}
                onClick={submitVoidDelivery}
              >
                {voiding ? 'Voiding...' : 'Void Delivery'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit requisition details modal */}
      {showEditDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Edit Requisition Details</h3>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client Name *</label>
              <input type="text" className="input" value={editClientName} onChange={e => setEditClientName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Location</label>
              <input type="text" className="input" value={editDeliveryLocation} onChange={e => setEditDeliveryLocation(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="input" rows={2} value={editReqNotes} onChange={e => setEditReqNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowEditDetails(false)}>Cancel</button>
              <button className="btn-primary" disabled={savingDetails} onClick={submitEditDetails}>
                {savingDetails ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit line quantity modal */}
      {qtyEditTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Edit Quantity</h3>
            <p className="text-sm text-gray-600">{qtyEditTarget.product_name}</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Quantity Requested</label>
              <input
                type="number"
                min={Number(qtyEditTarget.quantity_delivered)}
                step="any"
                autoFocus
                className="input"
                value={qtyEditValue}
                onChange={e => setQtyEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitQtyEdit(); }}
              />
              {Number(qtyEditTarget.quantity_delivered) > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Cannot be less than {Number(qtyEditTarget.quantity_delivered)} already delivered
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setQtyEditTarget(null)}>Cancel</button>
              <button className="btn-primary" disabled={savingQty} onClick={submitQtyEdit}>
                {savingQty ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit delivery modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Edit Delivery {editTarget.delivery_number}</h3>
            <p className="text-sm text-gray-600">
              Quantities delivered cannot be changed here — void this delivery and process a new one for that. You can fix the date, names, and notes below.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Date</label>
                <input type="date" className="input" value={editDeliveryDate} onChange={e => setEditDeliveryDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Delivered By</label>
                <input type="text" className="input" value={editDeliveredBy} onChange={e => setEditDeliveredBy(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Received By</label>
                <input type="text" className="input" value={editReceivedBy} onChange={e => setEditReceivedBy(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="input" rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
              <button className="btn-primary" disabled={savingEdit} onClick={submitEditDelivery}>
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
