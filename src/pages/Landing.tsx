import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Camera, Brain, Sparkles, CheckCircle2, TrendingUp } from "lucide-react";
import heroImg from "@/assets/hero-portrait.jpg";
import { CATEGORIES } from "@/lib/categories";
import { useAuth } from "@/hooks/useAuth";

export default function Landing() {
  const { user } = useAuth();
  const ctaTo = user ? "/practice" : "/auth?mode=signup";
  const liveTo = user ? "/interview" : "/auth?mode=signup";

  return (
    <main className="overflow-x-hidden">
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-hero grain min-h-[calc(100vh-4.25rem)] md:min-h-0">
        <div className="container py-16 md:py-24 lg:py-28 grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          <div className="lg:col-span-6 animate-fade-up z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-soft text-primary text-xs font-semibold tracking-wide mb-6 border border-primary/10">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary/40 animate-pulse-ring" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              AI-powered interview &amp; body-language coaching
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-[3.35rem] xl:text-7xl font-extrabold leading-[1.05] tracking-tight text-foreground">
              Land the role{" "}
              <span className="text-primary">faster</span>
              <br />
              with <span className="text-coral">live AI coaching</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Your camera tracks eye contact, posture, and presence in real time. Speak your answers — we transcribe, score, and show you exactly how to improve before the interview that counts.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="shadow-md group">
                <Link to={ctaTo}>
                  Start free practice
                  <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-primary/20 bg-card/80 backdrop-blur-sm">
                <Link to={liveTo}>
                  Live voice interview
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <a href="#how">How it works</a>
              </Button>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-mint shrink-0" /> Webcam analysis stays on your device
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-mint shrink-0" /> Free tier always available
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 relative min-h-[420px] lg:min-h-[480px]">
            {/* Decorative floating cards (Nexus-style) */}
            <div className="absolute inset-0 flex items-center justify-center lg:justify-end pointer-events-none select-none">
              <div className="relative w-full max-w-md aspect-[4/5] lg:translate-x-4">
                <div className="absolute -top-2 -left-4 md:left-0 z-20 w-[88%] rounded-2xl bg-card border border-border/80 shadow-elegant p-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center font-display font-bold text-sm">P</div>
                    <div>
                      <p className="text-xs text-muted-foreground">Practice session</p>
                      <p className="font-semibold text-sm">Senior PM — behavioral</p>
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Your fit score</p>
                      <p className="font-display text-3xl font-extrabold text-mint">97%</p>
                    </div>
                    <div className="flex-1 pt-4">
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full w-[97%] rounded-full bg-mint" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute top-[38%] -right-2 md:right-0 z-30 w-[72%] ml-auto rounded-2xl bg-card border border-border/80 shadow-elegant p-3 animate-fade-up" style={{ animationDelay: "200ms" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Interview score</span>
                    <TrendingUp className="h-4 w-4 text-mint" />
                  </div>
                  <p className="font-display text-4xl font-extrabold text-foreground">
                    87<span className="text-lg text-muted-foreground font-semibold">/100</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Eye contact &amp; clarity trending up</p>
                </div>

                <div className="absolute bottom-6 left-2 md:left-4 z-10 w-[78%] rounded-2xl bg-card/95 backdrop-blur border border-border/80 shadow-lg p-3 animate-fade-up" style={{ animationDelay: "320ms" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Top skills this week</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["STAR stories", "Confidence", "Filler words", "Posture"].map((t) => (
                      <span key={t} className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-soft text-primary">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="relative z-0 mx-auto w-[70%] aspect-[3/4] rounded-3xl overflow-hidden shadow-elegant border border-border/60 mt-8">
                  <img src={heroImg} alt="Confident professional in mid-interview" className="w-full h-full object-cover" width={1080} height={1440} />
                  <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-md rounded-xl px-3 py-2 border border-border/60 shadow-sm">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Live eye contact</div>
                    <div className="font-mono text-2xl font-bold text-primary">92</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 md:py-28 border-t border-border/60 bg-background">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">How it works</p>
            <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              Three signals. <span className="text-coral">One clear path.</span>
            </h2>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              { icon: Camera, title: "Real-time body language", body: "MediaPipe runs in your browser for eye contact, stability, posture, and warmth — video never leaves your device.", tag: "On-device" },
              { icon: Brain, title: "AI content coaching", body: "We transcribe your spoken answers and coach structure, clarity, and STAR framing with actionable rewrites.", tag: "Content" },
              { icon: Sparkles, title: "Scores that compound", body: "Every session lands a single score, strengths, improvements, and history on your dashboard.", tag: "Progress" },
            ].map((c, i) => (
              <div key={i} className="p-8 rounded-2xl bg-card border border-border/80 shadow-sm hover:shadow-md hover:border-primary/20 transition-all">
                <span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full bg-mint-soft text-mint mb-4">{c.tag}</span>
                <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center mb-5 text-primary">
                  <c.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl font-bold mb-2">{c.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm md:text-base">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="py-20 md:py-28 border-t border-border/60 bg-secondary/40">
        <div className="container">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Practice tracks</p>
            <h2 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              Pick a lane. <span className="text-primary">Get sharper.</span>
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map((c) => (
              <Link
                key={c.id}
                to={user ? `/practice?cat=${c.id}` : "/auth?mode=signup"}
                className="group p-6 rounded-2xl bg-card border border-border/80 hover:border-primary/25 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="font-display text-xl font-bold">{c.label}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.blurb}</p>
                <p className="text-xs text-muted-foreground/80 mt-3 font-mono">{c.questions.length} questions</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PRO */}
      <section className="py-20 md:py-28 border-t border-border/60 bg-background">
        <div className="container max-w-4xl">
          <div className="rounded-3xl bg-gradient-brand-panel text-primary-foreground p-10 md:p-14 text-center shadow-elegant relative overflow-hidden grain">
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold tracking-wide uppercase mb-6">
                <Sparkles className="h-3 w-3" /> Poise Pro · XRPL
              </div>
              <h2 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight">
                Pay with XRP.
                <br />
                <span className="text-white/90">Unlock a deeper coach.</span>
              </h2>
              <p className="mt-6 text-base md:text-lg text-primary-foreground/85 max-w-2xl mx-auto leading-relaxed">
                Send 1 XRP from any wallet for 30 days of extended AI feedback, full STAR-format model answers, and richer session breakdowns — verified on-ledger.
              </p>
              <div className="mt-8">
                <Button asChild size="lg" variant="secondary" className="shadow-lg">
                  <Link to={user ? "/pro" : "/auth?mode=signup"}>
                    Unlock Pro <Sparkles className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10 bg-secondary/30">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Poise. Built for the interview that changes everything.</p>
          <p className="font-mono text-xs">v1</p>
        </div>
      </footer>
    </main>
  );
}
