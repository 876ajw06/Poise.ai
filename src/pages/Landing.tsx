import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Camera, Brain, Sparkles, CheckCircle2 } from "lucide-react";
import heroImg from "@/assets/hero-portrait.jpg";
import { CATEGORIES } from "@/lib/categories";
import { useAuth } from "@/hooks/useAuth";

export default function Landing() {
  const { user } = useAuth();
  const ctaTo = user ? "/practice" : "/auth?mode=signup";

  return (
    <main>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-hero grain">
        <div className="container py-20 md:py-28 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/60 bg-background/60 backdrop-blur-sm mb-6">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent animate-pulse-ring" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              <span className="text-xs font-medium tracking-wide uppercase">AI body-language coaching</span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tight">
              Interview like<br />
              <span className="italic text-accent">you mean it.</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
              Your camera reads your eye contact, posture, and energy in real time.
              Our AI coach grades your answers and shows you exactly how to improve —
              before the interview that matters.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-foreground text-background hover:bg-foreground/90 group">
                <Link to={ctaTo}>
                  Start a free practice session
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#how">How it works</a>
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" /> No webcam data leaves your device</div>
              <div className="hidden sm:flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" /> Free forever</div>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[3/4] rounded-3xl overflow-hidden shadow-elegant">
              <img
                src={heroImg}
                alt="Confident professional in mid-interview"
                className="w-full h-full object-cover"
                width={1080}
                height={1440}
              />
              {/* Floating metric chip */}
              <div className="absolute top-6 left-6 bg-background/90 backdrop-blur-md rounded-xl px-3 py-2 border border-border/60 shadow-md animate-fade-up" style={{ animationDelay: "300ms" }}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Eye contact</div>
                <div className="font-mono text-2xl text-accent">92</div>
              </div>
              <div className="absolute bottom-6 right-6 bg-background/90 backdrop-blur-md rounded-xl px-3 py-2 border border-border/60 shadow-md animate-fade-up" style={{ animationDelay: "500ms" }}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overall</div>
                <div className="font-mono text-2xl text-foreground">87<span className="text-sm text-muted-foreground">/100</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 md:py-28 border-t border-border/60">
        <div className="container">
          <div className="max-w-2xl">
            <p className="text-sm uppercase tracking-widest text-muted-foreground mb-3">How it works</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">Three signals. <span className="italic">One coach.</span></h2>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              { icon: Camera, title: "Real-time body language", body: "MediaPipe runs in your browser to track eye contact, head stability, posture, and warmth — no video ever uploaded." },
              { icon: Brain, title: "AI content coaching", body: "Speak your answer; we transcribe it and grade structure, clarity, and STAR framing using Lovable AI." },
              { icon: Sparkles, title: "A score that matters", body: "Every session gets a single number, concrete strengths, and a rewrite path — saved to your dashboard." },
            ].map((c, i) => (
              <div key={i} className="p-7 rounded-2xl bg-card border border-border/60 hover:border-foreground/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center mb-5">
                  <c.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-2xl mb-2">{c.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="py-20 md:py-28 border-t border-border/60 bg-secondary/30">
        <div className="container">
          <div className="max-w-2xl mb-12">
            <p className="text-sm uppercase tracking-widest text-muted-foreground mb-3">What you can practice</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight">Pick a track. <span className="italic">Get sharper.</span></h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map((c) => (
              <Link
                key={c.id}
                to={user ? `/practice?cat=${c.id}` : "/auth?mode=signup"}
                className="group p-6 rounded-2xl bg-background border border-border/60 hover:border-accent/60 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="font-display text-2xl">{c.label}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-sm text-muted-foreground">{c.blurb}</p>
                <p className="text-xs text-muted-foreground/70 mt-3 font-mono">{c.questions.length} questions</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PRO */}
      <section className="py-20 md:py-28 border-t border-border/60">
        <div className="container max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-pro text-primary-foreground text-xs font-medium tracking-wide uppercase mb-6">
            <Sparkles className="h-3 w-3" /> Poise Pro · powered by XRPL
          </div>
          <h2 className="font-display text-4xl md:text-6xl tracking-tight">
            Pay with XRP.<br />
            <span className="italic text-accent">Get a deeper coach.</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Send 1 XRP from any wallet to unlock 30 days of extended AI feedback,
            full STAR-format model answers, and weekly progress reports.
            Verified on-ledger — no card, no subscription, no middleman.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="bg-gradient-pro text-primary-foreground hover:opacity-90">
              <Link to={user ? "/pro" : "/auth?mode=signup"}>Unlock Pro <Sparkles className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Poise. Built for the interview that changes everything.</p>
          <p className="font-mono text-xs">v1 · made with Lovable</p>
        </div>
      </footer>
    </main>
  );
}
