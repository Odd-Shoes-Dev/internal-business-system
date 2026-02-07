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

interface PaymentFailedEmailProps {
  companyName: string;
  planName: string;
  amount: string;
  failureReason?: string;
  updatePaymentUrl: string;
  retryDate: string;
}

export const PaymentFailedEmail = ({
  companyName,
  planName,
  amount,
  failureReason,
  updatePaymentUrl,
  retryDate,
}: PaymentFailedEmailProps) => {
  const previewText = 'Payment failed - Action required';

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>⚠️ Payment Failed</Heading>
          
          <Text style={text}>Hi {companyName} team,</Text>
          
          <Text style={text}>
            We were unable to process your recent payment for the <strong>{planName}</strong> plan.
          </Text>

          <Section style={errorBox}>
            <Text style={errorIcon}>✗</Text>
            <Text style={errorText}>Payment Declined</Text>
            <Text style={errorAmount}>{amount}</Text>
            {failureReason && (
              <Text style={errorReason}>Reason: {failureReason}</Text>
            )}
          </Section>

          <Text style={text}>
            <strong>What you need to do:</strong>
          </Text>

          <Text style={text}>
            Please update your payment method to avoid service interruption. We will automatically retry the payment on <strong>{retryDate}</strong>.
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={updatePaymentUrl}>
              Update Payment Method
            </Button>
          </Section>

          <Hr style={hr} />

          <Section style={infoBox}>
            <Text style={infoTitle}>Common reasons for payment failure:</Text>
            <Text style={infoText}>
              • Insufficient funds in your account<br />
              • Expired or invalid card<br />
              • Card security restrictions<br />
              • Bank declining the transaction
            </Text>
          </Section>

          <Text style={text}>
            <strong>Timeline:</strong>
          </Text>
          <Text style={smallText}>
            • We'll retry payment in 3 days<br />
            • If payment fails again, we'll try 2 more times<br />
            • Your subscription will be cancelled after the final retry<br />
            • You'll have 7 days to reactivate before data deletion
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            Need help? Contact us at support@blueox.app
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

export default PaymentFailedEmail;

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

const errorBox = {
  backgroundColor: '#fee2e2',
  border: '2px solid #dc2626',
  borderRadius: '8px',
  margin: '24px 40px',
  padding: '24px',
  textAlign: 'center' as const,
};

const errorIcon = {
  color: '#991b1b',
  fontSize: '48px',
  fontWeight: '700',
  margin: '0',
};

const errorText = {
  color: '#991b1b',
  fontSize: '20px',
  fontWeight: '600',
  margin: '8px 0',
};

const errorAmount = {
  color: '#991b1b',
  fontSize: '24px',
  fontWeight: '700',
  margin: '8px 0 0 0',
};

const errorReason = {
  color: '#7f1d1d',
  fontSize: '14px',
  margin: '12px 0 0 0',
  fontStyle: 'italic' as const,
};

const infoBox = {
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  margin: '24px 40px',
  padding: '20px',
};

const infoTitle = {
  color: '#1e40af',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 8px 0',
};

const infoText = {
  color: '#1e3a8a',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
};

const buttonContainer = {
  padding: '24px 40px',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#dc2626',
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
