import { LegalDocument } from '@/components/legal-document';

export const metadata = {
  title: 'Terms of Service - BlueOx',
};

export default function TermsOfServicePage() {
  return <LegalDocument title="Terms of Service" filePath="docs/contracts/TERMS_OF_SERVICE.md" />;
}
