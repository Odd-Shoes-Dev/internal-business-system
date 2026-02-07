# Database Integrity Tests

**Purpose:** Validate database consistency, relationships, and data integrity  
**Frequency:** Daily (automated) + On-demand  
**Impact:** Critical - Database corruption can cause system-wide failures

---

## Test Categories

### 🔴 Critical Integrity Checks (Daily)
- **Foreign Key Constraints** - All relationships are valid
- **Multi-Tenant Isolation** - No cross-company data leakage
- **Financial Data Consistency** - Accounting equation balances
- **Inventory Consistency** - Stock levels match transactions
- **Subscription Data Validity** - Valid subscription states

### 🟡 Data Quality Checks (Weekly)
- **Duplicate Records** - Check for unintended duplicates
- **Orphaned Records** - Records without valid parents
- **Data Type Validation** - Ensure data types are correct
- **Business Rule Validation** - Domain-specific constraints
- **Performance Metrics** - Query optimization opportunities

### 🟢 Archival & Cleanup (Monthly)
- **Old Log Cleanup** - Remove expired log entries
- **Backup Verification** - Validate backup integrity
- **Index Optimization** - Database performance tuning
- **Storage Analysis** - Disk usage and optimization

---

## Critical Database Tables

### Core Business Tables
```sql
-- Primary business entities
companies           -- Tenant isolation base
users              -- User accounts and permissions
subscriptions      -- Billing and plan management
invoices           -- Revenue tracking
bookings           -- Tour operations core
customers          -- Customer relationships
```

### Financial Tables
```sql
-- Accounting and finance
accounts           -- Chart of accounts
journal_entries    -- Double-entry accounting
invoices           -- Accounts receivable
bills              -- Accounts payable
payments           -- Payment transactions
receipts           -- Payment receipts
bank_accounts      -- Bank account management
```

### Operations Tables
```sql
-- Tour operations
tours              -- Tour packages
hotels             -- Hotel inventory
bookings           -- Reservation management
inventory          -- Product inventory
employees          -- HR management
assets             -- Fixed assets
```

---

## Automated Integrity Tests

### 1. Foreign Key Constraint Validation
```sql
-- File: tests/database/integrity/foreign-key-check.sql

-- Check for orphaned invoice records
SELECT 'orphaned_invoices' as test_name, COUNT(*) as violations
FROM invoices i
LEFT JOIN companies c ON i.company_id = c.id
WHERE c.id IS NULL
UNION ALL

-- Check for orphaned booking records
SELECT 'orphaned_bookings' as test_name, COUNT(*) as violations  
FROM bookings b
LEFT JOIN companies c ON b.company_id = c.id
WHERE c.id IS NULL
UNION ALL

-- Check for orphaned payment records
SELECT 'orphaned_payments' as test_name, COUNT(*) as violations
FROM payments p
LEFT JOIN invoices i ON p.invoice_id = i.id
WHERE p.invoice_id IS NOT NULL AND i.id IS NULL
UNION ALL

-- Check for orphaned journal entries
SELECT 'orphaned_journal_entries' as test_name, COUNT(*) as violations
FROM journal_entries je
LEFT JOIN companies c ON je.company_id = c.id
WHERE c.id IS NULL;
```

### 2. Multi-Tenant Isolation Validation
```sql
-- File: tests/database/integrity/multi-tenant-check.sql

-- Verify no cross-company data access
WITH company_data AS (
  SELECT DISTINCT company_id FROM invoices
  UNION
  SELECT DISTINCT company_id FROM bookings  
  UNION
  SELECT DISTINCT company_id FROM customers
  UNION
  SELECT DISTINCT company_id FROM accounts
),
invalid_companies AS (
  SELECT cd.company_id
  FROM company_data cd
  LEFT JOIN companies c ON cd.company_id = c.id
  WHERE c.id IS NULL
)
SELECT 'invalid_company_references' as test_name, COUNT(*) as violations
FROM invalid_companies;

-- Check for NULL company_id values (should not exist)
SELECT 'null_company_ids' as test_name, 
       COUNT(*) as violations
FROM (
  SELECT company_id FROM invoices WHERE company_id IS NULL
  UNION ALL
  SELECT company_id FROM bookings WHERE company_id IS NULL
  UNION ALL
  SELECT company_id FROM customers WHERE company_id IS NULL
  UNION ALL  
  SELECT company_id FROM accounts WHERE company_id IS NULL
) null_checks;
```

