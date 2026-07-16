import { supabase } from "@/lib/supabase";

export type PaymentRow = {
  id: string;
  appointment_id: string;
  patient_id: string;
  amount: number;
  currency: string;
  payment_gateway: string;
  gateway_order_id: string;
  gateway_payment_id: string | null;
  gateway_signature: string | null;
  paid_at: string | null;
  status: string;
  error_description: string | null;
  created_at: string;
};

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new Error("You need to be signed in to complete payment.");
  return t;
}

export type CreateOrderResponse = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  paymentRowId: string;
  appointment: {
    id: string;
    doctorName: string;
    consultationName: string;
  };
};

export async function createRazorpayOrder(appointmentId: string): Promise<CreateOrderResponse> {
  const token = await bearer();
  const res = await fetch("/api/public/payments/create-order", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ appointmentId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Could not create payment order");
  return json as CreateOrderResponse;
}

export type VerifyResponse = { ok: true; paymentMethod: string | null; paymentId: string };

export async function verifyRazorpayPayment(input: {
  appointmentId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<VerifyResponse> {
  const token = await bearer();
  const res = await fetch("/api/public/payments/verify", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Payment verification failed");
  return json as VerifyResponse;
}

export async function markPaymentFailed(input: {
  appointmentId: string;
  razorpay_order_id: string;
  reason?: string;
}): Promise<void> {
  const token = await bearer();
  await fetch("/api/public/payments/mark-failed", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  }).catch(() => {});
}

export async function releasePendingAppointment(appointmentId: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/public/appointments/release-pending", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ appointmentId }),
      keepalive: true,
    });
  } catch {
    /* ignore — abandonment cleanup is best-effort */
  }
}

export async function fetchPaymentHistory(): Promise<
  Array<
    PaymentRow & {
      appointments: {
        id: string;
        appointment_date: string | null;
        start_time: string | null;
        doctors: { full_name: string; specialization: string } | null;
        consultation_types: { name: string; mode: string } | null;
      } | null;
    }
  >
> {
  const { data, error } = await (supabase as any)
    .from("payments")
    .select(
      "*, appointments(id, appointment_date, start_time, doctors(full_name, specialization), consultation_types(name, mode))",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

export async function fetchLatestPaymentForAppointment(appointmentId: string): Promise<PaymentRow | null> {
  const { data, error } = await (supabase as any)
    .from("payments")
    .select("*")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data as PaymentRow[] | null)?.[0]) ?? null;
}

// --- Reschedule payment (mandatory ₹100 fee) ---

export type CreateRescheduleOrderResponse = CreateOrderResponse & {
  previous: { date: string | null; startTime: string | null; endTime: string | null };
  newSlot: { date: string; startTime: string; endTime: string };
};

export async function createRescheduleOrder(input: {
  appointmentId: string;
  newSlotId: string;
}): Promise<CreateRescheduleOrderResponse> {
  const token = await bearer();
  const res = await fetch("/api/public/reschedule/create-order", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Could not start reschedule payment");
  return json as CreateRescheduleOrderResponse;
}

export async function verifyReschedulePayment(input: {
  appointmentId: string;
  newSlotId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<VerifyResponse> {
  const token = await bearer();
  const res = await fetch("/api/public/reschedule/verify", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Reschedule verification failed");
  return json as VerifyResponse;
}