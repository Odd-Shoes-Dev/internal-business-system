-- Migration 102: Add company contact details table
-- Allows companies to store multiple emails and phone numbers with custom labels

CREATE TABLE company_contact_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('email', 'phone')),
  label VARCHAR(100) NOT NULL,
  value VARCHAR(255) NOT NULL,
  show_on_documents BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_company_contact_details_company_id ON company_contact_details(company_id);
