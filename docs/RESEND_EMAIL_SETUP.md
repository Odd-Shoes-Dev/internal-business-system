# Resend Email Setup Guide
**Sceneside Financial System**  
Last Updated: December 15, 2025

---

## Overview

This guide explains how to configure Resend for sending invoices, receipts, quotations, and other documents to customers via email.

---

## What is Resend?

Resend is a modern email API service that allows the application to send transactional emails (like invoices and receipts) to customers. It's reliable, affordable, and easy to set up.

**Pricing:**
- Free tier: 100 emails/day, 3,000 emails/month
- Pro tier: $20/month for 50,000 emails/month
- [View full pricing](https://resend.com/pricing)

---

## Step 1: Create a Resend Account

1. Go to [https://resend.com](https://resend.com)
2. Click **Sign Up** (or use GitHub to sign in)
3. Verify your email address
4. Complete the onboarding process

---

## Step 2: Get Your API Key

1. Log into your Resend dashboard
2. Navigate to **API Keys** in the left sidebar
3. Click **Create API Key**
4. Enter a name for your key:
   - Development: `Sceneside Dev`
   - Production: `Sceneside Production`
5. Select permissions: **Full Access** (for sending emails)
6. Click **Create**
7. **IMPORTANT:** Copy the API key immediately (it starts with `re_`)
   - You won't be able to see it again!
   - Store it securely

---

## Step 3: Add API Key to Environment Variables

### For Local Development:

1. In your project root (`C:\Users\HP\Desktop\Sceneside`), create a file named `.env.local` if it doesn't exist
2. Add this line:

```env
RESEND_API_KEY=re_your_actual_api_key_here
```

3. Replace `re_your_actual_api_key_here` with the API key you copied

### For Production (Vercel/Netlify):

Add the environment variable in your hosting platform:

**Vercel:**
1. Go to Project Settings → Environment Variables
2. Add `RESEND_API_KEY` with your production API key
3. Redeploy your application

**Netlify:**
1. Go to Site Settings → Environment Variables
2. Add `RESEND_API_KEY` with your production API key
3. Redeploy your application

---

## Step 4: Verify Your Domain (Production Only)

For production use, you need to verify your sending domain to avoid emails going to spam.

### 4.1 Add Your Domain in Resend

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain: `sceneside.com` (or your actual domain)
4. Click **Add**

### 4.2 Add DNS Records

Resend will provide you with DNS records to add. You'll need to add these to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):

**Typical Records:**
- **SPF Record** (TXT): Authorizes Resend to send emails from your domain
- **DKIM Record** (TXT): Cryptographic signature for email authentication
- **DMARC Record** (TXT): Email authentication policy

**Example DNS Records:**

| Type | Name | Value |
|------|------|-------|
| TXT | @ | `v=spf1 include:resend.com ~all` |
| TXT | resend._domainkey | `[provided by Resend]` |
| TXT | _dmarc | `v=DMARC1; p=none;` |

### 4.3 Verify Domain

1. After adding DNS records, go back to Resend dashboard
2. Click **Verify** next to your domain
3. Verification usually takes 5-15 minutes (DNS propagation)
4. Once verified, you'll see a green checkmark ✓

---

## Step 5: Update Email "From" Address (Optional)

The default sending address is `invoices@sceneside.com`. To change it:

1. Open `src/lib/email/resend.ts`
2. Find line 143 and 286 (two email functions)
3. Change the `from` field:

```typescript
from: 'Your Company Name <invoices@yourdomain.com>',
```

**Important:** The domain in the "from" address must match your verified domain in Resend.

---

## Step 6: Test Email Sending

### 6.1 Restart Development Server

After adding the API key:

```bash
# Stop the server (Ctrl+C in terminal)
# Then restart:
npm run dev
```

### 6.2 Test Sending an Invoice

1. Go to **Invoices** or **Receipts** in the dashboard
2. Click on any invoice/receipt
3. Click the green **"Send Email"** button
4. Check the customer's email inbox

### 6.3 Check Resend Logs

1. Go to Resend dashboard → **Logs**
2. You'll see all sent emails with their status:
   - ✓ **Delivered**: Email successfully sent
   - ⏳ **Pending**: Email being processed
   - ✗ **Failed**: Check error message

---

## Troubleshooting

### Error: "RESEND_API_KEY is not configured on the server"

**Solution:** Make sure you:
1. Created `.env.local` file in the project root
2. Added `RESEND_API_KEY=re_your_key` to the file
3. Restarted the development server

### Emails Going to Spam

**Solutions:**
1. Verify your domain in Resend (see Step 4)
2. Add all DNS records (SPF, DKIM, DMARC)
3. Use a verified domain in the "from" address
4. Warm up your domain by sending low volumes initially

### Error: "Customer does not have an email address"

**Solution:** 
1. Go to **Customers**
2. Click on the customer
3. Click **Edit**
4. Add their email address(es)
5. Save changes

### API Key Not Working

**Solutions:**
1. Check if you copied the entire API key (starts with `re_`)
2. Make sure there are no extra spaces in `.env.local`
3. Verify the API key is still active in Resend dashboard
4. Create a new API key if needed

---

## Email Features in Sceneside

### What Gets Sent to Customers?

When you click "Send Email" on an invoice/receipt, customers receive:

1. **Professional HTML Email** with:
   - Sceneside branding
   - Document details (invoice number, amount, due date)
   - Payment status
   - Direct payment link (for unpaid invoices)
   - Company contact information

2. **Sent to Multiple Email Addresses:**
   - Primary email
   - Email 2 (if added)
   - Email 3 (if added)
   - Email 4 (if added)

3. **Automatic Status Update:**
   - Draft invoices automatically change to "Sent" status

### Supported Document Types

- ✓ Invoices
- ✓ Quotations
- ✓ Proforma Invoices
- ✓ Receipts
- ✓ Payment Receipts

---

## Security Best Practices

1. **Never commit `.env.local` to Git**
   - It's already in `.gitignore`
   - Never share your API key publicly

2. **Use Different Keys for Development and Production**
   - Create separate API keys in Resend
   - Use test key for development
   - Use production key for live environment

3. **Rotate Keys Regularly**
   - Update API keys every 6-12 months
   - Delete old keys in Resend dashboard

4. **Monitor Usage**
   - Check Resend dashboard for unusual activity
   - Set up usage alerts if available

---

## Cost Estimation

Based on typical usage:

| Business Size | Emails/Month | Resend Plan | Cost |
|--------------|--------------|-------------|------|
| Small (1-10 customers) | 50-500 | Free | $0 |
| Medium (10-100 customers) | 500-5,000 | Pro | $20 |
| Large (100+ customers) | 5,000-50,000 | Pro | $20 |

**Note:** The free tier is generous and sufficient for most small businesses.

---

## Additional Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend API Reference](https://resend.com/docs/api-reference/introduction)
- [Email Best Practices](https://resend.com/docs/knowledge-base/best-practices)
- [DNS Setup Guide](https://resend.com/docs/knowledge-base/dns-records)

---

## Support

If you encounter issues:

1. Check Resend status: [status.resend.com](https://status.resend.com)
2. Resend support: [resend.com/support](https://resend.com/support)
3. Sceneside documentation: `docs/` folder

---

**Last Updated:** December 15, 2025  
**Resend Setup Version:** 1.0
