-- Migration: Update parents table schema
-- Date: 2025-11-25
-- Description: Add missing fields to parents table and make some fields optional

-- Start transaction for safety
BEGIN;

-- Add name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'parents' 
        AND column_name = 'name'
    ) THEN
        ALTER TABLE parents ADD COLUMN name VARCHAR;
        RAISE NOTICE 'Added name column to parents table';
    END IF;
END $$;

-- Add active column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'parents' 
        AND column_name = 'active'
    ) THEN
        ALTER TABLE parents ADD COLUMN active BOOLEAN DEFAULT true;
        RAISE NOTICE 'Added active column to parents table';
    END IF;
END $$;

-- Add createdAt column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'parents' 
        AND column_name = 'createdAt'
    ) THEN
        ALTER TABLE parents ADD COLUMN "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added createdAt column to parents table';
    END IF;
END $$;

-- Add updatedAt column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'parents' 
        AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE parents ADD COLUMN "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updatedAt column to parents table';
    END IF;
END $$;

-- Make idnumber nullable if it's not already
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'parents' 
        AND column_name = 'idnumber' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE parents ALTER COLUMN idnumber DROP NOT NULL;
        RAISE NOTICE 'Made idnumber column nullable in parents table';
    END IF;
END $$;

-- Verification: Check the column constraints
SELECT 
    column_name,
    is_nullable,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'parents' 
ORDER BY column_name;

-- Commit the transaction
COMMIT;

-- Success message
SELECT 'Parents table schema update completed successfully!' as status;

