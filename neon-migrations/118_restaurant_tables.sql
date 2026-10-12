-- Migration 118: restaurant tables and open table orders (POS restaurant mode)
--
-- A table's running order is a held order with table_id set: items are added during the meal,
-- sent to the kitchen, then charged (all at once or split) at the till. At most one open order
-- per table. Restaurant mode itself is a till setting (companies.settings -> pos -> restaurant_mode).

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  area VARCHAR(50),
  seats INT CHECK (seats IS NULL OR seats > 0),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_restaurant_tables_company_name
  ON restaurant_tables (company_id, lower(name)) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_company ON restaurant_tables (company_id, sort_order, name);

ALTER TABLE pos_held_orders ADD COLUMN IF NOT EXISTS table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL;
ALTER TABLE pos_held_orders ADD COLUMN IF NOT EXISTS guests INT CHECK (guests IS NULL OR guests > 0);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_held_orders_table ON pos_held_orders (table_id) WHERE table_id IS NOT NULL;
