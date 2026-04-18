import { useCallback, useEffect, useRef } from "react";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";

const DEFAULT_LIVE_MODEL = "gemini-live-2.5-flash-preview";
const FRAME_INTERVAL_MS = 1000;
const FINALIZE_TIMEOUT_MS = 75_000;

export type GeminiLiveInterviewAnalysis = {
  raw_model_text: string;
  eye_contact_from_video?: number;
  posture_from_video?: number;
  warmth_from_video?: number;
  stillness_from_video?: number;
  body_language_notes?: string;
  filler_words_from_audio_context?: string;
};

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
 * Streams webcam JPEG frames (~1 FPS) to the Gemini Live API during a session,
 * then requests a structured JSON summary of visible delivery + transcript-based fillers.
 *
 * Set `VITE_GEMINI_API_KEY` in `.env` (Google AI Studio). Optional: `VITE_GEMINI_LIVE_MODEL`.
 */
export function useGeminiLiveInterviewVision() {
  const sessionRef = useRef<Session | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const capturingRef = useRef(false);
  /** When false, model text is ignored (frames-only phase). */
  const acceptModelTextRef = useRef(false);
  const finalizeBufferRef = useRef<string[]>([]);
  const finalizeResolverRef = useRef<((v: GeminiLiveInterviewAnalysis | null) => void) | null>(null);
  const finalizeDoneRef = useRef(false);
  const finalizeTimeoutIdRef = useRef<number | null>(null);

  const closeSession = useCallback(() => {
    capturingRef.current = false;
    acceptModelTextRef.current = false;
    if (frameTimerRef.current != null) {
      window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    try {
      sessionRef.current?.close();
    } catch {
      /* ignore */
    }
    sessionRef.current = null;
  }, []);

  const onLiveMessage = useCallback((msg: LiveServerMessage) => {
    if (!acceptModelTextRef.current) return;
    const sc = msg.serverContent;
    if (!sc) return;
    const parts = sc.modelTurn?.parts;
    if (parts?.length) {
      for (const p of parts) {
        if (p.text) finalizeBufferRef.current.push(p.text);
      }
    }
    if (sc.turnComplete && finalizeResolverRef.current && !finalizeDoneRef.current) {
      finalizeDoneRef.current = true;
      if (finalizeTimeoutIdRef.current != null) {
        window.clearTimeout(finalizeTimeoutIdRef.current);
        finalizeTimeoutIdRef.current = null;
      }
      const joined = finalizeBufferRef.current.join("");
      finalizeResolverRef.current(joined.trim() ? parseAnalysis(joined) : null);
      finalizeResolverRef.current = null;
    }
  }, []);

  const begin = useCallback(
    async (getVideo: () => HTMLVideoElement | null, question: string, category: string): Promise<boolean> => {
      const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
      if (!apiKey) return false;

      closeSession();
      finalizeBufferRef.current = [];
      finalizeDoneRef.current = false;

      const model = (import.meta.env.VITE_GEMINI_LIVE_MODEL as string | undefined)?.trim() || DEFAULT_LIVE_MODEL;
      const ai = new GoogleGenAI({ apiKey });

      let session: Session;
      try {
        session = await ai.live.connect({
          model,
          config: {
            responseModalities: [Modality.TEXT],
            temperature: 0.35,
            systemInstruction: {
              parts: [
                {
                  text: `You are an expert interview coach observing ${category} practice through a webcam (about one JPEG frame per second).

Rules:
- You only receive silent video snapshots (no microphone audio in this app). Infer visible delivery cues: head orientation and approximate eye line toward the camera, posture and shoulders, facial tension vs warmth, fidgeting or large sudden motions.
- Do NOT emit assistant text while snapshots are still arriving. Wait for the explicit "END SESSION" user message that ends the run.

When you receive "END SESSION", reply with a single JSON object (no markdown code fences) using exactly these keys:
{
  "eye_contact_from_video": number (0-100),
  "posture_from_video": number (0-100),
  "warmth_from_video": number (0-100),
  "stillness_from_video": number (0-100),
  "body_language_notes": string,
  "filler_words_from_audio_context": string
}

For filler_words_from_audio_context: you did not hear raw audio; combine (a) any visible hesitation cues if present with (b) the transcript text you will be given at END SESSION, explicitly calling out common fillers (um, uh, like, you know, basically, etc.) when they appear in that transcript. If the transcript is empty, say so.`,
                },
              ],
            },
          },
          callbacks: {
            onmessage: onLiveMessage,
            onerror: (e) => console.warn("Gemini Live session error", e),
          },
        });
      } catch (e) {
        console.warn("Gemini Live connect failed", e);
        return false;
      }

      sessionRef.current = session;
      acceptModelTextRef.current = false;

      try {
        session.sendClientContent({
          turns: [
            {
              role: "user",
              parts: [
                {
                  text: `Session context — category: ${category}. Question shown to the candidate:\n${question}\n\nWebcam frames will follow about once per second. Remain silent until END SESSION.`,
                },
              ],
            },
          ],
          turnComplete: false,
        });
      } catch (e) {
        console.warn("Gemini Live seed message failed", e);
        closeSession();
        return false;
      }

      if (!canvasRef.current) canvasRef.current = document.createElement("canvas");

      capturingRef.current = true;
      frameTimerRef.current = window.setInterval(() => {
        if (!capturingRef.current) return;
        const video = getVideo();
        const sess = sessionRef.current;
        if (!video || !sess || video.readyState < 2) return;

        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return;

        const canvas = canvasRef.current;
        const targetW = Math.min(640, w);
        const targetH = Math.round((h / w) * targetW);
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, targetW, targetH);

        canvas.toBlob(
          (blob) => {
            if (!blob || !sessionRef.current) return;
            try {
              sessionRef.current.sendRealtimeInput({ video: blob });
            } catch (err) {
              console.warn("Gemini Live frame send failed", err);
            }
          },
          "image/jpeg",
          0.55,
        );
      }, FRAME_INTERVAL_MS);

      return true;
    },
    [closeSession, onLiveMessage],
  );

  const finish = useCallback(
    async (transcript: string, question: string, category: string): Promise<GeminiLiveInterviewAnalysis | null> => {
      const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
      if (!apiKey) return null;

      const session = sessionRef.current;
      if (!session) return null;

      capturingRef.current = false;
      if (frameTimerRef.current != null) {
        window.clearInterval(frameTimerRef.current);
        frameTimerRef.current = null;
      }

      finalizeBufferRef.current = [];
      finalizeDoneRef.current = false;
      acceptModelTextRef.current = true;

      const waitForSummary = new Promise<GeminiLiveInterviewAnalysis | null>((resolve) => {
        finalizeResolverRef.current = resolve;
      });

      try {
        session.sendClientContent({
          turns: [
            {
              role: "user",
              parts: [
                {
                  text: `END SESSION — produce the JSON summary now.

Interview question:
${question}

Category: ${category}

Live speech transcript (may be partial; use for filler words and pacing):
"""${transcript || "(empty)"}"""`,
                },
              ],
            },
          ],
          turnComplete: true,
        });
      } catch (e) {
        console.warn("Gemini Live finalize send failed", e);
        acceptModelTextRef.current = false;
        finalizeResolverRef.current = null;
        closeSession();
        return null;
      }

      const result = await Promise.race([
        waitForSummary,
        new Promise<GeminiLiveInterviewAnalysis | null>((resolve) => {
          finalizeTimeoutIdRef.current = window.setTimeout(() => {
            finalizeTimeoutIdRef.current = null;
            if (finalizeDoneRef.current) return;
            finalizeDoneRef.current = true;
            finalizeResolverRef.current = null;
            const joined = finalizeBufferRef.current.join("");
            resolve(joined.trim() ? parseAnalysis(joined) : null);
          }, FINALIZE_TIMEOUT_MS);
        }),
      ]);

      if (finalizeTimeoutIdRef.current != null) {
        window.clearTimeout(finalizeTimeoutIdRef.current);
        finalizeTimeoutIdRef.current = null;
      }

      acceptModelTextRef.current = false;
      closeSession();
      return result;
    },
    [closeSession],
  );

  const abort = useCallback(() => {
    if (finalizeTimeoutIdRef.current != null) {
      window.clearTimeout(finalizeTimeoutIdRef.current);
      finalizeTimeoutIdRef.current = null;
    }
    finalizeResolverRef.current = null;
    finalizeDoneRef.current = true;
    closeSession();
  }, [closeSession]);

  useEffect(() => () => abort(), [abort]);

  return { begin, finish, abort };
}
