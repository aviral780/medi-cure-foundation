-- MediCure — SECURITY DEFINER RPC to confirm an appointment after payment.
-- Apply this on your EXTERNAL Supabase project from Supabase Studio → SQL editor.
--
-- Called by the payment verification server route after the gateway signature
-- has been validated. Marks the appointment as paid and confirmed, while
-- preserving existing cancelled or completed appointments. RLS stays enabled
-- because the function runs with definer privileges and re-validates ownership.

CREATE OR REPLACE FUNCTION public.mark_appointment_paid(
  p_appointment_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient uuid;
BEGIN
  SELECT patient_id INTO v_patient
    FROM public.appointments
    WHERE id = p_appointment_id;

  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF v_patient <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.appointments
    SET payment_status = 'paid',
        appointment_status = CASE
          WHEN appointment_status IN ('cancelled', 'canceled', 'completed') THEN appointment_status
          ELSE 'confirmed'
        END
    WHERE id = p_appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_appointment_paid(uuid) TO authenticated;
