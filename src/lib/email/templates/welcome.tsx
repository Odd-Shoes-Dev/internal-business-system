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

interface WelcomeEmailProps {
  companyName: string;
  userName: string;
  planName: string;
  trialEndDate: string;
  dashboardUrl: string;
  modulesSelected: string[];
}

export const WelcomeEmail = ({
  companyName,
  userName,
  planName,
  trialEndDate,
  dashboardUrl,
  modulesSelected,
}: WelcomeEmailProps) => {
  const previewText = 'Welcome to BlueOx - Your trial has started!';

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🎉 Welcome to BlueOx!</Heading>
          
          <Text style={text}>Hi {userName},</Text>
          
          <Text style={text}>
            Welcome aboard! Your <strong>{planName}</strong> trial has started, and you're all set to explore the full power of BlueOx Business Platform.
          </Text>

          <Section style={highlightBox}>
            <Text style={highlightText}>
              14-day free trial • No credit card required
            </Text>
            <Text style={highlightSubtext}>
              Trial ends: {trialEndDate}
            </Text>
          </Section>

          {modulesSelected.length > 0 && (
            <>
              <Text style={text}>
                <strong>Your selected modules:</strong>
              </Text>
              <Section style={modulesBox}>
                {modulesSelected.map((module, index) => (
                  <Text key={index} style={moduleItem}>
                    ✓ {module}
                  </Text>
                ))}
              </Section>
            </>
          )}

          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
              Go to Dashboard
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={text}>
            <strong>Quick Start Guide:</strong>
          </Text>
          <Text style={smallText}>
            <strong>1. Set up your company profile</strong><br />
            Add your logo, business details, and preferences
          </Text>
          <Text style={smallText}>
            <strong>2. Invite your team</strong><br />
            Add users and assign roles for collaboration
          </Text>
          <Text style={smallText}>
            <strong>3. Configure your chart of accounts</strong><br />
            Customize accounts to match your business needs
          </Text>
          <Text style={smallText}>
            <strong>4. Start recording transactions</strong><br />
            Create invoices, track expenses, and manage your finances
          </Text>

          <Hr style={hr} />

          <Section style={tipsBox}>
            <Text style={tipsTitle}>💡 Pro Tips:</Text>
            <Text style={tipsText}>
              • Use keyboard shortcuts for faster navigation<br />
              • Set up automated recurring transactions<br />
              • Connect your bank for automatic reconciliation<br />
              • Explore reports to gain financial insights
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={text}>
            <strong>Need help?</strong>
          </Text>
          <Text style={smallText}>
            • Check out our <a href={`${dashboardUrl}/help`} style={link}>Help Center</a><br />
            • Watch <a href={`${dashboardUrl}/videos`} style={link}>video tutorials</a><br />
            • Email us at support@blueox.app<br />
            • Book a free onboarding call
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            We're excited to have you on board!
          </Text>

          <Text style={footer}>
            The BlueOx Team<br />
            Empowering businesses across Africa and beyond
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default WelcomeEmail;

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
  fontSize: '36px',
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
  marginBottom: '16px',
};

const smallText = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '24px',
  padding: '0 40px',
  marginBottom: '12px',
};

const highlightBox = {
  backgroundColor: '#dbeafe',
  borderRadius: '8px',
  margin: '24px 40px',
  padding: '20px',
  textAlign: 'center' as const,
};

const highlightText = {
  color: '#1e40af',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0',
};

const highlightSubtext = {
  color: '#1e3a8a',
  fontSize: '14px',
  margin: '8px 0 0 0',
};

const modulesBox = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  margin: '16px 40px 24px 40px',
  padding: '16px 24px',
};

const moduleItem = {
  color: '#059669',
  fontSize: '15px',
  margin: '8px 0',
  fontWeight: '500' as const,
};

const tipsBox = {
  backgroundColor: '#fef3c7',
  borderRadius: '8px',
  margin: '24px 40px',
  padding: '20px',
};

const tipsTitle = {
  color: '#92400e',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0',
};

const tipsText = {
  color: '#78350f',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
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

const link = {
  color: '#2563eb',
  textDecoration: 'underline',
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
  marginTop: '8px',
};
