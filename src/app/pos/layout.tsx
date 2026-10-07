import type { Metadata } from 'next';
import { CompanyProvider } from '@/contexts/company-context';
import { PosTillGuard } from './pos-till-guard';

export const metadata: Metadata = {
  title: 'POS Till',
};

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompanyProvider>
      <div className="h-screen overflow-hidden bg-gray-900 text-white">
        <PosTillGuard>{children}</PosTillGuard>
      </div>
    </CompanyProvider>
  );
}
