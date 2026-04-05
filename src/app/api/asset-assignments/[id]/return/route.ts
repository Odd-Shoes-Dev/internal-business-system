import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;
    const assignmentId = id;
    const body = await request.json();
    const { return_date, condition_at_return, return_notes } = body;

    if (!return_date) {
      return NextResponse.json({ error: 'Return date is required' }, { status: 400 });
    }

    const assignmentResult = await db.query<any>(
      `SELECT aa.id, aa.asset_id, aa.status, fa.company_id
       FROM asset_assignments aa
       INNER JOIN fixed_assets fa ON fa.id = aa.asset_id
       WHERE aa.id = $1
       LIMIT 1`,
      [assignmentId]
    );

    const assignment = assignmentResult.rows[0];
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, assignment.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (assignment.status === 'returned') {
      return NextResponse.json({ error: 'Asset has already been returned' }, { status: 400 });
    }

    await db.query(
      `UPDATE asset_assignments
       SET return_date = $2::date,
           condition_at_return = $3,
           return_notes = $4,
           status = 'returned'
       WHERE id = $1`,
      [assignmentId, return_date, condition_at_return || null, return_notes || null]
    );

    return NextResponse.json({
      message: 'Asset returned successfully',
      assignmentId,
    });
  } catch (error: any) {
    console.error('Error returning asset:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
