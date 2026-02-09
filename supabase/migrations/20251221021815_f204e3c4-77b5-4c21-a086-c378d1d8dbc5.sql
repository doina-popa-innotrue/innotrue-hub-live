-- First, add the missing 'coaching' value to the enum for existing data compatibility
ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'coaching';

-- Now convert the column from enum to text with foreign key
-- Step 1: Add a temporary text column
ALTER TABLE program_modules ADD COLUMN module_type_text text;

-- Step 2: Copy data from enum to text
UPDATE program_modules SET module_type_text = module_type::text;

-- Step 3: Drop the old enum column
ALTER TABLE program_modules DROP COLUMN module_type;

-- Step 4: Rename the text column to module_type
ALTER TABLE program_modules RENAME COLUMN module_type_text TO module_type;

-- Step 5: Make it NOT NULL
ALTER TABLE program_modules ALTER COLUMN module_type SET NOT NULL;

-- Step 6: Add a unique constraint to module_types.name if not exists
ALTER TABLE module_types ADD CONSTRAINT module_types_name_unique UNIQUE (name);

-- Step 7: Add foreign key constraint to enforce valid values
ALTER TABLE program_modules 
ADD CONSTRAINT program_modules_module_type_fkey 
FOREIGN KEY (module_type) REFERENCES module_types(name) ON UPDATE CASCADE;