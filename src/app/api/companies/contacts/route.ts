import { NextRequest, NextResponse } from 'next/server';
import {
  getCompanyIdFromRequest,
  requireCompanyAccess,
  requireSessionUser,
} from '@/lib/provider/route-guards';

// GET /api/companies/contacts?company_id=xxx
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const result = await db.query(
      `SELECT id, type, label, value, show_on_documents, sort_order
       FROM company_contact_details
       WHERE company_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [companyId]
    );

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/companies/contacts
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const { company_id, type, label, value, show_on_documents = false, sort_order = 0 } = body;

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }
    if (!type || !['email', 'phone'].includes(type)) {
      return NextResponse.json({ error: 'type must be email or phone' }, { status: 400 });
    }
    if (!label?.trim()) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 });
    }
    if (!value?.trim()) {
      return NextResponse.json({ error: 'value is required' }, { status: 400 });
    }

    const accessError = await requireCompanyAccess(user.id, company_id);
    if (accessError) return accessError;

    const result = await db.query(
      `INSERT INTO company_contact_details (company_id, type, label, value, show_on_documents, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, type, label, value, show_on_documents, sort_order`,
      [company_id, type, label.trim(), value.trim(), show_on_documents, sort_order]
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
