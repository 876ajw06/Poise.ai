import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CATEGORIES, pickRandomQuestion } from "@/lib/categories";
import { useBodyLanguage } from "@/hooks/useBodyLanguage";
import { useSpeechTranscript } from "@/hooks/useSpeechTranscript";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import MetricsOverlay from "@/components/MetricsOverlay";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Camera, Mic, MicOff, Play, StopCircle, RefreshCw, Loader2, Sparkles, ArrowRight } from "lucide-react";

type Phase = "setup" | "live" | "scoring" | "result";

export default function Practice() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [category, setCategory] = useState(params.get("cat") ?? "behavioral");
  const [question, setQuestion] = useState(() => pickRandomQuestion(category));
  const [phase, setPhase] = useState<Phase>("setup");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const [feedback, setFeedback] = useState<{ feedback_markdown: string; overall_score: number; strengths: string[]; improvements: string[] } | null>(null);
  const [scoring, setScoring] = useState(false);

  const { metrics, ready: bodyReady, error: bodyError, reset: resetMetrics } = useBodyLanguage({
    videoEl: videoRef.current,
    running: phase === "live",
  });
  const { transcript, supported: speechSupported, reset: resetTranscript } = useSpeechTranscript(phase === "live");

  // Camera lifecycle
  useEffect(() => {
    if (phase === "setup" || phase === "live") {
      if (!stream) {
        navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true })
          .then((s) => {
            setStream(s);
            if (videoRef.current) {
              videoRef.current.srcObject = s;
              videoRef.current.play().catch(() => {});
            }
          })
          .catch((e) => toast({ title: "Camera blocked", description: e.message, variant: "destructive" }));
      } else if (videoRef.current && videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    }
    return () => {};
  }, [phase, stream]);

  useEffect(() => {
    return () => { stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer
  useEffect(() => {
    if (phase !== "live") return;
    const id = setInterval(() => {
      if (startedAtRef.current) setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [phase]);

  const handleStart = () => {
    resetMetrics();
    resetTranscript();
    setElapsed(0);
    startedAtRef.current = Date.now();
    setPhase("live");
  };

  const handleStop = async () => {
    setPhase("scoring");
    setScoring(true);
    const overall = Math.round(
      (metrics.eyeContact * 0.3 + metrics.posture * 0.25 + metrics.smile * 0.15 + metrics.stability * 0.3),
    );
    try {
      const { data, error } = await supabase.functions.invoke("coach-feedback", {
        body: {
          question,
          transcript,
          metrics: {
            eyeContact: metrics.eyeContact,
            posture: metrics.posture,
            smile: metrics.smile,
            stability: metrics.stability,
          },
          category,
          isPro: !!profile?.is_pro,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const fb = data as { feedback_markdown: string; overall_score: number; strengths: string[]; improvements: string[] };
      setFeedback(fb);

      if (user) {
        await supabase.from("interview_sessions").insert({
          user_id: user.id,
          category,
          question,
          answer_transcript: transcript,
          eye_contact_score: metrics.eyeContact,
          posture_score: metrics.posture,
          smile_score: metrics.smile,
          stability_score: metrics.stability,
          overall_score: fb.overall_score ?? overall,
          ai_feedback: fb.feedback_markdown,
          duration_seconds: elapsed,
          is_pro_feedback: !!profile?.is_pro,
        });
      }
      setPhase("result");
    } catch (e: any) {
      toast({ title: "Coach unavailable", description: e.message ?? "Please try again", variant: "destructive" });
      setPhase("live");
    } finally {
      setScoring(false);
    }
  };

  const handleNext = () => {
    setFeedback(null);
    setQuestion(pickRandomQuestion(category));
    setPhase("setup");
  };

  return (
    <main className="container py-8">
      <div className="grid lg:grid-cols-3 gap-6">
        {/* LEFT — controls */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Category</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  disabled={phase === "live" || phase === "scoring"}
                  onClick={() => { setCategory(c.id); setQuestion(pickRandomQuestion(c.id)); }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    category === c.id
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background border-border hover:border-foreground/40"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Question</p>
              {phase === "setup" && (
                <button onClick={() => setQuestion(pickRandomQuestion(category))} className="text-xs text-accent hover:underline flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> shuffle
                </button>
              )}
            </div>
            <p className="font-display text-xl leading-snug">{question}</p>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Live transcript</p>
            <div className="text-sm min-h-[100px] max-h-[200px] overflow-auto leading-relaxed">
              {!speechSupported && <p className="text-muted-foreground italic">Speech recognition not supported in this browser. Use Chrome/Edge for transcription.</p>}
              {speechSupported && (transcript ? <p>{transcript}</p> : <p className="text-muted-foreground italic">Your spoken answer will appear here as you speak.</p>)}
            </div>
          </Card>

          {phase === "setup" && (
            <Button onClick={handleStart} disabled={!bodyReady} size="lg" className="w-full bg-foreground text-background hover:bg-foreground/90">
              {bodyReady ? <><Play className="h-4 w-4 mr-2" /> Start session</> : <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading models…</>}
            </Button>
          )}
          {phase === "live" && (
            <Button onClick={handleStop} size="lg" variant="destructive" className="w-full">
              <StopCircle className="h-4 w-4 mr-2" /> End & get feedback
            </Button>
          )}
          {bodyError && <p className="text-xs text-destructive">{bodyError}</p>}
        </div>

        {/* RIGHT — webcam */}
        <div className="lg:col-span-2">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-ink aspect-video shadow-elegant">
            <video
              ref={videoRef}
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
            />
            {!stream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-primary-foreground/80 gap-3">
                <Camera className="h-10 w-10" />
                <p className="text-sm">Allow camera & microphone to begin</p>
              </div>
            )}

            {/* Top bar */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/40 text-xs">
                {phase === "live" ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-destructive animate-pulse-ring" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                    </span>
                    <span className="font-mono">REC · {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</span>
                  </>
                ) : (
                  <span className="font-mono">{phase === "setup" ? "READY" : phase.toUpperCase()}</span>
                )}
              </div>
              {phase === "live" && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm text-xs">
                  {speechSupported ? <Mic className="h-3 w-3 text-accent" /> : <MicOff className="h-3 w-3 text-muted-foreground" />}
                  <span>{speechSupported ? "Listening" : "Mic not supported"}</span>
                </div>
              )}
            </div>

            {/* Metrics overlay */}
            {(phase === "live" || phase === "setup") && stream && (
              <div className="absolute bottom-4 left-4 hidden sm:block">
                <MetricsOverlay metrics={metrics} />
              </div>
            )}

            {/* Face detection hint */}
            {phase === "live" && !metrics.faceDetected && (
              <div className="absolute inset-x-0 bottom-4 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 mx-auto w-fit px-4 py-2 rounded-full bg-background/90 backdrop-blur-md text-sm">
                Center your face in the frame
              </div>
            )}

            {/* Scoring overlay */}
            {phase === "scoring" && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-md flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-accent" />
                <p className="font-display text-xl">Coach is analyzing your answer…</p>
              </div>
            )}
          </div>

          {/* Mobile metrics */}
          {(phase === "live" || phase === "setup") && stream && (
            <div className="mt-4 sm:hidden">
              <MetricsOverlay metrics={metrics} large />
            </div>
          )}

          {/* Result */}
          {phase === "result" && feedback && (
            <Card className="mt-6 p-6 lg:p-8 animate-fade-up">
              <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Overall score</p>
                  <p className="font-display text-6xl leading-none">{feedback.overall_score}<span className="text-2xl text-muted-foreground">/100</span></p>
                </div>
                {profile?.is_pro && <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-gradient-pro text-primary-foreground"><Sparkles className="h-3 w-3" /> PRO feedback</span>}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-secondary/50">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Strengths</p>
                  <ul className="space-y-1.5 text-sm">
                    {feedback.strengths.map((s, i) => <li key={i} className="flex gap-2"><span className="text-accent">✓</span>{s}</li>)}
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-secondary/50">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Improvements</p>
                  <ul className="space-y-1.5 text-sm">
                    {feedback.improvements.map((s, i) => <li key={i} className="flex gap-2"><span className="text-accent">→</span>{s}</li>)}
                  </ul>
                </div>
              </div>

              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground leading-relaxed">
                {feedback.feedback_markdown}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button onClick={handleNext} className="bg-foreground text-background hover:bg-foreground/90">
                  Practice another <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>View dashboard</Button>
                {!profile?.is_pro && (
                  <Button variant="outline" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground" onClick={() => navigate("/pro")}>
                    <Sparkles className="h-4 w-4 mr-2" /> Unlock deeper feedback
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
