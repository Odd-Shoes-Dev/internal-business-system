// Lazily construct Resend client inside functions so missing API keys don't throw during
// module import (which can break builds when environment variables are not provided).
async function getResendClient() {
  const { Resend } = await import('resend');
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured on the server');
  return new Resend(apiKey);
}

interface CompanyInfo {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
}

interface SendInvoiceEmailParams {
  to: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  balanceDue: number;
  paymentLink: string;
  company: CompanyInfo;
}

export async function sendInvoiceEmail(params: SendInvoiceEmailParams) {
  const {
    to,
    customerName,
    invoiceNumber,
    invoiceDate,
    dueDate,
    totalAmount,
    balanceDue,
    paymentLink,
    company,
  } = params;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0d9488 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">${company.name}</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0;">Invoice ${invoiceNumber}</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              Hi ${customerName},
            </p>
            
            <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
              Please find attached your invoice. Here's a summary:
            </p>
            
            <!-- Invoice Summary -->
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Invoice Number:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1e3a5f;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Invoice Date:</td>
                  <td style="padding: 8px 0; text-align: right;">${formatDate(invoiceDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Due Date:</td>
                  <td style="padding: 8px 0; text-align: right;">${formatDate(dueDate)}</td>
                </tr>
                <tr style="border-top: 2px solid #e5e7eb;">
                  <td style="padding: 12px 0 8px 0; color: #666;">Total Amount:</td>
                  <td style="padding: 12px 0 8px 0; text-align: right; font-size: 18px; font-weight: 700; color: #1e3a5f;">${formatCurrency(totalAmount)}</td>
                </tr>
                ${balanceDue < totalAmount ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Balance Due:</td>
                  <td style="padding: 8px 0; text-align: right; font-size: 16px; font-weight: 600; color: #dc2626;">${formatCurrency(balanceDue)}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <!-- Payment Button -->
            ${balanceDue > 0 ? `
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #0d9488 100%); color: white; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Pay Now
              </a>
            </div>
            ` : `
            <div style="text-align: center; margin-bottom: 30px; padding: 15px; background: #d1fae5; border-radius: 8px;">
              <span style="color: #059669; font-weight: 600;">✓ Paid in Full</span>
            </div>
            `}
            
            <p style="font-size: 14px; color: #999; margin-bottom: 10px;">
              If you have any questions about this invoice, please don't hesitate to contact us.
            </p>
            
            <p style="font-size: 16px; color: #333; margin-top: 30px;">
              Thank you for choosing ${company.name}!
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 10px;">
              Best regards,<br>
              <strong>${company.name}</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #999;">
              ${company.name}${company.address ? ` • ${company.address}` : ''}
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #999;">
              ${company.phone ? `Tel: ${company.phone} • ` : ''}Email: ${company.email}
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const resend = await getResendClient();
    const fromEmail = process.env.RESEND_FROM_EMAIL || company.email || 'noreply@example.com';
    const fromName = company.name;
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: `Invoice ${invoiceNumber} from ${company.name}`,
      html,
    });

    if (error) {
      console.error('Email send error:', error);
      throw new Error(error.message);
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

interface SendPaymentReceiptParams {
  to: string;
  customerName: string;
  invoiceNumber: string;
  paymentDate: string;
  paymentAmount: number;
  paymentMethod: string;
  remainingBalance: number;
  company: CompanyInfo;
}

export async function sendPaymentReceiptEmail(params: SendPaymentReceiptParams) {
  const {
    to,
    customerName,
    invoiceNumber,
    paymentDate,
    paymentAmount,
    paymentMethod,
    remainingBalance,
    company,
  } = params;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">✓</div>
            <h1 style="color: white; margin: 0; font-size: 24px;">Payment Received</h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 30px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
              Hi ${customerName},
            </p>
            
            <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
              We've received your payment. Thank you!
            </p>
            
            <!-- Payment Details -->
            <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;">Invoice Number:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1e3a5f;">${invoiceNumber}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Payment Date:</td>
                  <td style="padding: 8px 0; text-align: right;">${formatDate(paymentDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;">Payment Method:</td>
                  <td style="padding: 8px 0; text-align: right; text-transform: capitalize;">${paymentMethod.replace('_', ' ')}</td>
                </tr>
                <tr style="border-top: 2px solid #e5e7eb;">
                  <td style="padding: 12px 0 8px 0; color: #666;">Amount Paid:</td>
                  <td style="padding: 12px 0 8px 0; text-align: right; font-size: 18px; font-weight: 700; color: #059669;">${formatCurrency(paymentAmount)}</td>
                </tr>
                ${remainingBalance > 0 ? `
                <tr>
                  <td style="padding: 8px 0; color: #666;">Remaining Balance:</td>
                  <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #dc2626;">${formatCurrency(remainingBalance)}</td>
                </tr>
                ` : `
                <tr>
                  <td colspan="2" style="padding: 12px 0; text-align: center;">
                    <span style="background: #d1fae5; color: #059669; padding: 8px 16px; border-radius: 20px; font-weight: 600; font-size: 14px;">Invoice Paid in Full</span>
                  </td>
                </tr>
                `}
              </table>
            </div>
            
            <p style="font-size: 14px; color: #999; margin-bottom: 10px;">
              This is your payment confirmation. Please keep it for your records.
            </p>
            
            <p style="font-size: 16px; color: #333; margin-top: 30px;">
              Thank you for your business!
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 10px;">
              Best regards,<br>
              <strong>${company.name}</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #999;">
              ${company.name}${company.address ? ` • ${company.address}` : ''}${company.city ? `, ${company.city}` : ''}${company.country ? `, ${company.country}` : ''}
            </p>
            ${company.phone || company.email ? `
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #999;">
              ${company.phone ? `Tel: ${company.phone}` : ''}${company.phone && company.email ? ' • ' : ''}${company.email ? `Email: ${company.email}` : ''}
            </p>
            ` : ''}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const resend = await getResendClient();
    const fromEmail = process.env.RESEND_FROM_EMAIL || company.email || 'noreply@example.com';
    const fromName = company.name;
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: `Payment Receipt - Invoice ${invoiceNumber}`,
      html,
    });

    if (error) {
      console.error('Email send error:', error);
      throw new Error(error.message);
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

interface SendInvitationEmailParams {
  to: string;
  invitedByName: string;
  companyName: string;
  role: string;
  inviteLink: string;
  expiresAt: string;
}

export async function sendInvitationEmail(params: SendInvitationEmailParams) {
  const { to, invitedByName, companyName, role, inviteLink, expiresAt } = params;
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #1e3a5f 0%, #0d9488 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 26px;">You're Invited!</h1>
            <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0 0; font-size: 15px;">${companyName}</p>
          </div>
          <div style="padding: 36px 30px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 8px;">Hi there,</p>
            <p style="font-size: 16px; color: #333; margin-bottom: 24px;">
              <strong>${invitedByName}</strong> has invited you to join <strong>${companyName}</strong> on BlueOx as a <strong>${roleLabel}</strong>.
            </p>
            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px 20px; margin-bottom: 28px;">
              <p style="margin: 0; font-size: 14px; color: #0369a1;">
                <strong>Role:</strong> ${roleLabel}<br/>
                <strong>Company:</strong> ${companyName}<br/>
                <strong>Invited by:</strong> ${invitedByName}
              </p>
            </div>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #1e3a5f 0%, #0d9488 100%); color: white; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-size: 16px; font-weight: 600;">
                Accept Invitation
              </a>
            </div>
            <p style="font-size: 13px; color: #888; text-align: center; margin-top: 8px;">
              Or copy this link: <a href="${inviteLink}" style="color: #0d9488;">${inviteLink}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 28px 0;" />
            <p style="font-size: 13px; color: #999; margin: 0;">
              This invitation expires on <strong>${expiresAt}</strong>. If you did not expect this, you can safely ignore this email.
            </p>
          </div>
          <div style="background: #f9fafb; border-top: 1px solid #eee; padding: 20px 30px; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #aaa;">Powered by <strong style="color: #1e3a5f;">BlueOx Business Platform</strong></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const resend = await getResendClient();
    const fromEmail = process.env.EMAIL_FROM || 'BlueOx <noreply@blueoxgroup.eu>';
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: `You're invited to join ${companyName} on BlueOx`,
      html,
    });

    if (error) {
      console.error('Invitation email send error:', error);
      throw new Error(error.message);
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    throw error;
  }
}
