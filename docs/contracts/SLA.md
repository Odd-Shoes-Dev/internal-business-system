# SERVICE LEVEL AGREEMENT (SLA)

**Effective Date:** [Date]

This Service Level Agreement ("SLA") is part of the Software as a Service Agreement between [Your Company Name] ("Provider") and the Client. This SLA defines the service levels, uptime commitments, support response times, and remedies for service failures.

---

## 1. SERVICE AVAILABILITY

### 1.1 Uptime Commitment

**Uptime Target: 99.5% Monthly Uptime**

Calculated as:
```
Uptime % = (Total Minutes in Month - Downtime Minutes) / Total Minutes in Month × 100
```

**Example:**
- Month with 30 days = 43,200 minutes
- Maximum allowed downtime = 216 minutes (3.6 hours)
- 99.5% uptime = 43,200 - 216 = 42,984 minutes available

### 1.2 Downtime Definition

**Downtime includes:**
- Service completely unavailable
- Error rates exceeding 5% of requests
- Critical functionality broken
- Unable to login or access data

**Downtime excludes:**
- Scheduled maintenance (with notice)
- Problems with Client's internet connection
- Client's hardware or software issues
- Third-party service failures (Stripe, Supabase infrastructure)
- Force majeure events
- Client-caused outages
- DDoS attacks or security incidents
- Beta features marked "as-is"

### 1.3 Measurement Period
Uptime calculated monthly, from the 1st to the last day of each calendar month.

### 1.4 Monitoring
We monitor service availability using:
- Automated uptime monitoring (1-minute intervals)
- Application performance monitoring
- Database health checks
- Third-party monitoring services

---

## 2. SCHEDULED MAINTENANCE

### 2.1 Maintenance Windows

**Routine Maintenance:**
- Frequency: Monthly or as needed
- Duration: Typically 1-2 hours
- Schedule: 8:00 PM - 6:00 AM EAT (off-peak hours)
- Notice: 48 hours advance notification
- Method: Email and in-app notification

**Example Maintenance Window:**
- Day: First Sunday of each month
- Time: 10:00 PM - 12:00 AM EAT
- Impact: Full service unavailable

### 2.2 Emergency Maintenance

**Critical Fixes:**
- Notice: As soon as possible (may be zero notice)
- Reasons: Security vulnerabilities, critical bugs, data integrity
- Duration: Minimized to shortest time necessary
- Communication: Real-time updates via status page

### 2.3 Maintenance Exclusion
Scheduled and emergency maintenance time does not count against uptime guarantee.

### 2.4 Status Page
Real-time service status available at: status.[yourdomain].com
- Current status
- Scheduled maintenance
- Incident history
- Subscribe to notifications

---

## 3. PERFORMANCE STANDARDS

### 3.1 Response Time Targets

**Page Load Times:**
- Dashboard: < 2 seconds (90th percentile)
- Reports: < 5 seconds (90th percentile)
- Data entry forms: < 1 second (90th percentile)
- API requests: < 500ms (90th percentile)

**PDF Generation:**
- Invoice/Receipt: < 10 seconds
- Complex reports: < 30 seconds

### 3.2 Data Processing

**Synchronization:**
- Real-time data updates: < 1 second
- Background jobs: Within 5 minutes
- Report generation: Within 2 minutes

**Batch Operations:**
- Bulk imports: < 5 minutes per 1,000 records
- Data exports: < 10 minutes per 10,000 records

### 3.3 API Performance

**Rate Limits:**
- Standard: 100 requests/minute per user
- Burst: 200 requests/minute for 1 minute
- Enterprise: 500 requests/minute

**API Availability:**
Same as web service (99.5% uptime)

---

## 4. SUPPORT RESPONSE TIMES

### 4.1 Support Tiers

#### STARTER PLAN

**Email Support:**
- Initial Response: 48 business hours
- Resolution Target: 5 business days
- Availability: Business hours (Mon-Fri, 8am-6pm EAT)
- Channels: Email only

**Severity Levels:**
- Critical: 48 hours
- High: 72 hours
- Medium: 5 business days
- Low: Best effort

#### PROFESSIONAL PLAN

**Email & Chat Support:**
- Initial Response: 24 business hours
- Resolution Target: 3 business days
- Availability: Business hours (Mon-Fri, 8am-6pm EAT)
- Channels: Email, Live chat
- Priority Queue: Yes

**Severity Levels:**
- Critical: 24 hours
- High: 48 hours
- Medium: 3 business days
- Low: 5 business days

#### ENTERPRISE PLAN

**Phone, Email & Chat Support:**
- Initial Response: 4 business hours
- Resolution Target: 24-48 hours
- Availability: Extended hours (Mon-Fri, 7am-8pm EAT)
- Channels: Phone, Email, Live chat
- Dedicated Account Manager: Yes

**Severity Levels:**
- Critical: 4 hours (24/7 emergency hotline)
- High: 12 hours
- Medium: 24 hours
- Low: 48 hours

### 4.2 Severity Definitions

**Critical (P1):**
- Complete service outage
- Data loss or corruption
- Security breach
- Payment processing failure
- Cannot access system at all

