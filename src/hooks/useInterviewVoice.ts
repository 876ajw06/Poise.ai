import { useCallback, useEffect, useRef, useState } from "react";

export type CoachFeedbackShape = {
  feedback_markdown: string;
  overall_score: number;
  strengths: string[];
  improvements: string[];
};

function stripMarkdownForSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2200);
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = `${v.name} ${v.voiceURI}`.toLowerCase();
  let score = 0;

  // Prefer English voices.
  if (v.lang?.toLowerCase().startsWith("en")) score += 50;

  // Prefer more natural-sounding voices (Windows/Edge often expose these).
  if (/(natural|neural|online|premium|enhanced)/i.test(name)) score += 40;

  // Prefer warm, friendly female voices (best-effort heuristic; varies by OS).
  if (/(female|woman|girl)/i.test(name)) score += 25;
  if (/(aria|jenny|sara|sarah|emma|olivia|ava|allison|joanna|salli|kimberly|ivy|michelle|natasha|serena|samantha|victoria|zira)/i.test(name)) {
    score += 35;
  }

  // Strongly prefer Microsoft/Google high quality voices when available.
  if (/(microsoft|google)/i.test(name)) score += 15;

  // Down-rank novelty/robotic voices.
  if (/(robot|whisper|bad news|bahh|fred)/i.test(name)) score -= 30;

  return score;
}

function pickVoice(prefer: "interviewer" | "coach"): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const sorted = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  const top = sorted[0] ?? null;

  // For interviewer/coach we use the same selection, but keep the parameter for future tuning.
  if (prefer === "interviewer" || prefer === "coach") return top;
  return top;
}

/**
 * Browser text-to-speech for interview question (interviewer) and coach feedback.
 * Pauses should be coordinated by the caller (e.g. disable speech recognition while isSpeaking).
 */
export function useInterviewVoice() {
  const [supported, setSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const chainRef = useRef<SpeechSynthesisUtterance[]>([]);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  useEffect(() => {
    if (!supported) return;
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);

  const cancel = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    chainRef.current = [];
    setIsSpeaking(false);
  }, []);

  const speakUtterances = useCallback((utterances: SpeechSynthesisUtterance[]) => {
    if (!supported || typeof window === "undefined") return;
    cancel();
    chainRef.current = utterances;
    if (!utterances.length) return;
    setIsSpeaking(true);
    let i = 0;
    const next = () => {
      if (i >= utterances.length) {
        setIsSpeaking(false);
        chainRef.current = [];
        return;
      }
      const u = utterances[i];
      i += 1;
      u.onend = () => next();
      u.onerror = () => {
        setIsSpeaking(false);
        chainRef.current = [];
      };
      window.speechSynthesis.speak(u);
    };
    next();
  }, [supported, cancel]);

  const speakQuestion = useCallback(
    (questionText: string) => {
      if (!supported) return;
      const voice = pickVoice("interviewer");
      const intro = new SpeechSynthesisUtterance(
        "Here's your interview question. Take a moment to think, then answer out loud.",
      );
      intro.rate = 0.95;
      intro.pitch = 1.06;
      if (voice) intro.voice = voice;

      const body = new SpeechSynthesisUtterance(questionText);
      body.rate = 0.92;
      body.pitch = 1.06;
      if (voice) body.voice = voice;

      speakUtterances([intro, body]);
    },
    [supported, speakUtterances],
  );

  const speakCoachFeedback = useCallback(
    (fb: CoachFeedbackShape) => {
      if (!supported) return;
      const voice = pickVoice("coach");
      const strengths = fb.strengths.length ? fb.strengths.join(". ") : "None listed.";
      const improvements = fb.improvements.length ? fb.improvements.join(". ") : "None listed.";
      const summary = stripMarkdownForSpeech(fb.feedback_markdown);

      const part1 = new SpeechSynthesisUtterance(
        `Your overall score is ${fb.overall_score} out of 100. Here is a quick summary. Strengths: ${strengths}`,
      );
      part1.rate = 0.94;
      part1.pitch = 1.03;
      if (voice) part1.voice = voice;

      const part2 = new SpeechSynthesisUtterance(`Areas to improve: ${improvements}`);
      part2.rate = 0.94;
      part2.pitch = 1.03;
      if (voice) part2.voice = voice;

      const part3 = new SpeechSynthesisUtterance(
        summary ? `Detailed coaching: ${summary}` : "That concludes the coaching feedback.",
      );
      part3.rate = 0.93;
      part3.pitch = 1.03;
      if (voice) part3.voice = voice;

      speakUtterances([part1, part2, part3]);
    },
    [supported, speakUtterances],
  );

  useEffect(() => () => cancel(), [cancel]);

  return {
    supported,
    isSpeaking,
    speakQuestion,
    speakCoachFeedback,
    cancel,
  };
}
