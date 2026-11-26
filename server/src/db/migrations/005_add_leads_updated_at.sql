-- Migration 005: Add updated_at column to leads table

ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

UPDATE leads SET updated_at = created_at WHERE updated_at IS NULL;
