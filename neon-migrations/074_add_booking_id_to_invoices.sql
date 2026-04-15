-- Add tour-booking-related columns to invoices table
-- booking_id is optional: NULL for standalone invoices, set when invoice is linked to a tour booking

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS booking_id UUID;

-- Tax rate at the invoice level (used by generate-invoice from booking)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,4) DEFAULT 0;

-- Flag for advance/deposit payments on bookings
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS is_advance_payment BOOLEAN DEFAULT false;

-- Service date range (travel dates for tour bookings)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS service_start_date DATE;

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS service_end_date DATE;

-- Index for faster lookups when querying invoices by booking
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON invoices(booking_id);

COMMENT ON COLUMN invoices.booking_id IS 'Optional reference to a tour booking. NULL for standalone invoices.';

-- NOTE: The FK constraint below must be applied AFTER 075_tour_module_tables.sql has been run.
-- Run this separately once the bookings table exists:
--
-- ALTER TABLE invoices
-- ADD CONSTRAINT fk_invoices_booking
-- FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

COMMENT ON COLUMN invoices.is_advance_payment IS 'True for deposit or balance invoices on tour bookings.';
COMMENT ON COLUMN invoices.service_start_date IS 'Travel/service start date, populated from booking.';
COMMENT ON COLUMN invoices.service_end_date IS 'Travel/service end date, populated from booking.';
