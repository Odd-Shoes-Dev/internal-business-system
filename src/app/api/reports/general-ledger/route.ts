import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

interface GeneralLedgerEntry {
  entryId: string;
  date: string;
  accountCode: string;
  accountName: string;
  accountType: 'Assets' | 'Liabilities' | 'Equity' | 'Revenue' | 'Expenses';
  description: string;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
  journalType: 'General Journal' | 'Sales Journal' | 'Purchase Journal' | 'Cash Receipts' | 'Cash Disbursements' | 'Payroll Journal';
}

interface AccountSummary {
  accountCode: string;
  accountName: string;
  accountType: 'Assets' | 'Liabilities' | 'Equity' | 'Revenue' | 'Expenses';
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  entryCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const searchParams = request.nextUrl.searchParams;
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const accountFilter = searchParams.get('accountFilter') || 'all';
    const journalType = searchParams.get('journalType') || 'all';
    const searchTerm = searchParams.get('searchTerm') || '';

    const journalEntriesResult = await db.query(
      `SELECT id, entry_number, entry_date, description, memo, source_module, status
       FROM journal_entries
       WHERE company_id = $1
         AND entry_date >= $2::date
         AND entry_date <= $3::date
         AND status = 'posted'
       ORDER BY entry_date ASC, entry_number ASC`,
      [companyId, startDate, endDate]
    );
    const journalEntries = journalEntriesResult.rows;

    const entryIds = journalEntries.map((entry: any) => entry.id);
    let linesByEntryId = new Map<string, any[]>();
    if (entryIds.length > 0) {
      const linesResult = await db.query(
        `SELECT jl.id,
                jl.journal_entry_id,
                jl.line_number,
                jl.account_id,
                jl.debit,
                jl.credit,
                jl.description,
                a.id AS account_ref_id,
                a.code AS account_code,
                a.name AS account_name,
                a.account_type
         FROM journal_lines jl
         LEFT JOIN accounts a ON a.id = jl.account_id
         WHERE jl.journal_entry_id = ANY($1::uuid[])
         ORDER BY jl.line_number ASC`,
        [entryIds]
      );

      for (const line of linesResult.rows) {
        const current = linesByEntryId.get(line.journal_entry_id) || [];
        current.push(line);
        linesByEntryId.set(line.journal_entry_id, current);
      }
    }

    // Transform journal entries into general ledger entries
    const entries: GeneralLedgerEntry[] = [];
    
    // Map source_module to journal type
    const getJournalType = (sourceModule: string | null): GeneralLedgerEntry['journalType'] => {
      if (!sourceModule) return 'General Journal';
      switch (sourceModule.toLowerCase()) {
        case 'sales':
        case 'invoices':
          return 'Sales Journal';
        case 'purchases':
        case 'bills':
          return 'Purchase Journal';
        case 'receipts':
          return 'Cash Receipts';
        case 'payments':
        case 'disbursements':
          return 'Cash Disbursements';
        case 'payroll':
          return 'Payroll Journal';
        default:
          return 'General Journal';
      }
    };

    // Map account_type to our type format
    const mapAccountType = (accountType: string): GeneralLedgerEntry['accountType'] => {
      const type = accountType.toLowerCase();
      if (type.includes('asset')) return 'Assets';
      if (type.includes('liab')) return 'Liabilities';
      if (type.includes('equity')) return 'Equity';
      if (type.includes('revenue') || type.includes('income')) return 'Revenue';
      if (type.includes('expense') || type.includes('cost')) return 'Expenses';
      return 'Assets'; // default
    };

    journalEntries?.forEach((entry: any) => {
      const lines = linesByEntryId.get(entry.id) || [];
      lines.forEach((line: any) => {
        if (line.account_ref_id) {
          entries.push({
            entryId: `${entry.entry_number}-${line.line_number}`,
            date: entry.entry_date,
            accountCode: line.account_code,
            accountName: line.account_name,
            accountType: mapAccountType(line.account_type),
            description: line.description || entry.description || '',
            reference: entry.memo || entry.entry_number,
            debit: parseFloat(line.debit) || 0,
            credit: parseFloat(line.credit) || 0,
            runningBalance: 0, // Will be calculated below
            journalType: getJournalType(entry.source_module)
          });
        }
      });
    });