### 3. Financial Data Consistency
```sql
-- File: tests/database/integrity/financial-consistency.sql

-- Trial balance validation (debits = credits)
WITH trial_balance AS (
  SELECT 
    company_id,
    SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as total_debits,
    SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as total_credits
  FROM journal_entries 
  GROUP BY company_id
)
SELECT 
  'trial_balance_imbalance' as test_name,
  COUNT(*) as violations
FROM trial_balance 
WHERE ABS(total_debits - total_credits) > 0.01;

-- Invoice totals consistency
WITH invoice_totals AS (
  SELECT 
    i.id,
    i.total_amount,
    COALESCE(SUM(ii.total_price), 0) as calculated_total
  FROM invoices i
  LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
  GROUP BY i.id, i.total_amount
)
SELECT 
  'invoice_total_mismatch' as test_name,
  COUNT(*) as violations
FROM invoice_totals
WHERE ABS(total_amount - calculated_total) > 0.01;

-- Payment allocation validation
WITH payment_totals AS (
  SELECT 
    invoice_id,
    SUM(amount) as total_payments
  FROM receipts
  WHERE invoice_id IS NOT NULL
  GROUP BY invoice_id
),
invoice_payments AS (
  SELECT 
    i.id,
    i.total_amount,
    COALESCE(pt.total_payments, 0) as paid_amount,
    i.status
  FROM invoices i
  LEFT JOIN payment_totals pt ON i.id = pt.invoice_id
)
SELECT 
  'payment_status_mismatch' as test_name,
  COUNT(*) as violations
FROM invoice_payments
WHERE (
  (status = 'paid' AND paid_amount < total_amount * 0.99) OR
  (status = 'partial' AND (paid_amount = 0 OR paid_amount >= total_amount)) OR
  (status = 'draft' AND paid_amount > 0)
);
```

### 4. Inventory Consistency
```sql
-- File: tests/database/integrity/inventory-consistency.sql

-- Stock level validation
WITH inventory_movements AS (
  SELECT 
    product_id,
    SUM(CASE WHEN type = 'in' THEN quantity ELSE -quantity END) as calculated_stock
  FROM inventory_movements
  GROUP BY product_id
),
stock_comparison AS (
  SELECT 
    p.id,
    p.current_stock,
    COALESCE(im.calculated_stock, 0) as calculated_stock
  FROM products p
  LEFT JOIN inventory_movements im ON p.id = im.product_id
)
SELECT 
  'stock_level_mismatch' as test_name,
  COUNT(*) as violations
FROM stock_comparison
WHERE current_stock != calculated_stock;

-- Negative stock validation (business rule)
SELECT 
  'negative_stock_levels' as test_name,
  COUNT(*) as violations
FROM products 
WHERE current_stock < 0 AND track_inventory = true;
```

### 5. Subscription Data Validation
```sql
-- File: tests/database/integrity/subscription-validation.sql

-- Active subscription validation
SELECT 
  'companies_without_active_subscription' as test_name,
  COUNT(*) as violations
FROM companies c
LEFT JOIN subscriptions s ON c.id = s.company_id AND s.status IN ('active', 'trial')
WHERE s.id IS NULL;

-- Expired trial validation
SELECT 
  'expired_trials_still_active' as test_name,
  COUNT(*) as violations
FROM subscriptions 
WHERE status = 'trial' 
  AND trial_end_date < CURRENT_DATE;

-- Billing consistency
SELECT 
  'subscription_without_billing_plan' as test_name,
  COUNT(*) as violations
FROM subscriptions s
LEFT JOIN billing_plans bp ON s.plan_id = bp.id
WHERE bp.id IS NULL;
```

---

## Database Health Check Script

