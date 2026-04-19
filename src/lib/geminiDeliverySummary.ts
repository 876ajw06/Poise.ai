import type { InterviewSetupState } from "@/lib/interviewSetup";
import type { GeminiLiveInterviewAnalysis } from "@/hooks/useGeminiLiveInterviewVision";

function stripJsonFence(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : s).trim();
}

function parseAnalysis(text: string): GeminiLiveInterviewAnalysis {
  const cleaned = stripJsonFence(text);
  const base: GeminiLiveInterviewAnalysis = { raw_model_text: text };
  try {
    const o = JSON.parse(cleaned) as Record<string, unknown>;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(Math.max(0, Math.min(100, v))) : undefined);
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    return {
      ...base,
      eye_contact_from_video: num(o.eye_contact_from_video),
      posture_from_video: num(o.posture_from_video),
      warmth_from_video: num(o.warmth_from_video),
      stillness_from_video: num(o.stillness_from_video),
      body_language_notes: str(o.body_language_notes),
      filler_words_from_audio_context: str(o.filler_words_from_audio_context),
    };
  } catch {
    return base;
  }
}

/**
 * One-shot JSON delivery summary using the REST Gemini API (not Live).
 * Used after a voice Live session ends so we still get structured video/transcript signals for the coach.
 */
export async function geminiJsonDeliverySummary(
  apiKey: string,
  input: {
    setup: InterviewSetupState;
    questionLine: string;
    transcript: string;
    assistantTranscript: string;
    metrics: { eyeContact: number; posture: number; smile: number; stability: number };
  },
): Promise<GeminiLiveInterviewAnalysis | null> {
  const key = apiKey.trim();
  if (!key) return null;

  const resume = input.setup.resumeText.trim();
  const prompt = `You are an expert interview coach who observed a LIVE voice interview session.

Interview setup:
- Role: ${input.setup.jobRole || "(unspecified)"}
- Company: ${input.setup.company || "(unspecified)"}
- Seniority: ${input.setup.seniority}
- Session line: ${input.questionLine}

Resume / background the candidate provided (may be empty):
"""${resume || "(none)"}"""

On-device body-language metrics captured during the session (0-100):
- Eye contact: ${input.metrics.eyeContact}
- Posture: ${input.metrics.posture}
- Smile/warmth: ${input.metrics.smile}
- Stability: ${input.metrics.stability}

Candidate speech transcript (browser STT; may be imperfect):
"""${input.transcript || "(empty)"}"""

Interviewer model text transcript (if any was captured from Live text / transcription):
"""${input.assistantTranscript || "(empty)"}"""

Return a single JSON object (no markdown fences) with exactly these keys:
{
  "eye_contact_from_video": number (0-100),
  "posture_from_video": number (0-100),
  "warmth_from_video": number (0-100),
  "stillness_from_video": number (0-100),
  "body_language_notes": string,
  "filler_words_from_audio_context": string
}

Notes:
- You did not see raw pixels here; infer cautiously from metrics + transcript tone, and say when data is insufficient.
- filler_words_from_audio_context: call out fillers from the candidate transcript (um, uh, like, you know, etc.).`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.25,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.warn("geminiJsonDeliverySummary failed", res.status, t);
    return null;
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("") ?? "";
  return text.trim() ? parseAnalysis(text) : null;
}
