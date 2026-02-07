import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set. Email functionality will be disabled.');
}

export const resend = new Resend(process.env.RESEND_API_KEY || '');

export const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'BlueOx <noreply@blueox.app>',
  replyTo: process.env.EMAIL_REPLY_TO || 'support@blueox.app',
  companyName: 'BlueOx Business Platform',
  supportEmail: 'support@blueox.app',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://blueox.app',
};
