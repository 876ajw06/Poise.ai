import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ArrowRight, Sparkles, Trophy, Calendar, Target } from "lucide-react";

type SessionRow = {
  id: string;
  category: string;
  question: string;
  overall_score: number | null;
  eye_contact_score: number | null;
  posture_score: number | null;
  smile_score: number | null;
  stability_score: number | null;
  ai_feedback: string | null;
  created_at: string;
  duration_seconds: number | null;
};

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("interview_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setSessions(data as SessionRow[]);
        setLoading(false);
      });
  }, [user]);

  const avg = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + (s.overall_score ?? 0), 0) / sessions.length)
    : 0;
  const best = sessions.reduce((m, s) => Math.max(m, s.overall_score ?? 0), 0);
  const chartData = [...sessions].reverse().map((s, i) => ({
    n: i + 1,
    score: s.overall_score ?? 0,
    date: new Date(s.created_at).toLocaleDateString(),
  }));

  return (
    <main className="container py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back{profile?.display_name ? `, ${profile.display_name}` : ""}.</p>
          <h1 className="font-display text-4xl tracking-tight">Your progress</h1>
        </div>
        <div className="flex gap-2">
          {!profile?.is_pro && (
            <Button asChild variant="outline" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
              <Link to="/pro"><Sparkles className="h-4 w-4 mr-2" /> Go Pro</Link>
            </Button>
          )}
          <Button asChild className="bg-foreground text-background hover:bg-foreground/90">
            <Link to="/practice">New session <ArrowRight className="h-4 w-4 ml-2" /></Link>
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Stat icon={Calendar} label="Sessions" value={sessions.length} />
        <Stat icon={Target} label="Average score" value={avg ? `${avg}/100` : "—"} />
        <Stat icon={Trophy} label="Best score" value={best ? `${best}/100` : "—"} accent />
      </div>

      {sessions.length > 1 && (
        <Card className="p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Score trend</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="n" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--accent))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--accent))" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <div>
        <h2 className="font-display text-2xl mb-4">Recent sessions</h2>
        {loading && <p className="text-muted-foreground">Loading…</p>}
        {!loading && sessions.length === 0 && (
          <Card className="p-12 text-center">
            <p className="font-display text-2xl mb-2">No sessions yet</p>
            <p className="text-muted-foreground mb-6">Run your first practice — it takes about 2 minutes.</p>
            <Button asChild className="bg-foreground text-background hover:bg-foreground/90">
              <Link to="/practice">Start practicing</Link>
            </Button>
          </Card>
        )}
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card key={s.id} className="p-5 hover:border-foreground/30 transition-colors">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary capitalize">{s.category}</span>
                    <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                  </div>
                  <p className="font-medium leading-snug">{s.question}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-3xl leading-none">{s.overall_score ?? "—"}<span className="text-sm text-muted-foreground">/100</span></p>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1">
                    EC {s.eye_contact_score ?? 0} · P {s.posture_score ?? 0} · S {s.smile_score ?? 0} · St {s.stability_score ?? 0}
                  </div>
                </div>
              </div>
              {s.ai_feedback && (
                <details className="mt-3 group">
                  <summary className="text-sm text-accent cursor-pointer hover:underline">View coach feedback</summary>
                  <div className="mt-3 p-4 rounded-lg bg-secondary/40 text-sm whitespace-pre-wrap leading-relaxed">{s.ai_feedback}</div>
                </details>
              )}
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: any; accent?: boolean }) {
  return (
    <Card className={`p-5 ${accent ? "bg-gradient-ink text-primary-foreground border-transparent" : ""}`}>
      <div className="flex items-center gap-3 mb-1">
        <Icon className={`h-4 w-4 ${accent ? "text-gold" : "text-muted-foreground"}`} />
        <p className={`text-xs uppercase tracking-widest ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</p>
      </div>
      <p className="font-display text-3xl">{value}</p>
    </Card>
  );
}
