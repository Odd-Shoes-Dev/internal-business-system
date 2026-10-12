'use client';

import Link from 'next/link';
import { ModuleGuard } from '@/components/module-guard';
import { useCompany } from '@/contexts/company-context';

export default function POSManagerLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useCompany();
  if (loading) return null;

  return (
    <ModuleGuard
      module="pos"
      fallback={
        <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Point of Sale is not on your plan</h2>
          <p className="mt-2 text-sm text-gray-600">
            Add the POS module from Billing, or contact support.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/dashboard/billing/add-modules" className="btn-primary">
              Add module
            </Link>
            <Link href="/dashboard" className="btn-secondary">
              Back to dashboard
            </Link>
          </div>
        </div>
      }
    >
      {children}
    </ModuleGuard>
  );
}
