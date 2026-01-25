import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/employees - List all employees with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    // Multi-tenant: Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Multi-tenant: Get company_id from query params
    const companyId = searchParams.get('company_id');
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Multi-tenant: Verify user has access to this company
    const { data: membership } = await supabase
      .from('user_companies')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
    }
    
    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const isActive = searchParams.get('is_active');

    let query = supabase
      .from('employees')
      .select('*')
      .order('first_name', { ascending: true });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('employment_status', status);
    }

    if (department && department !== 'all') {
      query = query.eq('department', department);
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/employees - Create a new employee
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { company_id, ...employeeData } = body;

    // Multi-tenant: Validate company_id
    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Validate required fields
    if (!employeeData.employee_number || !employeeData.first_name || !employeeData.last_name || !employeeData.hire_date || !employeeData.job_title || !employeeData.basic_salary) {
      return NextResponse.json(
        { error: 'Missing required fields: employee_number, first_name, last_name, hire_date, job_title, basic_salary' },
        { status: 400 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Multi-tenant: Verify user has access to this company
    const { data: membership } = await supabase
      .from('user_companies')
      .select('id')
      .eq('user_id', user.id)
      .eq('company_id', company_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
    }

    // Check for duplicate employee number
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('employee_number', employeeData.employee_number)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Employee number already exists' },
        { status: 409 }
      );
    }

    // Create the employee
    const { data, error } = await supabase
      .from('employees')
      .insert({
        company_id,
        employee_number: employeeData.employee_number,
        first_name: employeeData.first_name,
        last_name: employeeData.last_name,
        other_names: employeeData.other_names || null,
        email: employeeData.email || null,
        phone: employeeData.phone || null,
        national_id: employeeData.national_id || null,
        nssf_number: employeeData.nssf_number || null,
        tin: employeeData.tin || null,
        date_of_birth: employeeData.date_of_birth || null,
        gender: employeeData.gender || null,
        nationality: employeeData.nationality || 'Ugandan',
        address: employeeData.address || null,
        emergency_contact_name: employeeData.emergency_contact_name || null,
        emergency_contact_phone: employeeData.emergency_contact_phone || null,
        job_title: employeeData.job_title,
        department: employeeData.department || null,
        employment_type: employeeData.employment_type || 'full_time',
        employment_status: 'active', // New employees are always active
        hire_date: employeeData.hire_date,
        basic_salary: employeeData.basic_salary,
        salary_currency: employeeData.salary_currency || 'UGX',
        pay_frequency: employeeData.pay_frequency || 'monthly',
        bank_name: employeeData.bank_name || null,
        bank_branch: employeeData.bank_branch || null,
        bank_account_number: employeeData.bank_account_number || null,
        bank_account_name: employeeData.bank_account_name || null,
        is_active: true,
        notes: employeeData.notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