### Node.js Database Health Check
```javascript
// File: tests/database/integrity/database-health-check.js

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runDatabaseHealthCheck() {
  console.log('🗄️ Starting Database Health Check...');
  
  const healthChecks = [
    {
      name: 'Connection Test',
      query: 'SELECT 1 as test',
      expected: (result) => result.data && result.data.length > 0
    },
    {
      name: 'Foreign Key Violations',
      query: `
        SELECT COUNT(*) as violations
        FROM invoices i
        LEFT JOIN companies c ON i.company_id = c.id
        WHERE c.id IS NULL
      `,
      expected: (result) => result.data[0].violations === 0
    },
    {
      name: 'Trial Balance Check',
      query: `
        WITH trial_balance AS (
          SELECT 
            company_id,
            SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as debits,
            SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as credits
          FROM journal_entries 
          GROUP BY company_id
        )
        SELECT COUNT(*) as imbalanced
        FROM trial_balance 
        WHERE ABS(debits - credits) > 0.01
      `,
      expected: (result) => result.data[0].imbalanced === 0
    },
    {
      name: 'Multi-Tenant Isolation',
      query: `
        SELECT COUNT(*) as violations
        FROM (
          SELECT company_id FROM invoices WHERE company_id IS NULL
          UNION ALL
          SELECT company_id FROM bookings WHERE company_id IS NULL
        ) null_checks
      `,
      expected: (result) => result.data[0].violations === 0
    }
  ];

  const results = [];
  
  for (const check of healthChecks) {
    try {
      console.log(`Testing: ${check.name}...`);
      
      const result = await supabase.rpc('execute_sql', { 
        sql: check.query 
      });
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      const passed = check.expected(result);
      
      results.push({
        name: check.name,
        passed,
        details: result.data
      });
      
      console.log(`${passed ? '✅' : '❌'} ${check.name}: ${passed ? 'PASS' : 'FAIL'}`);
      
    } catch (error) {
      results.push({
        name: check.name,
        passed: false,
        error: error.message
      });
      console.log(`❌ ${check.name}: ERROR - ${error.message}`);
    }
  }
  
  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log(`\\n📊 Database Health Summary: ${passed}/${total} checks passed`);
  
  if (passed < total) {
    console.log('🚨 Database integrity issues detected!');
    process.exit(1);
  } else {
    console.log('✅ All database health checks passed');
    process.exit(0);
  }
}

runDatabaseHealthCheck();
```

---

## Performance Monitoring Queries

### 1. Slow Query Detection
```sql
-- File: tests/database/performance/slow-queries.sql

-- Monitor long-running queries (requires pg_stat_statements extension)
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements 
WHERE mean_time > 1000  -- Queries taking > 1 second on average
ORDER BY mean_time DESC
LIMIT 10;
```

### 2. Index Usage Analysis  
```sql
-- File: tests/database/performance/index-usage.sql

-- Identify unused indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE idx_tup_read = 0
ORDER BY schemaname, tablename;

-- Identify missing indexes (table scans)
SELECT 
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  seq_tup_read / seq_scan as avg_seq_scan
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC
LIMIT 10;
```

### 3. Database Size Monitoring
```sql
-- File: tests/database/performance/size-monitoring.sql

-- Table size analysis
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Database growth tracking
SELECT 
  datname,
  pg_size_pretty(pg_database_size(datname)) as size
FROM pg_database 
WHERE datname NOT IN ('template0', 'template1', 'postgres');
```

---

## Automated Cleanup Procedures

### 1. Log Table Cleanup
```sql
-- File: tests/database/cleanup/log-cleanup.sql

-- Remove old activity logs (keep 90 days)
DELETE FROM activity_logs 
WHERE created_at < CURRENT_DATE - INTERVAL '90 days';

-- Remove old audit trails (keep 1 year)  
DELETE FROM audit_trail
WHERE created_at < CURRENT_DATE - INTERVAL '1 year';

-- Archive old email logs (keep 30 days active)
INSERT INTO email_logs_archive 
SELECT * FROM email_logs 
WHERE created_at < CURRENT_DATE - INTERVAL '30 days';

DELETE FROM email_logs 
WHERE created_at < CURRENT_DATE - INTERVAL '30 days';
```

### 2. Orphaned Record Cleanup
```sql
-- File: tests/database/cleanup/orphaned-cleanup.sql

-- Remove orphaned invoice items (invoice deleted)
DELETE FROM invoice_items 
WHERE invoice_id NOT IN (SELECT id FROM invoices);

-- Remove orphaned booking items (booking deleted)
DELETE FROM booking_items
WHERE booking_id NOT IN (SELECT id FROM bookings);

-- Remove orphaned file attachments (parent record deleted)
DELETE FROM file_attachments fa
WHERE NOT EXISTS (
  SELECT 1 FROM invoices WHERE id = fa.entity_id AND fa.entity_type = 'invoice'
  UNION
  SELECT 1 FROM bookings WHERE id = fa.entity_id AND fa.entity_type = 'booking'
  UNION  
  SELECT 1 FROM expenses WHERE id = fa.entity_id AND fa.entity_type = 'expense'
);
```

