-- Migration: Add group invoice fields to invoice table
-- This migration adds support for group invoices (multiple students, same donor/scholarship)

-- Add groupInvoiceNumber column (nullable, for linking invoices in a group)
ALTER TABLE invoice 
ADD COLUMN IF NOT EXISTS "groupInvoiceNumber" VARCHAR(255) NULL;

-- Add donorNote column (nullable, for donor/scholarship information)
ALTER TABLE invoice 
ADD COLUMN IF NOT EXISTS "donorNote" TEXT NULL;

-- Add index on groupInvoiceNumber for efficient queries
CREATE INDEX IF NOT EXISTS "IDX_invoice_groupInvoiceNumber" 
ON invoice("groupInvoiceNumber") 
WHERE "groupInvoiceNumber" IS NOT NULL;

-- Add comment to columns
COMMENT ON COLUMN invoice."groupInvoiceNumber" IS 'Group invoice number linking multiple student invoices together (e.g., GRP-2026-000001)';
COMMENT ON COLUMN invoice."donorNote" IS 'Optional note about donor/scholarship paying for this invoice';

-- Verification queries
SELECT 
    COUNT(*) as total_invoices,
    COUNT("groupInvoiceNumber") as invoices_with_group_number,
    COUNT("donorNote") as invoices_with_donor_note
FROM invoice;

