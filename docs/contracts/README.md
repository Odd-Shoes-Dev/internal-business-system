# Legal Contracts & Agreements

This folder contains template contracts and legal documents for [Your Company Name]'s SaaS business management platform.

---

## 📄 DOCUMENTS INCLUDED

### 1. **SERVICE_AGREEMENT.md**
**Purpose:** Master agreement between you and your clients  
**When to Use:** Sign with every new customer during onboarding  
**Key Sections:**
- Service features and modules
- Subscription pricing tiers
- Payment terms and billing
- Data ownership and privacy
- Service Level Agreement (SLA)
- Termination and cancellation
- Liability limitations

**Action Required:**
- [ ] Replace `[Your Company Name]` with your actual company name
- [ ] Fill in your business address and contact info
- [ ] Review pricing tiers ($29/$99/$299) and adjust if needed
- [ ] Add your jurisdiction (country/state) for governing law
- [ ] Have reviewed by lawyer familiar with SaaS agreements
- [ ] Create DocuSign or similar e-signature workflow

---

### 2. **TERMS_OF_SERVICE.md**
**Purpose:** Legal terms users agree to when signing up  
**When to Use:** Display during registration; users must accept  
**Key Sections:**
- Account registration and eligibility
- Acceptable use policy
- Intellectual property rights
- Data privacy and security
- Payment and refund terms
- Termination rights
- Limitation of liability

**Action Required:**
- [ ] Customize company name and contact details
- [ ] Update last modified date when you make changes
- [ ] Add link to your website's terms page
- [ ] Include checkbox in registration form: "I agree to Terms of Service"
- [ ] Store acceptance timestamp in database
- [ ] Review annually and update as needed

**Integration:**
```typescript
// In registration form
<Checkbox required>
  I agree to the <Link to="/terms">Terms of Service</Link> 
  and <Link to="/privacy">Privacy Policy</Link>
</Checkbox>
```

---

### 3. **PRIVACY_POLICY.md**
**Purpose:** Explains how you collect, use, and protect user data  
**When to Use:** Required by law; link from website footer and registration  
**Key Sections:**
- What data you collect
- How you use data
- Who you share data with (never sold!)
- Data security measures
- User rights (access, delete, export)
- Cookie policy
- GDPR and CCPA compliance

**Action Required:**
- [ ] Customize all placeholder text
- [ ] List actual third-party services (Stripe, Supabase, email provider)
- [ ] Specify data storage locations
- [ ] Include contact for Data Protection Officer (DPO)
- [ ] Review GDPR requirements if serving EU customers
- [ ] Review CCPA requirements if serving California customers
- [ ] Update cookie consent banner if you use analytics

**Legal Requirement:** 
- **MANDATORY** - Cannot operate without this
- Must be accessible before users create accounts
- Update whenever you change data practices

---

### 4. **SLA.md** (Service Level Agreement)
**Purpose:** Guarantees uptime, support response times, and remedies  
**When to Use:** Part of Service Agreement; referenced in sales process  
**Key Sections:**
- 99.5% uptime commitment
- Support response times by plan tier
- Data backup and recovery commitments
- Security standards
- Service credits for downtime
- Escalation procedures

**Action Required:**
- [ ] Verify you can meet 99.5% uptime (test your infrastructure)
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom, etc.)
- [ ] Configure status page (status.yourdomain.com)
- [ ] Train support team on response time SLAs
- [ ] Create escalation contact list
- [ ] Test backup restoration monthly
- [ ] Document incident response procedures

**Tracking:**
- Use Supabase/monitoring tools to track actual uptime
- Calculate monthly uptime percentage
- Automatically issue service credits if below threshold
- Publish uptime reports for transparency

---

### 5. **NDA.md** (Non-Disclosure Agreement)
**Purpose:** Protect confidential information in business relationships  
**When to Use:**
- Partnership discussions
- Integration partnerships
- Reseller agreements
- Investor meetings
- Contractor/consultant engagements
- Beta tester programs

**Key Sections:**
- Definition of confidential information
- Obligations of receiving party
- Exclusions (public info, prior knowledge)
- Term and survival (5 years standard)
- Remedies for breach

