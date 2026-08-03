import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  clinicName: z.string().default("the clinic"),
  /** Pre-computed, already-filtered metrics. The model may not add facts. */
  facts: z.record(z.string(), z.union([z.string(), z.number()])),
});

const SYSTEM = `You write a short executive summary of a medical clinic's day for the clinic administrator.
Rules:
- Use ONLY the metrics provided. Never invent numbers, names or trends.
- 3 to 5 short sentences, plain professional English, no bullet points, no markdown, no headings.
- Mention counts, revenue, busiest doctor, most common consultation type and completion rate only when present.
- If there is almost no activity, say so plainly.
Return only the narrative text.`;

export const generateDailySummary = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<{ narrative: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

    const factLines = Object.entries(data.facts)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Clinic: ${data.clinicName}\nToday's metrics:\n${factLines}`,
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit reached. Please retry shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits to continue.");
    if (!res.ok) throw new Error(`Could not generate the summary (${res.status}).`);

    const json = (await res.json()) as any;
    const text = String(json?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) throw new Error("Empty summary response.");
    return { narrative: text };
  });
