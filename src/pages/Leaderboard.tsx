import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy } from "lucide-react";

type Row = {
  id: string;
  display_name: string | null;
  overall_score: number;
  job_role: string | null;
  company: string | null;
  seniority: string | null;
  duration_minutes: number | null;
  interview_modes: unknown;
  created_at: string;
};

export default function Leaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: qErr } = await supabase
        .from("leaderboard_entries")
        .select("id, display_name, overall_score, job_role, company, seniority, duration_minutes, interview_modes, created_at")
        .order("overall_score", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        setRows([]);
      } else {
        setRows((data ?? []) as Row[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="container py-10 md:py-14">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Community</p>
            <h1 className="font-display text-4xl md:text-5xl tracking-tight flex items-center gap-3">
              <Trophy className="h-9 w-9 text-primary" /> Leaderboard
            </h1>
            <p className="mt-3 text-muted-foreground leading-relaxed max-w-2xl">
              Recent live interview scores (overall coach score). No transcripts are shown here — only what you choose to surface when you finish a session.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/interview">Start a live interview</Link>
          </Button>
        </div>

        <Card className="p-0 overflow-hidden border-border/70">
          {loading && (
            <div className="p-10 flex items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading scores…
            </div>
          )}
          {!loading && error && (
            <div className="p-8 text-sm text-destructive">
              {error}
              <p className="mt-2 text-muted-foreground">
                If you just added this table, run the latest Supabase migration and refresh RLS policies.
              </p>
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div className="p-10 text-center text-muted-foreground text-sm">No scores yet — be the first to post one from a live interview.</div>
          )}
          {!loading && !error && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Seniority</th>
                    <th className="px-4 py-3">Modes</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.id} className="border-t border-border/60 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-3 font-mono text-mint font-bold">{Math.round(r.overall_score)}</td>
                      <td className="px-4 py-3">{r.display_name ?? "Anonymous"}</td>
                      <td className="px-4 py-3">{r.job_role ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.company ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.seniority ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {Array.isArray(r.interview_modes) ? (r.interview_modes as string[]).join(", ") : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
