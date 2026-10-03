import { Resend } from 'resend';
import { SUPPORT_EMAIL } from '../support';

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set. Email functionality will be disabled.');
}

export const resend = new Resend(process.env.RESEND_API_KEY || '');

export const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || 'BlueOxGroup <noreply@blueoxgroup.eu>',
  replyTo: process.env.EMAIL_REPLY_TO || SUPPORT_EMAIL,
  companyName: 'BlueOx Business Platform',
  supportEmail: SUPPORT_EMAIL,
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://system.blueoxgroup.eu',
};
