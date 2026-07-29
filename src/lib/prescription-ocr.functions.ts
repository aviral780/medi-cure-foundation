import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  /** data URL: data:<mime>;base64,.... */
  dataUrl: z.string().min(16),
});

export type OcrExtraction = {
  chief_complaint: string;
  diagnosis: string;
  investigations: string;
  advice: string;
  medicines: {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
  }[];
};

const SYSTEM = `You read scanned or photographed medical prescriptions (printed or handwritten).
Extract only what is legible. Never invent clinical content.
Respond with ONLY a JSON object of this exact shape:
{"chief_complaint":"","diagnosis":"","investigations":"","advice":"","medicines":[{"name":"","dosage":"","frequency":"","duration":"","instructions":""}]}
Use empty strings for anything not found. Frequency may use forms like "1-0-1" or "twice daily".`;

function safeParse(text: string): OcrExtraction {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const raw = start >= 0 && end > start ? cleaned.slice(start, end + 1) : "{}";
  let obj: any = {};
  try {
    obj = JSON.parse(raw);
  } catch {
    obj = {};
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    chief_complaint: str(obj.chief_complaint),
    diagnosis: str(obj.diagnosis),
    investigations: str(obj.investigations),
    advice: str(obj.advice),
    medicines: Array.isArray(obj.medicines)
      ? obj.medicines
          .map((m: any) => ({
            name: str(m?.name),
            dosage: str(m?.dosage),
            frequency: str(m?.frequency),
            duration: str(m?.duration),
            instructions: str(m?.instructions),
          }))
          .filter((m: any) => m.name)
      : [],
  };
}

export const extractPrescriptionFromFile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<OcrExtraction> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured for this project.");

    const isPdf = data.mimeType.includes("pdf");
    const content = isPdf
      ? [
          { type: "text", text: "Extract the prescription details from this document." },
          { type: "file", file: { filename: data.fileName, file_data: data.dataUrl } },
        ]
      : [
          { type: "text", text: "Extract the prescription details from this image." },
          { type: "image_url", image_url: { url: data.dataUrl } },
        ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit reached. Please retry in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
    if (!res.ok) throw new Error(`Could not read the file (${res.status}).`);

    const json = (await res.json()) as any;
    return safeParse(json?.choices?.[0]?.message?.content ?? "");
  });
