// Read-only mode after a free trial ends.
//
// Once a company's trial is over and it has not paid, it can still view, print and export
// everything, but it cannot create, edit or delete anything until it upgrades. Expiry is
// worked out from the dates on each request, so no scheduled job is needed.
//
// Plain code with no server imports, so both the API guards and the UI banner use it.

// MASTER SWITCH. When true, a company whose trial has ended and which is not active is
// read-only. Set to false and redeploy to lift the lock for everyone.
// Payments are currently handled manually: a paying company is unlocked by setting its
// status to 'active' in the database. Online payment (the Whop webhook) is not yet
// confirmed to activate a company, so do not rely on it to unlock anyone.
export const ENFORCE_READ_ONLY_AFTER_TRIAL = true;

export const TRIAL_EXPIRED_MESSAGE =
  'Your trial has ended. Your account is read-only until you upgrade to a paid plan.';

// A paid company stays fully usable for this many days after its paid period ends, so a late
// renewal (or a manual one that has not been entered yet) does not lock the team out at once.
export const PAID_GRACE_DAYS = 7;

export const SUBSCRIPTION_EXPIRED_MESSAGE =
  'Your subscription has ended. Your account is read-only until it is renewed. Please contact support.';

export const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Writes under these paths stay allowed so an expired company can still pay, sign in/out,
// and use read-only features that happen to be POST requests (reports, notifications).
export const READ_ONLY_EXEMPT_PATH_PREFIXES = [
  '/api/billing',
  '/api/auth',
  '/api/trial',
  '/api/trials',
  '/api/onboarding',
  '/api/notifications',
  '/api/reports',
  '/api/webhooks',
  '/api/cron',
];

// A company is "trial expired" when its status is expired, or it is still marked trial but
// the trial end date has passed. Active, past-due and cancelled companies are not affected
// here: their grace periods are a separate decision.
export function isTrialExpired(
  status: string | null | undefined,
  trialEndsAt: string | Date | null | undefined,
  now: number = Date.now()
): boolean {
  if (status === 'expired') return true;
  if (status && status !== 'trial') return false;
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt).getTime() < now;
}

// A paid company is "lapsed" when its status is still active but the paid period (plus the
// grace days above) is over. With no period end on record we cannot tell, so it is not locked.
export function isSubscriptionLapsed(
  status: string | null | undefined,
  periodEnd: string | Date | null | undefined,
  now: number = Date.now()
): boolean {
  if (status !== 'active') return false;
  if (!periodEnd) return false;
  const graceMs = PAID_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return new Date(periodEnd).getTime() + graceMs < now;
}
