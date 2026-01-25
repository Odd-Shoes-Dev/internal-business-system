/**
 * Script to update remaining files for multi-tenant architecture
 * Run with: node scripts/update-multi-tenant.js
 */

const fs = require('fs');
const path = require('path');

// Patterns to identify files that need updating
const dashboardPagesPattern = /src[\\\/]app[\\\/]dashboard[\\\/].*[\\\/]page\.tsx$/;
const apiRoutesPattern = /src[\\\/]app[\\\/]api[\\\/].*[\\\/]route\.ts$/;

// Files already updated (skip these)
const updatedFiles = [
  'src/app/api/customers/route.ts',
  'src/app/api/vendors/route.ts',
  'src/app/api/invoices/route.ts',
  'src/app/api/bookings/route.ts',
  'src/app/api/expenses/route.ts',
  'src/app/api/employees/route.ts',
  'src/app/api/accounts/route.ts',
  'src/app/api/tours/route.ts',
  'src/app/api/companies/register/route.ts',
  'src/app/dashboard/page.tsx',
  'src/app/dashboard/customers/page.tsx',
];

function updateDashboardPage(filePath, content) {
  // Skip if already has useCompany
  if (content.includes('useCompany')) {
    console.log(`✓ Already updated: ${filePath}`);
    return content;
  }

  // Skip if it's not a 'use client' component
  if (!content.includes("'use client'")) {
    console.log(`⊘ Skipping server component: ${filePath}`);
    return content;
  }

  let updated = content;

  // Add useCompany import if not present
  if (!content.includes('useCompany')) {
    updated = updated.replace(
      /(import.*from ['"]@\/lib\/supabase\/client['"];?\n)/,
      "$1import { useCompany } from '@/contexts/company-context';\n"
    );
  }

  // Add company context to component
  updated = updated.replace(
    /(export default function \w+\([^)]*\) \{[\s\n]*)(const \[)/,
    "$1  const { company, loading: companyLoading } = useCompany();\n  $2"
  );

  // Update useEffect to depend on company
  updated = updated.replace(
    /useEffect\(\(\) => \{[\s\n]*([^}]*loadData[^;]*\(\);[\s\n]*)\}, \[(.*?)\]\);/,
    "useEffect(() => {\n    if (company) {\n      $1    }\n  }, [company, $2]);"
  );

  // Add company check at start of load functions
  updated = updated.replace(
    /(const load\w+ = async \(\) => \{[\s\n]*)(try \{)/,
    "$1    if (!company) return;\n    \n    $2"
  );

  // Add company_id to supabase queries
  updated = updated.replace(
    /\.from\(['"](\w+)['"]\)([\s\n]*)\.select\(/g,
    ".from('$1')$2.select("
  );

  // Add .eq('company_id', company.id) after .from() calls
  updated = updated.replace(
    /\.from\(['"](\w+)['"]\)([\s\n]*)\.select\(([^)]+)\)([\s\n]*)\.(?!eq\(['"]company_id)/g,
    ".from('$1')$2.select($3)$4.eq('company_id', company.id)."
  );

  console.log(`✓ Updated: ${filePath}`);
  return updated;
}

function updateAPIRoute(filePath, content) {
  // Skip if already has multi-tenant comments
  if (content.includes('Multi-tenant:')) {
    console.log(`✓ Already updated: ${filePath}`);
    return content;
  }

  // Skip webhooks and special routes
  if (filePath.includes('webhook') || filePath.includes('stripe')) {
    console.log(`⊘ Skipping special route: ${filePath}`);
    return content;
  }

  let updated = content;

  // Update GET endpoints
  updated = updated.replace(
    /(export async function GET\(request: NextRequest[^)]*\) \{[\s\n]*try \{[\s\n]*const supabase = await createClient\(\);[\s\n]*const \{ searchParams \} = new URL\(request\.url\);[\s\n]*)/,
    `$1
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
    `
  );

  // Update POST endpoints
  updated = updated.replace(
    /(export async function POST\(request: NextRequest[^)]*\) \{[\s\n]*try \{[\s\n]*const supabase = await createClient\(\);[\s\n]*const body = await request\.json\(\);[\s\n]*)/,
    `$1
    const { company_id, ...data } = body;

    // Multi-tenant: Validate company_id
    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }
    `
  );

  console.log(`✓ Updated: ${filePath}`);
  return updated;
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (stat.isFile()) {
      callback(filePath);
    }
  });
}

// Main execution
const rootDir = path.join(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

console.log('🚀 Starting multi-tenant update script...\n');

let updatedCount = 0;
let skippedCount = 0;

walkDir(srcDir, (filePath) => {
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  
  // Skip already updated files
  if (updatedFiles.includes(relativePath)) {
    return;
  }

  // Check if it's a dashboard page
  if (dashboardPagesPattern.test(relativePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const updated = updateDashboardPage(relativePath, content);
    
    if (updated !== content) {
      fs.writeFileSync(filePath, updated, 'utf-8');
      updatedCount++;
    } else {
      skippedCount++;
    }
  }
  
  // Check if it's an API route
  else if (apiRoutesPattern.test(relativePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const updated = updateAPIRoute(relativePath, content);
    
    if (updated !== content) {
      fs.writeFileSync(filePath, updated, 'utf-8');
      updatedCount++;
    } else {
      skippedCount++;
    }
  }
});

console.log(`\n✅ Update complete!`);
console.log(`   Updated: ${updatedCount} files`);
console.log(`   Skipped: ${skippedCount} files`);
console.log(`\n⚠️  Manual review recommended for complex files`);
console.log(`   Run database migrations next: supabase migration up`);
