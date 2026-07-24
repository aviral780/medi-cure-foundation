-- MediCure — enable Realtime on public.availability_slots so admin schedule
-- edits (create / block / unblock / delete) propagate immediately to any
-- patient booking or reschedule screen with an active subscription.
--
-- Apply on your external Supabase project from Supabase Studio → SQL editor.
-- Safe to re-run; the DO block skips the ALTER when the table is already in
-- the publication.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'availability_slots'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_slots';
  END IF;
END $$;

-- The schedule module treats availability_slots.status as a free-text label
-- and uses these values: 'available', 'booked', 'blocked'. If a CHECK
-- constraint on availability_slots.status exists and does NOT allow
-- 'blocked', drop/replace it so blocking works. Example (uncomment if
-- needed):
--
-- ALTER TABLE public.availability_slots
--   DROP CONSTRAINT IF EXISTS availability_slots_status_check;
-- ALTER TABLE public.availability_slots
--   ADD CONSTRAINT availability_slots_status_check
--   CHECK (status IN ('available', 'booked', 'blocked'));