-- Add is_archived column for soft-delete/archive functionality
ALTER TABLE training_plans ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
ALTER TABLE ojt_plans ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;
