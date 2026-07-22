-- Add optional description column to consultation_types.
-- Safe to run multiple times.
ALTER TABLE public.consultation_types
  ADD COLUMN IF NOT EXISTS description text;