**High (P2):**
- Major features non-functional
- Significant performance degradation
- Workaround available but difficult
- Affects multiple users

**Medium (P3):**
- Minor feature issues
- Workaround easily available
- Affects single user or small group
- Cosmetic bugs

**Low (P4):**
- Enhancement requests
- Documentation questions
- Minor cosmetic issues
- General inquiries

### 4.3 Business Hours
**Standard Business Hours:**
Monday to Friday, 8:00 AM to 6:00 PM East Africa Time (EAT/GMT+3)

**Holidays:**
We observe major public holidays in Uganda, Kenya, and Tanzania. Emergency support available for Enterprise clients.

### 4.4 Response Time Measurement
Clock starts when ticket is created in our system. Paused during non-business hours and when waiting for Client response.

---

## 5. DATA BACKUP & RECOVERY

### 5.1 Backup Schedule

**Automated Backups:**
- Frequency: Every 6 hours (4 times daily)
- Retention: 30 days
- Type: Full database snapshots
- Location: Multiple geographic regions

**Daily Backups:**
- Time: 2:00 AM EAT
- Retention: 90 days
- Type: Full backup with transaction logs

**Weekly Backups:**
- Time: Sunday 2:00 AM EAT
- Retention: 1 year
- Type: Complete system backup

### 5.2 Recovery Time Objectives (RTO)

**Disaster Recovery:**
- RTO: 4 hours (time to restore service)
- RPO: 6 hours (maximum data loss)

**Data Restoration Requests:**
- Individual record: Within 2 business hours
- Company data: Within 8 business hours
- Full account: Within 24 business hours

### 5.3 Backup Testing
We test backup restoration monthly to ensure integrity and reliability.

### 5.4 Client Backups
Clients can export their own data anytime:
- Format: CSV, JSON, PDF
- Frequency: Unlimited
- Self-service via account settings

---

## 6. SECURITY COMMITMENTS

### 6.1 Data Protection

**Encryption:**
- In-transit: TLS 1.2+ (256-bit encryption)
- At-rest: AES-256 encryption
- Passwords: Bcrypt hashing

**Access Control:**
- Role-based access control (RBAC)
- Multi-factor authentication (optional)
- Session timeout: 24 hours
- IP whitelisting (Enterprise only)

### 6.2 Security Monitoring

**24/7 Monitoring:**
- Intrusion detection
- DDoS protection
- Malware scanning
- Unusual activity alerts

**Vulnerability Management:**
- Monthly security audits
- Quarterly penetration testing
- Patch management within 48 hours for critical vulnerabilities

### 6.3 Data Breach Response

**Notification Timeline:**
- Internal detection: Within 1 hour
- Client notification: Within 72 hours
- Regulatory notification: As required by law
- Incident report: Within 7 days

**Breach Response:**
- Immediate containment
- Forensic investigation
- Remediation plan
- Ongoing monitoring

### 6.4 Compliance

**Standards:**
- GDPR compliant (where applicable)
- SOC 2 Type II (in progress)
- PCI DSS Level 1 (via Stripe)
- ISO 27001 (in progress)

---

## 7. SERVICE CREDITS

### 7.1 Credit Calculation

If monthly uptime falls below 99.5%, Client receives service credit:

| Uptime Achieved | Service Credit |
|-----------------|----------------|
| 99.0% - 99.49% | 10% of monthly fee |
| 98.0% - 98.99% | 25% of monthly fee |
| 95.0% - 97.99% | 50% of monthly fee |
| Below 95.0% | 100% of monthly fee |

**Example:**
- Monthly fee: $99
- Uptime: 98.5%
- Credit: $24.75 (25% of $99)

### 7.2 Credit Application

**Automatic Credits:**
- Applied to next month's invoice
- No request needed for downtimes > 1 hour
- Visible in billing history

**Manual Credit Requests:**
Must be submitted within 30 days of incident:
- Via email: support@[yourdomain].com
- Subject: "SLA Credit Request"
- Include: Dates, times, impact description

### 7.3 Credit Limitations

**Maximum Credit:**
One month of service fees per incident

**Credits are:**
- Not cash refunds
- Not transferable
- Not cumulative beyond one month's fee
- Sole remedy for service failures

**No credit for:**
- Downtime during scheduled maintenance
- Client-caused issues
- Force majeure events
- Third-party service failures
- Free trial accounts

---

## 8. ESCALATION PROCEDURES

### 8.1 Standard Escalation Path

**Level 1: Support Team**
- First point of contact
- Handle 80% of issues
- Response per support tier SLA

**Level 2: Senior Support Engineer**
- Complex technical issues
- Escalation after 24 hours (no resolution)
- Direct email/chat access

**Level 3: Engineering Team**
- Critical bugs or system issues
- Escalation after 48 hours
- Direct involvement in resolution

**Level 4: CTO/Management**
- Persistent critical issues
- Escalation after 72 hours or upon request
- Executive involvement

### 8.2 Emergency Hotline (Enterprise Only)

