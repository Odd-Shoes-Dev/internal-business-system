import { NextRequest, NextResponse } from 'next/server';
import {
  requireCompanyAccess,
  requireSessionUser,
} from '@/lib/provider/route-guards';

// PATCH /api/companies/contacts/[id]
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id } = params;
    const body = await request.json();
    const { company_id, type, label, value, show_on_documents, sort_order } = body;

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }
    if (type && !['email', 'phone'].includes(type)) {
      return NextResponse.json({ error: 'type must be email or phone' }, { status: 400 });
    }

    const accessError = await requireCompanyAccess(user.id, company_id);
    if (accessError) return accessError;

    const result = await db.query(
      `UPDATE company_contact_details
       SET type = COALESCE($2, type),
           label = COALESCE($3, label),
           value = COALESCE($4, value),
           show_on_documents = COALESCE($5, show_on_documents),
           sort_order = COALESCE($6, sort_order),
           updated_at = NOW()
       WHERE id = $1 AND company_id = $7
       RETURNING id, type, label, value, show_on_documents, sort_order`,
      [id, type || null, label?.trim() || null, value?.trim() || null, show_on_documents ?? null, sort_order ?? null, company_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/companies/contacts/[id]
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id } = params;
    const { searchParams } = new URL(request.url);
    const company_id = searchParams.get('company_id');

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const accessError = await requireCompanyAccess(user.id, company_id);
    if (accessError) return accessError;

    const result = await db.query(
      `DELETE FROM company_contact_details WHERE id = $1 AND company_id = $2 RETURNING id`,
      [id, company_id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
