-- Migration 125: let a company have its own domain
--
-- Visiting a client's own domain (added in Vercel as a domain alias for this same app) showed
-- the public marketing/landing page, meant for prospects, not existing clients - and the
-- generic login screen rather than anything recognisable as theirs. custom_domain is the exact
-- hostname a client was given (e.g. system.applestorembarara.com); middleware looks this up to
-- send that domain straight to login instead of the landing page, and the login screen uses it
-- to show the company's own logo and name instead of the defaults.
--
-- Set by hand per client for now (via UPDATE), the same time the domain is added in Vercel -
-- this is expected to be rare enough that it doesn't need a self-service settings field yet.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS custom_domain TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_custom_domain
  ON companies (custom_domain) WHERE custom_domain IS NOT NULL;
