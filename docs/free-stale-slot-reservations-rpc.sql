-- MediCure — SECURITY DEFINER RPC to free stale reservations on a slot before
-- the slot is reassigned by reschedule_appointment.
--
-- A UNIQUE(availability_slot_id) constraint on public.appointments causes
-- reschedule failures ("duplicate key ... availability_slot_id") when a prior
-- cancelled / completed / rescheduled appointment still references the target
-- slot. This RPC NULLs those stale references — active reservations
-- (pending / confirmed) are left alone; the caller (reschedule verify route)
-- already enforces that the slot's status is 'available' before invoking it.
--
-- Apply on your external Supabase project from Supabase Studio → SQL editor.

CREATE OR REPLACE FUNCTION public.free_stale_slot_reservations(
  p_slot_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.appointments
    SET availability_slot_id = NULL
    WHERE availability_slot_id = p_slot_id
      AND lower(coalesce(appointment_status, '')) IN (
        'cancelled', 'canceled', 'completed', 'rescheduled'
      );
END;
$$;

GRANT EXECUTE ON FUNCTION public.free_stale_slot_reservations(uuid) TO authenticated;