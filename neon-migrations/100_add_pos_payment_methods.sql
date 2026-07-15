-- Migration 100: Add POS payment methods to payment_method enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'card';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'mobile_money';