    // Calculate running balances for each account
    const accountBalances = new Map<string, number>();
    entries.forEach(entry => {
      const currentBalance = accountBalances.get(entry.accountCode) || 0;
      let newBalance = currentBalance;
      
      // For Assets and Expenses, debits increase balance, credits decrease
      if (entry.accountType === 'Assets' || entry.accountType === 'Expenses') {
        newBalance = currentBalance + entry.debit - entry.credit;
      } else {
        // For Liabilities, Equity, and Revenue, credits increase balance, debits decrease
        newBalance = currentBalance + entry.credit - entry.debit;
      }
      
      entry.runningBalance = newBalance;
      accountBalances.set(entry.accountCode, newBalance);
    });

    // Apply filters
    let filteredEntries = entries;

    // Date filter already applied in query
    // Account type filter
    if (accountFilter !== 'all') {
      filteredEntries = filteredEntries.filter(entry => entry.accountType === accountFilter);
    }

    // Journal type filter
    if (journalType !== 'all') {
      filteredEntries = filteredEntries.filter(entry => entry.journalType === journalType);
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredEntries = filteredEntries.filter(entry =>
        entry.accountCode.toLowerCase().includes(searchLower) ||
        entry.accountName.toLowerCase().includes(searchLower) ||
        entry.description.toLowerCase().includes(searchLower) ||
        entry.reference.toLowerCase().includes(searchLower)
      );
    }

    // Sort by date and then by entry ID
    filteredEntries.sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.entryId.localeCompare(b.entryId);
    });

    // Calculate summary statistics
    const totalDebits = filteredEntries.reduce((sum, entry) => sum + entry.debit, 0);
    const totalCredits = filteredEntries.reduce((sum, entry) => sum + entry.credit, 0);
    const balanceDifference = totalDebits - totalCredits;
    const inBalance = Math.abs(balanceDifference) < 0.01; // Allow for small rounding differences

    // Get unique accounts
    const accountMap = new Map<string, AccountSummary>();
    
    filteredEntries.forEach(entry => {
      const key = entry.accountCode;
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          accountCode: entry.accountCode,
          accountName: entry.accountName,
          accountType: entry.accountType,
          openingBalance: 0, // Simplified - in real system would track opening balances
          totalDebits: 0,
          totalCredits: 0,
          closingBalance: 0,
          entryCount: 0
        });
      }
      
      const account = accountMap.get(key)!;
      account.totalDebits += entry.debit;
      account.totalCredits += entry.credit;
      account.entryCount += 1;
      
      // Calculate closing balance based on account type
      if (account.accountType === 'Assets' || account.accountType === 'Expenses') {
        account.closingBalance = account.openingBalance + account.totalDebits - account.totalCredits;
      } else {
        account.closingBalance = account.openingBalance + account.totalCredits - account.totalDebits;
      }
    });

    const accountSummaries = Array.from(accountMap.values()).sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    // Calculate account type summaries
    const accountTypes = {
      assets: {
        accounts: accountSummaries.filter(a => a.accountType === 'Assets').length,
        balance: accountSummaries.filter(a => a.accountType === 'Assets').reduce((sum, a) => sum + a.closingBalance, 0)
      },
      liabilities: {
        accounts: accountSummaries.filter(a => a.accountType === 'Liabilities').length,
        balance: accountSummaries.filter(a => a.accountType === 'Liabilities').reduce((sum, a) => sum + a.closingBalance, 0)
      },
      equity: {
        accounts: accountSummaries.filter(a => a.accountType === 'Equity').length,
        balance: accountSummaries.filter(a => a.accountType === 'Equity').reduce((sum, a) => sum + a.closingBalance, 0)
      },
      revenue: {
        accounts: accountSummaries.filter(a => a.accountType === 'Revenue').length,
        balance: accountSummaries.filter(a => a.accountType === 'Revenue').reduce((sum, a) => sum + a.closingBalance, 0)
      },
      expenses: {
        accounts: accountSummaries.filter(a => a.accountType === 'Expenses').length,
        balance: accountSummaries.filter(a => a.accountType === 'Expenses').reduce((sum, a) => sum + a.closingBalance, 0)
      }
    };

    const response = {
      reportPeriod: {
        startDate,
        endDate
      },
      summary: {
        totalAccounts: accountSummaries.length,
        totalDebits,
        totalCredits,
        totalEntries: filteredEntries.length,
        balanceDifference,
        inBalance
      },
      entries: filteredEntries,
      accountSummaries,
      accountTypes
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('General ledger report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate general ledger report' },
      { status: 500 }
    );
  }
}

