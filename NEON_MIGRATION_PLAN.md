# Supabase to Neon Migration Plan

**Objective:** Migrate database from Supabase to Neon while keeping Supabase Auth
**Timeline:** 2-3 weeks
**Risk Level:** Low-Medium
**Key Benefit:** Neon branching for safer testing across multiple environments

---

## Phase 1: Setup & Preparation (Days 1-2)

### 1.1 Neon Account & Database Setup
- [ ] Create Neon account (Pro tier recommended for corporations)
- [ ] Create main production database
- [ ] Set up dev/staging branch
- [ ] Document connection strings for all environments:
  - Production: `NEON_DATABASE_URL_PROD`
  - Development: `NEON_DATABASE_URL_DEV`
  - Testing: `NEON_DATABASE_URL_TEST`

### 1.2 Database Schema Migration
- [ ] Export schema from Supabase
- [ ] Import schema to Neon main database
- [ ] Verify all tables, indexes, constraints exist
- [ ] Verify RLS policies (if any)
- [ ] Test connection from local machine

### 1.3 Environment Configuration
- [ ] Add Neon connection string to `.env.local`
- [ ] Update `.env.example` with Neon variables
- [ ] Create environment-specific connection logic
- [ ] Update Supabase client to support dual connection (auth + database separation)

### 1.4 Create Database Abstraction Layer
- **Directory:** `src/lib/database/`
- [ ] Create `neon-client.ts` - Neon connection wrapper
- [ ] Create `db.ts` - Main database interface
- [ ] Keep `supabase-client.ts` for auth only (rename to `auth-client.ts`)
- [ ] Add database transaction support
- [ ] Add connection pooling configuration

---

## Phase 2: Dependency Installation & Setup (Days 2-3)

### 2.1 Install Required Packages
```bash
npm install pg @neondatabase/serverless
npm install -D @types/pg
```

### 2.2 Create Neon Connection Module
- [ ] Create `src/lib/database/neon-client.ts`
  - Use `@neondatabase/serverless` for serverless queries
  - Use `pg` for long-running server queries
  - Implement connection pooling
  - Add error handling and logging

### 2.3 Create Query Builder/ORM Interface
- [ ] Create `src/lib/database/db.ts`
  - Abstract queries away from Supabase
  - Standardize query patterns
  - Support parameterized queries (prevent SQL injection)

---

## Phase 3: Gradual Query Migration (Days 4-14)

### 3.1 Identify All Database Queries (Audit)
- [ ] Search codebase for all Supabase `.from()` calls
- [ ] Categorize by feature/module (e.g., billing, invoices, payroll)
- [ ] Prioritize by criticality (start with less critical features)
- [ ] Create spreadsheet tracking migration status

### 3.2 Create Query Migration Template
```typescript
// OLD (Supabase)
const { data } = await supabase
  .from('table')
  .select('*')
  .eq('company_id', companyId);

// NEW (Neon)
const data = await db.query(
  'SELECT * FROM table WHERE company_id = $1',
  [companyId]
);
```

### 3.3 Migrate Queries by Priority
- [ ] **Priority 1 (Week 1):** Dashboard, Auth-related, Company settings
- [ ] **Priority 2 (Week 2):** Finance (invoices, bills, expenses)
- [ ] **Priority 3 (Week 2-3):** Operations (modules, modules-related)
- [ ] **Priority 4 (Week 3):** Remaining APIs

### 3.4 Per-Query Migration Checklist
For each query:
- [ ] Create equivalent Neon query
- [ ] Add comprehensive error handling
- [ ] Write unit tests for new query
- [ ] Test with dev branch data
- [ ] Code review before merging
- [ ] Monitor in staging before production

---

## Phase 4: Authentication Separation (Days 3-5)

### 4.1 Separate Auth from Database
- [ ] Rename `src/lib/supabase/client.ts` → `src/lib/auth/auth-client.ts`
- [ ] Keep ONLY auth operations in auth client:
  - `supabase.auth.getSession()`
  - `supabase.auth.signOut()`
  - `supabase.auth.signUp()`
- [ ] Remove ALL data queries from auth client

### 4.2 Update All Auth Imports
- [ ] Search for `from '@/lib/supabase/client'`
- [ ] Update to `from '@/lib/auth/auth-client'`
- [ ] Ensure no data queries in auth-related files

### 4.3 Middleware Updates
- [ ] Update `src/middleware.ts` to use auth client only
- [ ] Verify session validation still works
- [ ] Test login/logout flow

---

## Phase 5: Testing & Validation (Days 10-14)

### 5.1 Unit Tests
- [ ] Write tests for each migrated query
- [ ] Test error scenarios
- [ ] Test with parameterized inputs
- [ ] Mock Neon responses

