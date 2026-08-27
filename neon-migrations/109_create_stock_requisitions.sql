-- Stock Requisitions module
-- A requisition captures what a client asked for (filled in-system by staff on the
-- client's behalf). It is fulfilled over one or more delivery forms — each delivery
-- form records what was actually handed over on a given date and deducts stock at
-- that point. A requisition tracks running quantity_delivered per line so partial
-- fulfillment across multiple delivery forms is visible, and completes automatically
-- once every line's delivered quantity reaches its requested quantity. A requisition
-- can also be closed without being fully delivered (remaining balance no longer
-- needed / issue occurred) — this does not reverse anything already delivered.
-- Voiding a delivery form reverses its stock effect and its contribution to the
-- requisition lines' delivered quantities, but keeps the voided delivery form record
-- for history.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumlabel = 'requisition'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'stock_movement_type')
  ) THEN
    ALTER TYPE stock_movement_type ADD VALUE 'requisition';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS stock_requisitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  requisition_number VARCHAR(50) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  delivery_location TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES user_profiles(id),
  closed_at TIMESTAMPTZ,
  close_reason TEXT,
  CONSTRAINT chk_stock_requisitions_status CHECK (status IN ('open', 'partial', 'completed', 'closed')),
  CONSTRAINT uq_stock_requisitions_number UNIQUE (company_id, requisition_number)
);

CREATE INDEX IF NOT EXISTS idx_stock_requisitions_company ON stock_requisitions(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_requisitions_status ON stock_requisitions(company_id, status);

CREATE TABLE IF NOT EXISTS stock_requisition_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id UUID NOT NULL REFERENCES stock_requisitions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_requested DECIMAL(15,4) NOT NULL,
  quantity_delivered DECIMAL(15,4) NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_stock_requisition_lines_qty CHECK (quantity_requested > 0 AND quantity_delivered >= 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_requisition_lines_requisition ON stock_requisition_lines(requisition_id);
CREATE INDEX IF NOT EXISTS idx_stock_requisition_lines_product ON stock_requisition_lines(product_id);

CREATE TABLE IF NOT EXISTS stock_delivery_forms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id UUID NOT NULL REFERENCES stock_requisitions(id) ON DELETE CASCADE,
  delivery_number VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivered_by VARCHAR(255),
  received_by VARCHAR(255),
  notes TEXT,
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  voided_by UUID REFERENCES user_profiles(id),
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  CONSTRAINT chk_stock_delivery_forms_status CHECK (status IN ('active', 'voided')),
  CONSTRAINT uq_stock_delivery_forms_number UNIQUE (requisition_id, delivery_number)
);

CREATE INDEX IF NOT EXISTS idx_stock_delivery_forms_requisition ON stock_delivery_forms(requisition_id);

CREATE TABLE IF NOT EXISTS stock_delivery_form_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_form_id UUID NOT NULL REFERENCES stock_delivery_forms(id) ON DELETE CASCADE,
  requisition_line_id UUID NOT NULL REFERENCES stock_requisition_lines(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity_delivered DECIMAL(15,4) NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_stock_delivery_form_lines_qty CHECK (quantity_delivered > 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_delivery_form_lines_delivery ON stock_delivery_form_lines(delivery_form_id);
CREATE INDEX IF NOT EXISTS idx_stock_delivery_form_lines_req_line ON stock_delivery_form_lines(requisition_line_id);

CREATE OR REPLACE FUNCTION generate_requisition_number(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INT;
  new_number TEXT;
BEGIN
  current_year := TO_CHAR(CURRENT_DATE, 'YYYY');

  SELECT COALESCE(
    MAX(CAST(SUBSTRING(requisition_number FROM 'REQ-' || current_year || '-(\d+)') AS INT)),
    0
  ) + 1
  INTO next_number
  FROM stock_requisitions
  WHERE company_id = p_company_id
    AND requisition_number LIKE 'REQ-' || current_year || '-%';

  new_number := 'REQ-' || current_year || '-' || LPAD(next_number::TEXT, 5, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;
