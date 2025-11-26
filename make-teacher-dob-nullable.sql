-- Migration: Make dob column nullable in teachers table
-- Date: 2025-11-25
-- Description: Fixes the NOT NULL constraint on dob column to allow optional date of birth

-- Start transaction for safety
BEGIN;

-- Check if the column exists and is currently NOT NULL
DO $$
BEGIN
    -- Check if the column exists and is NOT NULL
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'teachers' 
        AND column_name = 'dob' 
        AND is_nullable = 'NO'
    ) THEN
        -- Make the dob column nullable
        ALTER TABLE teachers ALTER COLUMN dob DROP NOT NULL;
        RAISE NOTICE 'Successfully made dob column nullable in teachers table';
    ELSE
        RAISE NOTICE 'dob column is already nullable or does not exist';
    END IF;
END $$;

-- Verification: Check the column constraint
SELECT 
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns 
WHERE table_name = 'teachers' 
AND column_name = 'dob';

-- Show current teachers with null dob (should work after migration)
SELECT COUNT(*) as teachers_with_null_dob
FROM teachers 
WHERE dob IS NULL;

-- Commit the transaction
COMMIT;

-- Success message
SELECT 'Migration completed successfully! The dob column in teachers table is now nullable.' as status;