**Action Required:**
- [ ] Customize company details
- [ ] Specify confidentiality term (2-5 years typical)
- [ ] Choose mutual vs. one-way NDA
- [ ] Add specific purpose in Appendix A
- [ ] Have lawyer review before using
- [ ] Create e-signature workflow
- [ ] Maintain signed NDA registry

**Types:**
- **One-Way NDA:** You disclose to them (e.g., hiring contractor)
- **Mutual NDA:** Both parties share info (e.g., partnership talks)

---

## 🎯 IMPLEMENTATION CHECKLIST

### Phase 1: Legal Review (Week 1)
- [ ] Hire or consult with SaaS-specialized lawyer
- [ ] Review all documents for your jurisdiction
- [ ] Customize terms for your business model
- [ ] Ensure compliance with local laws
- [ ] Add required disclosures for your industry

### Phase 2: Website Integration (Week 2)
- [ ] Create legal pages on website:
  - `/terms` - Terms of Service
  - `/privacy` - Privacy Policy
  - `/sla` - Service Level Agreement
- [ ] Add footer links to legal pages
- [ ] Create `/legal` hub page with all documents
- [ ] Implement cookie consent banner (if needed)
- [ ] Add Terms acceptance checkbox to registration

### Phase 3: Contract Workflow (Week 3)
- [ ] Set up DocuSign or similar e-signature platform
- [ ] Create Service Agreement template in DocuSign
- [ ] Build contract signing into onboarding flow
- [ ] Store signed contracts in secure location
- [ ] Create contract database/registry
- [ ] Set renewal reminders (annual contracts)

### Phase 4: Compliance Systems (Week 4)
- [ ] Implement Terms acceptance logging:
  ```sql
  CREATE TABLE terms_acceptances (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users,
    terms_version VARCHAR(50),
    accepted_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT
  );
  ```
- [ ] Build data export functionality (GDPR compliance)
- [ ] Create account deletion workflow
- [ ] Set up uptime monitoring
- [ ] Configure status page
- [ ] Document SLA tracking process

### Phase 5: Training & Documentation
- [ ] Train sales team on contract process
- [ ] Train support team on SLA commitments
- [ ] Create internal wiki for legal questions
- [ ] Document escalation procedures
- [ ] Prepare customer-facing SLA dashboard

---

## 📋 USAGE GUIDELINES

### When Signing New Customers:

1. **During Sales:**
   - Share SLA and pricing tiers
   - Discuss data privacy and security
   - Explain terms clearly

2. **Before Contract:**
   - Send Service Agreement for review
   - Allow 5-7 days for legal review
   - Answer questions promptly
   - Consider negotiation (Enterprise clients)

3. **Contract Signing:**
   - Use e-signature platform (DocuSign)
   - Both parties sign
   - Store signed PDF securely
   - Send copy to customer
   - File in contract management system

4. **After Signing:**
   - Activate account with correct subscription tier
   - Schedule onboarding call
   - Send welcome email with support contacts
   - Set renewal reminder (if annual)

### For Self-Service Signups:

1. **Registration Flow:**
   ```
   Enter details → Accept Terms (checkbox) → 
   Create account → Email verification → 
   Start trial → Upgrade prompt at trial end
   ```

2. **Terms Tracking:**
   - Log acceptance with timestamp
   - Store IP and user agent
   - Version control Terms (v1.0, v1.1, etc.)
   - Re-prompt on major updates

3. **Auto-Conversion:**
   - Trial ends → Prompt to enter payment
   - First payment = acceptance of paid terms
   - Send confirmation email

---

## ⚖️ COMPLIANCE NOTES

### GDPR (EU Customers)
**If you have EU customers, you MUST:**
- Appoint Data Protection Officer (can be you initially)
- Implement "right to be forgotten" (account deletion)
- Allow data export in machine-readable format
- Get explicit consent for data processing
- Report breaches within 72 hours
- Maintain data processing records

**Resources:**
- GDPR Official Text: https://gdpr.eu/
- GDPR Checklist: https://gdpr.eu/checklist/

