import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  defaultInterviewSetup,
  type InterviewModes,
  type InterviewSetupState,
  type Seniority,
  persistInterviewSetup,
} from "@/lib/interviewSetup";
import { ArrowRight, Mic, Code2, PenLine, Video } from "lucide-react";

const SENIORITY: Array<{ id: Seniority; label: string; hint: string }> = [
  { id: "junior", label: "Junior", hint: "0–2 yrs" },
  { id: "mid", label: "Mid", hint: "2–5 yrs" },
  { id: "senior", label: "Senior", hint: "5–9 yrs" },
  { id: "staff", label: "Staff+", hint: "10+ yrs" },
];

const MODE_DEFS: Array<{ key: keyof InterviewModes; title: string; body: string; icon: typeof Mic }> = [
  { key: "voice", title: "Voice", body: "Spoken Q&A over Gemini Live audio.", icon: Mic },
  { key: "coding", title: "Coding", body: "Lightweight scratch pad for snippets.", icon: Code2 },
  { key: "systemDesign", title: "System design", body: "Notes / whiteboard-style thinking.", icon: PenLine },
  { key: "bodyLanguage", title: "Body language", body: "Webcam frames + on-device metrics.", icon: Video },
];

export default function InterviewSetup() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState<InterviewSetupState>(() => defaultInterviewSetup());

  const durationLabel = useMemo(() => `${setup.durationMin} min`, [setup.durationMin]);

  const toggleMode = (key: keyof InterviewModes) => {
    if (key === "voice") return;
    setSetup((s) => ({ ...s, modes: { ...s.modes, [key]: !s.modes[key] } }));
  };

  const canContinue = setup.jobRole.trim().length > 2;

  const handleContinue = () => {
    if (!canContinue) return;
    const normalized: InterviewSetupState = {
      ...setup,
      jobRole: setup.jobRole.trim(),
      company: setup.company.trim(),
      resumeText: setup.resumeText.trim(),
      modes: { ...setup.modes, voice: true },
    };
    persistInterviewSetup(normalized);
    navigate("/interview/live", { state: { setup: normalized } });
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background via-background to-secondary/20">
      <div className="container max-w-3xl py-12 md:py-16">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-3">Live interview</p>
          <h1 className="font-display text-4xl md:text-5xl tracking-tight">Set the stage.</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            A few details so Poise can run a spontaneous, interruptible voice session — grounded in your background when you share it.
          </p>
        </div>

        <Card className="p-6 md:p-8 border-border/70 shadow-elegant space-y-8">
          <div className="space-y-2">
            <Label htmlFor="job-role">Job role (required)</Label>
            <Input
              id="job-role"
              value={setup.jobRole}
              onChange={(e) => setSetup((s) => ({ ...s, jobRole: e.target.value }))}
              placeholder="Senior Frontend Engineer"
              autoComplete="organization-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company (optional)</Label>
            <Input
              id="company"
              value={setup.company}
              onChange={(e) => setSetup((s) => ({ ...s, company: e.target.value }))}
              placeholder="Stripe, Anthropic, …"
              autoComplete="organization"
            />
          </div>

          <div className="space-y-3">
            <Label>Seniority</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SENIORITY.map((s) => {
                const selected = setup.seniority === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSetup((prev) => ({ ...prev, seniority: s.id }))}
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                      selected ? "border-primary ring-2 ring-primary/20 bg-blue-soft" : "border-border hover:border-primary/25"
                    }`}
                  >
                    <p className="font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <Label>Duration</Label>
              <p className="text-sm font-mono text-primary font-semibold">{durationLabel.toUpperCase()}</p>
            </div>
            <Slider
              value={[setup.durationMin]}
              min={10}
              max={90}
              step={5}
              onValueChange={([v]) => setSetup((s) => ({ ...s, durationMin: v ?? s.durationMin }))}
            />
            <p className="text-xs text-muted-foreground">Between 10 and 90 minutes — Poise will pace follow-ups for the window you pick.</p>
          </div>

          <div className="space-y-3">
            <Label>Interview modes</Label>
            <div className="grid sm:grid-cols-2 gap-3">
              {MODE_DEFS.map((m) => {
                const on = setup.modes[m.key];
                const locked = m.key === "voice";
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={locked}
                    onClick={() => toggleMode(m.key)}
                    className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                      on ? "border-primary ring-2 ring-primary/20 bg-blue-soft" : "border-border hover:border-primary/25"
                    } ${locked ? "opacity-95 cursor-default" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-lg bg-secondary p-2 text-primary">
                        <m.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{m.title}{locked ? " (on)" : ""}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-snug">{m.body}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resume">Résumé / background (optional)</Label>
            <Textarea
              id="resume"
              value={setup.resumeText}
              onChange={(e) => setSetup((s) => ({ ...s, resumeText: e.target.value }))}
              placeholder="Paste résumé text — the interviewer will ask grounded follow-ups based on your real experience."
              className="min-h-[140px] resize-y"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Voice interviews stream microphone audio to Google Gemini Live. Webcam frames are only sent when body language mode is on.
            </p>
            <Button
              size="lg"
              className="shrink-0 shadow-md"
              disabled={!canContinue}
              onClick={handleContinue}
            >
              Enter live room <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
