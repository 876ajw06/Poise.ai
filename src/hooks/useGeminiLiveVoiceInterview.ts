import { useCallback, useRef, useState } from "react";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import type { InterviewSetupState } from "@/lib/interviewSetup";
import { interviewModesToArray } from "@/lib/interviewSetup";

/** Default matches Google’s “Gemini 3.1 Flash Live Preview” Live API model id. Override with `VITE_GEMINI_LIVE_MODEL` if needed. */
const DEFAULT_LIVE_MODEL = "gemini-3.1-flash-live-preview";
const FRAME_INTERVAL_MS = 1000;
const OUT_SAMPLE_RATE_DEFAULT = 24_000;
const BARGE_IN_RMS = 0.04;

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function downsampleToInt16Mono(input: Float32Array, inputRate: number, outRate: number): Int16Array {
  if (!input.length || outRate <= 0 || inputRate <= 0) return new Int16Array();
  const ratio = inputRate / outRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = Math.min(input.length - 1, Math.floor(i * ratio));
    const s = Math.max(-1, Math.min(1, input[idx] ?? 0));
    out[i] = Math.round(s * 32767);
  }
  return out;
}

function int16ToFloat32(pcm: Int16Array): Float32Array {
  const f32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) f32[i] = pcm[i]! / 32768;
  return f32;
}

function parseRateFromMime(mime: string | undefined, fallback: number) {
  if (!mime) return fallback;
  const m = mime.match(/rate=(\d+)/i);
  if (!m) return fallback;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}

/** Google AI (ML dev) WebSocket JSON is often snake_case; the web SDK assigns it raw onto `LiveServerMessage`. */
function liveServerContent(msg: LiveServerMessage): Record<string, unknown> | undefined {
  const m = msg as unknown as Record<string, unknown>;
  return asRecord(m.serverContent ?? m.server_content);
}

function modelTurnParts(sc: Record<string, unknown>): Array<Record<string, unknown>> {
  const mt = asRecord(sc.modelTurn ?? sc.model_turn);
  const parts = mt?.parts;
  return Array.isArray(parts) ? (parts as Array<Record<string, unknown>>) : [];
}

function inlineDataFromPart(part: Record<string, unknown>): { data: string; mimeType?: string } | undefined {
  const inl = asRecord(part.inlineData ?? part.inline_data);
  if (!inl) return undefined;
  const data = inl.data;
  if (typeof data !== "string") return undefined;
  const mimeType = inl.mimeType ?? inl.mime_type;
  return { data, mimeType: typeof mimeType === "string" ? mimeType : undefined };
}

/** Treat as PCM if it is clearly audio and not a compressed codec we cannot decode here. */
function mimeLooksLikeLivePcm(mime: string | undefined): boolean {
  if (!mime) return true;
  const m = mime.toLowerCase();
  if (!m.includes("audio")) return false;
  if (m.includes("mp3") || m.includes("mpeg") || m.includes("opus") || m.includes("aac") || m.includes("flac")) return false;
  return true;
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) return input;
  if (fromRate <= 0 || toRate <= 0) return input;
  const outLen = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = (i * fromRate) / toRate;
    const j = Math.floor(pos);
    const frac = pos - j;
    const s0 = input[j] ?? 0;
    const s1 = input[j + 1] ?? s0;
    out[i] = s0 + frac * (s1 - s0);
  }
  return out;
}

function buildInterviewerSystemInstruction(setup: InterviewSetupState): string {
  const modes = interviewModesToArray(setup.modes).join(", ") || "voice";
  const resume = setup.resumeText.trim();

  return `You are a senior hiring manager conducting a LIVE, spoken job interview over realtime audio.

Interview context:
- Target role: ${setup.jobRole || "General professional role"}
- Company: ${setup.company || "Not specified"}
- Expected seniority band: ${setup.seniority}
- Planned session length: about ${setup.durationMin} minutes (pace yourself; do not read a script)
- Enabled interview modes on the client: ${modes}

Candidate background / résumé text (may be empty — if present, ground your questions and follow-ups in it; if empty, ask one crisp question at a time and build from answers):
"""${resume || "(none provided)"}"""

How to behave (critical):
- This is continuous realtime audio: you hear the candidate as they speak. React like a human interviewer — brief verbal acknowledgements during natural micro-pauses ("mm-hmm", "right", "okay") when it fits; do not talk over them. When they finish a thought, respond with your next question, probe, or comment.
- Sound like a real interviewer: short acknowledgements, natural curiosity, occasional clarifying questions, and follow-ups that reference what they *just* said.
- Do NOT behave like a chatbot that dumps long multi-part essays. Keep each speaking turn concise (usually a few sentences) unless they ask for detail.
- Ask one primary question at a time; probe deeper when answers are vague.
- The candidate can interrupt you at any time — treat interruptions as normal. If they start talking while you are speaking, stop immediately in your *next* audio chunk (the client will cut playback) and listen.
- Vary pacing and tone; use brief pauses; avoid repeating boilerplate intros.
- If coding mode is enabled, you may weave in a small concrete technical prompt, but do not require an IDE — keep it conversational.
- If system design mode is enabled, you may ask for a high-level architecture sketch in speech.
- If body language mode is enabled, you may occasionally comment on visible confidence *lightly* and constructively (the client also streams periodic webcam frames).

You speak only through the Live API's native audio. There is no separate robot voice on the client — you are the voice they hear.`;
}

