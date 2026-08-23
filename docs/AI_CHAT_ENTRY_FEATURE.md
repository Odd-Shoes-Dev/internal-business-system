# AI Chat Record Entry — Feature Proposal

## What the client asked for

A chat or bot interface where a user can describe a record in plain language and the system automatically creates it — without navigating to a form, filling in fields, or clicking through the UI.

**Examples of what a user could type:**
- "Add an expense of 50,000 for fuel paid by cash today"
- "Create an invoice for Kampala Traders, 3 units of cement at 120,000 each"
- "Record a payment of 200,000 received from John Mukasa"
- "Add employee Harriet Nabuuma, salary 800,000, department Finance"

---

## How it would work

### 1. Chat UI
A floating chat bubble or side panel available on any dashboard page. The user types a natural language instruction. No need to navigate anywhere.

### 2. AI interprets the instruction
The message is sent to Claude (via the Anthropic API). The system prompt tells Claude:
- What company the user belongs to
- What modules are active (expenses, invoices, employees, etc.)
- The schema of each record type (required fields, allowed values)
- What action to take (create, update, list, delete)

Claude responds with a **structured JSON action**, not plain text. Example:

```json
{
  "action": "create",
  "module": "expenses",
  "data": {
    "description": "Fuel",
    "amount": 50000,
    "category": "Transport",
    "payment_method": "cash",
    "expense_date": "2026-08-24"
  }
}
```

### 3. Confirmation step
Before saving, the system shows the user a preview card:
> "I'll create an expense — Fuel, USh 50,000, cash, today. Confirm?"

The user clicks **Confirm** or **Edit** (which opens the normal form pre-filled).

### 4. Record is created
On confirm, the frontend calls the existing API endpoint (e.g. `POST /api/expenses`) with the extracted data. The same validation and business logic applies — the AI just fills in the fields.

### 5. Response
The chat replies: "Done — expense created. [View it →]"

---

## Supported modules (phase 1 suggestion)

| Module | Actions |
|---|---|
| Expenses | Create |
| Invoices | Create |
| Bills | Create |
| Payments | Record received / paid |
| Employees | Create |
| Payroll | Generate period |

---

## Technical approach

- **Model:** Claude (claude-sonnet-5 or claude-haiku-4-5 for speed/cost)
- **API route:** `POST /api/ai/chat` — receives user message + company context, returns structured action
- **Auth:** Same session auth as the rest of the app, scoped to company_id
- **Prompt engineering:** System prompt includes field definitions and examples per module
- **Fallback:** If Claude cannot confidently extract a valid action, it asks a clarifying question instead of guessing

---

## Key constraints

- The AI must never create a record without user confirmation
- All records go through existing API endpoints — no direct DB writes from the AI route
- The feature respects module access (subscription_modules table) — if a module is inactive, the AI says so
- Sensitive fields (bank account numbers, passwords) are never passed through the chat

---

## Open questions

- Should the chat be global (floating bubble) or per-module (sidebar on each page)?
- Should it support read queries too ("show me expenses this month")?
- Cost management — haiku is cheap enough for high volume; sonnet gives better extraction accuracy
- Should conversation history be kept per session or per user?
