-- Migration 098: Add pos_sale to document_type enum
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'pos_sale';
