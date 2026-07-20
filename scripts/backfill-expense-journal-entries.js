/**
 * Backfill journal entries for all expenses that are approved or paid
 * but have no journal_entry_id.
 *
 * Run with: node scripts/backfill-expense-journal-entries.js
 */

const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  });
}

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function query(client, text, params = []) {
  const result = await client.query(text, params);
  return { rows: result.rows, rowCount: result.rowCount };
}

async function getAccountIdByCode(client, code, companyId) {
  const result = await query(client,
    `SELECT id FROM accounts WHERE code = $1 AND company_id = $2 LIMIT 1`,
    [code, companyId]
  );
  return result.rows[0]?.id || null;
}

async function getExchangeRate(client, currency, companyId) {
  if (!currency || currency === 'USD') return 1;
  // Get company base currency
  const companyResult = await query(client,
    `SELECT currency FROM companies WHERE id = $1 LIMIT 1`,
    [companyId]
  );
  const baseCurrency = companyResult.rows[0]?.currency || 'USD';
  if (currency === baseCurrency) return 1;

  const rateResult = await query(client,
    `SELECT rate FROM exchange_rates
     WHERE from_currency = $1 AND to_currency = $2
     ORDER BY effective_date DESC LIMIT 1`,
    [currency, baseCurrency]
  );
  return rateResult.rows[0]?.rate ? parseFloat(rateResult.rows[0].rate) : 1;
}

async function backfill() {
  const client = await pool.connect();
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  try {
    // Find all approved/paid expenses with no journal entry
    const expensesResult = await query(client,
      `SELECT
         e.id,
         e.expense_number,
         e.expense_date,
         e.total,
         e.description,
         e.currency,
         e.bank_account_id,
         e.expense_account_id,
         e.company_id,
         e.status,
         a.code AS account_code,
         u.id AS created_by
       FROM expenses e
       LEFT JOIN accounts a ON a.id = e.expense_account_id
       LEFT JOIN user_profiles u ON u.company_id = e.company_id AND u.role = 'admin'
       WHERE e.status IN ('approved', 'paid')
         AND e.journal_entry_id IS NULL
       ORDER BY e.expense_date ASC`
    );

    const expenses = expensesResult.rows;
    console.log(`Found ${expenses.length} expenses to backfill.\n`);

    for (const expense of expenses) {
      console.log(`Processing ${expense.expense_number} (${expense.status}) — ${expense.currency} ${expense.total} — ${expense.description?.slice(0, 40)}`);

      if (!expense.account_code) {
        console.log(`  ⚠ SKIPPED — no expense account assigned`);
        skipped++;
        continue;
      }

      await client.query('BEGIN');
      try {
        // Get expense account ID
        const expenseAccountId = await getAccountIdByCode(client, expense.account_code, expense.company_id);
        if (!expenseAccountId) {
          console.log(`  ⚠ SKIPPED — account code ${expense.account_code} not found`);
          await client.query('ROLLBACK');
          skipped++;
          continue;
        }

        // Get cash/bank account
        let cashAccountId = null;
        if (expense.bank_account_id) {
          const bankResult = await query(client,
            `SELECT gl_account_id FROM bank_accounts WHERE id = $1 LIMIT 1`,
            [expense.bank_account_id]
          );
          cashAccountId = bankResult.rows[0]?.gl_account_id || null;
        }
        if (!cashAccountId) {
          cashAccountId = await getAccountIdByCode(client, '1000', expense.company_id);
        }
        if (!cashAccountId) {
          console.log(`  ⚠ SKIPPED — cash/bank account not found`);
          await client.query('ROLLBACK');
          skipped++;
          continue;
        }

        // Exchange rate
        const currency = expense.currency || 'USD';
        const exchangeRate = await getExchangeRate(client, currency, expense.company_id);
        const amount = parseFloat(expense.total);
        const baseAmount = amount * exchangeRate;

        // Get created_by — use admin of company, or fallback to any user in company
        let createdBy = expense.created_by;
        if (!createdBy) {
          const userResult = await query(client,
            `SELECT id FROM user_profiles WHERE company_id = $1 LIMIT 1`,
            [expense.company_id]
          );
          createdBy = userResult.rows[0]?.id;
        }
        if (!createdBy) {
          // Last resort: any user linked to this company via user_companies
          const ucResult = await query(client,
            `SELECT user_id FROM user_companies WHERE company_id = $1 LIMIT 1`,
            [expense.company_id]
          );
          createdBy = ucResult.rows[0]?.user_id;
        }
        if (!createdBy) {
          console.log(`  ⚠ SKIPPED — no user found for company`);
          await client.query('ROLLBACK');
          skipped++;
          continue;
        }

        // Generate journal entry number
        const entryNumResult = await query(client,
          `SELECT generate_journal_entry_number() AS entry_number`
        );
        const entryNumber = entryNumResult.rows[0]?.entry_number;

        // Create journal entry header
        const jeResult = await query(client,
          `INSERT INTO journal_entries (
             entry_number, entry_date, description, source_module,
             source_document_id, status, created_by, company_id
           ) VALUES ($1, $2, $3, 'expense', $4, 'posted', $5, $6)
           RETURNING id`,
          [
            entryNumber,
            expense.expense_date,
            `Expense: ${expense.description || expense.expense_number}`,
            expense.id,
            createdBy,
            expense.company_id,
          ]
        );
        const journalEntryId = jeResult.rows[0].id;

        // Debit expense account
        await query(client,
          `INSERT INTO journal_lines (
             journal_entry_id, line_number, account_id, debit, credit,
             description, currency, exchange_rate, base_debit, base_credit
           ) VALUES ($1, 1, $2, $3, 0, $4, $5, $6, $7, 0)`,
          [journalEntryId, expenseAccountId, amount,
           expense.description || expense.expense_number,
           currency, exchangeRate, baseAmount]
        );

        // Credit cash/bank account
        await query(client,
          `INSERT INTO journal_lines (
             journal_entry_id, line_number, account_id, debit, credit,
             description, currency, exchange_rate, base_debit, base_credit
           ) VALUES ($1, 2, $2, 0, $3, $4, $5, $6, 0, $7)`,
          [journalEntryId, cashAccountId, amount,
           `Payment - ${expense.description || expense.expense_number}`,
           currency, exchangeRate, baseAmount]
        );

        // Link journal entry back to expense
        await query(client,
          `UPDATE expenses SET journal_entry_id = $2 WHERE id = $1`,
          [expense.id, journalEntryId]
        );

        await client.query('COMMIT');
        console.log(`  ✓ Created JE ${entryNumber}`);
        processed++;

      } catch (err) {
        await client.query('ROLLBACK');
        console.log(`  ✗ FAILED — ${err.message}`);
        failed++;
      }
    }

    console.log(`\n========================================`);
    console.log(`Done.`);
    console.log(`  Created:  ${processed} journal entries`);
    console.log(`  Skipped:  ${skipped} (missing account or user)`);
    console.log(`  Failed:   ${failed}`);
    console.log(`========================================`);

  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
