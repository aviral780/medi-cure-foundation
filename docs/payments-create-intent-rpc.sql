-- MediCure — SECURITY DEFINER RPC to record a Razorpay payment intent.
-- Apply this on your EXTERNAL Supabase project (gvtjlfpzxyjbcaiyonnb)
-- from Supabase Studio → SQL editor.
--
-- Why: The public.payments RLS policy on INSERT rejects direct client inserts
-- from the server route (even with the user's bearer token). This RPC runs
-- with definer privileges, re-validates that the caller owns the appointment
-- via auth.uid(), and then inserts the payment row. RLS stays enabled — the
-- RPC is the only trusted insert path.

CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_appointment_id uuid,
  p_amount numeric,
  p_currency text,
  p_payment_gateway text,
  p_gateway_order_id text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient uuid;
  v_payment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT patient_id INTO v_patient
    FROM public.appointments
    WHERE id = p_appointment_id;

  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  IF v_patient <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.payments (
    appointment_id,
    patient_id,
    amount,
    currency,
    payment_gateway,
    gateway_order_id,
    status
  ) VALUES (
    p_appointment_id,
    auth.uid(),
    p_amount,
    COALESCE(p_currency, 'INR'),
    COALESCE(p_payment_gateway, 'razorpay'),
    p_gateway_order_id,
    'created'
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_payment_intent(uuid, numeric, text, text, text) TO authenticated;