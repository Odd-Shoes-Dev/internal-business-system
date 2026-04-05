import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';
import { generatePayslipHTML, type PayslipData } from '@/lib/pdf/payslip-pdf';

// GET /api/payslips/[id]/pdf - Generate and download payslip PDF
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;

    // Fetch payslip with employee and period details
    const payslipResult = await db.query(
      `SELECT p.*,
              row_to_json(e.*) AS employee,
              json_build_object(
                'period_name', pp.period_name,
                'start_date', pp.start_date,
                'end_date', pp.end_date,
                'payment_date', pp.payment_date,
                'status', pp.status
              ) AS payroll_period
       FROM payslips p
       LEFT JOIN employees e ON e.id = p.employee_id
       LEFT JOIN payroll_periods pp ON pp.id = p.payroll_period_id
       WHERE p.id = $1
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

    // Fetch company info
    const companyResult = await db.query(
      `SELECT name, logo_url, email, phone, address, city, country, tax_id, registration_number, website
       FROM companies
       WHERE id = $1
       LIMIT 1`,
      [payslip.company_id]
    );
    const company = companyResult.rows[0] as any;

    // Fetch payslip items
    const payslipItemsResult = await db.query(
      `SELECT *
       FROM payslip_items
       WHERE payslip_id = $1
       ORDER BY item_type DESC, item_name ASC`,
      [id]
    );
    const payslipItems = payslipItemsResult.rows as any[];

    // Prepare payslip data
    const payslipData: PayslipData = {
      ...payslip,
      payslip_items: payslipItems || [],
      company: company || undefined,
    };

    // Generate HTML
    const htmlContent = generatePayslipHTML(payslipData);

    // Return HTML as downloadable file
    // Note: For true PDF generation, you would need a library like puppeteer or jsPDF
    // For now, we return HTML that can be printed to PDF by the browser
    const filename = `Payslip_${payslip.payslip_number}_${payslip.employee.first_name}_${payslip.employee.last_name}.html`;

    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('Error generating payslip PDF:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate payslip PDF' },
      { status: 500 }
    );
  }
}
