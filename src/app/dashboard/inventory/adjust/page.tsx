'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCompany } from '@/contexts/company-context';
import toast from 'react-hot-toast';
import { ADJUSTMENT_REASON_OPTIONS } from '@/lib/inventory/adjustment-reasons';
import {
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { PageHeader } from '@/components/page-header';

interface Product {
  id: string;
  name: string;
  sku: string;
  quantity_on_hand: number;
}

interface AdjustmentLine {
  id: string;
  product_id: string;
  product_name: string;
  current_quantity: number;
  adjustment_quantity: number;
  new_quantity: number;
  reason: string;
}

export default function InventoryAdjustmentPage() {
  const router = useRouter();
  const { company } = useCompany();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<AdjustmentLine[]>([]);
  const [adjustmentDate, setAdjustmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!company?.id) {
      return;
    }
    loadProducts();
  }, [company?.id]);

  const loadProducts = async () => {
    try {
      if (!company?.id) {
        return;
      }

      const response = await fetch(`/api/inventory?company_id=${company.id}&limit=500`, {
        credentials: 'include',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load products');
      }

      setProducts((result.data || []).filter((p: any) => p.track_inventory !== false));
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('Failed to load products');
    }
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: Math.random().toString(),
        product_id: '',
        product_name: '',
        current_quantity: 0,
        adjustment_quantity: 0,
        new_quantity: 0,
        reason: 'count_correction',
      },
    ]);
  };

  const updateLine = (index: number, field: keyof AdjustmentLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };

    if (field === 'product_id') {
      const product = products.find((p) => p.id === value);
      if (product) {
        newLines[index].product_name = product.name;
        newLines[index].current_quantity = Number(product.quantity_on_hand || 0);
        newLines[index].new_quantity = Number(product.quantity_on_hand || 0) + newLines[index].adjustment_quantity;
      }
    }

    if (field === 'adjustment_quantity') {
      newLines[index].new_quantity = newLines[index].current_quantity + parseFloat(value || '0');
    }

    setLines(newLines);
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lines.length === 0) {
      toast.error('Please add at least one adjustment');
      return;
    }

    if (lines.some((line) => !line.product_id)) {
      toast.error('Please select a product for all lines');
      return;
    }

    setLoading(true);
    try {
      if (!company?.id) {
        throw new Error('No company selected');
      }

      const toSend = lines.filter((line) => line.adjustment_quantity !== 0);
      const response = await fetch('/api/stock-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          company_id: company.id,
          approve: true, // applied now if you may approve; otherwise they wait for approval
          lines: toSend.map((line) => ({
            product_id: line.product_id,
            quantity_change: line.adjustment_quantity,
            reason: line.reason,
            notes: notes || null,
          })),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || 'Failed to process adjustment');
      }
      const pending = (result.data || []).filter((a: any) => a.status === 'pending').length;
      if (pending) toast.success(`${pending} adjustment(s) sent for approval`);

      toast.success('Inventory adjusted successfully');
      router.push('/dashboard/inventory/adjustments');
    } catch (error: any) {
      console.error('Error adjusting inventory:', error);
      toast.error(error.message || 'Failed to adjust inventory');
    } finally {
      setLoading(false);
    }
  };

  const reasonOptions = ADJUSTMENT_REASON_OPTIONS;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader title="Inventory Adjustment" />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Adjustment Info */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Adjustment Information</h2>
          </div>
          <div className="card-body space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">
                  Adjustment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={adjustmentDate}
                  onChange={(e) => setAdjustmentDate(e.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input"
                rows={2}
                placeholder="Reason for adjustment..."
              />
            </div>
          </div>
        </div>

        {/* Adjustment Lines */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold">Adjustments</h2>
            <button type="button" onClick={addLine} className="btn-primary flex items-center gap-2">
              <PlusIcon className="w-4 h-4" />
              Add Product
            </button>
          </div>
          <div className="card-body">
            {lines.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No adjustments added. Click &quot;Add Product&quot; to start.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-64">Product</th>
                      <th className="w-32">Current Qty</th>
                      <th className="w-32">Adjustment</th>
                      <th className="w-32">New Qty</th>
                      <th className="w-48">Reason</th>
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={line.id}>
                        <td>
                          <select
                            value={line.product_id}
                            onChange={(e) => updateLine(index, 'product_id', e.target.value)}
                            className="input text-sm"
                            required
                          >
                            <option value="">Select product...</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name} ({product.sku})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="text-center font-medium">{line.current_quantity}</td>
                        <td>
                          <input
                            type="number"
                            value={line.adjustment_quantity === 0 ? '' : line.adjustment_quantity}
                            onChange={(e) => {
                              const raw = e.target.value;
                              updateLine(index, 'adjustment_quantity', raw === '' || raw === '-' ? 0 : parseFloat(raw) || 0);
                            }}
                            onBlur={(e) => {
                              if (e.target.value === '' || e.target.value === '-') {
                                updateLine(index, 'adjustment_quantity', 0);
                              }
                            }}
                            className="input text-sm text-center"
                            step="0.01"
                            placeholder="0"
                            required
                          />
                        </td>
                        <td className="text-center font-medium">{line.new_quantity}</td>
                        <td>
                          <select
                            value={line.reason}
                            onChange={(e) => updateLine(index, 'reason', e.target.value)}
                            className="input text-sm"
                            required
                          >
                            {reasonOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="btn-ghost text-red-600 p-1"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/dashboard/inventory/adjustments" className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={loading || lines.length === 0} className="btn-primary">
            {loading ? 'Processing...' : 'Process Adjustment'}
          </button>
        </div>
      </form>
    </div>
  );
}
