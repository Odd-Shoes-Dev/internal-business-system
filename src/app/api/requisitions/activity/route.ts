import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/requisitions/activity - Recent requisition events for the notification bell:
// created, delivery processed, completed, closed (voided or closed without completing).
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const limit = Number(new URL(request.url).searchParams.get('limit') || 5);

    const createdResult = await db.query(
      `SELECT id, requisition_number, client_name, created_at AS event_time
       FROM stock_requisitions
       WHERE company_id = $1 AND created_at > NOW() - INTERVAL '14 days'
       ORDER BY created_at DESC LIMIT $2`,
      [companyId, limit]
    );

    const completedResult = await db.query(
      `SELECT id, requisition_number, client_name, completed_at AS event_time
       FROM stock_requisitions
       WHERE company_id = $1 AND completed_at IS NOT NULL AND completed_at > NOW() - INTERVAL '14 days'
       ORDER BY completed_at DESC LIMIT $2`,
      [companyId, limit]
    );

    const closedResult = await db.query(
      `SELECT id, requisition_number, client_name, closed_at AS event_time, close_reason
       FROM stock_requisitions
       WHERE company_id = $1 AND closed_at IS NOT NULL AND closed_at > NOW() - INTERVAL '14 days'
       ORDER BY closed_at DESC LIMIT $2`,
      [companyId, limit]
    );

    const deliveredResult = await db.query(
      `SELECT d.id, d.delivery_number, d.created_at AS event_time,
              r.id AS requisition_id, r.requisition_number, r.client_name
       FROM stock_delivery_forms d
       JOIN stock_requisitions r ON r.id = d.requisition_id
       WHERE r.company_id = $1 AND d.status = 'active' AND d.created_at > NOW() - INTERVAL '14 days'
       ORDER BY d.created_at DESC LIMIT $2`,
      [companyId, limit]
    );

    const events = [
      ...createdResult.rows.map((r: any) => ({
        id: `req-created-${r.id}`,
        type: 'requisition_created',
        title: `Requisition ${r.requisition_number} created`,
        message: `For ${r.client_name}`,
        time: r.event_time,
        href: `/dashboard/requisitions/${r.id}`,
      })),
      ...deliveredResult.rows.map((r: any) => ({
        id: `req-delivered-${r.id}`,
        type: 'requisition_delivered',
        title: `Delivery ${r.delivery_number} processed`,
        message: `${r.requisition_number} — ${r.client_name}`,
        time: r.event_time,
        href: `/dashboard/requisitions/${r.requisition_id}`,
      })),
      ...completedResult.rows.map((r: any) => ({
        id: `req-completed-${r.id}`,
        type: 'requisition_completed',
        title: `Requisition ${r.requisition_number} completed`,
        message: `For ${r.client_name}`,
        time: r.event_time,
        href: `/dashboard/requisitions/${r.id}`,
      })),
      ...closedResult.rows.map((r: any) => ({
        id: `req-closed-${r.id}`,
        type: 'requisition_closed',
        title: `Requisition ${r.requisition_number} closed`,
        message: r.close_reason || `For ${r.client_name}`,
        time: r.event_time,
        href: `/dashboard/requisitions/${r.id}`,
      })),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, limit);

    return NextResponse.json({ data: events });
  } catch (error: any) {
    console.error('Error fetching requisition activity:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
