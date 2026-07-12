-- MediCure — Razorpay payments schema
-- Apply this SQL on your EXTERNAL Supabase project (gvtjlfpzxyjbcaiyonnb)
-- from Supabase Studio → SQL editor. This project's built-in migration
-- system targets Lovable Cloud, not the external Supabase you use.

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  payment_method text,
  razorpay_order_id text NOT NULL,
  razorpay_payment_id text,
  razorpay_signature text,
  status text NOT NULL DEFAULT 'created',
  error_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_appointment_id_idx ON public.payments(appointment_id);
CREATE INDEX IF NOT EXISTS payments_patient_id_idx ON public.payments(patient_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_razorpay_order_id_uidx ON public.payments(razorpay_order_id);

GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Patients can view own payments" ON public.payments;
CREATE POLICY "Patients can view own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Patients can insert own payments" ON public.payments;
CREATE POLICY "Patients can insert own payments"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = patient_id);

DROP POLICY IF EXISTS "Patients can update own payments" ON public.payments;
CREATE POLICY "Patients can update own payments"
  ON public.payments FOR UPDATE TO authenticated
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

-- Security-definer RPC. Called by the payment verification server route
-- after the Razorpay signature has been validated. Marks the appointment
-- as paid + confirmed atomically, without needing a broad RLS UPDATE on
-- appointments.
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
  SELECT patient_id INTO v_patient FROM public.appointments WHERE id = p_appointment_id;
  IF v_patient IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;
  IF v_patient <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.appointments
    SET payment_status = 'paid',
        appointment_status = CASE
          WHEN appointment_status IN ('cancelled','canceled','completed') THEN appointment_status
          ELSE 'confirmed'
        END
    WHERE id = p_appointment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_appointment_paid(uuid) TO authenticated;