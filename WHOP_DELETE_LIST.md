# Whop Products & Plans to Delete

Delete these in your Whop Dashboard before running the updated setup script.

---

## 📦 PRODUCTS TO DELETE

### Base Subscription Product
- **Product Name:** `Base Plans`
- **Description:** `Subscription tiers`
- **Contains:** All tier plans (starter, professional, enterprise) for all regions

### Module Products (6 products)
1. **Product Name:** `tours module`
   - **Description:** `Module: tours`

2. **Product Name:** `fleet module`
   - **Description:** `Module: fleet`

3. **Product Name:** `hotels module`
   - **Description:** `Module: hotels`

4. **Product Name:** `cafe module`
   - **Description:** `Module: cafe`

5. **Product Name:** `inventory module`
   - **Description:** `Module: inventory`

6. **Product Name:** `payroll module`
   - **Description:** `Module: payroll`

---

## 📋 PLANS TO DELETE (by Internal Name)

### Base Plans (Monthly) - 18 plans
**Format:** `{tier}-{region}-monthly`

1. `starter-AFRICA-monthly`
2. `starter-ASIA-monthly`
3. `starter-EU-monthly`
4. `starter-GB-monthly`
5. `starter-US-monthly`
6. `starter-DEFAULT-monthly`
7. `professional-AFRICA-monthly`
8. `professional-ASIA-monthly`
9. `professional-EU-monthly`
10. `professional-GB-monthly`
11. `professional-US-monthly`
12. `professional-DEFAULT-monthly`
13. `enterprise-AFRICA-monthly`
14. `enterprise-ASIA-monthly`
15. `enterprise-EU-monthly`
16. `enterprise-GB-monthly`
17. `enterprise-US-monthly`
18. `enterprise-DEFAULT-monthly`

### Base Plans (Annual) - 18 plans (if they exist)
**Format:** `{tier}-{region}-annual` (may have been created manually)

1. `starter-AFRICA-annual`
2. `starter-ASIA-annual`
3. `starter-EU-annual`
4. `starter-GB-annual`
5. `starter-US-annual`
6. `starter-DEFAULT-annual`
7. `professional-AFRICA-annual`
8. `professional-ASIA-annual`
9. `professional-EU-annual`
10. `professional-GB-annual`
11. `professional-US-annual`
12. `professional-DEFAULT-annual`
13. `enterprise-AFRICA-annual`
14. `enterprise-ASIA-annual`
15. `enterprise-EU-annual`
16. `enterprise-GB-annual`
17. `enterprise-US-annual`
18. `enterprise-DEFAULT-annual`

### Module Plans - 36 plans
**Format:** `{moduleId}-{region}`

#### Tours Module (6 plans)
1. `tours-AFRICA`
2. `tours-ASIA`
3. `tours-EU`
4. `tours-GB`
5. `tours-US`
6. `tours-DEFAULT`

#### Fleet Module (6 plans)
7. `fleet-AFRICA`
8. `fleet-ASIA`
9. `fleet-EU`
10. `fleet-GB`
11. `fleet-US`
12. `fleet-DEFAULT`

#### Hotels Module (6 plans)
13. `hotels-AFRICA`
14. `hotels-ASIA`
15. `hotels-EU`
16. `hotels-GB`
17. `hotels-US`
18. `hotels-DEFAULT`

#### Cafe Module (6 plans)
19. `cafe-AFRICA`
20. `cafe-ASIA`
21. `cafe-EU`
22. `cafe-GB`
23. `cafe-US`
24. `cafe-DEFAULT`

#### Inventory Module (6 plans)
25. `inventory-AFRICA`
26. `inventory-ASIA`
27. `inventory-EU`
28. `inventory-GB`
29. `inventory-US`
30. `inventory-DEFAULT`

#### Payroll Module (6 plans)
31. `payroll-AFRICA`
32. `payroll-ASIA`
33. `payroll-EU`
34. `payroll-GB`
35. `payroll-US`
36. `payroll-DEFAULT`

---

## 🗑️ HOW TO DELETE IN WHOP DASHBOARD

### Option 1: Delete by Product (Easiest)
1. Go to **Whop Dashboard** → **Products**
2. Find each product listed above
3. Click on the product → **Settings** → **Delete Product**
4. This will delete all plans under that product

### Option 2: Delete Individual Plans
1. Go to **Whop Dashboard** → **Products** → Select a product
2. Find plans by their **Internal Name** (shown above)
3. Click on each plan → **Delete Plan**

---

## ✅ AFTER DELETION

1. Run your GitHub workflow with the updated `run-whop-setup` script
2. The script will create new products/plans with:
   - `initial_price: 0` ✅
   - `renewal_price: {monthly_amount}` ✅
3. Update `src/lib/whop-config.ts` with the new plan IDs returned by the script

---

## 📝 NOTES

- **Total Products:** 7 (1 base + 6 modules)
- **Total Plans:** ~72 plans (18 monthly + 18 annual if they exist + 36 modules)
- If you can't find a plan by internal name, check the plan ID in `whop-config.ts` and search by that
- Annual plans might not exist if they were never created - only delete what you find
