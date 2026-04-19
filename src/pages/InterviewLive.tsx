import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBodyLanguage } from "@/hooks/useBodyLanguage";
import { useGeminiLiveVoiceInterview } from "@/hooks/useGeminiLiveVoiceInterview";
import { useInterviewVoice } from "@/hooks/useInterviewVoice";
import { useSpeechTranscript } from "@/hooks/useSpeechTranscript";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { geminiJsonDeliverySummary } from "@/lib/geminiDeliverySummary";
import { cleanCoachFeedbackDisplayText } from "@/lib/coachFeedbackDisplay";
import {
  interviewModesToArray,
  readInterviewSetup,
  type InterviewSetupState,
} from "@/lib/interviewSetup";
import type { GeminiLiveInterviewAnalysis } from "@/hooks/useGeminiLiveInterviewVision";
import MetricsOverlay from "@/components/MetricsOverlay";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Camera,
  Loader2,
  Mic,
  MicOff,
  Play,
  Sparkles,
  StopCircle,
  Volume2,
} from "lucide-react";

type Phase = "lobby" | "live" | "scoring" | "result";

type LocationState = { setup?: InterviewSetupState } | null;

export default function InterviewLive() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();

  const setup = useMemo(() => {
    const st = (location.state as LocationState)?.setup;
    if (st?.jobRole?.trim()) return { ...st, modes: { ...st.modes, voice: true } };
    const persisted = readInterviewSetup();
    if (persisted?.jobRole?.trim()) return { ...persisted, modes: { ...persisted.modes, voice: true } };
    return null;
  }, [location.state]);

  const [phase, setPhase] = useState<Phase>("lobby");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const [codingNotes, setCodingNotes] = useState("");
  const [designNotes, setDesignNotes] = useState("");
  const [feedback, setFeedback] = useState<{
    feedback_markdown: string;
    overall_score: number;
    strengths: string[];
    improvements: string[];
  } | null>(null);
  const [scoring, setScoring] = useState(false);
  const [voiceCoachEnabled, setVoiceCoachEnabled] = useState(true);
  const [assistantLog, setAssistantLog] = useState("");
  const stopFnRef = useRef<(() => Promise<void>) | null>(null);

  const {
    supported: coachVoiceSupported,
    isSpeaking: coachSpeaking,
    speakCoachFeedback,
    cancel: cancelCoachVoice,
  } = useInterviewVoice();

  const geminiVoice = useGeminiLiveVoiceInterview();

  const bodyRunning = phase === "live" && !!setup?.modes.bodyLanguage;
  const { metrics, ready: bodyReady, error: bodyError, reset: resetMetrics } = useBodyLanguage({
    videoEl: videoRef.current,
    running: bodyRunning,
  });

  const { transcript, speechInsights, supported: speechSupported, reset: resetTranscript } = useSpeechTranscript(
    phase === "live",
    geminiVoice.modelSpeaking || coachSpeaking,
  );

  const targetSeconds = (setup?.durationMin ?? 30) * 60;
  const remaining = Math.max(0, targetSeconds - elapsed);

  useEffect(() => {
    if (!setup) navigate("/interview", { replace: true });
  }, [setup, navigate]);

  useEffect(() => {
    if (!setup) return;
    if (phase !== "lobby" && phase !== "live") return;
    if (stream) return;

    const wantVideo = setup.modes.bodyLanguage;
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: wantVideo ? { width: 1280, height: 720 } : false,
      })
      .then((s) => {
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play().catch(() => {});
        }
      })
      .catch((e) => toast({ title: "Microphone blocked", description: e.message, variant: "destructive" }));
  }, [setup, phase, stream]);

  useEffect(() => {
    if (!stream || !videoRef.current) return;
    if (stream.getVideoTracks().length) {
      videoRef.current.srcObject = stream;
      void videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "live") return;
    let autoEnded = false;
    const id = window.setInterval(() => {
      if (!startedAtRef.current) return;
      const el = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(el);
      if (!autoEnded && el >= targetSeconds) {
        autoEnded = true;
        void stopFnRef.current?.();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, targetSeconds]);

  useEffect(() => {
    if (!voiceCoachEnabled) cancelCoachVoice();
  }, [voiceCoachEnabled, cancelCoachVoice]);

  useEffect(() => {
    if (phase !== "result" || !feedback || !voiceCoachEnabled || !coachVoiceSupported) return;
    const id = window.setTimeout(() => speakCoachFeedback(feedback), 700);
    return () => clearTimeout(id);
  }, [phase, feedback, voiceCoachEnabled, coachVoiceSupported, speakCoachFeedback]);

  const questionLine = useMemo(() => {
    if (!setup) return "";
    const co = setup.company.trim();
    return co ? `Live interview — ${setup.jobRole.trim()} @ ${co}` : `Live interview — ${setup.jobRole.trim()}`;
  }, [setup]);

  const handleStart = async () => {
    if (!setup || !stream) return;
    cancelCoachVoice();
    resetMetrics();
    resetTranscript();
    setAssistantLog("");
    setElapsed(0);
    startedAtRef.current = Date.now();
    setPhase("live");

    const ok = await geminiVoice.begin({
      mediaStream: stream,
      getVideo: () => videoRef.current,
      setup,
      sendVideoFrames: setup.modes.bodyLanguage,
    });
    if (!ok) {
      toast({
        title: "Live interviewer unavailable",
        description: "Set VITE_GEMINI_API_KEY (Google AI Studio) and optionally VITE_GEMINI_LIVE_MODEL, then try again.",
        variant: "destructive",
      });
      setPhase("lobby");
      startedAtRef.current = null;
    }
  };

  const handleStop = async () => {
    if (!setup) return;
    cancelCoachVoice();
    setPhase("scoring");
    setScoring(true);

    const elapsedForRecord = startedAtRef.current
      ? Math.floor((Date.now() - startedAtRef.current) / 1000)
      : elapsed;

    const { assistantTranscript, userTranscript } = geminiVoice.end();
    setAssistantLog(assistantTranscript);

    const combinedTranscript = [transcript, userTranscript].filter(Boolean).join("\n\n--- live ASR ---\n\n");

    const overall = Math.round(metrics.eyeContact * 0.3 + metrics.posture * 0.25 + metrics.smile * 0.15 + metrics.stability * 0.3);

    let geminiLiveAnalysis: GeminiLiveInterviewAnalysis | null = null;
    const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
    if (apiKey) {
      try {
        geminiLiveAnalysis = await geminiJsonDeliverySummary(apiKey, {
          setup,
          questionLine,
          transcript: combinedTranscript,
          assistantTranscript,
          metrics: {
            eyeContact: metrics.eyeContact,
            posture: metrics.posture,
            smile: metrics.smile,
            stability: metrics.stability,
          },
        });
      } catch (e) {
        console.warn("Delivery summary failed", e);
      }
    }

    const modesArr = interviewModesToArray(setup.modes);
    const attachment = [codingNotes.trim() && `Coding notes:\n${codingNotes.trim()}`, designNotes.trim() && `System design notes:\n${designNotes.trim()}`]
      .filter(Boolean)
      .join("\n\n");

    const transcriptForCoach = [combinedTranscript, attachment].filter(Boolean).join("\n\n");

    try {
      const { data, error } = await supabase.functions.invoke("coach-feedback", {
        body: {
          question: questionLine,
          transcript: transcriptForCoach,
          metrics: {
            eyeContact: metrics.eyeContact,
            posture: metrics.posture,
            smile: metrics.smile,
            stability: metrics.stability,
          },
          category: "live_interview",
          isPro: !!profile?.is_pro,
          geminiLiveAnalysis,
          speechInsights,
          interviewSetup: {
            jobRole: setup.jobRole,
            company: setup.company,
            seniority: setup.seniority,
            durationMin: setup.durationMin,
            modes: modesArr,
            resumePreview: setup.resumeText.slice(0, 4000),
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const fb = data as { feedback_markdown: string; overall_score: number; strengths: string[]; improvements: string[] };
      setFeedback(fb);

      if (user) {
        const { data: inserted, error: insErr } = await supabase
          .from("interview_sessions")
          .insert({
            user_id: user.id,
            category: "live_interview",
            question: questionLine,
            answer_transcript: transcriptForCoach,
            eye_contact_score: metrics.eyeContact,
            posture_score: metrics.posture,
            smile_score: metrics.smile,
            stability_score: metrics.stability,
            overall_score: fb.overall_score ?? overall,
            ai_feedback: fb.feedback_markdown,
            duration_seconds: elapsedForRecord,
            is_pro_feedback: !!profile?.is_pro,
            job_role: setup.jobRole,
            company: setup.company || null,
            seniority: setup.seniority,
            target_duration_min: setup.durationMin,
            interview_modes: modesArr,
            resume_context: setup.resumeText || null,
            session_kind: "live",
          })
          .select("id")
          .single();

        if (insErr) console.warn("interview_sessions insert failed", insErr);
        if (inserted?.id) {
          const { error: lbErr } = await supabase.from("leaderboard_entries").insert({
            user_id: user.id,
            session_id: inserted.id,
            display_name: profile?.display_name ?? "Anonymous",
            overall_score: fb.overall_score ?? overall,
            job_role: setup.jobRole,
            company: setup.company || null,
            seniority: setup.seniority,
            duration_minutes: setup.durationMin,
            interview_modes: modesArr,
          });
          if (lbErr) console.warn("leaderboard insert failed", lbErr);
        }
      }

      setPhase("result");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again";
      toast({ title: "Coach unavailable", description: msg, variant: "destructive" });
      setPhase("live");
      startedAtRef.current = Date.now();
      if (stream) {
        void geminiVoice.begin({
          mediaStream: stream,
          getVideo: () => videoRef.current,
          setup,
          sendVideoFrames: setup.modes.bodyLanguage,
        });
      }
    } finally {
      setScoring(false);
    }
  };

  stopFnRef.current = handleStop;

  if (!setup) return null;

  return (
    <main className="container py-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/interview")} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" /> Edit setup
        </Button>
        <p className="text-xs text-muted-foreground text-right">
          {questionLine}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5 space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Session</p>
            <p className="font-display text-2xl leading-snug">{setup.jobRole}</p>
            <p className="text-sm text-muted-foreground">
              {setup.company.trim() || "Company not specified"} · {setup.seniority} · target {setup.durationMin} min
            </p>
            <div className="text-xs text-muted-foreground">
              Modes: {interviewModesToArray(setup.modes).join(", ") || "voice"}
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug pt-2 border-t border-border/50">
              Voice is Gemini Live only (native audio). Your <span className="font-mono">VITE_GEMINI_API_KEY</span> drives the session — no browser TTS for the interviewer here.
            </p>
          </Card>

          {(setup.modes.coding || setup.modes.systemDesign) && (
            <Card className="p-5 space-y-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Workspace</p>
              {setup.modes.coding && (
                <div className="space-y-2">
                  <Label>Coding scratch pad</Label>
                  <Textarea value={codingNotes} onChange={(e) => setCodingNotes(e.target.value)} className="min-h-[120px] font-mono text-xs" />
                </div>
              )}
              {setup.modes.systemDesign && (
                <div className="space-y-2">
                  <Label>System design notes</Label>
                  <Textarea value={designNotes} onChange={(e) => setDesignNotes(e.target.value)} className="min-h-[120px] text-sm" />
                </div>
              )}
            </Card>
          )}

          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="coach-voice" className="text-xs font-medium cursor-pointer">
                  Read coach feedback aloud
                </Label>
                <p className="text-[11px] text-muted-foreground leading-snug">Browser TTS after the session ends (optional).</p>
              </div>
              <Switch id="coach-voice" checked={voiceCoachEnabled} onCheckedChange={setVoiceCoachEnabled} disabled={!coachVoiceSupported} />
            </div>
            {!coachVoiceSupported && (
              <p className="text-[11px] text-muted-foreground">Speech synthesis is not available in this browser.</p>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">You (STT)</p>
            <div className="text-sm min-h-[100px] max-h-[200px] overflow-auto leading-relaxed">
              {!speechSupported && <p className="text-muted-foreground italic">Speech recognition not supported in this browser.</p>}
              {speechSupported && (transcript ? <p>{transcript}</p> : <p className="text-muted-foreground italic">Your speech shows up here as you answer.</p>)}
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Interviewer (Live text)</p>
            <div className="text-sm min-h-[80px] max-h-[160px] overflow-auto leading-relaxed">
              {assistantLog ? <p>{assistantLog}</p> : <p className="text-muted-foreground italic">Transcription appears when the model exposes it.</p>}
            </div>
          </Card>

          {phase === "lobby" && (
            <Button
              onClick={() => void handleStart()}
              disabled={!stream || (setup.modes.bodyLanguage && !bodyReady)}
              size="lg"
              className="w-full shadow-md"
            >
              {bodyReady || !setup.modes.bodyLanguage ? (
                <>
                  <Play className="h-4 w-4 mr-2" /> Start live interview
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading vision…
                </>
              )}
            </Button>
          )}

          {phase === "live" && (
            <Button onClick={() => void handleStop()} size="lg" variant="destructive" className="w-full">
              <StopCircle className="h-4 w-4 mr-2" /> End & score
            </Button>
          )}

          {bodyError && <p className="text-xs text-destructive">{bodyError}</p>}
        </div>

        <div className="lg:col-span-2">
          <div className="relative rounded-3xl overflow-hidden bg-muted aspect-video shadow-elegant ring-1 ring-border/60">
            {setup.modes.bodyLanguage ? (
              <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Mic className="h-10 w-10" />
                <p className="text-sm px-6 text-center">Audio-only session — enable body language on setup to share webcam frames.</p>
              </div>
            )}

            {!stream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Camera className="h-10 w-10" />
                <p className="text-sm">Allow microphone{setup.modes.bodyLanguage ? " & camera" : ""} to begin</p>
              </div>
            )}

            <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/40 text-xs">
                {phase === "live" ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-destructive animate-pulse-ring" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                    </span>
                    <span className="font-mono">
                      LIVE · {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")} · left{" "}
                      {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}
                    </span>
                  </>
                ) : (
                  <span className="font-mono">{phase.toUpperCase()}</span>
                )}
              </div>
              {phase === "live" && (
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {geminiVoice.modelSpeaking && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-soft border border-primary/15 text-xs text-primary">
                      <Volume2 className="h-3 w-3 shrink-0" />
                      <span>Interviewer speaking…</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm text-xs">
                    {speechSupported ? <Mic className="h-3 w-3 text-primary" /> : <MicOff className="h-3 w-3 text-muted-foreground" />}
                    <span>
                      {speechSupported
                        ? geminiVoice.modelSpeaking || coachSpeaking
                          ? "STT paused (voice)"
                          : "Listening"
                        : "Mic not supported"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {setup.modes.bodyLanguage && (phase === "live" || phase === "lobby") && stream && (
              <div className="absolute bottom-4 left-4 hidden sm:block">
                <MetricsOverlay metrics={metrics} />
              </div>
            )}

            {phase === "scoring" && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="font-display text-xl">Scoring your session…</p>
              </div>
            )}
          </div>

          {setup.modes.bodyLanguage && (phase === "live" || phase === "lobby") && stream && (
            <div className="mt-4 sm:hidden">
              <MetricsOverlay metrics={metrics} large />
            </div>
          )}

          {phase === "result" && feedback && (
            <Card className="mt-6 p-6 lg:p-8 animate-fade-up">
              {coachSpeaking && voiceCoachEnabled && coachVoiceSupported && (
                <div className="flex items-center gap-2 text-sm text-primary mb-4">
                  <Volume2 className="h-4 w-4 shrink-0" />
                  <span>Coach is reading your feedback aloud…</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Overall score</p>
                  <p className="font-display text-6xl leading-none">
                    <span className="text-mint">{feedback.overall_score}</span>
                    <span className="text-2xl text-muted-foreground">/100</span>
                  </p>
                </div>
                {profile?.is_pro && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-gradient-pro text-primary-foreground">
                    <Sparkles className="h-3 w-3" /> PRO feedback
                  </span>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-mint-soft border border-border/60">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Strengths</p>
                  <ul className="space-y-1.5 text-sm">
                    {feedback.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-mint">✓</span>
                        {cleanCoachFeedbackDisplayText(s)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-coral-soft border border-border/60">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Improvements</p>
                  <ul className="space-y-1.5 text-sm">
                    {feedback.improvements.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-coral">→</span>
                        {cleanCoachFeedbackDisplayText(s)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground leading-relaxed">
                {cleanCoachFeedbackDisplayText(feedback.feedback_markdown)}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={() => navigate("/leaderboard")} variant="outline">
                  View leaderboard
                </Button>
                <Button onClick={() => navigate("/interview")} className="shadow-md">
                  Run another interview
                </Button>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  Dashboard
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
