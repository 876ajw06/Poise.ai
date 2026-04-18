import { useEffect, useRef, useState } from "react";

// Minimal browser SpeechRecognition wrapper.
// Works in Chromium-based browsers; gracefully no-ops elsewhere.
// When `paused` is true, recognition stops (e.g. while TTS plays so the mic doesn't transcribe the AI voice).
const LONG_PAUSE_THRESHOLD_MS = 1800;
const FILLER_TERMS = ["um", "uh", "like", "you know", "basically", "actually", "literally", "kind of", "sort of"] as const;

export type SpeechInsights = {
  totalWords: number;
  fillerTotal: number;
  fillerPer100Words: number;
  fillerCounts: Record<string, number>;
  longPauseCount: number;
  averagePauseMs: number;
  maxPauseMs: number;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countMatches(text: string, term: string): number {
  const r = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
  return text.match(r)?.length ?? 0;
}

function analyzeTranscript(transcript: string, longPauseMs: number[]): SpeechInsights {
  const normalized = transcript.toLowerCase();
  const words = normalized.match(/\b[\w']+\b/g) ?? [];
  const fillerCounts = FILLER_TERMS.reduce<Record<string, number>>((acc, term) => {
    acc[term] = countMatches(normalized, term);
    return acc;
  }, {});
  const fillerTotal = Object.values(fillerCounts).reduce((a, b) => a + b, 0);
  const averagePauseMs = longPauseMs.length
    ? Math.round(longPauseMs.reduce((a, b) => a + b, 0) / longPauseMs.length)
    : 0;
  const maxPauseMs = longPauseMs.length ? Math.round(Math.max(...longPauseMs)) : 0;

  return {
    totalWords: words.length,
    fillerTotal,
    fillerPer100Words: words.length ? Number(((fillerTotal / words.length) * 100).toFixed(1)) : 0,
    fillerCounts,
    longPauseCount: longPauseMs.length,
    averagePauseMs,
    maxPauseMs,
  };
}

export function useSpeechTranscript(active: boolean, paused = false) {
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(true);
  const [speechInsights, setSpeechInsights] = useState<SpeechInsights>({
    totalWords: 0,
    fillerTotal: 0,
    fillerPer100Words: 0,
    fillerCounts: {},
    longPauseCount: 0,
    averagePauseMs: 0,
    maxPauseMs: 0,
  });
  const recRef = useRef<any>(null);
  const finalRef = useRef("");
  const lastResultAtRef = useRef<number | null>(null);
  const longPauseRef = useRef<number[]>([]);

  useEffect(() => {
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e: any) => {
      const now = Date.now();
      if (lastResultAtRef.current) {
        const delta = now - lastResultAtRef.current;
        if (delta >= LONG_PAUSE_THRESHOLD_MS) longPauseRef.current.push(delta);
      }
      lastResultAtRef.current = now;

      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalRef.current += res[0].transcript + " ";
        else interim += res[0].transcript;
      }
      const merged = (finalRef.current + interim).trim();
      setTranscript(merged);
      setSpeechInsights(analyzeTranscript(merged, longPauseRef.current));
    };
    r.onerror = () => {};
    recRef.current = r;
  }, []);

  useEffect(() => {
    if (!recRef.current || !supported) return;
    if (active && !paused) {
      try { recRef.current.start(); } catch {}
    } else {
      try { recRef.current.stop(); } catch {}
    }
  }, [active, supported, paused]);

  const reset = () => {
    finalRef.current = "";
    lastResultAtRef.current = null;
    longPauseRef.current = [];
    setTranscript("");
    setSpeechInsights({
      totalWords: 0,
      fillerTotal: 0,
      fillerPer100Words: 0,
      fillerCounts: {},
      longPauseCount: 0,
      averagePauseMs: 0,
      maxPauseMs: 0,
    });
  };

  return { transcript, speechInsights, supported, reset };
}