**24/7 Critical Issues:**
- Phone: [Emergency Number]
- For Critical (P1) issues only
- Direct to on-call engineer
- Response within 15 minutes

### 8.3 Account Manager (Enterprise Only)

**Dedicated Support:**
- Direct email and phone
- Weekly check-ins
- Quarterly business reviews
- Custom escalation procedures

---

## 9. CLIENT RESPONSIBILITIES

### 9.1 For SLA Compliance

Clients must:
- Maintain stable internet connection
- Use supported browsers (Chrome, Firefox, Safari, Edge - latest 2 versions)
- Keep login credentials secure
- Report issues promptly
- Provide necessary information for troubleshooting
- Test integrations before production use
- Maintain current contact information

### 9.2 For Support

When reporting issues:
- Describe problem clearly
- Include steps to reproduce
- Provide screenshots or screen recordings
- Specify affected users/features
- Indicate business impact

### 9.3 For Backups

Clients should:
- Regularly export critical data
- Maintain local backups of important records
- Test data restoration procedures
- Verify data accuracy after imports

---

## 10. THIRD-PARTY DEPENDENCIES

### 10.1 Service Providers

We rely on:
- **Supabase** (database hosting) - 99.9% uptime SLA
- **Stripe** (payments) - 99.99% uptime
- **AWS/DigitalOcean** (infrastructure) - 99.95% uptime
- **Email providers** (Resend/SendGrid) - 99.95% uptime

### 10.2 Third-Party Failures

We are not liable for downtime caused by third-party services, but will:
- Monitor third-party status
- Communicate issues to clients
- Work with providers for resolution
- Provide workarounds when possible

### 10.3 Integration Issues

Client integrations (custom APIs, webhooks) not covered by this SLA. We provide best-effort support.

---

## 11. REPORTING & TRANSPARENCY

### 11.1 Status Page

Real-time updates at status.[yourdomain].com:
- Current system status
- Ongoing incidents
- Scheduled maintenance
- Historical uptime data

### 11.2 Monthly Reports (Enterprise Only)

Includes:
- Uptime statistics
- Performance metrics
- Support ticket summary
- Incident reports
- Upcoming changes

### 11.3 Incident Post-Mortems

For major incidents (>1 hour downtime):
- Root cause analysis
- Timeline of events
- Remediation steps
- Prevention measures
- Published within 7 days

---

## 12. SLA MODIFICATIONS

### 12.1 Changes

We may modify this SLA with:
- 60 days advance notice
- Email notification
- Updated effective date

### 12.2 Material Changes

For significant changes (reducing commitments):
- 90 days notice
- Option to cancel without penalty

### 12.3 Improvements

Improvements (higher uptime, faster response) effective immediately without notice.

---

## 13. SLA EXCLUSIONS

This SLA does not apply to:
- **Beta features** - marked "Beta" or "Preview"
- **Free trials** - SLA starts after paid subscription begins
- **Unpaid accounts** - suspended or delinquent accounts
- **Deprecated features** - announced 90 days prior
- **Client modifications** - custom code or integrations
- **Unsupported configurations** - modified code, outdated browsers

---

## 14. FORCE MAJEURE

We are not liable for service failures due to events beyond reasonable control:
- Natural disasters (earthquakes, floods, hurricanes)
- War, terrorism, civil unrest
- Government actions or regulations
- Internet backbone failures
- Power grid failures
- Pandemics or health emergencies
- Labor strikes or disputes
- Acts of God

During force majeure:
- We will communicate status
- Work to restore service ASAP
- No SLA credits apply

---

## 15. DISPUTE RESOLUTION

### 15.1 SLA Disputes

If you disagree with uptime calculations:
1. Contact support within 30 days
2. Provide your records and evidence
3. We will review and respond within 10 business days
4. Escalate to management if unresolved

### 15.2 Good Faith

Both parties will act in good faith to resolve disputes.

---

## 16. DEFINITIONS

- **Business Hours:** Monday-Friday, 8am-6pm EAT, excluding holidays
- **Business Days:** Monday-Friday, excluding holidays
- **Critical Issue:** Complete service outage or data loss
- **Downtime:** Service unavailable for 5+ consecutive minutes
- **EAT:** East Africa Time (GMT+3)
- **Incident:** Event causing service degradation or failure
- **Uptime:** Service available and functional

---

## 17. CONTACT INFORMATION

**Support:**
Email: support@[yourdomain].com  
Phone: [Your Phone Number]  
Live Chat: Available in dashboard (Business hours)

**Emergency (Enterprise Only):**
Phone: [Emergency Number]  
Available: 24/7 for Critical (P1) issues

**Status Updates:**
Website: status.[yourdomain].com  
Twitter: @[YourTwitterHandle]

**Escalations:**
Email: escalations@[yourdomain].com

---

## 18. ACCEPTANCE

By using the Service, you acknowledge and accept the terms of this Service Level Agreement. This SLA is effective for all paid subscriptions and is part of your Service Agreement.

---

**This SLA represents our commitment to providing reliable, high-quality service. We continuously work to exceed these standards and deliver exceptional value to our clients.**
