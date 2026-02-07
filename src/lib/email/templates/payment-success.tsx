import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import * as React from 'react';

interface PaymentSuccessEmailProps {
  companyName: string;
  planName: string;
  amount: string;
  invoiceNumber: string;
  invoiceUrl?: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
}

export const PaymentSuccessEmail = ({
  companyName,
  planName,
  amount,
  invoiceNumber,
  invoiceUrl,
  billingPeriodStart,
  billingPeriodEnd,
}: PaymentSuccessEmailProps) => {
  const previewText = `Payment received - ${amount}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>✅ Payment Successful</Heading>
          
          <Text style={text}>Hi {companyName} team,</Text>
          
          <Text style={text}>
            Thank you! Your payment has been processed successfully.
          </Text>

          <Section style={successBox}>
            <Text style={successIcon}>✓</Text>
            <Text style={successText}>Payment Confirmed</Text>
          </Section>

          <Section style={detailsBox}>
            <table style={table}>
              <tr>
                <td style={labelCell}>Plan:</td>
                <td style={valueCell}>{planName}</td>
              </tr>
              <tr>
                <td style={labelCell}>Amount Paid:</td>
                <td style={valueCell}><strong>{amount}</strong></td>
              </tr>
              <tr>
                <td style={labelCell}>Invoice Number:</td>
                <td style={valueCell}>{invoiceNumber}</td>
              </tr>
              <tr>
                <td style={labelCell}>Billing Period:</td>
                <td style={valueCell}>{billingPeriodStart} - {billingPeriodEnd}</td>
              </tr>
            </table>
          </Section>

          {invoiceUrl && (
            <Section style={buttonContainer}>
              <Button style={button} href={invoiceUrl}>
                Download Invoice
              </Button>
            </Section>
          )}

          <Hr style={hr} />

          <Text style={text}>
            Your subscription is now active and you have full access to all features in your plan.
          </Text>

          <Text style={smallText}>
            You can manage your subscription, update payment methods, or view billing history anytime from your dashboard.
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            Questions about your billing? Contact us at support@blueox.app
          </Text>

          <Text style={footer}>
            BlueOx Business Platform<br />
            Empowering businesses across Africa and beyond
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default PaymentSuccessEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const h1 = {
  color: '#1f2937',
  fontSize: '32px',
  fontWeight: '700',
  margin: '40px 0',
  padding: '0 40px',
  textAlign: 'center' as const,
};

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '26px',
  padding: '0 40px',
};

const smallText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '22px',
  padding: '0 40px',
};

const successBox = {
  backgroundColor: '#d1fae5',
  borderRadius: '8px',
  margin: '24px 40px',
  padding: '24px',
  textAlign: 'center' as const,
};

const successIcon = {
  color: '#065f46',
  fontSize: '48px',
  fontWeight: '700',
  margin: '0',
};

const successText = {
  color: '#065f46',
  fontSize: '20px',
  fontWeight: '600',
  margin: '8px 0 0 0',
};

const detailsBox = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  margin: '24px 40px',
  padding: '24px',
};

const table = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const labelCell = {
  color: '#6b7280',
  fontSize: '14px',
  padding: '8px 0',
  width: '40%',
};

const valueCell = {
  color: '#1f2937',
  fontSize: '14px',
  padding: '8px 0',
  textAlign: 'right' as const,
};

const buttonContainer = {
  padding: '24px 40px',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 40px',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '32px 40px',
};

const footer = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '18px',
  padding: '0 40px',
  textAlign: 'center' as const,
};
