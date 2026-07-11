## MediCure — Patient App Production Pass

Ship end-to-end polish across booking, reschedule, cancel, visits, and appointment details. Backend, schema, RLS, and RPCs stay untouched.

### 1. Reschedule flow (highest priority)
`src/routes/_authenticated/appointments.$appointmentId.reschedule.tsx`
- Filter out past dates and past times (today's slots whose `end_time` has passed) from the picker; mark them "Expired" instead of hiding.
- Show three visual states: Available (selectable), Booked (disabled + label), Expired (disabled + label). Keep the current slot highlighted as "Now" and selectable back.
- Disable Confirm while `rescheduleMutation.isPending` (already covers double-click); also guard the button with `useRef` to swallow rapid re-fires.
- On success: `invalidateQueries` for `["appointment", id]`, `["visits"]`, `["slots", doctorId, typeId]`, then navigate back to details. Toast success.
- Errors: parse Postgres error codes for "slot no longer available" and surface a friendly message; refetch slots so the picker updates.
- Loading skeletons for both the appointment and slot queries; empty state when no dates.

### 2. Prevent booking past dates
`src/routes/_authenticated/doctors.$doctorId.book.tsx`, `booking.review.tsx`, `booking-queries.ts`
- `fetchAllSlots` already filters `slot_date >= today`. Add client-side filter on the day's times so today's already-past `start_time` slots render as "Expired" (disabled).
- In the review page, revalidate the slot before calling `book_appointment`: refetch slot; if `slot_date + end_time` is in the past or status ≠ available, block submit with a clear error and offer "Pick another time".
- Guard URL tampering: if `search.slotId` resolves to a past/unavailable slot, redirect back to the picker with a toast.

### 3. Fix Upcoming vs Past classification
`src/routes/_authenticated/visits.tsx`
- Logic is already end-time based; add fallback when `appointment_date`/`end_time` columns are null by using `availability_slots.slot_date/end_time`.
- Exclude cancelled from Upcoming (already done); confirm ordering: Upcoming ascending, Past descending.
- Timezone-safe local comparison via existing `localDateTime` helper.

### 4. Appointment details — schema correctness
`src/routes/_authenticated/appointments.$appointmentId.tsx`, `booking-queries.ts`
- Audit all queries to use `availability_slot_id` and `appointment_status` only (already correct in `fetchAppointmentById`); grep the codebase for stray `slot_id`/`status` references and remove them.
- Ensure the details view displays: doctor, specialty, consultation type + mode, date, time, duration, fee, appointment status, payment status, patient notes.
- Show skeleton, not-found, and error states cleanly.

### 5. Visits polish
- Card shows: doctor name, consultation type, date, time, status badge, payment badge.
- Upcoming cards get inline actions: Reschedule (Link) and Cancel (opens the same confirm dialog used on details). Past cards get only "View details".
- Extract the cancel dialog into a small shared component so it can be triggered from either the details page or a visit card without duplicating state.
- Add loading skeleton list and richer empty state per tab.

### 6. Booking flow state persistence
- Booking selections (`consultationTypeId`, `slotId`, `doctorId`) already travel as URL search params through `/booking/review`. Verify `validateSearch` on the review route and that a page refresh reloads the exact same slot/consultation.
- Preserve `consultationTypeId` when the user navigates back from picker to profile via `Link ... search={{ consultationTypeId }}`.

### 7. Slot picker rules (shared)
Extract slot-button rendering into `src/components/booking/SlotButton.tsx`:
- Available → selectable, primary style.
- Booked → disabled, muted "Booked".
- Past (today) → disabled, muted "Expired".
Never hide. Used by both booking picker and reschedule picker.

### 8. Homepage & How It Works
- `src/routes/index.tsx`: keep CTAs. Feature card destinations:
  - Real-time availability → `/doctors`
  - Secure teleconsultation → `/doctors?mode=online` (add a `mode` search param to `/doctors` and filter consultation types accordingly)
  - Verified specialists → `/doctors`
- `src/routes/how-it-works.tsx`: already exists — verify the 5-step content and the "Book an appointment" CTA to `/doctors`.

### 9. Doctor profile — direct consultation entry
`src/routes/doctors.$doctorId.index.tsx` (already implemented in prior pass) — verify Clinic/Video cards navigate to booking with the correct `consultationTypeId` preselected; add a keyboard-focusable outline and an aria-label.

### 10. Navigation audit
- Confirm every `<Link>` uses typed routes with `params`, no `href` interpolation.
- Back buttons always resolve to the logical parent (details → visits, reschedule → details, booking → doctor profile).
- Remove any dead links/routes; confirm 404 handling on `__root.tsx`.

### 11. UX polish
- Loading skeletons on: doctors list, doctor profile, booking picker, review, visits, details, reschedule.
- Empty states with a call-to-action button.
- Toast on every mutation (book/cancel/reschedule) — success + error.
- Disable submit buttons during pending mutations.
- Ensure buttons have `min-h-11`, aria-labels on icon-only controls, focus rings preserved.

### 12. Final QA (manual via Playwright script)
Run a headless script covering: sign in → browse doctors → book clinic → book video → review → confirm → visits (upcoming) → details → reschedule → cancel → sign out → sign in → data persists. Capture screenshots for each step and fix any issue found.

### Files to touch
- `src/routes/_authenticated/appointments.$appointmentId.reschedule.tsx`
- `src/routes/_authenticated/appointments.$appointmentId.tsx`
- `src/routes/_authenticated/booking.review.tsx`
- `src/routes/_authenticated/doctors.$doctorId.book.tsx`
- `src/routes/_authenticated/visits.tsx`
- `src/routes/doctors.index.tsx`, `doctors.$doctorId.index.tsx`
- `src/routes/index.tsx`, `src/routes/how-it-works.tsx`
- `src/lib/booking-queries.ts`
- New: `src/components/booking/SlotButton.tsx`, `src/components/appointments/CancelAppointmentDialog.tsx`

### Out of scope
Payments, DB schema, RLS, RPC signatures, auth flow.
