// Server-only Google Calendar / Meet sync for online consultations.
import {
  GoogleAuthExpiredError,
  GoogleNotConnectedError,
  getAccessToken,
  supabaseService,
} from "./google.server";

const CALENDAR_ID = "primary";
export const CLINIC_TIME_ZONE = "Asia/Kolkata";

export type MeetingSyncResult = {
  synced: boolean;
  reason?: string;
  meetingUrl?: string | null;
  eventId?: string | null;
};

type AppointmentForCalendar = {
  id: string;
  appointment_date: string | null;
  start_time: string | null;
  end_time: string | null;
  appointment_status: string | null;
  patient_notes: string | null;
  google_event_id: string | null;
  meeting_url: string | null;
  patient_id: string | null;
  doctors: { full_name: string | null } | null;
  consultation_types: { name: string | null; mode: string | null } | null;
};

function toRfc3339(date: string, time: string): string {
  // Times are stored as local clinic wall-clock (HH:MM[:SS]).
  const hhmmss = time.length === 5 ? `${time}:00` : time.slice(0, 8);
  return `${date}T${hhmmss}`;
}

async function calendarFetch(
  path: string,
  init: RequestInit & { accessToken: string },
): Promise<any> {
  const { accessToken, ...rest } = init;
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...rest,
    headers: {
      ...(rest.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(json?.error?.message || `Google Calendar error (${res.status})`);
  }
  return json;
}

async function loadAppointment(id: string): Promise<AppointmentForCalendar | null> {
  const db = supabaseService();
  if (!db) return null;
  const { data } = await db
    .from("appointments")
    .select(
      "id, appointment_date, start_time, end_time, appointment_status, patient_notes, google_event_id, meeting_url, patient_id, doctors(full_name), consultation_types(name, mode)",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as AppointmentForCalendar | null) ?? null;
}

async function patientEmail(patientId: string | null): Promise<string | null> {
  if (!patientId) return null;
  const db = supabaseService();
  if (!db) return null;
  const { data } = await db
    .from("profiles")
    .select("email, full_name")
    .eq("id", patientId)
    .maybeSingle();
  return ((data as { email?: string | null } | null)?.email ?? null) || null;
}

async function markAppointment(
  id: string,
  patch: Record<string, string | null>,
): Promise<void> {
  const db = supabaseService();
  if (!db) return;
  await db.from("appointments").update(patch).eq("id", id);
}

function isOnline(appt: AppointmentForCalendar): boolean {
  return (appt.consultation_types?.mode ?? "").toLowerCase() === "online";
}

function failureReason(err: unknown): string {
  if (err instanceof GoogleNotConnectedError) return "google_not_connected";
  if (err instanceof GoogleAuthExpiredError) return "google_auth_expired";
  return (err as Error)?.message ?? "google_error";
}

/**
 * Creates the Google Calendar event + Meet link for a paid, confirmed ONLINE
 * appointment. Idempotent: if an event already exists it is returned as-is.
 * Never throws — booking/payment flows must not fail because Google is down.
 */
export async function createMeetingForAppointment(appointmentId: string): Promise<MeetingSyncResult> {
  try {
    const appt = await loadAppointment(appointmentId);
    if (!appt) return { synced: false, reason: "appointment_not_found" };
    if (!isOnline(appt)) return { synced: false, reason: "not_online" };
    if (appt.google_event_id) {
      return { synced: true, eventId: appt.google_event_id, meetingUrl: appt.meeting_url };
    }
    if (!appt.appointment_date || !appt.start_time || !appt.end_time) {
      return { synced: false, reason: "missing_schedule" };
    }

    const accessToken = await getAccessToken();
    const email = await patientEmail(appt.patient_id);
    const doctor = appt.doctors?.full_name ?? "Doctor";

    const event = await calendarFetch(
      `/calendars/${encodeURIComponent(CALENDAR_ID)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        accessToken,
        method: "POST",
        body: JSON.stringify({
          summary: `Online consultation · ${doctor}`,
          description: [
            `Consultation type: ${appt.consultation_types?.name ?? "Online consultation"}`,
            appt.patient_notes ? `Patient notes: ${appt.patient_notes}` : null,
            `Appointment ID: ${appt.id}`,
          ]
            .filter(Boolean)
            .join("\n"),
          start: {
            dateTime: toRfc3339(appt.appointment_date, appt.start_time),
            timeZone: CLINIC_TIME_ZONE,
          },
          end: {
            dateTime: toRfc3339(appt.appointment_date, appt.end_time),
            timeZone: CLINIC_TIME_ZONE,
          },
          attendees: email ? [{ email }] : undefined,
          reminders: {
            useDefault: false,
            overrides: [
              { method: "email", minutes: 60 },
              { method: "popup", minutes: 10 },
            ],
          },
          conferenceData: {
            createRequest: {
              requestId: `medicure-${appt.id}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }),
      },
    );

    const meetingUrl: string | null =
      event.hangoutLink ??
      event.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri ??
      null;

    await markAppointment(appt.id, {
      google_event_id: event.id ?? null,
      meeting_url: meetingUrl,
      meeting_provider: "google_meet",
      meeting_status: "scheduled",
      meeting_error: null,
    });

    return { synced: true, eventId: event.id ?? null, meetingUrl };
  } catch (err) {
    const reason = failureReason(err);
    await markAppointment(appointmentId, { meeting_status: "failed", meeting_error: reason });
    console.error("[google-calendar] create failed", appointmentId, reason);
    return { synced: false, reason };
  }
}

