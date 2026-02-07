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

interface TrialReminderEmailProps {
  companyName: string;
  daysRemaining: number;
  planName: string;
  monthlyPrice: string;
  upgradeUrl: string;
}

export const TrialReminderEmail = ({
  companyName,
  daysRemaining,
  planName,
  monthlyPrice,
  upgradeUrl,
}: TrialReminderEmailProps) => {
  const urgency = daysRemaining === 1 ? 'tomorrow' : `in ${daysRemaining} days`;
  const previewText = `Your BlueOx trial ends ${urgency}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🔔 Your Trial is Ending Soon</Heading>
          
          <Text style={text}>Hi {companyName} team,</Text>
          
          <Text style={text}>
            Your BlueOx free trial will end <strong>{urgency}</strong>. We hope you've enjoyed exploring our platform!
          </Text>

          <Section style={warningBox}>
            <Text style={warningText}>
              ⏰ <strong>{daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining</strong>
            </Text>
          </Section>

          <Text style={text}>
            To continue using your selected modules and features, upgrade to the <strong>{planName}</strong> plan:
          </Text>

          <Section style={priceBox}>
            <Text style={priceText}>{monthlyPrice}</Text>
            <Text style={priceSubtext}>per month</Text>
          </Section>

          <Section style={buttonContainer}>
            <Button style={button} href={upgradeUrl}>
              Upgrade Now
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={text}>
            <strong>What happens after trial ends?</strong>
          </Text>
          <Text style={smallText}>
            • Your data will be preserved for 30 days<br />
            • You'll lose access to all modules<br />
            • You can upgrade anytime to restore access
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            Questions? Reply to this email or contact us at support@blueox.app
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

export default TrialReminderEmail;

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

const warningBox = {
  backgroundColor: '#fef3c7',
  border: '2px solid #f59e0b',
  borderRadius: '8px',
  margin: '24px 40px',
  padding: '16px',
  textAlign: 'center' as const,
};

const warningText = {
  color: '#92400e',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0',
};

const priceBox = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  margin: '24px 40px',
  padding: '24px',
  textAlign: 'center' as const,
};

const priceText = {
  color: '#1f2937',
  fontSize: '36px',
  fontWeight: '700',
  margin: '0',
};

const priceSubtext = {
  color: '#6b7280',
  fontSize: '14px',
  margin: '4px 0 0 0',
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
