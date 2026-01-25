import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { updateExchangeRates } from '@/lib/currency';

// GET /api/exchange-rates - Fetch latest exchange rates
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .order('effective_date', { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/exchange-rates - Update exchange rates from API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Update exchange rates
    const success = await updateExchangeRates(supabase);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update exchange rates' },
        { status: 500 }
      );
    }

    // Fetch updated rates
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('*')
      .eq('effective_date', new Date().toISOString().split('T')[0])
      .order('from_currency');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Exchange rates updated successfully',
      data,
    });
  } catch (error: any) {
    console.error('Error updating exchange rates:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
