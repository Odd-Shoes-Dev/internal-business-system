// The one place the support contact address is defined. Use these instead of typing the
// address, so it can never drift again.
export const SUPPORT_EMAIL = 'support@blueoxgroup.eu';

export function supportMailto(subject?: string): string {
  return subject
    ? `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${SUPPORT_EMAIL}`;
}