### 5.2 Integration Tests
- [ ] Test full feature flows (e.g., create invoice → fetch → update)
- [ ] Test multi-tenant isolation (company_id filtering)
- [ ] Test transactions
- [ ] Test concurrent operations

### 5.3 Staging Verification
- [ ] Deploy to staging environment
- [ ] Run full smoke tests
- [ ] Test with real user scenarios
- [ ] Performance testing (query times)
- [ ] Memory usage monitoring

### 5.4 Branch Testing Workflow
- [ ] Create feature branch in Neon
- [ ] Test schema migrations on branch
- [ ] Verify branch-specific data isolation
- [ ] Test branch reset/cleanup

---

## Phase 6: Production Deployment (Day 15)

### 6.1 Pre-Deployment Checklist
- [ ] All queries migrated
- [ ] All tests passing
- [ ] Performance benchmarks acceptable
- [ ] Rollback plan documented
- [ ] Team trained on Neon dashboard

### 6.2 Deployment Steps
1. [ ] Backup Supabase database (export full dump)
2. [ ] Run final schema sync to Neon
3. [ ] Deploy updated code to production
4. [ ] Update production connection string in env vars
5. [ ] Monitor error logs for 24 hours
6. [ ] Verify all data queries working

### 6.3 Post-Deployment
- [ ] Monitor database performance
- [ ] Check error rates in logs
- [ ] Verify user workflows
- [ ] Document lessons learned

---

## Phase 7: Cleanup & Optimization (After Deployment)

### 7.1 Remove Supabase Database Code
- [ ] Remove Supabase data query methods
- [ ] Remove unused Supabase packages (if any)
- [ ] Clean up dual-client code

### 7.2 Optimize Neon Configuration
- [ ] Review slow query logs
- [ ] Add missing indexes
- [ ] Optimize connection pooling
- [ ] Configure branch auto-deletion

### 7.3 Documentation
- [ ] Update development docs with Neon setup
- [ ] Document branching strategy for testing
- [ ] Create runbooks for common tasks
- [ ] Update API documentation if needed

---

## File Structure (New)

```
src/lib/
├── auth/
│   ├── auth-client.ts          (renamed from supabase/client.ts)
│   └── get-service-client.ts   (auth service client only)
├── database/
│   ├── neon-client.ts          (NEW - Neon connection)
│   ├── db.ts                   (NEW - Query interface)
│   ├── types.ts                (NEW - Type defs)
│   └── queries/                (NEW - Organized queries)
│       ├── companies.ts
│       ├── invoices.ts
│       ├── users.ts
│       └── ...
└── supabase/
    └── [DEPRECATED - to be removed after migration]
```

---

## Environment Variables

### Current (Supabase)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### New (Neon + Supabase)
```
# Neon Database
NEON_DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.neon.tech/dbname
NEON_DATABASE_URL_DEV=postgresql://user:password@ep-xxx.us-east-1.neon.tech/dbname_dev

# Supabase Auth (KEEP)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx (if used for auth operations)
```

---

## Rollback Plan

If critical issues occur:

### 1. Immediate Rollback (Minutes)
- [ ] Revert code changes to previous commit
- [ ] Redeploy to production
- [ ] Update env vars to point back to Supabase database

### 2. Data Sync Rollback
- If less than 1 hour of new data:
  - Restore from Supabase backup
  - Notify users of potential data loss
  
### 3. Extended Rollback  
- If migration had significant new data:
  - Keep Neon as read-only
  - Gradually migrate back
  - Communicate with users

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Data loss during migration | Full backup before migration, verify data integrity |
| Query performance degradation | Performance testing on staging, index optimization |
| Multi-tenant isolation break | Test RLS equivalents, verify company_id filtering |
| Authentication failure | Keep Supabase Auth unchanged, thorough auth testing |
| Connection pool exhaustion | Monitor connections, tune pool settings |
| Syntax differences | Test all queries on Neon before production |

---

## Success Criteria

- [ ] All database queries migrated to Neon
- [ ] Zero authentication-related issues
- [ ] Query performance equivalent or better than Supabase
- [ ] Multi-tenant data isolation maintained
- [ ] All tests passing (unit + integration)
- [ ] Neon branching workflow functional for testing
- [ ] No data loss or corruption
- [ ] Team comfortable with Neon operations

---

## Tracking

Use this checklist to track progress:

- **Phase 1 Completion:** ___/___
- **Phase 2 Completion:** ___/___
- **Phase 3 Completion:** ___/___
- **Phase 4 Completion:** ___/___
- **Phase 5 Completion:** ___/___
- **Phase 6 Completion:** ___/___
- **Phase 7 Completion:** ___/___

**Overall Progress:** ___% (Update weekly)

---

## Next Steps

1. Create Neon account
2. Complete Phase 1 setup
3. Proceed with Phase 2 dependency installation
4. Begin Phase 3 query migration (start with Priority 1)