export function useGeminiLiveVoiceInterview() {
  const sessionRef = useRef<Session | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const capturingRef = useRef(false);

  const micCtxRef = useRef<AudioContext | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const micMuteRef = useRef<GainNode | null>(null);

  const playCtxRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef(0);
  const outRateRef = useRef(OUT_SAMPLE_RATE_DEFAULT);

  const assistantTextRef = useRef<string[]>([]);
  const userTextRef = useRef<string[]>([]);

  const [modelSpeaking, setModelSpeaking] = useState(false);
  const speakingDepthRef = useRef(0);

  const closeSession = useCallback(() => {
    capturingRef.current = false;
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

    try {
      micProcessorRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    micProcessorRef.current = null;
    try {
      micSourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    micSourceRef.current = null;
    try {
      micMuteRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    micMuteRef.current = null;
    try {
      void micCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    micCtxRef.current = null;

    interruptPlayback();
    try {
      void playCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    playCtxRef.current = null;
  }, []);

  const interruptPlayback = useCallback(() => {
    for (const s of activeSourcesRef.current) {
      try {
        s.stop(0);
      } catch {
        /* ignore */
      }
      try {
        s.disconnect();
      } catch {
        /* ignore */
      }
    }
    activeSourcesRef.current = [];
    speakingDepthRef.current = 0;
    setModelSpeaking(false);
    const ctx = playCtxRef.current;
    if (ctx && ctx.state !== "closed") nextPlayTimeRef.current = ctx.currentTime;
  }, []);

  const bumpSpeaking = useCallback((delta: number) => {
    speakingDepthRef.current = Math.max(0, speakingDepthRef.current + delta);
    setModelSpeaking(speakingDepthRef.current > 0);
  }, []);

  const enqueuePcmPlayback = useCallback(
    (pcmBytes: Uint8Array, mimeType?: string) => {
      if (!pcmBytes.byteLength) return;
      const inputRate = parseRateFromMime(mimeType, outRateRef.current);
      outRateRef.current = inputRate;

      let playCtx = playCtxRef.current;
      if (!playCtx || playCtx.state === "closed") {
        playCtx = new AudioContext();
        playCtxRef.current = playCtx;
        nextPlayTimeRef.current = 0;
      }

      void playCtx.resume().catch(() => {
        /* autoplay policies: resume after user gesture */
      });

      const sampleCount = Math.floor(pcmBytes.byteLength / 2);
      if (!sampleCount) return;
      const int16 = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, sampleCount);
      const f32AtInputRate = int16ToFloat32(int16);
      const ctxRate = playCtx.sampleRate;
      const f32 = resampleLinear(f32AtInputRate, inputRate, ctxRate);

      let buffer: AudioBuffer;
      try {
        buffer = playCtx.createBuffer(1, f32.length, ctxRate);
      } catch {
        return;
      }
      buffer.copyToChannel(f32, 0, 0);

      const src = playCtx.createBufferSource();
      src.buffer = buffer;
      src.connect(playCtx.destination);
      activeSourcesRef.current.push(src);
      bumpSpeaking(1);
      src.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter((x) => x !== src);
        bumpSpeaking(-1);
      };
      const startAt = Math.max(playCtx.currentTime, nextPlayTimeRef.current, 0.0001);
      nextPlayTimeRef.current = startAt + buffer.duration;
      try {
        src.start(startAt);
      } catch {
        bumpSpeaking(-1);
      }
    },
    [bumpSpeaking],
  );

  const onLiveMessage = useCallback(
    (msg: LiveServerMessage) => {
      const sc = liveServerContent(msg);
      if (!sc) return;

      if (sc.interrupted === true) interruptPlayback();

      const pushTranscript = (target: "in" | "out", text: string) => {
        const t = text.trim();
        if (!t) return;
        if (target === "in") userTextRef.current.push(t);
        else assistantTextRef.current.push(t);
      };

      const inputTx = asRecord(sc.inputTranscription ?? sc.input_transcription) as
        | { text?: string; transcripts?: Array<{ text?: string }> }
        | undefined;
      if (inputTx?.text) pushTranscript("in", inputTx.text);
      if (Array.isArray(inputTx?.transcripts)) {
        for (const t of inputTx.transcripts) if (t?.text) pushTranscript("in", t.text);
      }

      const outputTx = asRecord(sc.outputTranscription ?? sc.output_transcription) as
        | { text?: string; transcripts?: Array<{ text?: string }> }
        | undefined;
      if (outputTx?.text) pushTranscript("out", outputTx.text);
      if (Array.isArray(outputTx?.transcripts)) {
        for (const t of outputTx.transcripts) if (t?.text) pushTranscript("out", t.text);
      }

      const parts = modelTurnParts(sc);
      if (parts.length) {
        for (const p of parts) {
          const inline = inlineDataFromPart(p);
          if (inline?.data && mimeLooksLikeLivePcm(inline.mimeType)) {
            const bytes = base64ToUint8(inline.data);
            enqueuePcmPlayback(bytes, inline.mimeType);
          }
          const text = typeof p.text === "string" ? p.text : undefined;
          if (text) pushTranscript("out", text);
        }
      }
    },
    [enqueuePcmPlayback, interruptPlayback],
  );

  const begin = useCallback(
    async (opts: {
      mediaStream: MediaStream;
      getVideo?: () => HTMLVideoElement | null;
      setup: InterviewSetupState;
      sendVideoFrames: boolean;
    }): Promise<boolean> => {
      const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
      if (!apiKey) return false;

      closeSession();
      nextPlayTimeRef.current = 0;
      assistantTextRef.current = [];
      userTextRef.current = [];

      const model = (import.meta.env.VITE_GEMINI_LIVE_MODEL as string | undefined)?.trim() || DEFAULT_LIVE_MODEL;
      const ai = new GoogleGenAI({ apiKey });

      let session: Session;
      try {
        session = await ai.live.connect({
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: {
              parts: [{ text: buildInterviewerSystemInstruction(opts.setup) }],
            },
          },
          callbacks: {
            onmessage: onLiveMessage,
            onerror: (e) => console.warn("Gemini Live voice session error", e),
          },
        });
      } catch (e) {
        console.warn("Gemini Live voice connect failed", e);
        return false;
      }

      sessionRef.current = session;

      const audioTracks = opts.mediaStream.getAudioTracks();
      if (!audioTracks.length) {
        console.warn("No audio track on media stream");
        closeSession();
        return false;
      }

      const micCtx = new AudioContext();
      micCtxRef.current = micCtx;
      await micCtx.resume().catch(() => {
        /* ensure graph runs after Start click */
      });
      const source = micCtx.createMediaStreamSource(opts.mediaStream);
      micSourceRef.current = source;

      const mute = micCtx.createGain();
      mute.gain.value = 0;
      micMuteRef.current = mute;

      const processor = micCtx.createScriptProcessor(4096, 1, 1);
      micProcessorRef.current = processor;

      let lastSend = 0;
      processor.onaudioprocess = (ev) => {
        const sess = sessionRef.current;
        if (!sess) return;

        const input = ev.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i]! * input[i]!;
        const rms = Math.sqrt(sum / input.length);
        if (rms > BARGE_IN_RMS && activeSourcesRef.current.length) interruptPlayback();

        const now = performance.now();
        if (now - lastSend < 120) return;
        lastSend = now;

        const pcm = downsampleToInt16Mono(input, micCtx.sampleRate, 16_000);
        if (!pcm.byteLength) return;
        const b64 = uint8ToBase64(new Uint8Array(pcm.buffer));

        try {
          sess.sendRealtimeInput({
            audio: { data: b64, mimeType: "audio/pcm;rate=16000" },
          });
        } catch (err) {
          console.warn("Gemini Live mic chunk send failed", err);
        }
      };

      source.connect(processor);
      processor.connect(mute);
      mute.connect(micCtx.destination);

      if (opts.sendVideoFrames) {
        if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
        capturingRef.current = true;
        frameTimerRef.current = window.setInterval(() => {
          if (!capturingRef.current) return;
          const video = opts.getVideo?.() ?? null;
          const sess = sessionRef.current;
          if (!video || !sess || video.readyState < 2) return;

          const w = video.videoWidth;
          const h = video.videoHeight;
          if (!w || !h) return;

          const canvas = canvasRef.current!;
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
                console.warn("Gemini Live video frame send failed", err);
              }
            },
            "image/jpeg",
            0.55,
          );
        }, FRAME_INTERVAL_MS);
      }

      const role = opts.setup.jobRole.trim() || "this role";
      const co = opts.setup.company.trim();
      try {
        session.sendClientContent({
          turns: [
            {
              role: "user",
              parts: [
                {
                  text: `SESSION LIVE — The candidate's microphone is streaming to you now${co ? ` for a ${role} opportunity at ${co}` : ` for ${role}`}.

Speak immediately in your natural voice (native audio output only): sound like a real hiring manager — brief warm-up, then your first substantive interview question for someone at ${opts.setup.seniority} level. Do not wait for them to talk first; do not stay silent.`,
                },
              ],
            },
          ],
          turnComplete: true,
        });
      } catch (e) {
        console.warn("Gemini Live conversation kickoff failed", e);
      }

      return true;
    },
    [closeSession, interruptPlayback, onLiveMessage],
  );

  const end = useCallback(() => {
    capturingRef.current = false;
    if (frameTimerRef.current != null) {
      window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }

    try {
      sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true });
    } catch {
      /* ignore */
    }

    closeSession();

    const assistantTranscript = assistantTextRef.current.join(" ").replace(/\s+/g, " ").trim();
    const userTranscript = userTextRef.current.join(" ").replace(/\s+/g, " ").trim();
    assistantTextRef.current = [];
    userTextRef.current = [];

    return { assistantTranscript, userTranscript };
  }, [closeSession]);

  return { begin, end, interruptPlayback, modelSpeaking };
}
