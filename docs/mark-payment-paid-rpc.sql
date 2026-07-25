-- MediCure — SECURITY DEFINER RPC to mark a payment as paid after Razorpay
-- signature verification. Apply on the external Supabase project via SQL editor.
--
-- Why: The public.payments RLS UPDATE policy silently filters updates issued
-- with the user's bearer token in some conditions, leaving status='created'
-- and paid_at NULL. This RPC runs with definer privileges, re-validates that
-- the caller owns the payment row via auth.uid(), then persists the paid
-- state atomically. RLS stays enabled — this RPC is the only trusted path
-- for flipping a payment to 'paid'.

CREATE OR REPLACE FUNCTION public.mark_payment_paid(
  p_payment_id uuid,
  p_gateway_payment_id text,
  p_gateway_signature text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT patient_id INTO v_patient
    FROM public.payments
    WHERE id = p_payment_id;

  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_patient <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.payments
    SET status = 'paid',
        gateway_payment_id = p_gateway_payment_id,
        gateway_signature = p_gateway_signature,
        paid_at = now(),
        updated_at = now()
    WHERE id = p_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_payment_failed(
  p_payment_id uuid,
  p_gateway_payment_id text,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT patient_id INTO v_patient
    FROM public.payments
    WHERE id = p_payment_id;

  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_patient <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.payments
    SET status = 'failed',
        gateway_payment_id = COALESCE(p_gateway_payment_id, gateway_payment_id),
        error_description = p_reason,
        updated_at = now()
    WHERE id = p_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_payment_paid(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_failed(uuid, text, text) TO authenticated;