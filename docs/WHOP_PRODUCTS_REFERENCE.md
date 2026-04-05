

## Checkout uses **plan** IDs, not product IDs

The app does **not** use these product IDs for checkout. It uses **plan** IDs in `src/lib/whop-config.ts`:

- **Base plans:** `WHOP_PLAN_IDS` (e.g. `starter-monthly`, `professional-annual` per region)
- **Modules:** `WHOP_MODULE_IDS` (e.g. `tours`, `fleet` per region)

Each product above contains multiple **plans** (one per region: AFRICA, ASIA, EU, GB, US, DEFAULT). Those plan IDs (they look like `plan_xxxxxxxxxxxx`) must be in `whop-config.ts` so “Proceed to Checkout” and create-checkout use the correct plans.

If your workflow or script output included the **new plan IDs** when it created these products, paste those into `src/lib/whop-config.ts` (replace the old `WHOP_PLAN_IDS` and `WHOP_MODULE_IDS`). If you only have product IDs, copy the plan IDs from each product in the Whop dashboard (Product → Plans → each plan’s ID) and update `whop-config.ts` accordingly.
