// CareHop — local, rule-based FAQ dataset + matching engine.
// Entirely client-side: no API calls, no AI, no backend.

export type FaqEntry = {
  id: string;
  keywords: string[];
  phrases: string[];
  response: string;
};

export const CONTACT_BLOCK = `📧 Email: info@vardhmanivf.in
☎️ Landline: 0124 4787191
📱 Mobile: +91 80762 95919
📱 Mobile: +91 99996 00410`;

export const GREETING = `👋 Hi! I'm CareHop.
Welcome to Vardhman Medicare.
I'm here to help answer common questions about appointments, consultations, payments, clinic timings, and other clinic-related services.
Feel free to ask me anything!`;

export const FALLBACK = `I'm sorry, I couldn't find an answer to that question.
For further assistance, please contact Vardhman Medicare directly. Our team will be happy to help you.
${CONTACT_BLOCK}`;

export const EMERGENCY_RESPONSE = `This appears to be a medical emergency.
Please immediately contact your nearest emergency services or visit the nearest hospital.
CareHop cannot provide emergency medical advice.`;

const EMERGENCY_TERMS = [
  "chest pain", "heart attack", "cardiac arrest", "bleeding", "blood loss",
  "unconscious", "fainted", "not breathing", "cannot breathe", "can't breathe",
  "breathless", "emergency", "stroke", "seizure", "severe pain", "suicide",
  "overdose", "accident", "ambulance", "critical",
];

export const SUGGESTED_QUESTIONS = [
  "📅 How do I book an appointment?",
  "🔄 Can I reschedule my appointment?",
  "❌ How do I cancel my appointment?",
  "💳 Payment methods",
  "🩺 Consultation types",
  "🕒 Clinic timings",
  "📍 Clinic location",
  "📞 Contact clinic",
] as const;

export const FAQS: FaqEntry[] = [
  {
    id: "booking",
    keywords: ["book", "booking", "appointment", "make", "schedule", "new", "slot"],
    phrases: ["how do i book", "book appointment", "appointment booking", "make appointment", "book a doctor", "take appointment", "fix appointment"],
    response:
      "To book an appointment, visit the Doctors section, choose your preferred doctor, select a consultation type, pick an available time slot, and complete your booking.",
  },
  {
    id: "reschedule",
    keywords: ["reschedule", "change", "postpone", "shift", "move", "prepone"],
    phrases: ["can i reschedule", "reschedule appointment", "change appointment", "change my slot", "move my appointment", "change date"],
    response:
      "If your appointment is eligible for rescheduling, you can check the My Visits section where the Reschedule option will be available whenever applicable.",
  },
  {
    id: "cancel",
    keywords: ["cancel", "cancellation", "delete", "remove", "refund"],
    phrases: ["cancel appointment", "can i cancel", "delete appointment", "cancel my booking", "how to cancel"],
    response:
      "If your appointment is eligible for cancellation, you can check the My Visits section where the Cancel Appointment option will be available whenever applicable.",
  },
  {
    id: "payments",
    keywords: ["payment", "pay", "razorpay", "upi", "card", "netbanking", "fees", "fee", "charges", "price", "cost", "wallet"],
    phrases: ["payment methods", "how to pay", "which payment", "is payment safe", "consultation fee", "how much"],
    response:
      "Payments are securely processed through Razorpay using supported online payment methods.",
  },
  {
    id: "consultation-types",
    keywords: ["consultation", "types", "video", "online", "person", "offline", "teleconsultation", "clinic visit"],
    phrases: ["consultation types", "types of consultation", "online consultation", "video consultation", "in person consultation"],
    response:
      "Vardhman Medicare offers different consultation types depending on the doctor's availability, including in-person and video consultations where available.",
  },
  {
    id: "timings",
    keywords: ["timing", "timings", "time", "hours", "open", "close", "availability", "available", "when", "schedule"],
    phrases: ["clinic timings", "opening hours", "what time", "when is the clinic open", "working hours", "available slots"],
    response:
      "Appointment availability depends on each doctor's schedule. Please visit the booking page to view the latest available appointment slots.",
  },
  {
    id: "doctors",
    keywords: ["doctor", "doctors", "specialist", "physician", "pediatrician", "who"],
    phrases: ["which doctors", "list of doctors", "see doctors", "available doctors", "who is the doctor"],
    response:
      "You can explore all available doctors from the Doctors section of the application.",
  },
  {
    id: "visits",
    keywords: ["visits", "my visits", "history", "status", "upcoming", "past", "bookings"],
    phrases: ["my visits", "my appointments", "appointment status", "where are my bookings", "see my appointment"],
    response:
      "The My Visits section allows you to view your appointments, appointment status, booking details, and, where applicable, available options such as rescheduling or cancellation.",
  },
  {
    id: "forgot-appointment",
    keywords: ["forgot", "forget", "remember", "lost"],
    phrases: ["i forgot my appointment", "forgot appointment time", "don't remember my appointment", "lost my booking"],
    response:
      "Please visit the My Visits page to view all your booked appointments and their current status.",
  },
  {
    id: "contact",
    keywords: ["contact", "phone", "number", "email", "support", "help", "reach", "call", "landline", "mobile", "address", "location", "where", "directions", "map"],
    phrases: ["contact clinic", "phone number", "customer support", "reach clinic", "how do i contact", "clinic location", "where is the clinic", "clinic address"],
    response: `We'd be happy to help.
You can contact Vardhman Medicare using any of the following:
${CONTACT_BLOCK}`,
  },
];

/* ------------------------------- engine ------------------------------- */

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

function fuzzyEqual(a: string, b: string): boolean {
  if (a === b) return true;
  const longer = Math.max(a.length, b.length);
  if (longer < 4) return false;
  const allowed = longer > 7 ? 2 : 1;
  return levenshtein(a, b) <= allowed;
}

export function isEmergency(input: string): boolean {
  const text = normalize(input);
  const words = text.split(" ");
  return EMERGENCY_TERMS.some((term) => {
    if (term.includes(" ")) return text.includes(term);
    return words.some((w) => fuzzyEqual(w, term));
  });
}

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "do", "does", "i", "my", "me", "you", "can",
  "how", "what", "to", "for", "of", "in", "on", "at", "and", "please", "it",
  "with", "from", "that", "this", "we", "us", "your",
]);

export function scoreFaq(entry: FaqEntry, input: string): number {
  const text = normalize(input);
  if (!text) return 0;
  const words = text.split(" ").filter((w) => !STOP_WORDS.has(w));
  let score = 0;

  for (const phrase of entry.phrases) {
    const p = normalize(phrase);
    if (text.includes(p)) score += 6;
    else if (p.includes(text) && text.length >= 5) score += 3;
  }

  for (const keyword of entry.keywords) {
    const k = normalize(keyword);
    if (k.includes(" ")) {
      if (text.includes(k)) score += 3;
      continue;
    }
    if (words.some((w) => w === k)) score += 2.5;
    else if (words.some((w) => w.length > 3 && (w.includes(k) || k.includes(w)))) score += 1.5;
    else if (words.some((w) => fuzzyEqual(w, k))) score += 1.2;
  }

  return score;
}

/** Returns a confident FAQ answer, the emergency notice, or null (unknown). */
export function answerQuestion(input: string): { response: string; matched: boolean } {
  if (isEmergency(input)) return { response: EMERGENCY_RESPONSE, matched: true };

  let best: FaqEntry | null = null;
  let bestScore = 0;
  for (const entry of FAQS) {
    const score = scoreFaq(entry, input);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (!best || bestScore < 2.4) return { response: FALLBACK, matched: false };
  return { response: best.response, matched: true };
}
