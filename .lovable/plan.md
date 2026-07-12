## Plan

1. **Remove the extra doctor-profile back button**
   - Remove the top-left “All doctors” link from the doctor profile tab/page.
   - Keep the bottom/header navigation intact.

2. **Fix the Visits reschedule action**
   - Adjust the Upcoming visit card actions so clicking **Reschedule** navigates directly to `/appointments/$appointmentId/reschedule` without being swallowed by the appointment-card link.
   - Keep **Cancel** working only for active upcoming appointments.

3. **Complete the reschedule screen behavior**
   - Ensure it loads the existing appointment, doctor, consultation type, and current `availability_slot_id`.
   - Preserve the appointment’s existing consultation type when fetching replacement slots.
   - Show future dates only.
   - Show slots for selected date with:
     - current slot highlighted as “Current” and disabled
     - booked slots disabled
     - expired slots disabled
     - available slots selectable
   - Call the existing `reschedule_appointment(p_appointment_id, p_new_slot_id)` RPC only after a new available slot is selected.
   - Invalidate/refresh appointment details, visits, and slots after success.
   - Show loading, success toast, and friendly slot-conflict/error messages.
   - Do not create or insert appointments anywhere.

4. **Clean up past appointment details**
   - On the appointment details screen, detect past/cancelled appointments by local appointment end time.
   - Hide Reschedule and Cancel actions for past/cancelled appointments.
   - Hide payment badges/buttons/status prompts for past appointment details as requested, leaving only necessary schedule, consultation, doctor, and notes details.

5. **QA pass**
   - Verify links use TanStack `Link` with route params.
   - Run a focused typecheck after changes.
   - Confirm there are no frontend changes to auth, backend connection, schema, RLS, RPC signatures, or payment implementation.