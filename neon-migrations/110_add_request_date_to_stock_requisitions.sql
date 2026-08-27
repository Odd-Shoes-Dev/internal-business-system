-- Separate the date a request was actually made (editable, backdatable) from
-- created_at (the untouched audit timestamp of when the record entered the system).
ALTER TABLE stock_requisitions ADD COLUMN IF NOT EXISTS request_date DATE NOT NULL DEFAULT CURRENT_DATE;
