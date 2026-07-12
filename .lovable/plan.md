# Sprint 2 — Razorpay Payment Module

## Flow
Review Booking → creates appointment (status: `pending_payment`) → `/payment/$appointmentId` → Razorpay Checkout → server-side signature verify → appointment `confirmed` + payment `paid` → Visits.

## 1. Database (migration)
New `public.payments` table:
- `id uuid pk`
- `appointment_id uuid fk → appointments(id) on delete cascade` (unique per successful payment)
- `patient_id uuid` (auth.uid())
- `amount numeric(10,2)`, `currency text default 'INR'`
- `payment_method text` (upi/card/netbanking/wallet)
- `razorpay_order_id text not null`
- `razorpay_payment_id text`
- `razorpay_signature text`
- `status text` (created/paid/failed)
- `error_description text`
- `created_at timestamptz default now()`, `updated_at`

Grants: `SELECT, INSERT, UPDATE` to authenticated (RLS: own patient_id only); `ALL` to service_role. RLS policies scoped to `auth.uid() = patient_id`.

Indexes on `appointment_id`, `razorpay_order_id`.

## 2. Booking behaviour change
`book_appointment` RPC already creates appointment with `payment_status='pending'`. After booking success, navigate to `/payment/$appointmentId` instead of confirmation screen (unless consultation `fee = 0`, which skips to Visits).

## 3. Server functions (`src/lib/payments.functions.ts`)
Use `requireSupabaseAuth` middleware.

- `createRazorpayOrder({ appointmentId })`: Load appointment (RLS-scoped), verify patient owns it and status is not already paid. Call Razorpay Orders API with `process.env.RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`. Upsert `payments` row with `razorpay_order_id`, status `created`. Return `{ orderId, amount, currency, keyId: process.env.RAZORPAY_KEY_ID }`.
- `verifyRazorpayPayment({ appointmentId, razorpay_order_id, razorpay_payment_id, razorpay_signature })`: HMAC-SHA256 verify (`order_id|payment_id` with secret), timing-safe compare. On success: update `payments` row (status=paid, method, payment_id, signature); update appointment via admin client (`payment_status='paid'`, `appointment_status='confirmed'`). On failure: mark payment `failed`; return error.
- `markPaymentFailed({ appointmentId, razorpay_order_id, error })`: set payment status `failed`.
- `getPaymentHistory()`: list user's payments joined with appointment/doctor/consultation for the account page.
- `getPaymentByAppointment(appointmentId)`: for receipt.

Admin client loaded inside handler via `await import('@/integrations/supabase/client.server')` for privileged appointment status updates.

## 4. Frontend pages/components
- `src/routes/_authenticated/payment.$appointmentId.tsx` — Payment page: summary card (doctor, type, date, time, duration, fee, tax=0, total), `Pay Now` + `Cancel Payment`. On mount, load Razorpay script (`https://checkout.razorpay.com/v1/checkout.js`) once. Pay Now → calls `createRazorpayOrder`, opens `Razorpay(options)` with handler → calls `verifyRazorpayPayment` → success screen → navigate to `/appointments/$id`. `modal.ondismiss` marks failed and allows retry (creates new order on next click). Idempotent button (disabled while pending).
- `src/routes/_authenticated/booking.review.tsx` — change post-booking navigation: if fee>0, go to `/payment/$appointmentId`; else keep current confirmed screen.
- `src/routes/_authenticated/appointments.$appointmentId.tsx` — if `payment_status='pending'`, show a prominent "Complete payment" CTA linking to payment page. Show payment method + payment ID once paid.
- `src/routes/_authenticated/receipts.$appointmentId.tsx` — printable receipt with clinic name, doctor, patient, consultation, date/time, amount, payment ID, method, appointment ID. Buttons: Print (window.print), Download PDF (use browser print-to-PDF via `window.print` styled `@media print`; keep it dependency-free).
- `src/routes/_authenticated/payments.tsx` — Payment History list; each row links to `/receipts/$appointmentId`. Add nav link from Account page.
- `StatusBadges.tsx` — already handles pending/paid/failed/refunded/cancelled/completed.

## 5. Env / secrets
Add via `add_secret`:
- `RAZORPAY_KEY_ID` (server)
- `RAZORPAY_KEY_SECRET` (server)
- `VITE_RAZORPAY_KEY_ID` (client) — publishable, safe

For test mode without keys, server fn returns clear error "Payments not configured — add Razorpay keys". UI still renders; button disabled with message. I will request secrets after implementation so the user can add them when ready.

## 6. Security
- Signature verification server-side only (HMAC + timing-safe).
- Secrets only in `process.env` in server fns; client never sees `RAZORPAY_KEY_SECRET`.
- Never log/store card/CVV/UPI PIN (Razorpay Checkout handles these; we only receive IDs).
- RLS ensures user only sees own payments.
- Idempotency: unique `razorpay_order_id` per attempt; retries generate new orders; verified payment marks appointment paid exactly once (guard by current status).

## Files to add/edit
- Migration: `payments` table + RLS + grants.
- New: `src/lib/payments.functions.ts`, `src/lib/razorpay-loader.ts`.
- New routes: `payment.$appointmentId.tsx`, `receipts.$appointmentId.tsx`, `payments.tsx`.
- Edit: `booking.review.tsx` (post-book navigation), `appointments.$appointmentId.tsx` (pending CTA + payment details), `account.tsx` (link to Payment History), `AppShell.tsx` (optional).

## Out of scope
Refunds automation, webhooks (can add later at `/api/public/webhooks/razorpay`), tax calculation (kept 0), invoice numbering.
