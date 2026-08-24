import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';
import { generatePayslipHTML, type PayslipData } from '@/lib/pdf/payslip-pdf';
import { Resend } from 'resend';

// POST /api/payslips/[id]/email - Email payslip to employee
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Email service is not configured. Please contact your administrator.' },
        { status: 500 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;

    // Fetch payslip with employee and period details
    const payslipResult = await db.query(
      `SELECT pps.*,
              e.first_name, e.last_name, e.employee_number, e.job_title, e.department, e.email AS employee_email,
              pp.company_id, pp.period_name, pp.start_date, pp.end_date, pp.payment_date
       FROM payroll_payslips pps
       LEFT JOIN employees e ON e.id = pps.employee_id
       LEFT JOIN payroll_periods pp ON pp.id = pps.payroll_period_id
       WHERE pps.id = $1
       LIMIT 1`,
      [id]
    );
    const payslip = payslipResult.rows[0] as any;

    if (!payslip) {
      return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, payslip.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Fetch company information
    const companyResult = await db.query('SELECT * FROM companies WHERE id = $1 LIMIT 1', [payslip.company_id]);
    const company = companyResult.rows[0] as any;

    // Check if employee has email
    if (!payslip.employee_email) {
      return NextResponse.json(
        { error: 'Employee does not have an email address on file' },
        { status: 400 }
      );
    }

    // Prepare payslip data
    const payslipData: PayslipData = {
      company,
      payslip_number: `PS-${payslip.id.slice(0, 8)}`,
      employee: {
        first_name: payslip.first_name,
        last_name: payslip.last_name,
        employee_number: payslip.employee_number,
        job_title: payslip.job_title,
        department: payslip.department,
        email: payslip.employee_email,
      },
      payroll_period: {
        period_name: payslip.period_name || `${payslip.start_date} - ${payslip.end_date}`,
        start_date: payslip.start_date,
        end_date: payslip.end_date,
        payment_date: payslip.payment_date,
      },
      basic_salary: Number(payslip.basic_salary || 0),
      total_allowances: Number(payslip.allowances || 0),
      overtime_hours: 0,
      overtime_amount: 0,
      bonus: 0,
      commission: 0,
      reimbursements: 0,
      gross_salary: Number(payslip.gross_salary || 0),
      paye: Number(payslip.tax_deduction || 0),
      nssf_employee: Number(payslip.nssf_deduction || payslip.nssf_employee || 0),
      loan_deduction: Number(payslip.loan_deduction || 0),
      salary_advance: Number(payslip.advance_deduction || 0),
      other_deductions: Number(payslip.other_deductions || 0),
      total_deductions: Number(payslip.deductions || 0),
      net_salary: Number(payslip.net_salary || 0),
      nssf_employer: Number(payslip.nssf_employer || 0),
      payment_method: 'bank_transfer',
      currency: company?.currency || 'UGX',
      notes: payslip.notes || null,
      payslip_items: [],
    };

    // Generate HTML
    const htmlContent = generatePayslipHTML(payslipData);

    // Send email via Resend
    const emailData = await resend.emails.send({
      from: `${company?.name || 'Company'} HR <${process.env.RESEND_FROM_EMAIL || company?.email || 'hr@company.com'}>`,
      to: [payslip.employee_email],
      subject: `Your Payslip - ${payslipData.payroll_period.period_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1e3a8a;">Dear ${payslipData.employee.first_name},</h2>

          <p style="color: #374151; line-height: 1.6;">
            Your payslip for <strong>${payslipData.payroll_period.period_name}</strong> is now available.
          </p>

          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0; color: #6b7280;"><strong>Pay Period:</strong> ${new Date(payslipData.payroll_period.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${new Date(payslipData.payroll_period.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            <p style="margin: 5px 0; color: #6b7280;"><strong>Payment Date:</strong> ${new Date(payslipData.payroll_period.payment_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p style="margin: 5px 0; color: #16a34a; font-size: 18px; font-weight: bold;"><strong>Net Pay:</strong> ${payslipData.currency} ${payslipData.net_salary.toLocaleString()}</p>
          </div>

          <p style="color: #374151; line-height: 1.6;">
            Your detailed payslip is attached to this email. Please review it and contact HR if you have any questions.
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
              <strong>${company?.name || 'Company Name'}</strong><br>
              HR Department<br>
              Email: ${company?.email || 'hr@company.com'}
            </p>
          </div>

          <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
            This is an automated email. Please do not reply to this message.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Payslip_${payslipData.payslip_number}_${payslipData.employee.first_name}_${payslipData.employee.last_name}.html`,
          content: Buffer.from(htmlContent).toString('base64'),
        },
      ],
    });

    if (!emailData.data) {
      throw new Error('Failed to send email');
    }

    return NextResponse.json({
      success: true,
      message: 'Payslip emailed successfully',
      emailId: emailData.data.id,
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error emailing payslip:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send payslip email' },
      { status: 500 }
    );
  }
}
