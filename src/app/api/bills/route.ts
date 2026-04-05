import { NextRequest, NextResponse } from 'next/server';
import {
  asQueryExecutor,
  createBillJournalEntryWithDb,
  increaseInventoryForBillWithDb,
  validatePeriodLockWithDb,
} from '@/lib/accounting/provider-accounting';
import {
  getCompanyIdFromRequest,
  requireCompanyAccess,
  requireSessionUser,
} from '@/lib/provider/route-guards';

// GET /api/bills - List bills
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const status = searchParams.get('status');
    const vendorId = searchParams.get('vendor_id');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const where: string[] = ['b.company_id = $1'];
    const params: any[] = [companyId];

    if (status && status !== 'all') {
      params.push(status);
      where.push(`b.status = $${params.length}`);
    }

    if (vendorId) {
      params.push(vendorId);
      where.push(`b.vendor_id = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`b.bill_number ILIKE $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const countResult = await db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM bills b
       ${whereSql}`,
      params
    );

    const listParams = [...params, limit, offset];
    const dataResult = await db.query(
      `SELECT b.*, v.id AS vendor_ref_id, v.name AS vendor_name, v.company_name AS vendor_company_name
       FROM bills b
       LEFT JOIN vendors v ON v.id = b.vendor_id
       ${whereSql}
       ORDER BY b.bill_date DESC
       LIMIT $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const data = dataResult.rows.map((row) => ({
      ...row,
      vendors: row.vendor_ref_id
        ? {
            id: row.vendor_ref_id,
            name: row.vendor_name,
            company_name: row.vendor_company_name,
          }
        : null,
    }));

    const count = Number(countResult.rows[0]?.total || 0);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bills - Create bill
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const { company_id } = body;

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    if (!body.vendor_id || !body.bill_date || !body.due_date) {
      return NextResponse.json(
        { error: 'Missing required fields: vendor_id, bill_date, due_date' },
        { status: 400 }
      );
    }

    const companyAccessError = await requireCompanyAccess(user.id, company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const periodError = await validatePeriodLockWithDb(asQueryExecutor(db), body.bill_date, company_id);
    if (periodError) {
      return NextResponse.json({ error: periodError }, { status: 403 });
    }

    const billNumberResult = await db.query<{ bill_number: string }>('SELECT generate_bill_number() AS bill_number');
    const billNumber = billNumberResult.rows[0]?.bill_number;
    if (!billNumber) {
      return NextResponse.json({ error: 'Failed to generate bill number' }, { status: 500 });
    }

    const apAccount = await db.query<{ id: string }>('SELECT id FROM accounts WHERE code = $1 LIMIT 1', ['2000']);

    const lines = body.line_items || body.lines || [];
    let subtotal = 0;
    let taxAmount = 0;

    const accountCodes = lines
      .map((line: any) => line.account_code)
      .filter((code: any) => code);

    let accountMap: Record<string, string> = {};
    if (accountCodes.length > 0) {
      const accounts = await db.query<{ id: string; code: string }>(
        'SELECT id, code FROM accounts WHERE code = ANY($1::text[])',
        [accountCodes]
      );

      if (accounts.rows.length > 0) {
        accountMap = Object.fromEntries(accounts.rows.map((acc) => [acc.code, acc.id]));
      }
    }

    lines.forEach((line: any) => {
      const unitCost = parseFloat(line.unit_cost || line.unit_price || 0);
      const quantity = parseFloat(line.quantity || 0);
      const taxRate = parseFloat(line.tax_rate || 0);
      const lineSubtotal = quantity * unitCost;
      const lineTax = lineSubtotal * taxRate;
      subtotal += lineSubtotal;
      taxAmount += lineTax;
    });

    const total = subtotal + taxAmount;

    const createdBill = await db.transaction(async (tx) => {
      const billInsert = await tx.query<any>(
        `INSERT INTO bills (
           company_id, bill_number, vendor_id, bill_date, due_date,
           vendor_invoice_number, notes, subtotal, tax_amount, total,
           amount_paid, status, currency, exchange_rate, payment_terms,
           ap_account_id, created_by
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10,
           0, $11, $12, $13, $14,
           $15, $16
         )
         RETURNING *`,
        [
          company_id,
          billNumber,
          body.vendor_id,
          body.bill_date,
          body.due_date,
          body.vendor_invoice_number || null,
          body.notes || null,
          subtotal,
          taxAmount,
          total,
          body.status || 'draft',
          body.currency || 'USD',
          body.exchange_rate || 1,
          body.payment_terms || 30,
          apAccount.rows[0]?.id || null,
          user.id,
        ]
      );

      const bill = billInsert.rows[0];

      const billLines = lines
        .filter((line: any) => {
          const unitCost = parseFloat(line.unit_cost || line.unit_price || 0);
          const quantity = parseFloat(line.quantity || 0);
          const hasDescription = line.description && line.description.trim();
          return hasDescription && quantity * unitCost > 0;
        })
        .map((line: any, index: number) => {
          const unitCost = parseFloat(line.unit_cost || line.unit_price || 0);
          const quantity = parseFloat(line.quantity || 0);
          const taxRate = parseFloat(line.tax_rate || 0);
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
            account_code: line.account_code || null,
          };
        });

      if (billLines.length > 0) {
        for (const line of billLines) {
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
      }

      if ((bill.status === 'posted' || bill.status === 'approved') && billLines.length > 0) {
        const inventoryResult = await increaseInventoryForBillWithDb(
          tx,
          bill.id,
          bill.bill_date,
          billLines.map((line: any) => ({
            product_id: line.product_id,
            quantity: line.quantity,
            unit_cost: line.unit_cost,
            line_total: line.line_total,
            description: line.description,
          })),
          user.id
        );

        if (!inventoryResult.success) {
          console.error('Failed to update inventory for bill:', inventoryResult.error);
        }

        const journalBillLines = billLines.map((line: any) => ({
          account_code:
            Object.keys(accountMap).find((key) => accountMap[key] === line.expense_account_id) || '5000',
          amount: line.line_total + line.tax_amount,
          description: line.description,
        }));

        const journalResult = await createBillJournalEntryWithDb(
          tx,
          {
            id: bill.id,
            bill_number: bill.bill_number,
            bill_date: bill.bill_date,
            total: bill.total,
          },
          journalBillLines,
          user.id
        );

        if (!journalResult.success) {
          console.error('Failed to create journal entry for bill:', journalResult.error);
        } else if (journalResult.journalEntryId) {
          await tx.query('UPDATE bills SET journal_entry_id = $2 WHERE id = $1', [
            bill.id,
            journalResult.journalEntryId,
          ]);
        }
      }

      return bill;
    });

    return NextResponse.json({ data: createdBill }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

