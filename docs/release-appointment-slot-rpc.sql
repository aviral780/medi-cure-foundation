-- MediCure — SECURITY DEFINER RPC to release a reserved slot when a patient
-- abandons the payment step (closes the tab, dismisses Razorpay, hits Cancel,
-- or a payment.failed callback fires).
--
-- Apply on your external Supabase project from Supabase Studio → SQL editor.
-- Only acts when the appointment has NOT been paid AND has not reached a
-- terminal state (confirmed / completed / cancelled). Safe no-op otherwise.
-- Frees the availability_slot back to 'available' AND NULLs the appointment's
-- availability_slot_id so any UNIQUE(availability_slot_id) index is released.

CREATE OR REPLACE FUNCTION public.release_appointment_slot(
  p_appointment_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient uuid;
  v_status text;
  v_payment text;
  v_slot uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT patient_id, appointment_status, payment_status, availability_slot_id
    INTO v_patient, v_status, v_payment, v_slot
    FROM public.appointments
    WHERE id = p_appointment_id;

  IF v_patient IS NULL THEN
    RETURN;
  END IF;
  IF v_patient <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_payment = 'paid' THEN RETURN; END IF;
  IF lower(coalesce(v_status, '')) IN ('confirmed', 'completed', 'cancelled', 'canceled') THEN
    RETURN;
  END IF;

  IF v_slot IS NOT NULL THEN
    UPDATE public.availability_slots
      SET status = 'available'
      WHERE id = v_slot;
  END IF;

  UPDATE public.appointments
    SET appointment_status = 'cancelled',
        availability_slot_id = NULL
    WHERE id = p_appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_appointment_slot(uuid) TO authenticated;