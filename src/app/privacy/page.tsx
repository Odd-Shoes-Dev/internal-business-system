import { LegalDocument } from '@/components/legal-document';

export const metadata = {
  title: 'Privacy Policy - BlueOx',
};

export default function PrivacyPolicyPage() {
  return <LegalDocument title="Privacy Policy" filePath="docs/contracts/PRIVACY_POLICY.md" />;
}