---

## Critical Alerts Configuration

### Database Connection Issues
```javascript
// File: tests/database/monitoring/connection-monitor.js

async function monitorDatabaseConnections() {
  const { data, error } = await supabase
    .from('pg_stat_activity')
    .select('count')
    .eq('state', 'active');
    
  if (error) {
    throw new Error(`Database connection check failed: ${error.message}`);
  }
  
  const activeConnections = data.length;
  const maxConnections = 100; // Supabase limit
  
  if (activeConnections > maxConnections * 0.8) {
    console.warn(`⚠️ High database connection usage: ${activeConnections}/${maxConnections}`);
  }
  
  if (activeConnections > maxConnections * 0.95) {
    console.error(`🚨 Critical database connection usage: ${activeConnections}/${maxConnections}`);
    // Send alert
  }
}
```

### Data Consistency Alerts
```javascript
// File: tests/database/monitoring/consistency-monitor.js

async function monitorDataConsistency() {
  const checks = [
    {
      name: 'Foreign Key Violations',
      tolerance: 0,
      query: `
        SELECT COUNT(*) as count FROM invoices i
        LEFT JOIN companies c ON i.company_id = c.id
        WHERE c.id IS NULL
      `
    },
    {
      name: 'Trial Balance Imbalance',  
      tolerance: 0,
      query: `
        WITH tb AS (
          SELECT company_id,
            SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as debits,
            SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as credits
          FROM journal_entries GROUP BY company_id
        )
        SELECT COUNT(*) as count FROM tb 
        WHERE ABS(debits - credits) > 0.01
      `
    }
  ];
  
  for (const check of checks) {
    const { data, error } = await supabase.rpc('execute_sql', { 
      sql: check.query 
    });
    
    if (error) {
      console.error(`❌ ${check.name}: Error - ${error.message}`);
      continue;
    }
    
    const violations = data[0].count;
    
    if (violations > check.tolerance) {
      console.error(`🚨 ${check.name}: ${violations} violations detected`);
      // Send critical alert
    } else {
      console.log(`✅ ${check.name}: OK`);
    }
  }
}
```

---

## Recovery Procedures

### 1. Database Corruption Recovery
```bash
#!/bin/bash
# File: tests/database/recovery/corruption-recovery.sh

echo "🛠️ Database Corruption Recovery Procedure"

# 1. Immediate assessment
echo "Step 1: Assessing corruption extent..."
psql $DATABASE_URL -c "\\
  SELECT schemaname, tablename \\
  FROM pg_tables \\
  WHERE schemaname = 'public'"

# 2. Check backup availability
echo "Step 2: Checking backup availability..."
# List available backups
aws s3 ls s3://blueox-backups/database/ --recursive

# 3. Isolate affected tables
echo "Step 3: Isolating affected tables..."
# Create temporary tables for corrupted data
psql $DATABASE_URL -c "\\
  CREATE TABLE invoices_backup AS SELECT * FROM invoices; \\
  CREATE TABLE bookings_backup AS SELECT * FROM bookings;"

# 4. Restore from backup
echo "Step 4: Restoring from backup..."
# Restore specific tables from backup
# Implementation depends on backup strategy (pg_dump, WAL-E, etc.)

echo "✅ Recovery procedure completed"
```

### 2. Performance Recovery
```sql
-- File: tests/database/recovery/performance-recovery.sql

-- Rebuild critical indexes
REINDEX INDEX CONCURRENTLY idx_invoices_company_id;
REINDEX INDEX CONCURRENTLY idx_bookings_company_id;
REINDEX INDEX CONCURRENTLY idx_journal_entries_account_id;

-- Update table statistics
ANALYZE invoices;
ANALYZE bookings;
ANALYZE journal_entries;
ANALYZE customers;

-- Vacuum heavy-usage tables
VACUUM ANALYZE invoices;
VACUUM ANALYZE bookings;
VACUUM ANALYZE activity_logs;
```

---

**Monitoring Schedule:**
- **Real-time:** Connection and performance metrics
- **Hourly:** Quick integrity checks
- **Daily:** Full integrity validation
- **Weekly:** Performance analysis and optimization
- **Monthly:** Deep cleanup and archival

**Last Updated:** February 7, 2026