### CCPA (California Customers)
**If you have California customers:**
- Allow users to request data deletion
- Disclose data collection practices
- State that you don't sell personal data
- Provide "Do Not Sell My Info" option (if applicable)

### Tax Compliance
**Sales Tax/VAT:**
- Collect based on customer location
- Register for VAT in EU (if revenue > €10,000)
- Use Stripe Tax or similar for automation
- File returns in required jurisdictions

### Industry-Specific
**If serving specific industries:**
- Tour operators: Check tourism regulations
- Financial services: May need additional compliance (SOC 2, etc.)
- Healthcare: HIPAA compliance if storing health data

---

## 🔄 MAINTENANCE SCHEDULE

### Monthly:
- [ ] Review new customer contracts
- [ ] Check SLA compliance (uptime, support response)
- [ ] Update status page with incidents

### Quarterly:
- [ ] Review terms for needed updates
- [ ] Audit data processing practices
- [ ] Test backup restoration
- [ ] Review security measures

### Annually:
- [ ] Full legal document review with lawyer
- [ ] Update terms if needed (notify customers)
- [ ] Renew annual contracts
- [ ] Review and update pricing
- [ ] Compliance audit (GDPR, CCPA, etc.)

---

## 📞 LEGAL CONTACTS

**Your Company Legal Team:**
- General Counsel: [Email]
- Contracts: [Email]
- Privacy Officer: dpo@[yourdomain].com

**External Legal Advisors:**
- SaaS Law Firm: [Contact]
- Data Privacy Attorney: [Contact]

**Regulatory Bodies:**
- Data Protection Authority: [Link/Contact]
- Local Business Registry: [Link/Contact]

---

## 🚨 IMPORTANT DISCLAIMERS

1. **Not Legal Advice:**
   These templates are starting points only. They do not constitute legal advice.

2. **Lawyer Review Required:**
   ALWAYS have a qualified attorney review and customize these documents for your specific situation, jurisdiction, and business model.

3. **Jurisdiction Matters:**
   Laws vary by country and state. Terms that work in Uganda may not work in California or Germany.

4. **Keep Updated:**
   Laws change. Review and update your legal documents regularly.

5. **No Warranty:**
   We provide these templates as-is without warranty. Use at your own risk.

---

## 📚 ADDITIONAL RESOURCES

**SaaS Legal Resources:**
- Stripe Atlas Legal Templates: https://stripe.com/atlas
- Contractually (Contract Templates): https://contractually.com
- TermsFeed (Privacy Policy Generator): https://www.termsfeed.com

**Compliance Tools:**
- Termly (Policy Generator): https://termly.io
- OneTrust (Privacy Management): https://www.onetrust.com
- Usercentrics (Cookie Consent): https://usercentrics.com

**Legal Education:**
- Startup Law 101 (Y Combinator): https://www.ycombinator.com
- SaaS Legal Handbook: Available on Amazon
- TechCrunch Legal Articles: https://techcrunch.com/tag/legal/

---

## ✅ QUICK START

**Ready to launch? Do this first:**

1. [ ] Have lawyer review Service Agreement
2. [ ] Post Privacy Policy on website
3. [ ] Add Terms acceptance to registration
4. [ ] Set up contract signing workflow
5. [ ] Configure uptime monitoring
6. [ ] Train support team on SLA

**After 30 days:**
- Review first contracts
- Check if SLA was met
- Gather customer feedback
- Adjust as needed

---

## 💡 TIPS FOR SUCCESS

1. **Be Transparent:** Clear, honest terms build trust
2. **Make Readable:** Avoid overly legal language
3. **Highlight Key Points:** Use bold/bullets for important sections
4. **Customer-Friendly:** Balance protection with fairness
5. **Update Regularly:** Keep pace with business and legal changes
6. **Track Everything:** Log acceptances, changes, renewals
7. **Get Insurance:** Professional liability insurance recommended

---

## Questions?

Contact: legal@[yourdomain].com

**Remember: When in doubt, consult a lawyer!**
