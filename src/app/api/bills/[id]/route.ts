import { NextRequest, NextResponse } from 'next/server';
import {
  createBillJournalEntryWithDb,
  increaseInventoryForBillWithDb,
} from '@/lib/accounting/provider-accounting';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/bills/[id] - Get single bill
export async function GET(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const billResult = await db.query<any>(
      `SELECT b.*, v.id AS vendor_ref_id, v.name AS vendor_name, v.company_name AS vendor_company_name,
              v.email AS vendor_email, v.phone AS vendor_phone,
              v.address_line1 AS vendor_address_line1, v.address_line2 AS vendor_address_line2,
              v.city AS vendor_city, v.state AS vendor_state, v.zip_code AS vendor_zip_code, v.country AS vendor_country
       FROM bills b
       LEFT JOIN vendors v ON v.id = b.vendor_id
       WHERE b.id = $1
       LIMIT 1`,
      [params.id]
    );

    const bill = billResult.rows[0];
    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, bill.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const linesResult = await db.query<any>(
      `SELECT *
       FROM bill_lines
       WHERE bill_id = $1
       ORDER BY line_number ASC`,
      [params.id]
    );

    const data = {
      ...bill,
      bill_lines: linesResult.rows,
      vendors: bill.vendor_ref_id
        ? {
            id: bill.vendor_ref_id,
            name: bill.vendor_name,
            company_name: bill.vendor_company_name,
            email: bill.vendor_email,
            phone: bill.vendor_phone,
            address_line1: bill.vendor_address_line1,
            address_line2: bill.vendor_address_line2,
            city: bill.vendor_city,
            state: bill.vendor_state,
            zip_code: bill.vendor_zip_code,
            country: bill.vendor_country,
          }
        : null,
    };

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/bills/[id] - Update bill
export async function PATCH(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    const existingBillResult = await db.query<any>(
      'SELECT * FROM bills WHERE id = $1 LIMIT 1',
      [params.id]
    );

    const existing = existingBillResult.rows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const existingLinesResult = await db.query<any>(
      'SELECT * FROM bill_lines WHERE bill_id = $1 ORDER BY line_number ASC',
      [params.id]
    );
    const existingBillLines = existingLinesResult.rows;

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (['paid', 'void'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Cannot edit paid or voided bills' },
        { status: 400 }
      );
    }

    const oldStatus = existing.status;
    const lines = body.line_items || body.lines || [];

    const accountCodes = lines
      .map((line: any) => line.account_code)
      .filter((code: any) => code);

    let accountMap: Record<string, string> = {};
    if (accountCodes.length > 0) {
      const accounts = await db.query<{ id: string; code: string }>(
        'SELECT id, code FROM accounts WHERE code = ANY($1::text[])',
        [accountCodes]
      );
      accountMap = Object.fromEntries(accounts.rows.map((acc) => [acc.code, acc.id]));
    }

    let subtotal = Number(existing.subtotal || 0);
    let taxAmount = Number(existing.tax_amount || 0);

    if (lines.length > 0) {
      subtotal = 0;
      taxAmount = 0;
      lines.forEach((line: any) => {
        const unitCost = Number(line.unit_cost || line.unit_price || 0);
        const quantity = Number(line.quantity || 0);
        const taxRate = Number(line.tax_rate || 0);
        subtotal += quantity * unitCost;
        taxAmount += quantity * unitCost * taxRate;
      });
    }

    const total = subtotal + taxAmount;

    const result = await db.transaction(async (tx) => {
      const updateData: any = {
        subtotal,
        tax_amount: taxAmount,
        total,
      };

      const allowedFields = ['vendor_id', 'bill_date', 'due_date', 'vendor_invoice_number', 'notes', 'status'];
      allowedFields.forEach((field) => {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      });

      const fields = Object.keys(updateData);
      const setSql = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');
      const values = fields.map((field) => updateData[field]);

      const billUpdate = await tx.query<any>(
        `UPDATE bills
         SET ${setSql}, updated_at = NOW()
         WHERE id = $${values.length + 1}
         RETURNING *`,
        [...values, params.id]
      );

      const bill = billUpdate.rows[0];
      const newStatus = bill.status;

      let billLinesForPosting = existingBillLines;

      if (lines.length > 0) {
        await tx.query('DELETE FROM bill_lines WHERE bill_id = $1', [params.id]);

        const newLines = lines
          .filter((line: any) => {
            const unitCost = Number(line.unit_cost || line.unit_price || 0);
            const quantity = Number(line.quantity || 0);
            const hasDescription = line.description && line.description.trim();
            return hasDescription && quantity * unitCost > 0;
          })
          .map((line: any, index: number) => {
            const unitCost = Number(line.unit_cost || line.unit_price || 0);
            const quantity = Number(line.quantity || 0);
            const taxRate = Number(line.tax_rate || 0);
            const expenseAccountId =
              line.expense_account_id || (line.account_code ? accountMap[line.account_code] : null);

            return {
              bill_id: bill.id,
              line_number: index + 1,
              expense_account_id: expenseAccountId,
              product_id: line.product_id || null,
              project_id: line.project_id || null,
              department: line.department || null,
              description: line.description || '',
              quantity,
              unit_cost: unitCost,
              tax_rate: taxRate,
              tax_amount: quantity * unitCost * taxRate,
              line_total: quantity * unitCost,
            };
          });

        for (const line of newLines) {
          await tx.query(
            `INSERT INTO bill_lines (
               bill_id, line_number, expense_account_id, product_id, project_id,
               department, description, quantity, unit_cost, tax_rate, tax_amount, line_total
             ) VALUES (
               $1, $2, $3, $4, $5,
               $6, $7, $8, $9, $10, $11, $12
             )`,
            [
              line.bill_id,
              line.line_number,
              line.expense_account_id,
              line.product_id,
              line.project_id,
              line.department,
              line.description,
              line.quantity,
              line.unit_cost,
              line.tax_rate,
              line.tax_amount,
              line.line_total,
            ]
          );
        }

        billLinesForPosting = newLines;
      }

      if ((newStatus === 'approved' || newStatus === 'posted') && oldStatus === 'draft' && user) {
        const inventoryResult = await increaseInventoryForBillWithDb(
          tx,
          bill.id,
          bill.bill_date,
          billLinesForPosting.map((line: any) => ({
            product_id: line.product_id,
            quantity: line.quantity,
            unit_cost: line.unit_cost || line.unit_price || 0,
            line_total:
              line.line_total || Number(line.quantity || 0) * Number(line.unit_cost || line.unit_price || 0),
            description: line.description,
          })),
          user.id
        );

        if (!inventoryResult.success) {
          console.error('Failed to update inventory for bill:', inventoryResult.error);
        }
      }

      if (
        (newStatus === 'approved' || newStatus === 'posted') &&
        oldStatus !== 'approved' &&
        oldStatus !== 'posted' &&
        !bill.journal_entry_id &&
        user
      ) {
        const billTotal = billLinesForPosting.reduce(
          (sum: number, line: any) => sum + Number(line.line_total || 0) + Number(line.tax_amount || 0),
          0
        );

        const journalBillLines = billLinesForPosting.map((line: any) => ({
          account_code:
            Object.keys(accountMap).find((key) => accountMap[key] === line.expense_account_id) || '5000',
          amount: Number(line.line_total || 0) + Number(line.tax_amount || 0),
          description: line.description,
        }));

        const journalResult = await createBillJournalEntryWithDb(
          tx,
          {
            id: bill.id,
            bill_number: bill.bill_number,
            bill_date: bill.bill_date,
            total: billTotal,
          },
          journalBillLines,
          user.id
        );

        if (!journalResult.success) {
          return {
            errorResponse: NextResponse.json(
              { error: `Bill updated but journal entry failed: ${journalResult.error}` },
              { status: 500 }
            ),
          };
        }

        if (journalResult.journalEntryId) {
          await tx.query('UPDATE bills SET journal_entry_id = $2 WHERE id = $1', [
            bill.id,
            journalResult.journalEntryId,
          ]);
          bill.journal_entry_id = journalResult.journalEntryId;
        }
      }

      return { bill };
    });

    if ((result as any).errorResponse) {
      return (result as any).errorResponse;
    }

    return NextResponse.json({ data: (result as any).bill });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bills/[id] - Delete or void bill
export async function DELETE(request: NextRequest, context: any) {
  const params = await context.params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'void';

    const existingResult = await db.query<{
      id: string;
      company_id: string;
      status: string;
      amount_paid: number;
    }>('SELECT id, company_id, status, amount_paid FROM bills WHERE id = $1 LIMIT 1', [params.id]);

    const existing = existingResult.rows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (existing.status === 'void') {
      return NextResponse.json({ error: 'Bill is already voided' }, { status: 400 });
    }

    if (action === 'delete') {
      if (existing.status !== 'draft' || Number(existing.amount_paid || 0) > 0) {
        return NextResponse.json(
          { error: 'Can only delete draft bills with no payments' },
          { status: 400 }
        );
      }

      await db.transaction(async (tx) => {
        await tx.query('DELETE FROM bill_lines WHERE bill_id = $1', [params.id]);
        await tx.query('DELETE FROM bills WHERE id = $1', [params.id]);
      });

      return NextResponse.json({ message: 'Bill deleted' });
    }

    const dataResult = await db.query<any>(
      'UPDATE bills SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
      [params.id, 'void']
    );

    return NextResponse.json({ data: dataResult.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
