import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/bookings/[id]/generate-invoice - Generate invoice from booking
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id: bookingId } = await context.params;
    const body = await request.json();

    const bookingResult = await db.query(
      `SELECT b.*,
              c.id AS customer_ref_id,
              c.name AS customer_name,
              c.email AS customer_email,
              c.phone AS customer_phone,
              c.address_line1 AS customer_address_line1,
              c.city AS customer_city,
              c.country AS customer_country,
              tp.id AS tour_package_ref_id,
              tp.name AS tour_package_name,
              tp.package_code AS tour_package_code,
              h.id AS hotel_ref_id,
              h.name AS hotel_name,
              h.star_rating AS hotel_star_rating,
              v.id AS vehicle_ref_id,
              v.vehicle_type AS vehicle_type,
              v.registration_number AS vehicle_registration_number
       FROM bookings b
       LEFT JOIN customers c ON c.id = b.customer_id
       LEFT JOIN tour_packages tp ON tp.id = b.tour_package_id
       LEFT JOIN hotels h ON h.id = b.hotel_id
       LEFT JOIN vehicles v ON v.id = b.assigned_vehicle_id
       WHERE b.id = $1
       LIMIT 1`,
      [bookingId]
    );

    const booking = bookingResult.rows[0];
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, booking.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const existingInvoiceResult = await db.query(
      'SELECT id, invoice_number FROM invoices WHERE booking_id = $1 LIMIT 1',
      [bookingId]
    );
    const existingInvoice = existingInvoiceResult.rows[0];

    if (existingInvoice) {
      return NextResponse.json(
        {
          error: 'Invoice already exists for this booking',
          invoice_id: existingInvoice.id,
          invoice_number: existingInvoice.invoice_number,
        },
        { status: 400 }
      );
    }

    const invoiceType = body.invoice_type || 'full';
    let amount = Number(booking.total || 0);

    let description = '';
    switch (booking.booking_type) {
      case 'tour':
        description = `Tour: ${booking.tour_package_name || 'Tour Package'}`;
        break;
      case 'hotel':
        description = `Hotel Booking: ${booking.hotel_name || 'Accommodation'}`;
        break;
      case 'car_hire':
        description = `Car Hire: ${booking.vehicle_type || 'Vehicle Rental'}`;
        break;
      case 'custom': {
        const items: string[] = [];
        if (booking.hotel_name) items.push(booking.hotel_name);
        if (booking.vehicle_type) items.push(booking.vehicle_type);
        description = `Custom Booking: ${items.join(' + ')}`;
        break;
      }
      default:
        description = `Booking: ${booking.booking_number}`;
    }

    let isAdvancePayment = false;

    if (invoiceType === 'deposit') {
      const depositPercent = body.deposit_percent || 30;
      amount = Number(booking.total || 0) * (Number(depositPercent) / 100);
      description = `Deposit (${depositPercent}%) - ${description}`;
      isAdvancePayment = true;
    } else if (invoiceType === 'balance') {
      amount = Number(booking.total || 0) - Number(booking.amount_paid || 0);
      description = `Balance Payment - ${description}`;
      isAdvancePayment = true;
    }

    const invoiceNumberResult = await db.query<{ invoice_number: string }>('SELECT generate_invoice_number() AS invoice_number');
    const invoiceNumber = invoiceNumberResult.rows[0]?.invoice_number;
    if (!invoiceNumber) {
      return NextResponse.json({ error: 'Failed to generate invoice number' }, { status: 500 });
    }

    const revenueAccountResult = await db.query('SELECT id FROM accounts WHERE code = $1 LIMIT 1', ['4100']);
    const revenueAccount = revenueAccountResult.rows[0];

    const taxRate = Number(body.tax_rate || 0);
    const subtotal = amount / (1 + taxRate);
    const taxAmount = amount - subtotal;

    const response = await db.transaction(async (tx) => {
      const invoiceResult = await tx.query(
        `INSERT INTO invoices (
           company_id, invoice_number, customer_id, booking_id,
           invoice_date, due_date, currency, exchange_rate,
           subtotal, tax_rate, tax_amount, total, amount_paid,
           status, is_advance_payment, service_start_date, service_end_date,
           notes, created_by
         ) VALUES (
           $1, $2, $3, $4,
           $5::date, $6::date, $7, $8,
           $9, $10, $11, $12, 0,
           'draft', $13, $14::date, $15::date,
           $16, $17
         )
         RETURNING *`,
        [
          booking.company_id,
          invoiceNumber,
          booking.customer_id,
          bookingId,
          body.invoice_date || new Date().toISOString().split('T')[0],
          body.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          booking.currency || 'USD',
          booking.exchange_rate || 1,
          subtotal,
          taxRate,
          taxAmount,
          amount,
          isAdvancePayment,
          booking.travel_start_date,
          booking.travel_end_date,
          body.notes || `Generated from booking ${booking.booking_number}`,
          user.id,
        ]
      );

      const invoice = invoiceResult.rows[0];

      await tx.query(
        `INSERT INTO invoice_lines (
           invoice_id, line_number, description, quantity, unit_price,
           line_total, revenue_account_id
         ) VALUES ($1, 1, $2, 1, $3, $3, $4)`,
        [invoice.id, description, subtotal, revenueAccount?.id || null]
      );

      if (invoiceType === 'deposit' && booking.status === 'inquiry') {
        await tx.query('UPDATE bookings SET status = $2, updated_at = NOW() WHERE id = $1', [bookingId, 'quote_sent']);
      }

      const completeResult = await tx.query(
        `SELECT i.*, c.id AS customer_ref_id, c.name AS customer_name, c.email AS customer_email
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
         WHERE i.id = $1
         LIMIT 1`,
        [invoice.id]
      );

      const linesResult = await tx.query('SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY line_number ASC', [
        invoice.id,
      ]);

      const completeInvoice = {
        ...completeResult.rows[0],
        customer: completeResult.rows[0]?.customer_ref_id
          ? {
              id: completeResult.rows[0].customer_ref_id,
              name: completeResult.rows[0].customer_name,
              email: completeResult.rows[0].customer_email,
            }
          : null,
        invoice_lines: linesResult.rows,
      };

      return completeInvoice;
    });

    return NextResponse.json(
      {
        message: 'Invoice generated successfully',
        invoice: response,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error generating invoice:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
