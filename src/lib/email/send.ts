import { render } from '@react-email/components';
import { TrialReminderEmail } from './templates/trial-reminder';
import { PaymentSuccessEmail } from './templates/payment-success';
import { PaymentFailedEmail } from './templates/payment-failed';
import { WelcomeEmail } from './templates/welcome';

// Lazy email client initialization
async function getEmailClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured on the server');
  }
  const { Resend } = await import('resend');
  return new Resend(process.env.RESEND_API_KEY);
}

export const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'BlueOx <noreply@blueox.app>',
  replyTo: process.env.EMAIL_REPLY_TO || 'support@blueox.app',
  companyName: 'BlueOx Business Platform',
  supportEmail: 'support@blueox.app',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://blueox.app',
};

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
}

/**
 * Send an email using Resend
 */
export async function sendEmail({ to, subject, react }: SendEmailOptions) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured. Email not sent.');
      return { success: false, error: 'Email service not configured' };
    }

    const resend = await getEmailClient();
    const { data, error } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: Array.isArray(to) ? to : [to],
      subject,
      react,
    });

    if (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }

    console.log('Email sent successfully:', data?.id);
    return { success: true, id: data?.id };
  } catch (error: any) {
    console.error('Email sending exception:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send trial reminder email
 */
export async function sendTrialReminderEmail(params: {
  to: string;
  companyName: string;
  daysRemaining: number;
  planName: string;
  monthlyPrice: string;
}) {
  const { to, companyName, daysRemaining, planName, monthlyPrice } = params;

  return sendEmail({
    to,
    subject: `Your BlueOx trial ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
    react: TrialReminderEmail({
      companyName,
      daysRemaining,
      planName,
      monthlyPrice,
      upgradeUrl: `${EMAIL_CONFIG.appUrl}/dashboard/billing/upgrade`,
    }),
  });
}

/**
 * Send payment success email
 */
export async function sendPaymentSuccessEmail(params: {
  to: string;
  companyName: string;
  planName: string;
  amount: string;
  invoiceNumber: string;
  invoiceUrl?: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
}) {
  const {
    to,
    companyName,
    planName,
    amount,
    invoiceNumber,
    invoiceUrl,
    billingPeriodStart,
    billingPeriodEnd,
  } = params;

  return sendEmail({
    to,
    subject: `Payment Received - ${amount}`,
    react: PaymentSuccessEmail({
      companyName,
      planName,
      amount,
      invoiceNumber,
      invoiceUrl,
      billingPeriodStart,
      billingPeriodEnd,
    }),
  });
}

/**
 * Send payment failed email
 */
export async function sendPaymentFailedEmail(params: {
  to: string;
  companyName: string;
  planName: string;
  amount: string;
  failureReason?: string;
  retryDate: string;
}) {
  const { to, companyName, planName, amount, failureReason, retryDate } = params;

  return sendEmail({
    to,
    subject: '⚠️ Payment Failed - Action Required',
    react: PaymentFailedEmail({
      companyName,
      planName,
      amount,
      failureReason,
      updatePaymentUrl: `${EMAIL_CONFIG.appUrl}/dashboard/billing`,
      retryDate,
    }),
  });
}

/**
 * Send welcome email when trial starts
 */
export async function sendWelcomeEmail(params: {
  to: string;
  companyName: string;
  userName: string;
  planName: string;
  trialEndDate: string;
  modulesSelected: string[];
}) {
  const { to, companyName, userName, planName, trialEndDate, modulesSelected } = params;

  return sendEmail({
    to,
    subject: '🎉 Welcome to BlueOx - Your trial has started!',
    react: WelcomeEmail({
      companyName,
      userName,
      planName,
      trialEndDate,
      dashboardUrl: EMAIL_CONFIG.appUrl,
      modulesSelected,
    }),
  });
}

/**
 * Format currency for email display
 */
export function formatCurrencyForEmail(amount: number, currency: string): string {
  if (currency === 'UGX') {
    return `UGX ${amount.toLocaleString('en-UG')}`;
  }

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(amount / 100); // Stripe amounts are in cents
}

/**
 * Format date for email display
 */
export function formatDateForEmail(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get retry date (3 days from now)
 */
export function getRetryDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  return formatDateForEmail(date);
}
