'use client';

import Link from 'next/link';
import { ModuleGuard } from '@/components/module-guard';
import { useCompany } from '@/contexts/company-context';

// Separate client component so the layout above can stay a server component (it exports
// metadata, which 'use client' files cannot do).
export function PosTillGuard({ children }: { children: React.ReactNode }) {
  const { loading } = useCompany();
  if (loading) return null;

  return (
    <ModuleGuard
      module="pos"
      fallback={
        <div className="flex h-screen items-center justify-center bg-gray-900 p-6 text-center text-white">
          <div>
            <h2 className="text-lg font-semibold">Point of Sale is not on your plan</h2>
            <p className="mt-2 text-sm text-gray-300">
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
        </div>
      }
    >
      {children}
    </ModuleGuard>
  );
}
