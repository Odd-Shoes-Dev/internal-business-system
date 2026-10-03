// Read-only mode after a free trial ends.
//
// Once a company's trial is over and it has not paid, it can still view, print and export
// everything, but it cannot create, edit or delete anything until it upgrades. Expiry is
// worked out from the dates on each request, so no scheduled job is needed.
//
// Plain code with no server imports, so both the API guards and the UI banner use it.

// MASTER SWITCH. Keep false until a real payment is confirmed to activate a company (the
// Whop webhook sets companies.subscription_status = 'active'). While false nothing is
// restricted. Turning this on with activation broken would lock paying customers out of
// editing their own data.
export const ENFORCE_READ_ONLY_AFTER_TRIAL = false;

export const TRIAL_EXPIRED_MESSAGE =
  'Your trial has ended. Your account is read-only until you upgrade to a paid plan.';

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
