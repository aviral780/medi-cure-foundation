import { useSyncExternalStore } from "react";

export type NotificationSettingKey =
  | "email_confirmations"
  | "reschedule_notifications"
  | "cancellation_notifications"
  | "daily_digest"
  | "sms_reminders";

export type NotificationSettings = Record<NotificationSettingKey, boolean>;

export const NOTIFICATION_DEFAULTS: NotificationSettings = {
  email_confirmations: true,
  reschedule_notifications: true,
  cancellation_notifications: true,
  daily_digest: false,
  sms_reminders: false,
};

/** Minutes before an appointment an SMS reminder should fire (future delivery). */
export const SMS_REMINDER_LEAD_MINUTES = 60;

const STORAGE_KEY = "clinic:notification-settings";
const EVENT = "clinic:notification-settings-changed";

function normalize(raw: unknown): NotificationSettings {
  const obj = (raw ?? {}) as Partial<Record<NotificationSettingKey, unknown>>;
  const out = { ...NOTIFICATION_DEFAULTS };
  (Object.keys(NOTIFICATION_DEFAULTS) as NotificationSettingKey[]).forEach((k) => {
    if (typeof obj[k] === "boolean") out[k] = obj[k] as boolean;
  });
  return out;
}

let cached: NotificationSettings | null = null;

export function getNotificationSettings(): NotificationSettings {
  if (cached) return cached;
  if (typeof window === "undefined") return NOTIFICATION_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cached = normalize(raw ? JSON.parse(raw) : {});
  } catch {
    cached = { ...NOTIFICATION_DEFAULTS };
  }
  return cached;
}

export function isNotificationEnabled(key: NotificationSettingKey): boolean {
  return getNotificationSettings()[key];
}

export function setNotificationSetting(key: NotificationSettingKey, value: boolean): NotificationSettings {
  const next = { ...getNotificationSettings(), [key]: value };
  cached = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
    window.dispatchEvent(new CustomEvent(EVENT));
  }
  return next;
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cached = null;
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useNotificationSettings(): NotificationSettings {
  return useSyncExternalStore(subscribe, getNotificationSettings, () => NOTIFICATION_DEFAULTS);
}

/**
 * Fire-and-forget notification dispatch that respects the admin toggles.
 * Returns false (without any network call) when the relevant toggle is off.
 */
export async function dispatchNotification(
  path: string,
  body: unknown,
  requires: NotificationSettingKey[],
  init?: { keepalive?: boolean },
): Promise<boolean> {
  if (!requires.every((k) => isNotificationEnabled(k))) return false;
  try {
    const { supabase } = await import("@/lib/supabase");
    const { data: sess } = await supabase.auth.getSession();
    const token = sess?.session?.access_token;
    await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      keepalive: init?.keepalive ?? false,
    });
    return true;
  } catch {
    return false;
  }
}

export type ScheduledSmsReminder = {
  appointmentId: string;
  phone: string | null;
  sendAt: string;
  message: string;
};

/**
 * Builds the SMS reminder schedule for upcoming appointments. Delivery is not
 * wired to a provider yet — the structure is future-ready and returns an empty
 * schedule while the toggle is off.
 */
export function buildSmsReminderSchedule(
  appointments: Array<{
    id: string;
    appointment_date: string | null;
    start_time: string | null;
    phone?: string | null;
    doctor_name?: string | null;
  }>,
  clinicName: string,
): ScheduledSmsReminder[] {
  if (!isNotificationEnabled("sms_reminders")) return [];
  const now = Date.now();
  const out: ScheduledSmsReminder[] = [];
  for (const a of appointments) {
    if (!a.appointment_date || !a.start_time) continue;
    const at = new Date(`${a.appointment_date}T${a.start_time}`);
    if (Number.isNaN(at.getTime())) continue;
    const sendAt = at.getTime() - SMS_REMINDER_LEAD_MINUTES * 60_000;
    if (sendAt <= now) continue;
    out.push({
      appointmentId: a.id,
      phone: a.phone ?? null,
      sendAt: new Date(sendAt).toISOString(),
      message: `Reminder: your appointment${a.doctor_name ? ` with ${a.doctor_name}` : ""} at ${clinicName} is at ${a.start_time.slice(0, 5)} today.`,
    });
  }
  return out.sort((x, y) => x.sendAt.localeCompare(y.sendAt));
}