/** Moves an existing event to the new slot after a paid reschedule. */
export async function rescheduleMeetingForAppointment(
  appointmentId: string,
): Promise<MeetingSyncResult> {
  try {
    const appt = await loadAppointment(appointmentId);
    if (!appt) return { synced: false, reason: "appointment_not_found" };
    if (!isOnline(appt)) return { synced: false, reason: "not_online" };
    if (!appt.google_event_id) return createMeetingForAppointment(appointmentId);
    if (!appt.appointment_date || !appt.start_time || !appt.end_time) {
      return { synced: false, reason: "missing_schedule" };
    }

    const accessToken = await getAccessToken();
    const event = await calendarFetch(
      `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(appt.google_event_id)}?conferenceDataVersion=1&sendUpdates=all`,
      {
        accessToken,
        method: "PATCH",
        body: JSON.stringify({
          start: {
            dateTime: toRfc3339(appt.appointment_date, appt.start_time),
            timeZone: CLINIC_TIME_ZONE,
          },
          end: {
            dateTime: toRfc3339(appt.appointment_date, appt.end_time),
            timeZone: CLINIC_TIME_ZONE,
          },
          status: "confirmed",
        }),
      },
    );

    const meetingUrl: string | null = event.hangoutLink ?? appt.meeting_url ?? null;
    await markAppointment(appt.id, {
      meeting_url: meetingUrl,
      meeting_status: "rescheduled",
      meeting_error: null,
    });
    return { synced: true, eventId: event.id ?? appt.google_event_id, meetingUrl };
  } catch (err) {
    const reason = failureReason(err);
    await markAppointment(appointmentId, { meeting_status: "sync_failed", meeting_error: reason });
    console.error("[google-calendar] reschedule failed", appointmentId, reason);
    return { synced: false, reason };
  }
}

/** Cancels the Google event (and Meet link) when an appointment is cancelled. */
export async function cancelMeetingForAppointment(appointmentId: string): Promise<MeetingSyncResult> {
  try {
    const appt = await loadAppointment(appointmentId);
    if (!appt) return { synced: false, reason: "appointment_not_found" };
    if (!appt.google_event_id) return { synced: false, reason: "no_event" };

    const accessToken = await getAccessToken();
    await calendarFetch(
      `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(appt.google_event_id)}?sendUpdates=all`,
      { accessToken, method: "DELETE" },
    ).catch(async (err: Error) => {
      // A 410/404 means it is already gone — treat as success.
      if (!/410|404|deleted|not found/i.test(err.message)) throw err;
    });

    await markAppointment(appt.id, {
      meeting_status: "cancelled",
      meeting_url: null,
      meeting_error: null,
    });
    return { synced: true, eventId: appt.google_event_id, meetingUrl: null };
  } catch (err) {
    const reason = failureReason(err);
    await markAppointment(appointmentId, { meeting_status: "sync_failed", meeting_error: reason });
    console.error("[google-calendar] cancel failed", appointmentId, reason);
    return { synced: false, reason };
  }
}