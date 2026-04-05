-- =====================================================
-- ADD DOCUMENT TYPES TO INVOICES
-- Adds support for Invoice, Receipt, Quotation, and Proforma Invoice
-- Migration: 015
-- Date: December 15, 2025
-- =====================================================

-- Create document type enum
CREATE TYPE document_type AS ENUM ('invoice', 'receipt', 'quotation', 'proforma');

-- Add document_type column to invoices table
ALTER TABLE invoices 
ADD COLUMN document_type document_type DEFAULT 'invoice';

-- Add separate number columns for each document type
ALTER TABLE invoices
ADD COLUMN quotation_number VARCHAR(50),
ADD COLUMN proforma_number VARCHAR(50),
ADD COLUMN receipt_number VARCHAR(50);

-- Create unique constraints for new number fields
CREATE UNIQUE INDEX idx_quotation_number ON invoices(quotation_number) WHERE quotation_number IS NOT NULL;
CREATE UNIQUE INDEX idx_proforma_number ON invoices(proforma_number) WHERE proforma_number IS NOT NULL;
CREATE UNIQUE INDEX idx_receipt_number ON invoices(receipt_number) WHERE receipt_number IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN invoices.document_type IS 'Type of document: invoice, receipt, quotation, or proforma';
COMMENT ON COLUMN invoices.quotation_number IS 'Unique number for quotations (format: QUO-YYYY-00001)';
COMMENT ON COLUMN invoices.proforma_number IS 'Unique number for proforma invoices (format: PRO-YYYY-00001)';
COMMENT ON COLUMN invoices.receipt_number IS 'Unique number for receipts (format: REC-YYYY-00001)';

-- =====================================================
-- QUOTATION NUMBER GENERATOR
-- =====================================================

CREATE OR REPLACE FUNCTION generate_quotation_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INT;
  new_quotation_number TEXT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Get the highest quotation number for this year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(quotation_number FROM 'QUO-' || current_year || '-(\d+)') AS INT
      )
    ),
    0
  ) + 1
  INTO next_number
  FROM invoices
  WHERE quotation_number LIKE 'QUO-' || current_year || '-%';
  
  new_quotation_number := 'QUO-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
  
  RETURN new_quotation_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PROFORMA NUMBER GENERATOR
-- =====================================================

CREATE OR REPLACE FUNCTION generate_proforma_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INT;
  new_proforma_number TEXT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Get the highest proforma number for this year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(proforma_number FROM 'PRO-' || current_year || '-(\d+)') AS INT
      )
    ),
    0
  ) + 1
  INTO next_number
  FROM invoices
  WHERE proforma_number LIKE 'PRO-' || current_year || '-%';
  
  new_proforma_number := 'PRO-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
  
  RETURN new_proforma_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RECEIPT NUMBER GENERATOR
-- =====================================================

CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INT;
  new_receipt_number TEXT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Get the highest receipt number for this year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(receipt_number FROM 'REC-' || current_year || '-(\d+)') AS INT
      )
    ),
    0
  ) + 1
  INTO next_number
  FROM invoices
  WHERE receipt_number LIKE 'REC-' || current_year || '-%';
  
  new_receipt_number := 'REC-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
  
  RETURN new_receipt_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- UPDATE EXISTING INVOICES
-- =====================================================

-- Update existing invoices to have invoice_number in the appropriate column
UPDATE invoices
SET document_type = 'invoice'
WHERE document_type IS NULL;
